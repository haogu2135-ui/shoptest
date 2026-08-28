(function () {
  var pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname !== '/' && pathname !== '/index.html') return;

  var currentScript = document.currentScript;
  var scriptPath = currentScript && currentScript.src ? new URL(currentScript.src).pathname : '/home-hero-preload.js';
  var publicRoot = scriptPath.replace(/\/home-hero-preload\.js$/, '');
  var addHeroPreload = function (href, media) {
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.type = 'image/webp';
    link.href = publicRoot + href;
    link.media = media;
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
  };

  addHeroPreload('/assets/home/hero-mobile-pet.webp', '(max-width: 780px)');
  addHeroPreload('/assets/home/hero-dog.webp', '(min-width: 781px)');
}());
