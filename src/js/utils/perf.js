document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('img:not([loading])');
  images.forEach((img) => {
    if (!img.dataset.priority) {
      img.loading = 'lazy';
      img.decoding = img.decoding || 'async';
    }
  });

  const hydrateDeferredAnimations = () => {
    document.documentElement.classList.add('perf-hydrated');
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(hydrateDeferredAnimations, { timeout: 2000 });
  } else {
    setTimeout(hydrateDeferredAnimations, 1500);
  }
});
