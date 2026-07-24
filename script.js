// ============================================================================
// DOM references and shared utilities
// ============================================================================

const projectDataElement = document.getElementById('project-data');
const projectData = projectDataElement
  ? JSON.parse(projectDataElement.textContent)
  : [];

const renderProjectViews = (projects) => {
  const galleryCanvasElement = document.getElementById('gallery-canvas');
  const vinylCollectionElement = document.getElementById('vinyl-collection');
  if (!galleryCanvasElement || !vinylCollectionElement) return;

  galleryCanvasElement.innerHTML = projects.map((project) => `
    <a
      class="gallery-item"
      href="${project.url}"
      data-categories="${project.categories}"
      style="left: ${project.position.left}; top: ${project.position.top};"
    >
      <img class="gallery-vinyl" src="${project.vinyl}" alt="" aria-hidden="true">
      <img class="gallery-image" src="${project.cover}" alt="${project.alt}">
      <span class="gallery-info">
        <span class="gallery-title">${project.title}</span>
        <span class="gallery-meta">${project.year} · ${project.type}</span>
        <span class="gallery-description">${project.description}</span>
      </span>
    </a>
  `).join('');

  vinylCollectionElement.innerHTML = projects.map((project) => `
    <div class="vinyl-container" data-categories="${project.categories}">
      <div class="vinyl-cover" data-project-name="${project.title}">
        <img class="cover-image" src="${project.cover}" alt="${project.alt}">
        <div class="vinyl" data-project-url="${project.url}">
          <img class="vinyl-image" src="${project.vinyl}" alt="${project.title} vinyl record">
        </div>
        <span class="vinyl-info">
          <strong>${project.title}</strong>
          <small>${project.year} · ${project.type}</small>
          <span>${project.description}</span>
        </span>
      </div>
    </div>
  `).join('');
};

renderProjectViews(projectData);

const vinylCollection = document.querySelector('.vinyl-collection');
const vinylContainers = Array.from(document.querySelectorAll('.vinyl-container'));
const vinylCovers = Array.from(document.querySelectorAll('.vinyl-cover'));
const vinyls = Array.from(document.querySelectorAll('.vinyl'));
const filterButtons = Array.from(document.querySelectorAll('.filter-button'));
const filterDropdown = document.querySelector('.filter-dropdown');
const filterToggle = document.querySelector('.filter-toggle');
let filterCloseTimer = null;
const viewButtons = Array.from(document.querySelectorAll('.view-button'));
const galleryView = document.getElementById('gallery-view');
const galleryTrack = document.getElementById('gallery-track');
const galleryCanvas = document.getElementById('gallery-canvas');
const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
const interactionHint = document.getElementById('interaction-hint');

document.body.classList.add('loading');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const snapToDevicePixel = (value) => {
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.round(value * pixelRatio) / pixelRatio;
};
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================================
// Shared portfolio state and responsive vinyl spacing
// ============================================================================

let itemSpacingX = 320;
let itemSpacingY = 170;

const calculateResponsiveSpacing = () => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const aspectRatio = viewportWidth / viewportHeight;
  
  // On portrait phones and small devices, use exact 45-degree spacing
  if (viewportWidth < 700 && aspectRatio <= 1.05) {
    const spacing = Math.max(viewportWidth * 0.31, 90);
    itemSpacingX = spacing;
    itemSpacingY = spacing;
  }
  // On tablets / larger devices, use medium spacing
  else if (viewportWidth < 900) {
    itemSpacingX = 250;
    itemSpacingY = 125;
  }
  // On desktop (>= 900px), use default spacing
  else {
    itemSpacingX = 290;
    itemSpacingY = 170;
  }
};

calculateResponsiveSpacing();

let activeIndex = 0;
let activeFilter = 'all';
const savedView = sessionStorage.getItem('portfolioView');
let activeView = savedView === 'gallery' || savedView === 'vinyl' ? savedView : 'vinyl';
const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let interactionHintTimer = null;
let interactionHintRetryTimer = null;
let touchStartY = null;
let touchCurrentY = null;
let touchMoved = false;
let touchLastTime = 0;
let touchVelocityY = 0;
const touchThreshold = 8;
let lastTouchedCover = null;
let touchHoverTimeout = null;

const dismissInteractionHint = () => {
  clearTimeout(interactionHintTimer);
  clearTimeout(interactionHintRetryTimer);
  if (!interactionHint) return;
  interactionHint.classList.remove('visible');
  interactionHint.setAttribute('aria-hidden', 'true');
};

// ============================================================================
// Contextual interaction hints
// ============================================================================

