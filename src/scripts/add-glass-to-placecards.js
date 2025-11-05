// Small script to automatically add the glass-card class to existing placecard elements.
// Include this script on the admin dashboard page (or bundle it).

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.placecard').forEach(el => {
    // Do not double-add if already present
    if (!el.classList.contains('glass-card')) {
      el.classList.add('glass-card');
    }
  });
});