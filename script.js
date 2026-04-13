const vinylCollection = document.querySelector('.vinyl-collection');
const vinylContainers = Array.from(document.querySelectorAll('.vinyl-container'));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const itemSpacingX = 320;
const itemSpacingY = 140;
let activeIndex = 0;

const setContainerPositions = () => {
  vinylContainers.forEach((container, index) => {
    container.style.left = `${-index * itemSpacingX}px`;
    container.style.top = `${index * itemSpacingY}px`;
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