const showInteractionHint = (view) => {
  if (!interactionHint) return;

  if (document.body.classList.contains('loading')) {
    clearTimeout(interactionHintRetryTimer);
    interactionHintRetryTimer = setTimeout(() => showInteractionHint(activeView), 350);
    return;
  }

  const inputType = supportsTouch ? 'touch' : 'pointer';
  const storageKey = `interactionHint:${view}:${inputType}`;
  if (sessionStorage.getItem(storageKey) === 'shown') return;

  const hintText = supportsTouch
    ? (view === 'gallery'
      ? 'DRAG TO EXPLORE · PINCH TO ZOOM · TAP TO OPEN'
      : 'SWIPE TO BROWSE · TAP TO PREVIEW · TAP AGAIN TO OPEN')
    : (view === 'gallery'
      ? 'DRAG TO EXPLORE · HOVER TO PREVIEW · CLICK TO OPEN'
      : 'SCROLL TO BROWSE · HOVER TO PREVIEW · CLICK TO OPEN');

  interactionHint.dataset.input = inputType;
  interactionHint.dataset.view = view;
  interactionHint.querySelector('.hint-copy').textContent = hintText;
  interactionHint.setAttribute('aria-hidden', 'false');
  sessionStorage.setItem(storageKey, 'shown');

  requestAnimationFrame(() => interactionHint.classList.add('visible'));
  clearTimeout(interactionHintTimer);
  interactionHintTimer = setTimeout(dismissInteractionHint, 4800);
};

window.addEventListener('pointerdown', dismissInteractionHint, { passive: true });
window.addEventListener('wheel', dismissInteractionHint, { passive: true });
window.addEventListener('keydown', dismissInteractionHint);

const clearTouchHover = () => {
  if (lastTouchedCover) {
    lastTouchedCover.classList.remove('touch-hover');
    lastTouchedCover = null;
  }
  if (touchHoverTimeout) {
    clearTimeout(touchHoverTimeout);
    touchHoverTimeout = null;
  }
};

const setTouchHover = (cover) => {
  clearTouchHover();
  cover.classList.add('touch-hover');
  lastTouchedCover = cover;
  touchHoverTimeout = setTimeout(clearTouchHover, 3000);
};

const animateVinylNavigation = (vinyl, targetUrl) => {
  if (!vinyl || !targetUrl || isNavigating) return;

  sessionStorage.setItem('portfolioView', activeView);

  if (prefersReducedMotion) {
    window.location.href = targetUrl;
    return;
  }

  isNavigating = true;
  document.body.classList.add('transitioning');
  document.body.classList.add('dark-grey-background');

  const rect = vinyl.getBoundingClientRect();
  const image = vinyl.querySelector('.vinyl-image');
  const clone = document.createElement('div');
  clone.classList.add('vinyl-animate', 'fly-right');
  const squareSize = Math.max(rect.width, rect.height);
  clone.style.setProperty('--vinyl-width', `${squareSize}px`);
  clone.style.setProperty('--vinyl-height', `${squareSize}px`);

  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const currentCenterX = rect.left + rect.width / 2;
  const currentCenterY = rect.top + rect.height / 2;
  const translateX = centerX - currentCenterX;
  const translateY = centerY - currentCenterY;

  clone.style.setProperty('--vinyl-translate-x', `${translateX}px`);
  clone.style.setProperty('--vinyl-translate-y', `${translateY}px`);

  const offsetX = (squareSize - rect.width) / 2;
  const offsetY = (squareSize - rect.height) / 2;
  clone.style.top = `${rect.top - offsetY}px`;
  clone.style.left = `${rect.left - offsetX}px`;
  clone.style.width = `${squareSize}px`;
  clone.style.height = `${squareSize}px`;
  clone.style.transform = 'none';
  clone.style.overflow = 'hidden';
  clone.style.borderRadius = '50%';

  if (image) {
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.alt || 'Vinyl record';
    img.className = 'vinyl-image';
    clone.appendChild(img);
  }

  document.body.appendChild(clone);
  vinyl.style.visibility = 'hidden';

  clone.addEventListener('animationend', () => {
    clone.classList.add('spin-continuous');
    requestAnimationFrame(() => {
      window.location.href = targetUrl;
    });
  }, { once: true });
};

// ============================================================================
// Project filtering and view switching
// ============================================================================

if (supportsTouch) {
  document.body.classList.add('touch-device');
}

const getVisibleContainers = () => vinylContainers.filter((container) => {
  if (activeFilter === 'all') return true;
  return (container.dataset.categories || '').split(' ').includes(activeFilter);
});

const getVisibleGalleryItems = () => galleryItems.filter((item) => {
  if (activeFilter === 'all') return true;
  return (item.dataset.categories || '').split(' ').includes(activeFilter);
});

