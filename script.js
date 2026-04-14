const vinylCollection = document.querySelector('.vinyl-collection');
const vinylContainers = Array.from(document.querySelectorAll('.vinyl-container'));
const vinylCovers = Array.from(document.querySelectorAll('.vinyl-cover'));
const vinyls = Array.from(document.querySelectorAll('.vinyl'));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const itemSpacingX = 320;
const itemSpacingY = 140;
let activeIndex = 0;

const setContainerPositions = () => {
  vinylContainers.forEach((container, index) => {
    container.style.left = `${-index * itemSpacingX}px`;
    container.style.top = `${index * itemSpacingY}px`;
    container.style.zIndex = `${index + 1}`; // stack later containers in front
  });
};

const updateCollectionTransform = () => {
  vinylCollection.style.transform = `translate(-50%, -50%) translate(${activeIndex * itemSpacingX}px, ${-activeIndex * itemSpacingY}px)`;
};

setContainerPositions();
updateCollectionTransform();

window.addEventListener('wheel', (event) => {
  event.preventDefault();

  const direction = event.deltaY > 0 ? -1 : 1;
  activeIndex = clamp(activeIndex + direction, 0, vinylContainers.length - 1);
  updateCollectionTransform();
}, { passive: false });

const aboutMeButton = document.getElementById('about-me-button');
const portfolioButton = document.getElementById('portfolio-button');
const contactButton = document.getElementById('contact-button')
const headerIcon = document.getElementById('header-icon');
const textBox = document.getElementById('text-box');
const aboutMeText = document.getElementById('about-me-text');
const contactOptions = document.getElementById('contact-options');

// Set the "SAM'S PORTFOLIO" button as initially active
portfolioButton.classList.add('active')


const resetView = () => {
    if (textBox) textBox.style.display = 'none';
    if (aboutMeText) aboutMeText.style.display = 'none';
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
    if (aboutMeText) aboutMeText.style.display = 'block';
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

let isNavigating = false;

vinyls.forEach((vinyl) => {
  vinyl.addEventListener('click', () => {
    if (isNavigating) return;
    const targetUrl = vinyl.dataset.projectUrl || 'project.html';
    isNavigating = true;
    document.body.classList.add('transitioning');

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
      clone.classList.add('spin-slow');
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 1200);
    }, { once: true });
  });
});