/* Good Stuff Software geo beacon loader.
 * Add to any site with:
 *   <script src="https://beacon.goodstuff.software/beacon.js" data-site="starrupture" defer></script>
 * Fires once per page load. Bot-free (only real browsers run this). No cookies, no PII sent. */
(function () {
  try {
    var s = document.currentScript
    var site = (s && s.getAttribute('data-site')) || location.hostname.split('.')[0]
    var u =
      'https://beacon.goodstuff.software/b?site=' +
      encodeURIComponent(site) +
      '&path=' +
      encodeURIComponent(location.pathname)
    new Image().src = u
  } catch (e) {
    /* no-op */
  }
})()