const setContainerPositions = () => {
  const visibleContainers = getVisibleContainers();
  const visibleGalleryItems = getVisibleGalleryItems();

  vinylContainers.forEach((container) => {
    const isVisible = visibleContainers.includes(container);
    container.classList.toggle('filter-hidden', !isVisible);
    container.setAttribute('aria-hidden', String(!isVisible));
  });

  galleryItems.forEach((item) => {
    const isVisible = visibleGalleryItems.includes(item);
    item.classList.toggle('filter-hidden', !isVisible);
    item.setAttribute('aria-hidden', String(!isVisible));
  });

  visibleContainers.forEach((container, index) => {
    container.style.left = `${-index * itemSpacingX}px`;
    container.style.top = `${index * itemSpacingY}px`;
    container.style.zIndex = `${index + 1}`; // stack later containers in front
  });

  activeIndex = clamp(activeIndex, 0, Math.max(visibleContainers.length - 1, 0));
};

const updateCollectionTransform = () => {
  const x = snapToDevicePixel(activeIndex * itemSpacingX);
  const y = snapToDevicePixel(-activeIndex * itemSpacingY);
  vinylCollection.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
};

setContainerPositions();
updateCollectionTransform();

const setActiveView = (view) => {
  activeView = view;
  sessionStorage.setItem('portfolioView', activeView);
  galleryView?.classList.toggle('active', view === 'gallery');
  vinylCollection?.classList.toggle('active', view === 'vinyl');

  viewButtons.forEach((button) => {
    const isActive = button.dataset.view === view;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const viewSwitch = document.querySelector('.view-switch');
  if (viewSwitch) {
    viewSwitch.setAttribute('data-active-view', view);
  }

  if (view === 'vinyl') {
    setContainerPositions();
    updateCollectionTransform();
  } else if (view === 'gallery') {
    requestAnimationFrame(centerGalleryCanvas);
  }

  showInteractionHint(view);
};

setActiveView(activeView);

window.addEventListener('touchstart', (event) => {
  if (activeView !== 'vinyl') return;
  if (event.touches.length !== 1) return;
  touchStartY = event.touches[0].clientY;
  touchCurrentY = touchStartY;
  touchMoved = false;
  touchLastTime = performance.now();
  touchVelocityY = 0;
  vinylCollection.classList.add('scrolling', 'gesturing');
  if (autoScrollAnimationId) {
    cancelAnimationFrame(autoScrollAnimationId);
    autoScrollAnimationId = null;
    activeIndex = clamp(activeIndex, 0, Math.max(getVisibleContainers().length - 1, 0));
  }
}, { passive: false });

window.addEventListener('touchmove', (event) => {
  if (activeView !== 'vinyl') return;
  if (!supportsTouch || touchStartY === null || event.touches.length !== 1) return;
  const touchY = event.touches[0].clientY;
  const deltaY = touchY - touchCurrentY;
  const currentTime = performance.now();
  const elapsed = Math.max(currentTime - touchLastTime, 1);
  touchVelocityY = touchVelocityY * 0.65 + (deltaY / elapsed) * 0.35;
  touchLastTime = currentTime;
  if (Math.abs(deltaY) < 0.5) return;
  touchMoved = true;
  touchCurrentY = touchY;

  event.preventDefault();
  vinylCollection.classList.add('scrolling');

  activeIndex = clamp(
    activeIndex - deltaY / itemSpacingY,
    0,
    Math.max(getVisibleContainers().length - 1, 0)
  );
  updateCollectionTransform();
}, { passive: false });

window.addEventListener('touchend', () => {
  if (activeView !== 'vinyl') return;
  vinylCollection.classList.remove('gesturing');
  const releaseVelocity = touchVelocityY;
  if (touchMoved && Math.abs(releaseVelocity) > 0.06) {
    const coastDirection = releaseVelocity > 0 ? -1 : 1;
    const coastDistance = Math.min(Math.abs(releaseVelocity) * 0.45, 0.28);
    requestAnimationFrame(() => {
      activeIndex = clamp(
        activeIndex + coastDirection * coastDistance,
        0,
        Math.max(getVisibleContainers().length - 1, 0)
      );
      updateCollectionTransform();
    });
  }
  touchStartY = null;
  touchCurrentY = null;
  touchMoved = false;
  touchVelocityY = 0;
});

window.addEventListener('touchcancel', () => {
  if (activeView !== 'vinyl') return;
  vinylCollection.classList.remove('gesturing');
  touchStartY = null;
  touchCurrentY = null;
  touchMoved = false;
  touchVelocityY = 0;
});

// ============================================================================
// Vinyl touch, wheel, and entrance motion
// ============================================================================

let autoScrollAnimationId;
let autoScrollProgress = 0;
const autoScrollVinyls = () => {
  let startTime = performance.now();
  const duration = 1500; // Total animation duration in ms
  const maxScroll = Math.max(getVisibleContainers().length - 2, 0);

  if (prefersReducedMotion) {
    activeIndex = maxScroll;
    updateCollectionTransform();
    return;
  }
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out animation for smooth deceleration
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // Calculate smooth scroll position without rounding
    const scrollAmount = easeProgress * maxScroll;
    autoScrollProgress = scrollAmount;
    vinylCollection.style.transform = `translate(-50%, -50%) translate(${scrollAmount * itemSpacingX}px, ${-scrollAmount * itemSpacingY}px)`;
    
    if (progress < 1) {
      autoScrollAnimationId = requestAnimationFrame(animate);
    } else {
      // Snap to final position
      activeIndex = maxScroll;
      updateCollectionTransform();
    }
  };
  
  autoScrollAnimationId = requestAnimationFrame(animate);
};

window.addEventListener('resize', () => {
  calculateResponsiveSpacing();
  setContainerPositions();
  updateCollectionTransform();
});

const scrollStep = 0.3;

window.addEventListener('wheel', (event) => {
  if (activeView !== 'vinyl') return;
  event.preventDefault();
  
  // Stop auto-scroll if user scrolls manually
  if (autoScrollAnimationId) {
    cancelAnimationFrame(autoScrollAnimationId);
    autoScrollAnimationId = null;
    activeIndex = clamp(autoScrollProgress, 0, vinylContainers.length - 1);
  }

  vinylCollection.classList.add('scrolling');
  const direction = event.deltaY > 0 ? -1 : 1;
  activeIndex = clamp(activeIndex + direction * scrollStep, 0, vinylContainers.length - 1);
  activeIndex = clamp(activeIndex, 0, Math.max(getVisibleContainers().length - 1, 0));
  updateCollectionTransform();
}, { passive: false });

const aboutMeButton = document.getElementById('about-me-button');
const portfolioButton = document.getElementById('portfolio-button');
const contactButton = document.getElementById('contact-button');
const headerIcon = document.getElementById('header-icon');
const textBox = document.getElementById('text-box');
const aboutMeText = document.getElementById('about-me-text');
const award1Button = document.querySelector('.award1-button');
const award2Button = document.querySelector('.award2-button');
const contactOptions = document.getElementById('contact-options');
const emailButton = document.querySelector('.email-button');
const linkedinButton = document.querySelector('.linkedin-button');
const instaButton = document.querySelector('.insta-button');

// ============================================================================
// Header, About, Contact, and external actions
// ============================================================================

portfolioButton.classList.add('active')


const resetView = () => {
    if (textBox) textBox.style.display = 'none';
    if (aboutMeText) aboutMeText.classList.remove('visible');
    if (contactOptions) contactOptions.style.display = 'none';
    if (headerIcon) {
      headerIcon.classList.remove('animate');
      headerIcon.setAttribute('aria-pressed', 'false');
    }
};
const clearActiveButtons = () => {
    aboutMeButton.classList.remove('active');
    portfolioButton.classList.remove('active');
    contactButton.classList.remove('active');
};

const toggleHeaderMark = () => {
    if (!headerIcon) return;
    const isExpanded = headerIcon.classList.toggle('animate');
    headerIcon.setAttribute('aria-pressed', String(isExpanded));
};

if (headerIcon) {
    headerIcon.setAttribute('aria-pressed', 'false');
    headerIcon.addEventListener('click', toggleHeaderMark);
    headerIcon.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleHeaderMark();
    });
}

