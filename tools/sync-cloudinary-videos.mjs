import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';

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

function configureCloudinary() {
  const required = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')}. Copy .env.example to .env and add your Cloudinary settings.`
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
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
        const priority = (name) => {
          if (/^video-web\./i.test(name)) return 0;
          if (/^video\./i.test(name)) return 1;
          return 2;
        };
        const leftPreferred = priority(left.name);
        const rightPreferred = priority(right.name);
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

function uploadLargeVideo(video, sha256) {
  return new Promise((resolveUpload, rejectUpload) => {
    cloudinary.uploader.upload_chunked(
      video.path,
      {
        resource_type: 'video',
        public_id: `sams-portfolio/${video.project}/video`,
        overwrite: true,
        invalidate: true,
        chunk_size: 10 * 1024 * 1024,
        context: `sha256=${sha256}|original_filename=${video.filename}`
      },
      (error, result) => {
        if (error) rejectUpload(error);
        else if (result?.done === false) return;
        else resolveUpload(result);
      }
    );
  });
}

async function syncVideos() {
  loadLocalEnv();
  configureCloudinary();
  const manifest = readManifest();
  const videos = await findProjectVideos();

  if (!videos.length) {
    console.log('No project videos found.');
    return;
  }

  for (const video of videos) {
    const fileStats = await stat(video.path);
    const sha256 = await hashFile(video.path);
    const extension = extname(video.filename).toLowerCase();
    const current = manifest[video.project];

    if (current?.sha256 === sha256 && current?.url) {
      console.log(`[${video.project}] Unchanged; already uploaded.`);
      continue;
    }

    console.log(
      `[${video.project}] Uploading ${relative(appRoot, video.path)} (${(fileStats.size / 1048576).toFixed(1)} MB)...`
    );
    const result = await uploadLargeVideo(video, sha256);
    if (!result?.secure_url) {
      throw new Error(`Cloudinary did not return a delivery URL for ${video.project}.`);
    }

    manifest[video.project] = {
      url: result.secure_url,
      type: mimeTypes[extension] || 'video/mp4',
      filename: video.filename,
      size: result.bytes || fileStats.size,
      sha256,
      publicId: result.public_id,
      version: result.version,
      width: result.width,
      height: result.height,
      duration: result.duration,
      format: result.format
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
