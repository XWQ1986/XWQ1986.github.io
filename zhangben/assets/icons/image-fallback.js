(() => {
  'use strict';
  const source = document.currentScript && document.currentScript.src;
  const assetRoot = new URL('.', source || new URL('assets/icons/image-fallback.js', document.baseURI));
  function recover(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.xzFallbackApplied) return;
    image.dataset.xzFallbackApplied = 'true';
    const avatar = /avatar/i.test(image.className) || image.closest('[class*="avatar"]');
    const brand = image.closest('.brand-mark, .fresh-brand-mark, .platform-modal-brand');
    image.classList.add(avatar ? 'xz-avatar-fallback' : 'xz-image-fallback');
    image.src = new URL(avatar ? 'user.svg' : brand ? '../yellow/logo.svg' : 'image-placeholder.svg', assetRoot).href;
    if (!avatar && !brand) image.title = image.alt || '图片暂时无法加载';
  }
  document.addEventListener('error', event => recover(event.target), true);
  function inspect() {
    document.querySelectorAll('img').forEach(image => {
      if (image.complete && image.getAttribute('src') && !image.naturalWidth) recover(image);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inspect, { once: true });
  else inspect();
})();
