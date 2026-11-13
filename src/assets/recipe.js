/*
  Recipe page actions: Copy link (desktop), Share (mobile, falls back to copy) and Print.
  Everything else on the page is static HTML written by the build.
*/
(function () {
  'use strict';
  var copyNote = document.getElementById('copy-note');
  var copyBtn = document.getElementById('copy');
  var title = document.querySelector('.recipe-intro h1').textContent;

  function copy() {
    var href = location.href;
    var done = function () { copyBtn.textContent = 'Link copied'; copyNote.textContent = 'Link copied to clipboard.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(href).then(done, function () { copyNote.textContent = 'Copy failed. Use your browser\'s address bar.'; });
    } else {
      copyNote.textContent = 'Copy is not available here. Use your browser\'s address bar.';
    }
  }

  copyBtn.addEventListener('click', copy);
  document.getElementById('share').addEventListener('click', function () {
    if (navigator.share) navigator.share({ title: title, url: location.href }).catch(function () {});
    else copy();
  });
  document.getElementById('print').addEventListener('click', function () { window.print(); });
})();
