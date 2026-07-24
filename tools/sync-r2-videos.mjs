import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = join(appRoot, 'projects');
const manifestPath = join(appRoot, 'video-manifest.json');
const envPath = join(appRoot, '.env');
const supportedExtensions = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv']);
const mimeTypes = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.ogv': 'video/ogg'
};

function loadLocalEnv() {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    value = value.replace(/^(['"])(.*)\1$/, '$2');
    if (!(name in process.env)) process.env[name] = value;
  }
}

function requireR2Config() {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_PUBLIC_BASE_URL'
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')}. Copy .env.example to .env and add your R2 settings.`
    );
  }

  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
  };
}

function readManifest() {
  if (!existsSync(manifestPath)) return {};
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error('video-manifest.json is not valid JSON.');
  }
}

function writeManifest(manifest) {
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right))
  );
  writeFileSync(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function findProjectVideos() {
  const entries = await readdir(projectsRoot, { withFileTypes: true });
  const projectFolders = entries.filter((entry) => entry.isDirectory());
  const videos = [];

  for (const folder of projectFolders) {
    const folderPath = join(projectsRoot, folder.name);
    const files = await readdir(folderPath, { withFileTypes: true });
    const candidates = files
      .filter((file) => file.isFile() && supportedExtensions.has(extname(file.name).toLowerCase()))
      .sort((left, right) => {
        const leftPreferred = /^video\./i.test(left.name) ? 0 : 1;
        const rightPreferred = /^video\./i.test(right.name) ? 0 : 1;
        return leftPreferred - rightPreferred || left.name.localeCompare(right.name);
      });

    if (!candidates.length) continue;
    const selected = candidates[0];
    videos.push({
      project: folder.name,
      filename: selected.name,
      path: join(folderPath, selected.name)
    });
    if (candidates.length > 1) {
      console.warn(`[${folder.name}] Multiple videos found; using ${selected.name}.`);
    }
  }

  return videos;
}

function publicObjectUrl(baseUrl, key) {
  return `${baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function syncVideos() {
  loadLocalEnv();
  const config = requireR2Config();
  const manifest = readManifest();
  const videos = await findProjectVideos();
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  if (!videos.length) {
    console.log('No project videos found.');
    return;
  }

  for (const video of videos) {
    const fileStats = await stat(video.path);
    const sha256 = await hashFile(video.path);
    const extension = extname(video.filename).toLowerCase();
    const objectKey = `projects/${video.project}/${video.filename}`;
    const current = manifest[video.project];

    if (current?.sha256 === sha256 && current?.url) {
      console.log(`[${video.project}] Unchanged; already uploaded.`);
      continue;
    }

    console.log(
      `[${video.project}] Uploading ${relative(appRoot, video.path)} (${(fileStats.size / 1048576).toFixed(1)} MB)...`
    );
    let lastPercent = -1;
    const upload = new Upload({
      client,
      params: {
        Bucket: config.bucket,
        Key: objectKey,
        Body: createReadStream(video.path),
        ContentType: mimeTypes[extension] || 'application/octet-stream',
        ContentDisposition: 'inline',
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: { sha256 }
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: false
    });

    upload.on('httpUploadProgress', ({ loaded = 0, total = fileStats.size }) => {
      const percent = Math.floor((loaded / total) * 100);
      if (percent >= lastPercent + 5 || percent === 100) {
        process.stdout.write(`  ${percent}%\n`);
        lastPercent = percent;
      }
    });

    const result = await upload.done();
    manifest[video.project] = {
      url: publicObjectUrl(config.publicBaseUrl, objectKey),
      type: mimeTypes[extension] || 'application/octet-stream',
      filename: video.filename,
      size: fileStats.size,
      sha256,
      etag: result.ETag?.replaceAll('"', '') || ''
    };
    writeManifest(manifest);
    console.log(`[${video.project}] Uploaded and manifest updated.`);
  }
}

let syncQueue = Promise.resolve();
function queueSync() {
  syncQueue = syncQueue
    .catch(() => {})
    .then(syncVideos)
    .catch((error) => {
      console.error(`Video sync failed: ${error.message}`);
    });
}

if (process.argv.includes('--watch')) {
  console.log('Watching project folders for videos. Press Ctrl+C to stop.');
  let debounceTimer = null;
  watch(projectsRoot, { recursive: true }, (_event, filename) => {
    if (!filename || !supportedExtensions.has(extname(filename).toLowerCase())) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(queueSync, 1200);
  });
  queueSync();
} else {
  await syncVideos();
}
