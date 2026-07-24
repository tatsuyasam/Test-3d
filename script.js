const vinylCollection = document.querySelector('.vinyl-collection');
const vinylContainers = Array.from(document.querySelectorAll('.vinyl-container'));
const vinylCovers = Array.from(document.querySelectorAll('.vinyl-cover'));
const vinyls = Array.from(document.querySelectorAll('.vinyl'));
const filterButtons = Array.from(document.querySelectorAll('.filter-button'));
const filterDropdown = document.querySelector('.filter-dropdown');
const filterToggle = document.querySelector('.filter-toggle');
const viewButtons = Array.from(document.querySelectorAll('.view-button'));
const galleryView = document.getElementById('gallery-view');
const galleryTrack = document.getElementById('gallery-track');
const galleryCanvas = document.getElementById('gallery-canvas');
const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));

document.body.classList.add('loading');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Calculate responsive spacing based on viewport size and aspect ratio
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
let activeView = 'vinyl';
const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let touchStartY = null;
let touchCurrentY = null;
let touchMoved = false;
let touchAccumulated = 0;
const touchThreshold = 8;
const touchStep = 0.35; // Increased for better responsiveness
let lastTouchedCover = null;
let touchHoverTimeout = null;

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
  vinylCollection.style.transform = `translate(-50%, -50%) translate(${activeIndex * itemSpacingX}px, ${-activeIndex * itemSpacingY}px)`;
};

setContainerPositions();
updateCollectionTransform();

const setActiveView = (view) => {
  activeView = view;
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
  }
};

setActiveView(activeView);

window.addEventListener('touchstart', (event) => {
  if (event.touches.length !== 1) return;
  touchStartY = event.touches[0].clientY;
  touchCurrentY = touchStartY;
  touchMoved = false;
  if (autoScrollAnimationId) {
    cancelAnimationFrame(autoScrollAnimationId);
    autoScrollAnimationId = null;
    activeIndex = clamp(activeIndex, 0, Math.max(getVisibleContainers().length - 1, 0));
  }
}, { passive: false });

window.addEventListener('touchmove', (event) => {
  if (!supportsTouch || touchStartY === null || event.touches.length !== 1) return;
  const touchY = event.touches[0].clientY;
  const deltaY = touchY - touchCurrentY;
  if (Math.abs(deltaY) < 2) return;
  touchMoved = true;
  touchCurrentY = touchY;
  touchAccumulated += deltaY;

  // Prevent tiny micro-movements from triggering scroll changes
  if (Math.abs(touchAccumulated) < touchThreshold) return;

  event.preventDefault();
  vinylCollection.classList.add('scrolling');

  // Reverse the direction so swipe up moves collection forward
  const direction = touchAccumulated > 0 ? -1 : 1;
  activeIndex = clamp(activeIndex + direction * touchStep, 0, Math.max(getVisibleContainers().length - 1, 0));
  updateCollectionTransform();

  // Keep remaining motion for smoother interaction
  touchAccumulated = touchAccumulated > 0 ? touchAccumulated - touchThreshold : touchAccumulated + touchThreshold;
}, { passive: false });

window.addEventListener('touchend', () => {
  touchStartY = null;
  touchCurrentY = null;
  touchMoved = false;
  touchAccumulated = 0;
});

window.addEventListener('touchcancel', () => {
  touchStartY = null;
  touchCurrentY = null;
  touchMoved = false;
  touchAccumulated = 0;
});

// Auto-scroll animation on page load
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

// Start auto-scroll immediately with entrance animation
// autoScrollVinyls();

// Handle window resize to recalculate spacing
window.addEventListener('resize', () => {
  calculateResponsiveSpacing();
  setContainerPositions();
  updateCollectionTransform();
});

let isScrolling = false;
const scrollStep = 0.5; // Smaller fraction per wheel event makes scroll less sensitive

