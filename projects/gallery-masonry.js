(function(){
  // Project registry and masonry layout
  const PROJECTS = [
    { id: '01', url: '01-Grasshopper.html', label: 'Computational Design' },
    { id: '02', url: '02-Stone-Veil.html', label: 'Stone Veil' },
    { id: '03', url: '03-Adda.html', label: 'Adda' },
    { id: '04', url: '04-Kelip.html', label: 'Kelip' },
    { id: '05', url: '05-Aliwal-Music-House.html', label: 'Aliwal Music House' },
    { id: '06', url: '06-Tobara.html', label: 'Tobara' },
  ];

  function getCurrentProjectIndex() {
    return PROJECTS.findIndex((project) => location.pathname.includes(project.url));
  }

  function applyMasonry(grid) {
    const rowHeight = parseInt(getComputedStyle(grid).getPropertyValue('--gallery-row-height')) || 220;
    const colWidth = parseInt(getComputedStyle(grid).getPropertyValue('--gallery-column-width')) || 12;
    const gap = parseInt(getComputedStyle(grid).getPropertyValue('gap')) || 24;
    const items = Array.from(grid.querySelectorAll('.gallery-item'));
 
    items.forEach(item => {
      const img = item.querySelector('img');
      if (!img) return;
      // ensure image is loaded to get natural sizes
      if (!img.naturalWidth) return img.onload = () => applyMasonry(grid);
      const aspect = img.naturalWidth / img.naturalHeight;
      const idealWidth = Math.round(aspect * rowHeight);
      // compute span: include gap in calculation roughly
      const span = Math.max(1, Math.round((idealWidth + gap) / (colWidth + gap)));
      item.style.gridColumnEnd = `span ${span}`;
      item.style.gridRowEnd = `span 1`;
    });
  }

  function refreshAll() {
    document.querySelectorAll('.gallery-grid').forEach(applyMasonry);
  }

  window.addEventListener('load', refreshAll);
  window.addEventListener('resize', debounce(refreshAll, 120));

  function debounce(fn, wait){
    let t;
    return function(){
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), wait);
    }
  }

  const navEntry = performance.getEntriesByType('navigation')[0];
  const isBackForward = navEntry?.type === 'back_forward';
  const isReturningFromHome = sessionStorage.getItem('returningToHome') === 'true';

  let loaderInterval = null;
  let loaderProgress = 0;

  async function waitForHeroImage() {
    const heroImg = document.querySelector('.hero-image img');

    if (!heroImg) return;

    if (typeof heroImg.decode === 'function') {
      try {
        await heroImg.decode();
      } catch (error) {
        // Ignore decode failures and continue with the page load.
      }
    }

    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  // Page entrance loader
  function getProjectVinylSource() {
    const match = location.pathname.match(/(\d{2})/);
    if (match) {
      const id = match[1];
      return `../${id}_Vinyl.png`;
    }

    const heroImg = document.querySelector('.hero-image img');
    return heroImg?.getAttribute('src') || '';
  }

  function createProjectLoader() {
    if (document.getElementById('project-page-loader')) return;

    const loader = document.createElement('div');
    loader.id = 'project-page-loader';

    const vinylSource = getProjectVinylSource();
    const heroImg = document.querySelector('.hero-image img');

    loader.innerHTML = `
      <div class="project-loader-shell">
        <div class="project-loader-vinyl" aria-hidden="true">
          <img class="vinyl-image" src="${vinylSource}" alt="Loading vinyl record">
        </div>
        <div id="project-loader-percent">0%</div>
      </div>
    `;

    const loaderImage = loader.querySelector('.vinyl-image');
    if (loaderImage && heroImg) {
      loaderImage.onerror = () => {
        loaderImage.src = heroImg.getAttribute('src') || '';
      };
    }

    document.body.appendChild(loader);
    return loader;
  }

  function removeProjectLoader() {
    const loader = document.getElementById('project-page-loader');
    if (!loader) return;

    loader.classList.add('hidden');
    window.setTimeout(() => {
      loader.remove();
    }, 1000);
  }

  function finishProjectLoader() {
    const loader = document.getElementById('project-page-loader');
    const percentText = document.getElementById('project-loader-percent');

    if (loaderInterval) {
      clearInterval(loaderInterval);
      loaderInterval = null;
    }

    loaderProgress = 100;
    if (percentText) {
      percentText.textContent = '100%';
    }

    document.body.classList.remove('loading');
    document.body.classList.add('page-loaded');
    initVinyl();
    initProjectLightbox();
    removeProjectLoader();
  }

  function startProjectLoader() {
    createProjectLoader();
    document.body.classList.add('loading');

    const loader = document.getElementById('project-page-loader');
    const percentText = document.getElementById('project-loader-percent');

    loaderProgress = 0;
    if (percentText) {
      percentText.textContent = '0%';
    }

    loaderInterval = setInterval(() => {
      loaderProgress = Math.min(loaderProgress + 1, 98);

      if (percentText) {
        percentText.textContent = `${loaderProgress}%`;
      }
    }, 20);

    waitForHeroImage().then(() => {
      finishProjectLoader();
    });
  }

  if (isBackForward || isReturningFromHome) {
    sessionStorage.removeItem('returningToHome');
    document.body.classList.remove('loading');
    document.body.classList.add('page-loaded');
    initVinyl();
    initProjectLightbox();
    removeProjectLoader();
  } else {
    startProjectLoader();
  }

  window.addEventListener('pageshow', (event) => {
    const persisted = event.persisted;
    const currentNavEntry = performance.getEntriesByType('navigation')[0];
    const persistedBackForward = currentNavEntry?.type === 'back_forward';

    if (persisted || persistedBackForward) {
      finishProjectLoader();
    }
  });

  /* Inject a spinning vinyl on project pages using the hero image */
  // Previous/next project vinyl navigation
  function initVinyl(){
    if(!document.querySelector('.project-page')) return;
    const heroImg = document.querySelector('.hero-image img');
    if(!heroImg) return;

    // avoid creating multiple times
    if(document.querySelector('.project-vinyl')) return;

    const currentProjectIndex = getCurrentProjectIndex();
    const previousProject = PROJECTS[(currentProjectIndex - 1 + PROJECTS.length) % PROJECTS.length];
    const nextProject = PROJECTS[(currentProjectIndex + 1) % PROJECTS.length];
    const header = document.querySelector('.project-header-bar');

    if (header && currentProjectIndex !== -1 && !header.querySelector('.mobile-project-nav')) {
      if (!header.querySelector('.project-index')) {
        const index = document.createElement('span');
        index.className = 'project-index';
        index.textContent = `${String(currentProjectIndex + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')}`;
        header.appendChild(index);
      }

      const mobileNav = document.createElement('nav');
      mobileNav.className = 'mobile-project-nav';
      mobileNav.setAttribute('aria-label', 'Project navigation');

      const previousButton = document.createElement('a');
      previousButton.className = 'mobile-project-nav-btn mobile-project-nav-prev';
      previousButton.href = previousProject.url;
      previousButton.textContent = '<';
      previousButton.setAttribute('aria-label', `Previous project: ${previousProject.label}`);

      const nextButton = document.createElement('a');
      nextButton.className = 'mobile-project-nav-btn mobile-project-nav-next';
      nextButton.href = nextProject.url;
      nextButton.textContent = '>';
      nextButton.setAttribute('aria-label', `Next project: ${nextProject.label}`);

      mobileNav.appendChild(previousButton);
      mobileNav.appendChild(nextButton);
      header.insertBefore(mobileNav, header.querySelector('.header-icon'));
    }

    const vinyl = document.createElement('div');
    vinyl.className = 'project-vinyl';

    // create inner image element to match main page structure
    const img = document.createElement('img');
    img.className = 'vinyl-image';
    vinyl.appendChild(img);

    document.body.appendChild(vinyl);

    // Derive project id (e.g. "01") from filename and prefer project vinly asset
    const match = location.pathname.match(/(\d{2})/);
    let vinylSrc = '';
    if(match){
      const id = match[1];
      // project pages live in /projects/, vinyl assets are at root one level up
      vinylSrc = `../${id}_Vinyl.png`;
    }

    // fallback to hero image if project-specific vinyl isn't available (onerror will handle it)
    img.src = vinylSrc || heroImg.getAttribute('src') || '';
    img.onerror = () => { img.src = heroImg.getAttribute('src') || ''; };

    // set size larger by default; can be tweaked per-project by changing the variable
    vinyl.style.setProperty('--vinyl-size', '400px');

    const createNavVinyl = (project, direction) => {
      if (!project || currentProjectIndex === -1) return null;

      const link = document.createElement('a');
      link.className = `project-nav-vinyl project-nav-vinyl-${direction}`;
      link.href = project.url;
      link.setAttribute('aria-label', `${direction === 'previous' ? 'Previous' : 'Next'} project: ${project.label}`);
      link.title = `${direction === 'previous' ? 'Previous' : 'Next'} project: ${project.label}`;

      const record = document.createElement('span');
      record.className = 'project-nav-vinyl-record';

      const linkImg = document.createElement('img');
      linkImg.className = 'vinyl-image';
      linkImg.src = `../${project.id}_Vinyl.png`;
      linkImg.alt = '';
      linkImg.onerror = () => { linkImg.src = heroImg.getAttribute('src') || ''; };

      const label = document.createElement('span');
      label.className = 'project-nav-vinyl-label';
      label.innerHTML = `
        <small>${direction === 'previous' ? 'Previous project' : 'Next project'}</small>
        <strong>${project.label}</strong>
      `;

      record.appendChild(linkImg);
      link.appendChild(record);
      link.appendChild(label);
      document.body.appendChild(link);
      return link;
    };

    createNavVinyl(previousProject, 'previous');
    createNavVinyl(nextProject, 'next');

    let rafId = null;
    function updateRotation(){
      const rotation = window.scrollY * 0.18; // tweak speed here
      // include translateX(40%) so only 60% of the vinyl is visible
      vinyl.style.setProperty('--vinyl-rotation', `${rotation}deg`);
      rafId = null;
    }

    window.addEventListener('scroll', () => {
      if(rafId) return;
      rafId = requestAnimationFrame(updateRotation);
    }, {passive: true});

    // initial position
    requestAnimationFrame(updateRotation);
  }

  // Accessible image lightbox
  function initProjectLightbox() {
    if (document.querySelector('.project-lightbox')) return;

    const images = Array.from(document.querySelectorAll('.feature-image img, .gallery-grid img'));
    if (!images.length) return;

    let activeImageIndex = 0;
    let previousFocus = null;

    const lightbox = document.createElement('div');
    lightbox.className = 'project-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Project image viewer');
    lightbox.innerHTML = `
      <button type="button" class="lightbox-btn lightbox-close" aria-label="Close image viewer">X</button>
      <button type="button" class="lightbox-btn lightbox-prev" aria-label="Previous image">&lt;</button>
      <figure class="lightbox-figure">
        <img class="lightbox-image" alt="">
        <figcaption class="lightbox-caption">
          <span class="lightbox-count"></span>
          <span class="lightbox-caption-text"></span>
        </figcaption>
      </figure>
      <button type="button" class="lightbox-btn lightbox-next" aria-label="Next image">&gt;</button>
    `;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector('.lightbox-image');
    const captionText = lightbox.querySelector('.lightbox-caption-text');
    const lightboxCount = lightbox.querySelector('.lightbox-count');
    const closeButton = lightbox.querySelector('.lightbox-close');
    const prevButton = lightbox.querySelector('.lightbox-prev');
    const nextButton = lightbox.querySelector('.lightbox-next');

    let imageTransitionTimer = null;
    const renderImage = (direction = 0, immediate = false) => {
      const image = images[activeImageIndex];
      const updateImage = () => {
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt || 'Project image';
        lightboxCount.textContent = `${String(activeImageIndex + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
        captionText.textContent = image.alt || 'Project image';
        lightboxImage.style.setProperty('--lightbox-direction', direction);
        lightboxImage.classList.remove('is-changing');
      };

      clearTimeout(imageTransitionTimer);
      if (immediate) {
        updateImage();
        return;
      }

      lightboxImage.classList.add('is-changing');
      imageTransitionTimer = window.setTimeout(updateImage, 150);
    };

    const closeLightbox = () => {
      lightbox.classList.remove('open');
      document.body.classList.remove('lightbox-open');
      if (previousFocus) previousFocus.focus();
    };

    const openLightbox = (index, trigger) => {
      activeImageIndex = index;
      previousFocus = trigger;
      renderImage(0, true);
      lightbox.classList.add('open');
      document.body.classList.add('lightbox-open');
      closeButton.focus();
    };

    const showPrevious = () => {
      activeImageIndex = (activeImageIndex - 1 + images.length) % images.length;
      renderImage(-1);
    };

    const showNext = () => {
      activeImageIndex = (activeImageIndex + 1) % images.length;
      renderImage(1);
    };

    images.forEach((image, index) => {
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `Open image ${index + 1} of ${images.length}`);
      image.addEventListener('click', () => openLightbox(index, image));
      image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(index, image);
        }
      });
    });

    closeButton.addEventListener('click', closeLightbox);
    prevButton.addEventListener('click', showPrevious);
    nextButton.addEventListener('click', showNext);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (event) => {
      if (!lightbox.classList.contains('open')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showPrevious();
      if (event.key === 'ArrowRight') showNext();
    });
  }

  function initProjectExperience() {
    if (document.body.classList.contains('project-experience-ready')) return;
    document.body.classList.add('project-experience-ready');

    const header = document.querySelector('.project-header-bar');
    const progress = document.createElement('div');
    progress.className = 'project-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<span></span>';
    document.body.appendChild(progress);
    const progressBar = progress.querySelector('span');

    let scrollFrame = null;
    const updateScrollExperience = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      progressBar.style.transform = `scaleX(${Math.min(window.scrollY / maxScroll, 1)})`;
      if (header) header.classList.toggle('is-compact', window.scrollY > 56);
      scrollFrame = null;
    };

    window.addEventListener('scroll', () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(updateScrollExperience);
    }, { passive: true });
    window.addEventListener('resize', updateScrollExperience, { passive: true });
    updateScrollExperience();

    const revealTargets = Array.from(document.querySelectorAll(
      '.hero-image, .hero-copy, .project-metadata, .text-image-section, .project-video-slot, .gallery-section'
    ));
    revealTargets.forEach((element, index) => {
      element.classList.add('reveal-on-scroll');
      element.style.transitionDelay = `${Math.min(index % 3, 2) * 70}ms`;
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px'
      });
      revealTargets.forEach((element) => observer.observe(element));
    } else {
      revealTargets.forEach((element) => element.classList.add('is-visible'));
    }

    if (window.matchMedia('(hover: hover)').matches) {
      window.addEventListener('pointermove', (event) => {
        const navVinyls = Array.from(document.querySelectorAll('.project-nav-vinyl'));
        let nearestVinyl = null;
        let nearestDistance = 160;

        navVinyls.forEach((vinyl) => {
          const bounds = vinyl.getBoundingClientRect();
          const centerX = bounds.left + bounds.width / 2;
          const centerY = bounds.top + bounds.height / 2;
          const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestVinyl = vinyl;
          }
        });

        navVinyls.forEach((vinyl) => {
          vinyl.classList.toggle('is-near', vinyl === nearestVinyl);
        });
      }, { passive: true });

      document.documentElement.addEventListener('mouseleave', () => {
        document.querySelectorAll('.project-nav-vinyl.is-near').forEach((vinyl) => {
          vinyl.classList.remove('is-near');
        });
      });
    }
  }

  async function initLazyProjectVideo() {
    if (document.querySelector('.project-video-slot:not([data-video-placeholder])')) return;

    const heroImage = document.querySelector('.hero-image img');
    const gallerySection = document.querySelector('.gallery-section');
    if (!heroImage || !gallerySection) return;

    const heroUrl = new URL(heroImage.getAttribute('src'), location.href);
    const contentFolder = new URL('./', heroUrl);
    const projectFolder = decodeURIComponent(
      contentFolder.pathname.split('/').filter(Boolean).at(-1) || ''
    );
    const videoNames = ['video.mp4', 'video.webm', 'video.mov', 'video.m4v'];
    let videoUrl = null;
    let videoType = '';

    try {
      const manifestResponse = await fetch(new URL('../video-manifest.json', location.href), {
        cache: 'no-cache'
      });
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        const hostedVideo = manifest[projectFolder];
        if (hostedVideo?.url) {
          videoUrl = new URL(hostedVideo.url);
          videoType = hostedVideo.type || '';
        }
      }
    } catch {
      // Local file previews may not allow fetch; fall back to local detection below.
    }

    for (const filename of videoUrl ? [] : videoNames) {
      if (location.protocol === 'file:') break;
      const candidate = new URL(filename, contentFolder);
      try {
        const response = await fetch(candidate.href, {
          method: 'HEAD',
          cache: 'no-store'
        });
        if (!response.ok) continue;
        videoUrl = candidate;
        videoType = response.headers.get('content-type') || '';
        break;
      } catch {
        // A missing candidate is expected; try the next supported filename.
      }
    }

    if (!videoUrl) return;

    const existingPlaceholders = document.querySelectorAll('.project-video-slot[data-video-placeholder]');
    existingPlaceholders.forEach((placeholder) => placeholder.remove());

    const section = document.createElement('section');
    section.className = 'project-video-slot project-video-lazy reveal-on-scroll';
    section.setAttribute('aria-labelledby', 'project-video-heading');
    section.innerHTML = `
      <div class="video-slot-header">
        <p class="eyebrow">Motion</p>
        <h2 id="project-video-heading">Project Video</h2>
      </div>
      <div class="video-frame">
        <button type="button" class="video-load-button" aria-label="Load and play project video">
          <img src="${heroImage.currentSrc || heroImage.src}" alt="" aria-hidden="true">
          <span class="video-load-overlay">
            <span class="video-play-icon" aria-hidden="true"></span>
          </span>
        </button>
      </div>
    `;
    gallerySection.parentNode.insertBefore(section, gallerySection);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => section.classList.add('is-visible'));
    });

    const frame = section.querySelector('.video-frame');
    const loadButton = section.querySelector('.video-load-button');
    loadButton.addEventListener('click', () => {
      if (frame.classList.contains('is-loaded')) return;

      const video = document.createElement('video');
      video.className = 'project-video-player';
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.disablePictureInPicture = true;
      video.setAttribute('controlsList', 'nodownload noremoteplayback');
      video.setAttribute('disablePictureInPicture', '');
      video.setAttribute('oncontextmenu', 'return false;');
      video.setAttribute('aria-label', 'Project video');

      const source = document.createElement('source');
      source.src = videoUrl.href;
      if (videoType) source.type = videoType;
      video.appendChild(source);

      frame.classList.add('is-loaded');
      frame.replaceChildren(video);
      video.load();
      const playRequest = video.play();
      if (playRequest) playRequest.catch(() => {});
    }, { once: true });
  }

  function protectProjectMedia() {
    document.addEventListener('dragstart', (event) => {
      if (event.target instanceof HTMLImageElement || event.target instanceof HTMLVideoElement) {
        event.preventDefault();
      }
    });

    document.addEventListener('contextmenu', (event) => {
      if (event.target instanceof HTMLImageElement || event.target instanceof HTMLVideoElement) {
        event.preventDefault();
      }
    });

    document.querySelectorAll('img').forEach((image) => {
      image.draggable = false;
    });
  }

  // One-time interaction guidance
  function showProjectInteractionHint() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const storageKey = `projectInteractionHint:${location.pathname}:${isTouch ? 'touch' : 'pointer'}`;
    if (sessionStorage.getItem(storageKey) === 'shown') return;

    const hint = document.createElement('div');
    hint.className = 'project-interaction-hint';
    hint.innerHTML = `
      <span class="project-hint-mark" aria-hidden="true"></span>
      <span>${isTouch
        ? 'SWIPE TO EXPLORE · TAP IMAGES TO EXPAND'
        : 'SCROLL TO EXPLORE · CLICK IMAGES TO EXPAND'}</span>
    `;
    hint.setAttribute('role', 'status');
    document.body.appendChild(hint);
    sessionStorage.setItem(storageKey, 'shown');

    const dismiss = () => {
      hint.classList.remove('visible');
      window.setTimeout(() => hint.remove(), 300);
    };

    requestAnimationFrame(() => hint.classList.add('visible'));
    const timer = window.setTimeout(dismiss, 4200);
    const dismissOnInteraction = () => {
      clearTimeout(timer);
      dismiss();
    };
    window.addEventListener('pointerdown', dismissOnInteraction, { once: true, passive: true });
    window.addEventListener('wheel', dismissOnInteraction, { once: true, passive: true });
    window.addEventListener('keydown', dismissOnInteraction, { once: true });
  }

  initProjectExperience();
  initLazyProjectVideo();
  protectProjectMedia();
  showProjectInteractionHint();
  window.addEventListener('resize', initVinyl);

})();


const returnBtn = document.querySelector('.back-btn');

if (returnBtn) {
  returnBtn.addEventListener('click', () => {
    sessionStorage.setItem('returningToHome', 'true');
  });
}