aboutMeButton.addEventListener('click', () => {
    clearActiveButtons();
    aboutMeButton.classList.add('active');
    if (headerIcon) headerIcon.classList.add('animate');
    if (headerIcon) headerIcon.setAttribute('aria-pressed', 'true');
    document.body.classList.add('dark-grey-background');
    if (textBox) textBox.style.display = 'block';
    if (aboutMeText) aboutMeText.classList.add('visible');
    if (contactOptions) contactOptions.style.display = 'none';
});
portfolioButton.addEventListener('click', () => {
    clearActiveButtons();
    portfolioButton.classList.add('active');
    document.body.classList.remove('dark-grey-background');
    resetView();
});
contactButton.addEventListener('click', () => {
    clearActiveButtons();
    contactButton.classList.add('active');
    document.body.classList.add('dark-grey-background');
    resetView();
    if (contactOptions) contactOptions.style.display = 'flex';
});

viewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveView(button.dataset.view || 'gallery');
  });
});

const closeFilterMenu = () => {
  if (!filterDropdown) return;
  clearTimeout(filterCloseTimer);
  filterDropdown.classList.remove('open');
  if (filterToggle) {
    filterToggle.setAttribute('aria-expanded', 'false');
  }
};

if (filterToggle) {
  filterToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!filterDropdown) return;
    const isOpen = filterDropdown.classList.toggle('open');
    filterToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