window.addEventListener('wheel', (event) => {
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
const emailbutton = document.querySelector('.email-button');
const linkedinButton = document.querySelector('.linkedin-button');
const instaButton = document.querySelector('.insta-button');

// Set the "SAM'S PORTFOLIO" button as initially active
portfolioButton.classList.add('active')


const resetView = () => {
    if (textBox) textBox.style.display = 'none';
    if (aboutMeText) aboutMeText.classList.remove('visible');
    if (contactOptions) contactOptions.style.display = 'none';
    if (headerIcon) headerIcon.classList.remove('animate');
};
const clearActiveButtons = () => {
    aboutMeButton.classList.remove('active');
    portfolioButton.classList.remove('active');
    contactButton.classList.remove('active');
};
aboutMeButton.addEventListener('click', () => {
    clearActiveButtons();
    aboutMeButton.classList.add('active');
    if (headerIcon) headerIcon.classList.add('animate');
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

if (emailbutton) {
  emailbutton.addEventListener('click', async () => {
    const success = await copyToClipboard('samtzk2006@gmail.com');
    if (!success) return;
    const originalText = emailbutton.textContent;
    emailbutton.textContent = 'Email Copied!';
    clearTimeout(emailbutton._timeout);
    emailbutton._timeout = setTimeout(() => {
      emailbutton.textContent = originalText;
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
let galleryDragOriginScrollLeft = 0;
let galleryDragOriginScrollTop = 0;
let galleryDragOriginTranslateX = 0;
let galleryDragOriginTranslateY = 0;
let galleryPointerActive = false;
const galleryDragThreshold = 6;

// current transform position (we move the canvas opposite the pointer)
let canvasTranslateX = 0;
let canvasTranslateY = 0;

if (galleryTrack) {
  const finishGalleryDrag = () => {
    galleryTrack.classList.remove('dragging');
    galleryPointerActive = false;
    isDraggingGallery = false;
  };

  const beginGalleryDrag = (clientX, clientY) => {
    galleryPointerActive = true;
    isDraggingGallery = false;
    galleryDragStartX = clientX;
    galleryDragStartY = clientY;
    galleryDragOriginScrollLeft = galleryTrack.scrollLeft;
    galleryDragOriginScrollTop = galleryTrack.scrollTop;
    galleryDragOriginTranslateX = canvasTranslateX;
    galleryDragOriginTranslateY = canvasTranslateY;
    galleryTrack.classList.add('dragging');
  };

  const applyCanvasTransform = (x, y) => {
    canvasTranslateX = x;
    canvasTranslateY = y;
    if (galleryCanvas) {
      galleryCanvas.style.transform = `translate(${canvasTranslateX}px, ${canvasTranslateY}px)`;
    } else {
      // fallback to scroll when no canvas present
      galleryTrack.scrollLeft = -canvasTranslateX;
      galleryTrack.scrollTop = -canvasTranslateY;
    }
  };

  const updateGalleryDrag = (clientX, clientY, event) => {
    if (!galleryPointerActive) return;
    const deltaX = clientX - galleryDragStartX;
    const deltaY = clientY - galleryDragStartY;

    if (!isDraggingGallery && (Math.abs(deltaX) > galleryDragThreshold || Math.abs(deltaY) > galleryDragThreshold)) {
      isDraggingGallery = true;
    }

    if (isDraggingGallery) {
      // move canvas opposite to pointer movement to mimic viewport panning
      const nextX = galleryDragOriginTranslateX + deltaX;
      const nextY = galleryDragOriginTranslateY + deltaY;
      applyCanvasTransform(nextX, nextY);
      event.preventDefault();
    }
  };

  galleryTrack.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    beginGalleryDrag(event.clientX, event.clientY);
    event.preventDefault();
  });

  galleryTrack.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    beginGalleryDrag(event.clientX, event.clientY);
    event.preventDefault();
  });

  galleryTrack.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    beginGalleryDrag(event.touches[0].clientX, event.touches[0].clientY);
    event.preventDefault();
  }, { passive: false });

  // prefer pointer events when available
  document.addEventListener('pointermove', (event) => {
    if (!galleryPointerActive) return;
    updateGalleryDrag(event.clientX, event.clientY, event);
  });

  // keep mousemove as fallback for older browsers
  document.addEventListener('mousemove', (event) => {
    if (!galleryPointerActive) return;
    updateGalleryDrag(event.clientX, event.clientY, event);
  });

  galleryTrack.addEventListener('touchmove', (event) => {
    if (!galleryPointerActive || event.touches.length !== 1) return;
    updateGalleryDrag(event.touches[0].clientX, event.touches[0].clientY, event);
  }, { passive: false });

  const endGalleryDrag = () => {
    finishGalleryDrag();
  };

  document.addEventListener('pointerup', (event) => {
    if (!galleryPointerActive) return;
    endGalleryDrag();
  });

  document.addEventListener('pointercancel', () => {
    if (!galleryPointerActive) return;
    endGalleryDrag();
  });

  document.addEventListener('mouseup', (event) => {
    if (!galleryPointerActive) return;
    endGalleryDrag();
  });

  document.addEventListener('touchend', (event) => {
    if (!galleryPointerActive) return;
    endGalleryDrag();
  }, { passive: true });

  document.addEventListener('touchcancel', (event) => {
    if (!galleryPointerActive) return;
    endGalleryDrag();
  }, { passive: true });
}

galleryItems.forEach((item) => {
  item.addEventListener('click', (event) => {
    if (isDraggingGallery) {
      isDraggingGallery = false;
      event.preventDefault();
      return;
    }
    const targetUrl = item.dataset.projectUrl || 'project.html';
    window.location.href = targetUrl;
  });
});

history.pushState(null, null, location.href);

// Desktop + basic back button handling
window.addEventListener("popstate", () => {
  history.pushState(null, null, location.href);
});

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

// Mobile + Safari + GitHub Pages fix
window.addEventListener("pageshow", (event) => {
  const isBackForward =
    event.persisted ||
    performance.getEntriesByType("navigation")[0]?.type === "back_forward";

  if (isBackForward) {
    resetPageState();
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

// ❌ SKIP LOADER CONDITIONS
const skipLoader =
  isReload || isBackForward || isReturningFromProject;

const loader = document.getElementById('loader');
const percentText = document.getElementById('loader-percent');

if (skipLoader) {
  if (loader) loader.remove();
  document.body.classList.remove('loading');
  autoScrollVinyls();
} else {

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
