/* The twelve original stories. Artwork and attribution stay in their original order. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const language = document.documentElement.lang === 'en' ? 'en' : 'is';
  const copy = JSON.parse($('reader-copy').textContent);
  const t = (key, values = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  const base = new URL(language === 'en' ? '/en/' : '/', location.href);
  const handbook = language === 'en' ? '/handbok/en/' : '/handbok/';
  const assets = new URL('/ARCTIC/', base);
  function moveLegacySection() {
    if (['#mission', '#join', '#workshops', '#faq', '#contact'].includes(location.hash) && !new URL(location.href).searchParams.has('hofundur')) {
      location.replace(`${handbook}${location.hash}`);
      return true;
    }
    return false;
  }
  if (moveLegacySection()) return;
  window.addEventListener('hashchange', moveLegacySection);
  const storageKey = 'arctic.bref.v1';
  const state = { stories: [], story: null, page: 1, token: 0, zoomToken: 0, zoom: 2, libraryScroll: 0 };
  let saved = { pages: {}, last: null };
  try {
    const value = JSON.parse(localStorage.getItem(storageKey));
    if (value && typeof value.pages === 'object' && value.pages) saved = { pages: value.pages, last: value.last };
  } catch { /* Reading works when storage is unavailable. */ }

  const storyURL = (story, page = 1) => {
    const url = new URL(base);
    url.searchParams.set('hofundur', story.id);
    url.searchParams.set('sida', String(page));
    return url.href;
  };
  const assetURL = src => new URL(src, assets).href;
  const boundedPage = (story, value) => Math.min(story.pages.length, Math.max(1, Number.parseInt(value, 10) || 1));
  const resumePage = story => boundedPage(story, saved.pages[story.id]);
  const controls = $('reader-controls');
  let controlsTimer;
  let controlsHovered = false;
  let keyboardNavigation = false;

  function hideControls() {
    if (controls.contains(document.activeElement)) document.activeElement.blur();
    clearTimeout(controlsTimer);
    $('reader').classList.add('controls-hidden');
    controls.inert = true;
    controls.setAttribute('aria-hidden', 'true');
    $('page-art').setAttribute('aria-expanded', 'false');
  }

  function scheduleControlsHide() {
    clearTimeout(controlsTimer);
    if (!state.story || $('reader').dataset.ready !== 'true') return;
    controlsTimer = setTimeout(() => {
      if ($('reader').dataset.ready !== 'true' || document.querySelector('dialog[open]') || controlsHovered || (keyboardNavigation && controls.contains(document.activeElement))) return;
      hideControls();
    }, 3000);
  }

  function showControls() {
    if (!state.story) return;
    $('reader').classList.remove('controls-hidden');
    controls.inert = false;
    controls.removeAttribute('aria-hidden');
    $('page-art').setAttribute('aria-expanded', 'true');
    scheduleControlsHide();
  }

  function toggleControls() {
    if ($('reader').classList.contains('controls-hidden')) showControls();
    else hideControls();
  }
  let announcementTimer;
  const announce = message => {
    clearTimeout(announcementTimer);
    $('action-status').textContent = message;
    announcementTimer = setTimeout(() => { $('action-status').textContent = ''; }, 3000);
  };

  function drawTrail(container, total, current) {
    if (container.children.length !== total) {
      container.replaceChildren(...Array.from({ length: total }, (_, index) => {
        const step = document.createElement('i');
        step.style.setProperty('--drift', `${[0, 2, -1, 1, -2, 1, 0, 2][index % 8]}px`);
        return step;
      }));
    }
    container.dataset.position = String(current);
    [...container.children].forEach((step, index) => {
      step.classList.toggle('is-current', index === current - 1);
      step.classList.toggle('is-before', index < current - 1);
    });
  }

  function updateLibrary() {
    for (const story of state.stories) {
      const card = document.querySelector(`.story-card[data-story="${story.id}"]`);
      if (!card) continue;
      const page = resumePage(story);
      const link = card.querySelector('a');
      const hasPosition = Boolean(saved.pages[story.id]);
      link.href = storyURL(story, page);
      link.setAttribute('aria-label', t('open_story', { author: story.author }) + (hasPosition ? t('saved_place', { page, total: story.pages.length }) : ''));
      card.classList.toggle('has-position', hasPosition);
      const trail = card.querySelector('[data-story-trail]');
      trail.hidden = !hasPosition;
      if (hasPosition) drawTrail(trail, story.pages.length, page);
    }
  }

  function remember(story, page) {
    saved.pages[story.id] = page;
    saved.last = story.id;
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Optional, device-local memory. */ }
    updateLibrary();
  }

  function closeDialogs() {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  }

  function showLibrary({ push = false, message = '', focus = true } = {}) {
    closeDialogs();
    clearTimeout(controlsTimer);
    controlsHovered = false;
    state.token++;
    state.story = null;
    document.body.classList.remove('is-reading');
    $('reader').hidden = true;
    $('library').hidden = false;
    $('library-status').hidden = !message;
    $('library-status').textContent = message;
    document.title = `${copy.title} · The Arctic Comics Journal`;
    document.querySelector('.skip').href = '#library-title';
    updateLibrary();
    if (push) history.pushState(null, '', base);
    if (focus) $('library-title').focus({ preventScroll: true });
    window.scrollTo(0, state.libraryScroll);
  }

  function showStory(story, page, { push = false, focus = false } = {}) {
    const entering = !state.story || state.story.id !== story.id;
    if (!state.story) state.libraryScroll = window.scrollY;
    closeDialogs();
    state.story = story;
    state.page = boundedPage(story, page);
    $('library').hidden = true;
    $('reader').hidden = false;
    document.body.classList.add('is-reading');
    if (entering) showControls();
    document.querySelector('.skip').href = '#reader-author';
    $('reader-author').textContent = story.author;
    document.title = `${story.author} · ${copy.title}`;
    const url = storyURL(story, state.page);
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
    if (entering) buildThumbnails(story);
    renderPage();
    if (focus) $('reader-author').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function renderPage() {
    const { story, page } = state;
    const token = ++state.token;
    const image = $('page-image');
    const data = story.pages[page - 1];
    const description = t('image_alt', { author: story.author, page, total: story.pages.length });
    const position = t('page_of', { page, total: story.pages.length });
    $('reader').dataset.story = story.id;
    $('reader').dataset.page = String(page);
    $('reader').dataset.ready = 'false';
    document.querySelector('.reading-space').setAttribute('aria-busy', 'true');
    $('reader-status').textContent = copy.loading;
    $('page-error').hidden = true;
    $('page-art').disabled = true;
    $('zoom-page').disabled = true;
    $('page-art').hidden = false;
    $('page-art').setAttribute('aria-label', `${copy.toggle_controls} — ${description}`);
    drawTrail($('reader-trail'), story.pages.length, page);
    $('page-counter').setAttribute('aria-label', `${position}. ${copy.overview}`);
    $('previous-page').disabled = page === 1;
    $('next-page').disabled = page === story.pages.length;
    $('reading-progress').setAttribute('aria-valuemax', String(story.pages.length));
    $('reading-progress').setAttribute('aria-valuenow', String(page));
    $('reading-progress').setAttribute('aria-valuetext', position);
    $('reading-progress').firstElementChild.style.width = `${page / story.pages.length * 100}%`;
    document.querySelectorAll('.thumbnail-button').forEach((button, index) => {
      if (index === page - 1) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $('story-end').hidden = true;
    const loader = new Image();
    loader.onload = () => {
      if (token !== state.token) return;
      image.src = loader.src;
      image.width = data.read.width;
      image.height = data.read.height;
      image.alt = description;
      image.hidden = false;
      $('reader').dataset.ready = 'true';
      document.querySelector('.reading-space').setAttribute('aria-busy', 'false');
      $('reader-status').textContent = position;
      $('page-art').disabled = false;
      $('zoom-page').disabled = false;
      if (!$('reader').classList.contains('controls-hidden')) scheduleControlsHide();
      remember(story, page);
      if (page === story.pages.length) showEnding(story);
      const next = story.pages[page];
      if (next) { const preload = new Image(); preload.src = assetURL(next.read.src); }
    };
    loader.onerror = () => {
      if (token !== state.token) return;
      document.querySelector('.reading-space').setAttribute('aria-busy', 'false');
      $('reader-status').textContent = '';
      $('page-art').hidden = true;
      $('page-error').hidden = false;
      showControls();
    };
    loader.src = assetURL(data.read.src);
  }

  function showEnding(story) {
    const next = state.stories[state.stories.indexOf(story) + 1];
    $('story-end').hidden = false;
    $('next-story').hidden = !next;
    if (next) {
      $('next-story').href = storyURL(next, resumePage(next));
      $('next-cover').src = assetURL(next.pages[0].thumb.src);
      $('next-author').textContent = next.author;
    }
  }

  function turn(delta) {
    if (!state.story) return;
    const page = boundedPage(state.story, state.page + delta);
    if (page !== state.page) showStory(state.story, page);
  }

  function buildThumbnails(story) {
    $('pages-title').textContent = story.author;
    $('page-thumbnails').replaceChildren(...story.pages.map((page, index) => {
      const button = document.createElement('button');
      button.className = 'thumbnail-button';
      button.type = 'button';
      button.setAttribute('aria-label', t('page', { page: index + 1 }));
      const image = new Image();
      image.src = assetURL(page.thumb.src);
      image.alt = '';
      image.width = page.thumb.width;
      image.height = page.thumb.height;
      image.loading = 'lazy';
      button.append(image);
      button.addEventListener('click', () => showStory(story, index + 1));
      return button;
    }));
  }

  function openDialog(dialog) {
    showControls();
    clearTimeout(controlsTimer);
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }

  function openPages() {
    if (!state.story) return;
    openDialog($('pages-dialog'));
    const current = $('page-thumbnails').querySelector('[aria-current=page]');
    if (current) current.focus({ preventScroll: true });
  }

  function resizeZoom(value, keepCenter = true) {
    const frame = $('zoom-frame');
    const image = $('zoom-image');
    const centerX = (frame.scrollLeft + frame.clientWidth / 2) / (image.offsetWidth || 1);
    const centerY = (frame.scrollTop + frame.clientHeight / 2) / (image.offsetHeight || 1);
    state.zoom = Math.min(3.5, Math.max(1, value));
    const padding = window.innerWidth <= 720 ? 24 : 48;
    image.style.width = `${Math.max(1, frame.clientWidth - padding) * state.zoom}px`;
    $('zoom-level').textContent = `${Math.round(state.zoom * 100)}%`;
    $('zoom-out').disabled = state.zoom <= 1;
    $('zoom-in').disabled = state.zoom >= 3.5;
    if (keepCenter) {
      frame.scrollLeft = centerX * image.offsetWidth - frame.clientWidth / 2;
      frame.scrollTop = centerY * image.offsetHeight - frame.clientHeight / 2;
    }
  }

  function openZoom() {
    if (!state.story || $('page-art').disabled) return;
    const page = state.story.pages[state.page - 1];
    const token = ++state.zoomToken;
    $('zoom-title').textContent = state.story.author;
    $('zoom-image').src = assetURL(page.read.src);
    $('zoom-image').width = page.read.width;
    $('zoom-image').height = page.read.height;
    $('zoom-image').alt = $('page-image').alt;
    $('zoom-status').textContent = copy.original_loading;
    $('open-original').href = assetURL(page.original.src);
    openDialog($('zoom-dialog'));
    resizeZoom(window.innerWidth <= 720 ? 2 : 1.5, false);
    $('zoom-frame').scrollTo(0, 0);
    const original = new Image();
    original.onload = () => {
      if (token !== state.zoomToken || !$('zoom-dialog').open) return;
      $('zoom-image').src = original.src;
      $('zoom-image').width = page.original.width;
      $('zoom-image').height = page.original.height;
      $('zoom-status').textContent = '';
    };
    original.onerror = () => {
      if (token === state.zoomToken && $('zoom-dialog').open) $('zoom-status').textContent = copy.original_error;
    };
    original.src = assetURL(page.original.src);
  }

  async function share() {
    if (!state.story) return;
    const url = storyURL(state.story, state.page);
    try {
      await navigator.clipboard.writeText(url);
      announce(copy.copied);
      $('share-story').querySelector('span').textContent = copy.copied_button;
      setTimeout(() => { $('share-story').querySelector('span').textContent = copy.share; }, 2000);
    } catch {
      $('share-url').value = url;
      openDialog($('share-dialog'));
      $('share-url').focus();
      $('share-url').select();
    }
  }

  function route({ focus = false } = {}) {
    const params = new URL(location.href).searchParams;
    const id = params.get('hofundur');
    const story = state.stories.find(item => item.id === id || item.legacyKey === id);
    if (story) showStory(story, params.get('sida'), { focus });
    else showLibrary({ focus, message: id ? copy.unknown_story : '' });
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a');
    if (!anchor) return;
    if (!state.stories.length || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href);
    if (url.origin !== base.origin || url.pathname !== base.pathname) return;
    if (url.hash && url.search === location.search) return;
    event.preventDefault();
    const story = state.stories.find(item => item.id === url.searchParams.get('hofundur'));
    if (story) showStory(story, url.searchParams.get('sida'), { push: true, focus: true });
    else showLibrary({ push: true });
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) {
        document.body.classList.remove('dialog-open');
        showControls();
      }
      if (dialog.id === 'zoom-dialog') {
        state.zoomToken++;
        $('zoom-image').removeAttribute('src');
      }
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  $('previous-page').addEventListener('click', () => turn(-1));
  $('next-page').addEventListener('click', () => turn(1));
  $('retry-page').addEventListener('click', renderPage);
  $('page-counter').addEventListener('click', openPages);
  $('zoom-page').addEventListener('click', openZoom);
  $('share-story').addEventListener('click', share);
  $('zoom-out').addEventListener('click', () => resizeZoom(state.zoom - .5));
  $('zoom-in').addEventListener('click', () => resizeZoom(state.zoom + .5));
  controls.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    controlsHovered = true;
    clearTimeout(controlsTimer);
  });
  controls.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    controlsHovered = false;
    scheduleControlsHide();
  });
  controls.addEventListener('focusin', showControls);
  controls.addEventListener('focusout', scheduleControlsHide);
  $('reader').addEventListener('pointerdown', () => { keyboardNavigation = false; });
  $('reader').addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') showControls();
  });
  document.querySelector('.reading-space').addEventListener('click', event => {
    if (!event.target.closest('button,a')) toggleControls();
  });
  window.addEventListener('resize', () => { if ($('zoom-dialog').open) resizeZoom(state.zoom); });
  window.addEventListener('popstate', () => route({ focus: true }));
  document.addEventListener('keydown', event => {
    if (state.story && event.key === 'Tab' && !document.querySelector('dialog[open]')) {
      keyboardNavigation = true;
      showControls();
    }
    if (!state.story || event.defaultPrevented || document.querySelector('dialog[open]') || event.altKey || event.metaKey || event.ctrlKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      turn(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  let gesture = null;
  let suppressClickUntil = 0;
  const pointers = new Set();
  $('page-art').addEventListener('pointerdown', event => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) { gesture = null; suppressClickUntil = performance.now() + 1000; return; }
    if (event.pointerType === 'touch') gesture = { x: event.clientX, y: event.clientY, at: performance.now(), id: event.pointerId };
  });
  $('page-art').addEventListener('pointerup', event => {
    pointers.delete(event.pointerId);
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - gesture.at < 1400) {
      suppressClickUntil = performance.now() + 700;
      turn(dx < 0 ? 1 : -1);
    }
    gesture = null;
  });
  $('page-art').addEventListener('pointercancel', event => { pointers.delete(event.pointerId); gesture = null; });
  $('page-art').addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
    if (event.detail === 0) showControls();
    else toggleControls();
  });

  fetch(new URL('sogur.json', assets)).then(response => {
    if (!response.ok) throw new Error('catalogue');
    return response.json();
  }).then(catalogue => {
    if (!Array.isArray(catalogue.stories) || catalogue.stories.length !== 12) throw new Error('catalogue');
    state.stories = catalogue.stories;
    updateLibrary();
    route();
  }).catch(() => {
    $('library-status').hidden = false;
    $('library-status').textContent = copy.reader_error;
  });
})();