if (filterDropdown && window.matchMedia('(hover: hover)').matches) {
  filterDropdown.addEventListener('mouseenter', () => {
    clearTimeout(filterCloseTimer);
  });

  filterDropdown.addEventListener('mouseleave', () => {
    clearTimeout(filterCloseTimer);
    filterCloseTimer = setTimeout(closeFilterMenu, 150);
  });
}

document.addEventListener('click', (event) => {
  if (filterDropdown && !filterDropdown.contains(event.target)) {
    closeFilterMenu();
  }
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((filterButton) => {
      filterButton.classList.remove('active');
      filterButton.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    activeFilter = button.dataset.filter || 'all';
    activeIndex = 0;
    setContainerPositions();
    updateCollectionTransform();
  });
  button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
});

if (award1Button) {
  award1Button.addEventListener('click', () => {
    window.open('https://www.worldskills.sg/skills/all-champions/-/-/digital-construction/gold-award/','_blank','noopener,noreferrer');
  });
}
if (award2Button) {
  award2Button.addEventListener('click', () => {
    window.open('https://seedaward.sg/dbcs-seed-award-winners/2025/','_blank','noopener,noreferrer');
  });
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
};

if (emailButton) {
  emailButton.addEventListener('click', async () => {
    const success = await copyToClipboard('samtzk2006@gmail.com');
    if (!success) return;
    const originalText = emailButton.textContent;
    emailButton.textContent = 'Email Copied!';
    clearTimeout(emailButton._timeout);
    emailButton._timeout = setTimeout(() => {
      emailButton.textContent = originalText;
    }, 2000);
  });
}

if (linkedinButton) {
  linkedinButton.addEventListener('click', () => {
    window.open('https://www.linkedin.com/in/sam-tan-tatsuya/','_blank','noopener,noreferrer');
  });
}

if (instaButton) {
  instaButton.addEventListener('click', () => {
    window.open(
      'https://www.instagram.com/sam_arch.exe/','_blank','noopener,noreferrer');
  });
}


let isNavigating = false;

// ============================================================================
// Vinyl hover, touch preview, and project navigation
// ============================================================================

const customCursorText = document.getElementById('custom-cursor-text');
let cursorTargetX = 0;
let cursorTargetY = 0;
let cursorCurrentX = 0;
let cursorCurrentY = 0;
let cursorAnimationFrame = null;

const easeCursor = () => {
  const ease = 0.16;
  cursorCurrentX += (cursorTargetX - cursorCurrentX) * ease;
  cursorCurrentY += (cursorTargetY - cursorCurrentY) * ease;
  customCursorText.style.left = `${cursorCurrentX}px`;
  customCursorText.style.top = `${cursorCurrentY}px`;
  cursorAnimationFrame = requestAnimationFrame(easeCursor);
};

const updateCursorTarget = (e) => {
  cursorTargetX = e.clientX + 10;
  cursorTargetY = e.clientY + 10;
  if (cursorAnimationFrame === null) {
    cursorAnimationFrame = requestAnimationFrame(easeCursor);
  }
};

vinylCovers.forEach((cover) => {
  cover.addEventListener('click', (event) => {
    if (supportsTouch || event.target.closest('.vinyl')) return;
    const vinyl = cover.querySelector('.vinyl');
    const targetUrl = vinyl?.dataset.projectUrl;
    if (vinyl && targetUrl) {
      animateVinylNavigation(vinyl, targetUrl);
    }
  });

  cover.addEventListener('mouseenter', (e) => {
    const projectName = cover.dataset.projectName;
    if (projectName) {
      customCursorText.textContent = projectName;
      customCursorText.style.display = 'block';
      document.documentElement.style.cursor = 'none';
      cursorCurrentX = e.clientX + 10;
      cursorCurrentY = e.clientY + 10;
      updateCursorTarget(e);
    }
  });

  cover.addEventListener('mousemove', (e) => {
    updateCursorTarget(e);
  });

  cover.addEventListener('mouseleave', () => {
    customCursorText.style.display = 'none';
    document.documentElement.style.cursor = '';
    if (cursorAnimationFrame !== null) {
      cancelAnimationFrame(cursorAnimationFrame);
      cursorAnimationFrame = null;
    }
  });

  cover.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
      touchStartY = event.touches[0].clientY;
      touchCurrentY = touchStartY;
      touchMoved = false;
    }
  }, { passive: true });

  cover.addEventListener('touchend', (event) => {
    if (touchStartY === null) return;
    const touchEndY = event.changedTouches[0].clientY;
    if (Math.abs(touchEndY - touchStartY) > touchThreshold) {
      touchStartY = null;
      return;
    }

    const vinyl = cover.querySelector('.vinyl');
    const targetUrl = vinyl?.dataset.projectUrl;
    if (!targetUrl || isNavigating) {
      touchStartY = null;
      return;
    }

    if (cover.classList.contains('touch-hover')) {
      clearTouchHover();
      animateVinylNavigation(vinyl, targetUrl);
    } else {
      setTouchHover(cover);
    }
    touchStartY = null;
  });
});

