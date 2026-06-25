/* Good Stuff Software geo beacon loader.
 * Add to any site with:
 *   <script src="https://beacon.goodstuff.software/beacon.js" data-site="starrupture" defer></script>
 * Fires once per page load. Bot-free (only real browsers run this). No cookies; the
 * only first-party storage is a single flag used to tell new vs returning visitors. */
(function () {
  try {
    var s = document.currentScript
    var site = (s && s.getAttribute('data-site')) || location.hostname.split('.')[0]
    var returning = '0'
    try {
      if (localStorage.getItem('_gssb')) returning = '1'
      else localStorage.setItem('_gssb', '1')
    } catch (e) {
      /* storage blocked — treat as new */
    }
    var q =
      '?site=' + encodeURIComponent(site) +
      '&path=' + encodeURIComponent(location.pathname) +
      '&ref=' + encodeURIComponent(document.referrer || '') +
      '&l=' + encodeURIComponent(navigator.language || '') +
      '&sw=' + (window.innerWidth || (window.screen && window.screen.width) || 0) +
      '&nv=' + returning
    new Image().src = 'https://beacon.goodstuff.software/b' + q
  } catch (e) {
    /* no-op */
  }
})()
