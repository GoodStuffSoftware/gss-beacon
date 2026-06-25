// Cloudflare Snippet — auto-injects the geo beacon into every HTML page served on
// the goodstuff.software zone (starrupture., simpletile., apex…) with ZERO changes
// to the individual site repos. The beacon.js loader derives the site tag from the
// hostname, so no per-site config is needed. Skips the dashboard + beacon hosts.
//
// Deployed via the Snippets API (see gss-beacon deploy notes). Rule: run on all
// requests; the code below filters to HTML responses.
export default {
  async fetch(request) {
    const host = new URL(request.url).hostname
    const response = await fetch(request)
    const ct = response.headers.get('content-type') || ''
    if (!ct.includes('text/html') || host.startsWith('stats.') || host.startsWith('beacon.')) {
      return response
    }
    return new HTMLRewriter()
      .on('head', {
        element(el) {
          el.append('<script src="https://beacon.goodstuff.software/beacon.js" defer></script>', { html: true })
        },
      })
      .transform(response)
  },
}