document.addEventListener('touchstart', (event) => {
  if (!lastTouchedCover) return;
  if (!lastTouchedCover.contains(event.target)) {
    clearTouchHover();
  }
}, { passive: true });

vinyls.forEach((vinyl) => {
  vinyl.tabIndex = 0;
  vinyl.setAttribute('role', 'button');
  vinyl.setAttribute('aria-label', `Open ${vinyl.closest('.vinyl-cover')?.dataset.projectName || 'project'}`);

  vinyl.addEventListener('click', () => {
    if (isNavigating) return;
    const targetUrl = vinyl.dataset.projectUrl || 'project.html';
    animateVinylNavigation(vinyl, targetUrl);
  });

  vinyl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (isNavigating) return;
    const targetUrl = vinyl.dataset.projectUrl || 'project.html';
    animateVinylNavigation(vinyl, targetUrl);
  });
});



let isDraggingGallery = false;
let galleryDragStartX = 0;
let galleryDragStartY = 0;
let galleryDragOriginTranslateX = 0;
let galleryDragOriginTranslateY = 0;
let galleryPointerActive = false;
let suppressGalleryClick = false;
let gallerySpringTimer = null;
const galleryDragThreshold = 6;

// ============================================================================
// Draggable and pinch-zoomable 2D gallery
// ============================================================================

let canvasTranslateX = 0;
let canvasTranslateY = 0;
let canvasScale = 1;
let galleryRenderFrame = null;

function centerGalleryCanvas() {
  if (!galleryTrack || !galleryCanvas) return;
  canvasTranslateX = snapToDevicePixel((galleryTrack.clientWidth - galleryCanvas.offsetWidth * canvasScale) / 2);
  canvasTranslateY = snapToDevicePixel((galleryTrack.clientHeight - galleryCanvas.offsetHeight * canvasScale) / 2);
  galleryCanvas.classList.add('springing');
  galleryCanvas.style.transform = `translate(${canvasTranslateX}px, ${canvasTranslateY}px) scale(${canvasScale})`;
  window.setTimeout(() => galleryCanvas.classList.remove('springing'), prefersReducedMotion ? 220 : 440);
}

