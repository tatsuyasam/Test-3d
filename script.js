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