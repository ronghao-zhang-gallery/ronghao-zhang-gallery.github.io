(function () {
  'use strict';

  /* =============================================
     MOBILE MENU
     ============================================= */
  var menuToggle = document.getElementById('menu-toggle');
  var siteNav    = document.getElementById('site-nav');

  if (menuToggle && siteNav) {
    menuToggle.addEventListener('click', function () {
      var open = siteNav.classList.toggle('open');
      menuToggle.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', function (e) {
      if (!siteNav.contains(e.target) && !menuToggle.contains(e.target)) {
        siteNav.classList.remove('open');
        menuToggle.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* =============================================
     HERO SLIDESHOW (home page)
     ============================================= */
  var heroSlideshow = document.getElementById('hero-slideshow');

  if (heroSlideshow) {
    var slides     = Array.from(heroSlideshow.querySelectorAll('.hero-slide'));
    var indicators = Array.from(document.querySelectorAll('.indicator'));
    var captionEl  = document.getElementById('hero-caption');
    var current    = 0;
    var timer      = null;
    var ANIMS      = ['anim-zoom-in', 'anim-zoom-out', 'anim-ltr', 'anim-rtl'];

    function randomAnim() { return ANIMS[Math.floor(Math.random() * ANIMS.length)]; }

    function applyAnim(slide) {
      ANIMS.forEach(function (a) { slide.classList.remove(a); });
      // Force reflow so removing + re-adding restarts the animation
      void slide.offsetWidth;
      slide.classList.add(randomAnim());
    }

    function updateCaption(slide) {
      if (!captionEl) return;
      var t = captionEl.querySelector('.caption-title');
      var c = captionEl.querySelector('.caption-category');
      if (t) t.textContent = slide.dataset.title    || '';
      if (c) c.textContent = slide.dataset.category || '';
    }

    function goTo(index) {
      slides[current].classList.remove('active');
      ANIMS.forEach(function (a) { slides[current].classList.remove(a); });
      if (indicators[current]) indicators[current].classList.remove('active');
      current = (index + slides.length) % slides.length;
      applyAnim(slides[current]);
      slides[current].classList.add('active');
      if (indicators[current]) indicators[current].classList.add('active');
      updateCaption(slides[current]);
    }

    function startTimer() { timer = setInterval(function () { goTo(current + 1); }, 5500); }
    function resetTimer()  { clearInterval(timer); startTimer(); }

    indicators.forEach(function (btn, idx) {
      btn.addEventListener('click', function () { goTo(idx); resetTimer(); });
    });

    // Wire hero prev/next arrows
    var heroPrev = document.getElementById('hero-prev');
    var heroNext = document.getElementById('hero-next');
    if (heroPrev) heroPrev.addEventListener('click', function () { goTo(current - 1); resetTimer(); });
    if (heroNext) heroNext.addEventListener('click', function () { goTo(current + 1); resetTimer(); });

    // Trigger first-slide Ken Burns: add .active after first paint so the
    // CSS transition actually fires (instead of starting already in the active state).
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        goTo(0);
        startTimer();
      });
    });
  }

  /* =============================================
     SIDEBAR — collapsible section toggles
     ============================================= */
  var sectionToggles = Array.from(document.querySelectorAll('.sidebar-section-toggle'));

  sectionToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var section = btn.closest('.sidebar-section');
      var isOpen  = section.classList.contains('open');

      // Close all sections, then open clicked one (accordion behaviour)
      sectionToggles.forEach(function (b) {
        b.closest('.sidebar-section').classList.remove('open');
      });

      if (!isOpen) {
        section.classList.add('open');
      }
    });
  });

  /* =============================================
     GALLERY FILTER
     ============================================= */
  var allSidebarLinks  = Array.from(document.querySelectorAll('.sidebar-link'));
  var photoCards       = Array.from(document.querySelectorAll('.photo-card'));
  var galleryTitleEl   = document.getElementById('gallery-title');

  function activateFilter(target) {
    photoCards.forEach(function (card) {
      card.classList.toggle('hidden', target !== 'all' && card.dataset.subproject !== target);
    });
  }

  function setActiveLink(link) {
    allSidebarLinks.forEach(function (l) { l.classList.remove('active'); });
    link.classList.add('active');
  }

  // Read URL param on load to pre-filter (used when navigating from another category)
  if (photoCards.length) {
    var params = new URLSearchParams(window.location.search);
    var initialSub = params.get('sub');

    if (initialSub) {
      // Find matching sidebar link for this sub-project
      var matchingLink = allSidebarLinks.find(function (l) {
        return l.dataset.subproject === initialSub;
      });

      if (matchingLink) {
        setActiveLink(matchingLink);
        activateFilter(initialSub);

        // Update title
        if (galleryTitleEl) {
          galleryTitleEl.textContent = matchingLink.textContent.trim();
        }

        // Ensure the section containing this link is open
        var parentSection = matchingLink.closest('.sidebar-section');
        if (parentSection) {
          sectionToggles.forEach(function (b) {
            b.closest('.sidebar-section').classList.remove('open');
          });
          parentSection.classList.add('open');
        }
      }
    }

    // Sidebar link click handler
    allSidebarLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        // Links pointing to other pages use default navigation — don't intercept
        if (!link.hasAttribute('data-subproject')) return;

        e.preventDefault();
        var target = link.dataset.subproject;

        setActiveLink(link);
        activateFilter(target);

        if (galleryTitleEl) {
          galleryTitleEl.textContent = (target === 'all')
            ? link.closest('.sidebar-section').querySelector('.sidebar-section-toggle span').textContent.trim()
            : link.textContent.trim();
        }

        // Clean the URL param so it doesn't confuse future state
        var url = new URL(window.location);
        if (target === 'all') {
          url.searchParams.delete('sub');
        } else {
          url.searchParams.set('sub', target);
        }
        window.history.replaceState({}, '', url);
      });
    });
  }

  /* =============================================
     LIGHTBOX
     ============================================= */
  var lightbox         = document.getElementById('lightbox');
  var lightboxBackdrop = document.getElementById('lightbox-backdrop');

  if (lightbox && photoCards.length) {
    var lbImg   = document.getElementById('lightbox-img');
    var lbClose = document.getElementById('lightbox-close');
    var lbPrev  = document.getElementById('lightbox-prev');
    var lbNext  = document.getElementById('lightbox-next');

    var fields = {
      title: document.getElementById('lightbox-title'),
      location: document.getElementById('lightbox-location'),
      iso: document.getElementById('lightbox-iso'),
      aperture: document.getElementById('lightbox-aperture'),
      exposure: document.getElementById('lightbox-exposure'),
      camera: document.getElementById('lightbox-camera'),
      lens: document.getElementById('lightbox-lens'),
      date: document.getElementById('lightbox-date'),
    };

    var visibleCards = [];
    var currentIdx   = 0;

    function getVisible() {
      return photoCards.filter(function (c) { return !c.classList.contains('hidden'); });
    }

    function populate(card) {
      if (lbImg) { lbImg.src = card.dataset.full || card.dataset.thumbnail || ''; lbImg.alt = card.dataset.title || ''; }
      Object.keys(fields).forEach(function (k) {
        if (fields[k]) fields[k].textContent = card.dataset[k] || '';
      });
    }

    function openLightbox(card) {
      visibleCards = getVisible();
      currentIdx   = visibleCards.indexOf(card);
      populate(card);
      lightbox.classList.add('visible');
      lightboxBackdrop.classList.add('visible');
      document.body.style.overflow = 'hidden';
      if (lbClose) lbClose.focus();
    }

    function closeLightbox() {
      lightbox.classList.remove('visible');
      lightboxBackdrop.classList.remove('visible');
      document.body.style.overflow = '';
      if (lbImg) { lbImg.src = ''; lbImg.alt = ''; }
    }

    function navigate(dir) {
      visibleCards = getVisible();
      currentIdx   = (currentIdx + dir + visibleCards.length) % visibleCards.length;
      populate(visibleCards[currentIdx]);
    }

    photoCards.forEach(function (card) {
      card.addEventListener('click', function () { openLightbox(card); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(card); }
      });
    });

    if (lbClose)    lbClose.addEventListener('click', closeLightbox);
    if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
    if (lbPrev)     lbPrev.addEventListener('click', function () { navigate(-1); });
    if (lbNext)     lbNext.addEventListener('click', function () { navigate(1); });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('visible')) return;
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });
  }

})();