if (galleryTrack) {
  let galleryDragBounds = null;
  let galleryMetrics = null;

  const refreshGalleryMetrics = () => {
    galleryMetrics = {
      trackWidth: galleryTrack.clientWidth,
      trackHeight: galleryTrack.clientHeight,
      canvasWidth: galleryCanvas?.offsetWidth || 0,
      canvasHeight: galleryCanvas?.offsetHeight || 0
    };
  };

  const getGalleryBounds = () => {
    if (!galleryCanvas) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    if (!galleryMetrics) refreshGalleryMetrics();
    const trackWidth = galleryMetrics.trackWidth;
    const trackHeight = galleryMetrics.trackHeight;
    const canvasWidth = galleryMetrics.canvasWidth * canvasScale;
    const canvasHeight = galleryMetrics.canvasHeight * canvasScale;
    const centeredX = (trackWidth - canvasWidth) / 2;
    const centeredY = (trackHeight - canvasHeight) / 2;
    const horizontalAllowance = clamp(trackWidth * 0.3, 180, 420);
    const upwardAllowance = clamp(trackHeight * 0.32, 150, 320);
    const baseMinX = canvasWidth > trackWidth ? trackWidth - canvasWidth : centeredX;
    const baseMaxX = canvasWidth > trackWidth ? 0 : centeredX;
    const baseMinY = canvasHeight > trackHeight ? trackHeight - canvasHeight : centeredY;
    const baseMaxY = canvasHeight > trackHeight ? 0 : centeredY;

    return {
      minX: baseMinX - horizontalAllowance,
      maxX: baseMaxX + horizontalAllowance,
      minY: baseMinY - upwardAllowance,
      maxY: baseMaxY
    };
  };

  const applyEdgeResistance = (value, min, max) => {
    if (value < min) return min + (value - min) * 0.18;
    if (value > max) return max + (value - max) * 0.18;
    return value;
  };

  const applyCanvasTransform = (x, y) => {
    canvasTranslateX = x;
    canvasTranslateY = y;
    if (galleryCanvas) {
      if (galleryRenderFrame !== null) return;
      galleryRenderFrame = requestAnimationFrame(() => {
        const renderedX = snapToDevicePixel(canvasTranslateX);
        const renderedY = snapToDevicePixel(canvasTranslateY);
        galleryCanvas.style.transform = `translate(${renderedX}px, ${renderedY}px) scale(${canvasScale})`;
        galleryRenderFrame = null;
      });
    } else {
      galleryTrack.scrollLeft = -canvasTranslateX;
      galleryTrack.scrollTop = -canvasTranslateY;
    }
  };

  const springGalleryIntoBounds = () => {
    const bounds = getGalleryBounds();
    const targetX = clamp(canvasTranslateX, bounds.minX, bounds.maxX);
    const targetY = clamp(canvasTranslateY, bounds.minY, bounds.maxY);
    if (targetX === canvasTranslateX && targetY === canvasTranslateY) return;

    if (galleryCanvas) {
      galleryCanvas.classList.add('springing');
      clearTimeout(gallerySpringTimer);
      gallerySpringTimer = setTimeout(() => {
        galleryCanvas.classList.remove('springing');
      }, prefersReducedMotion ? 220 : 440);
    }
    applyCanvasTransform(targetX, targetY);
  };

  const finishGalleryDrag = () => {
    galleryTrack.classList.remove('dragging');
    galleryPointerActive = false;
    isDraggingGallery = false;
    springGalleryIntoBounds();
  };

  const beginGalleryDrag = (clientX, clientY) => {
    if (galleryCanvas) galleryCanvas.classList.remove('springing');
    clearTimeout(gallerySpringTimer);
    galleryPointerActive = true;
    isDraggingGallery = false;
    suppressGalleryClick = false;
    galleryDragStartX = clientX;
    galleryDragStartY = clientY;
    galleryDragOriginTranslateX = canvasTranslateX;
    galleryDragOriginTranslateY = canvasTranslateY;
    refreshGalleryMetrics();
    galleryDragBounds = getGalleryBounds();
    galleryTrack.classList.add('dragging');
  };

  const updateGalleryDrag = (clientX, clientY, event) => {
    if (!galleryPointerActive) return;
    const deltaX = clientX - galleryDragStartX;
    const deltaY = clientY - galleryDragStartY;

    if (!isDraggingGallery && (Math.abs(deltaX) > galleryDragThreshold || Math.abs(deltaY) > galleryDragThreshold)) {
      isDraggingGallery = true;
      suppressGalleryClick = true;
    }

    if (isDraggingGallery) {
      const nextX = galleryDragOriginTranslateX + deltaX;
      const nextY = galleryDragOriginTranslateY + deltaY;
      const bounds = galleryDragBounds || getGalleryBounds();
      applyCanvasTransform(
        applyEdgeResistance(nextX, bounds.minX, bounds.maxX),
        applyEdgeResistance(nextY, bounds.minY, bounds.maxY)
      );
      event.preventDefault();
    }
  };

  const endGalleryDrag = () => {
    finishGalleryDrag();
  };

  if (window.PointerEvent) {
    const galleryPointers = new Map();
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let pinchCanvasPointX = 0;
    let pinchCanvasPointY = 0;

    const getPinchGeometry = () => {
      const points = Array.from(galleryPointers.values()).slice(0, 2);
      if (points.length < 2) return null;
      const rect = galleryTrack.getBoundingClientRect();
      const deltaX = points[1].x - points[0].x;
      const deltaY = points[1].y - points[0].y;
      return {
        distance: Math.hypot(deltaX, deltaY),
        centerX: (points[0].x + points[1].x) / 2 - rect.left,
        centerY: (points[0].y + points[1].y) / 2 - rect.top
      };
    };

    const beginGalleryPinch = () => {
      const geometry = getPinchGeometry();
      if (!geometry) return;
      pinchStartDistance = Math.max(geometry.distance, 1);
      pinchStartScale = canvasScale;
      pinchCanvasPointX = (geometry.centerX - canvasTranslateX) / canvasScale;
      pinchCanvasPointY = (geometry.centerY - canvasTranslateY) / canvasScale;
      isDraggingGallery = true;
      suppressGalleryClick = true;
      galleryTrack.classList.add('dragging');
    };

    galleryTrack.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      galleryPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (galleryPointers.size === 1) {
        beginGalleryDrag(event.clientX, event.clientY);
      } else if (galleryPointers.size === 2) {
        beginGalleryPinch();
      }
    });

    document.addEventListener('pointermove', (event) => {
      if (!galleryPointers.has(event.pointerId)) return;
      galleryPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (galleryPointers.size >= 2) {
        const geometry = getPinchGeometry();
        if (!geometry) return;
        canvasScale = clamp(pinchStartScale * (geometry.distance / pinchStartDistance), 0.5, 1.65);
        const nextX = geometry.centerX - pinchCanvasPointX * canvasScale;
        const nextY = geometry.centerY - pinchCanvasPointY * canvasScale;
        const bounds = getGalleryBounds();
        applyCanvasTransform(
          applyEdgeResistance(nextX, bounds.minX, bounds.maxX),
          applyEdgeResistance(nextY, bounds.minY, bounds.maxY)
        );
        event.preventDefault();
      } else if (galleryPointerActive) {
        updateGalleryDrag(event.clientX, event.clientY, event);
      }
    });

    const finishGalleryPointer = (event) => {
      galleryPointers.delete(event.pointerId);
      if (galleryPointers.size === 1) {
        const remainingPoint = Array.from(galleryPointers.values())[0];
        beginGalleryDrag(remainingPoint.x, remainingPoint.y);
        suppressGalleryClick = true;
      } else if (galleryPointers.size === 0) {
        endGalleryDrag();
      }
    };

    document.addEventListener('pointerup', finishGalleryPointer);
    document.addEventListener('pointercancel', finishGalleryPointer);
  } else {
    galleryTrack.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      beginGalleryDrag(event.clientX, event.clientY);
    });

    document.addEventListener('mousemove', (event) => {
      if (!galleryPointerActive) return;
      updateGalleryDrag(event.clientX, event.clientY, event);
    });

    document.addEventListener('mouseup', () => {
      if (!galleryPointerActive) return;
      endGalleryDrag();
    });

    galleryTrack.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) return;
      beginGalleryDrag(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: true });

    galleryTrack.addEventListener('touchmove', (event) => {
      if (!galleryPointerActive || event.touches.length !== 1) return;
      updateGalleryDrag(event.touches[0].clientX, event.touches[0].clientY, event);
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (!galleryPointerActive) return;
      endGalleryDrag();
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
      if (!galleryPointerActive) return;
      endGalleryDrag();
    }, { passive: true });
  }

  window.addEventListener('resize', () => {
    refreshGalleryMetrics();
    springGalleryIntoBounds();
  });
}

