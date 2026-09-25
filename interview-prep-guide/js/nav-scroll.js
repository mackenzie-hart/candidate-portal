/** Toggles .scrolled on .page-nav once the user scrolls past the top of the page. */
(function () {
  var nav = document.querySelector('.page-nav');
  if (!nav) return;
  var THRESHOLD = 8;

  function update() {
    nav.classList.toggle('scrolled', window.scrollY > THRESHOLD);
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
})();

/**
 * On mobile location pages the nav collapses into a floating back button
 * (see the .page-location .page-nav mobile rules in site.css). Hide it
 * while scrolling down, reveal it while scrolling up — the CSS transition
 * gives the reveal a slight overshoot so it reads as "dropping in".
 */
(function () {
  var nav = document.querySelector('.page-location .page-nav');
  if (!nav) return;
  var MOBILE_BREAKPOINT = 720;
  var REVEAL_THRESHOLD = 60;
  var lastY = window.scrollY;

  function update() {
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      nav.classList.remove('nav-hidden');
      lastY = window.scrollY;
      return;
    }
    var y = window.scrollY;
    var scrollingDown = y > lastY;
    if (y <= REVEAL_THRESHOLD) {
      nav.classList.remove('nav-hidden');
    } else if (scrollingDown) {
      nav.classList.add('nav-hidden');
    } else {
      nav.classList.remove('nav-hidden');
    }
    lastY = y;
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
})();
