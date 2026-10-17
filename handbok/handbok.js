/* The handbook is readable without JavaScript. This only marks the visible chapter. */
(() => {
  const links = [...document.querySelectorAll('.book-toc li a')];
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of links) {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-5% 0px -70% 0px', threshold: 0 });
  document.querySelectorAll('.book-chapter').forEach(chapter => observer.observe(chapter));
})();