galleryItems.forEach((item) => {
  item.addEventListener('click', (event) => {
    if (suppressGalleryClick) {
      suppressGalleryClick = false;
      event.preventDefault();
      return;
    }
    sessionStorage.setItem('portfolioView', 'gallery');
  });
});

// ============================================================================
// Back-navigation recovery and first-visit loader
// ============================================================================

function resetPageState() {
  document.body.classList.remove('transitioning', 'dark-grey-background');

  document.querySelectorAll('.vinyl-animate').forEach(el => el.remove());

  document.querySelectorAll('.vinyl').forEach(vinyl => {
    vinyl.style.visibility = 'visible';
  });

  isNavigating = false;

  if (typeof updateCollectionTransform === "function") {
    updateCollectionTransform();
  }

  document.body.offsetHeight;
}

window.addEventListener("pageshow", (event) => {
  const isBackForward =
    event.persisted ||
    performance.getEntriesByType("navigation")[0]?.type === "back_forward";

  if (isBackForward) {
    resetPageState();
    const restoredView = sessionStorage.getItem('portfolioView');
    if (restoredView === 'gallery' || restoredView === 'vinyl') {
      setActiveView(restoredView);
    }
  }
});


const isReturningFromProject =
  sessionStorage.getItem('returningToHome') === 'true';

sessionStorage.removeItem('returningToHome');

const video = document.getElementById('loader-video');

if (video) {
  video.addEventListener('loadedmetadata', () => {
    video.playbackRate = 1.11;
  });
}

const navEntry = performance.getEntriesByType("navigation")[0];

const isReload = navEntry?.type === "reload";
const isBackForward = navEntry?.type === "back_forward";
const hasVisited = localStorage.getItem('hasVisited') === 'true';

const skipLoader =
  hasVisited || isReload || isBackForward || isReturningFromProject;

const loader = document.getElementById('loader');
const percentText = document.getElementById('loader-percent');

if (skipLoader) {
  if (loader) loader.remove();
  document.body.classList.remove('loading');
  autoScrollVinyls();
} else {

  localStorage.setItem('hasVisited', 'true');
  document.body.classList.add('loading');

  window.addEventListener('load', () => {

    let progress = 0;

    const interval = setInterval(() => {
      progress++;

      if (percentText) {
        percentText.textContent = `${progress}%`;
      }

      if (progress >= 100) {
        clearInterval(interval);

        loader.classList.add('hidden');
        document.body.classList.remove('loading');

        setTimeout(() => {
          loader.remove();
        }, 1000);

        autoScrollVinyls();
      }
    }, 20);

  });
}
