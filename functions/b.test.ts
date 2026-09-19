// Unit tests for the in-app-browser classification in b.ts. Run with:
//   node --test functions/b.test.ts
//
// No test framework dependency — Node's built-in `node:test` + `node:assert`, consistent
// with this repo's "no new npm packages" rule for the beacon's hot path.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inAppOf } from './b.ts'

// Real user-agent strings (trimmed to what matters; these are representative, not
// captured verbatim from a device).
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'

const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36'

// A Chrome Custom Tab launches real Chrome, so its UA is byte-for-byte the same string a
// standalone Chrome tab would send — there is nothing in the UA to key off. This is the
// same constant as ANDROID_CHROME on purpose: the test below asserts they classify IDENTICALLY.
const ANDROID_CUSTOM_TAB = ANDROID_CHROME

const ANDROID_FACEBOOK =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/441.0.0.32.113;]'

const ANDROID_INSTAGRAM =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.23.114 Android'

const ANDROID_TIKTOK =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 musical_ly_28.9.0 TikTok_Android'

const ANDROID_LINE =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Line/13.20.0'

const ANDROID_SNAPCHAT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Snapchat/12.60.0.34'

const ANDROID_PINTEREST =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Pinterest/11.30 Android'

const ANDROID_TWITTER =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Twitter for Android'

const ANDROID_GOOGLE_APP =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 GSA/14.34.20.28'

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

// A real iOS in-app WKWebView: no "Safari/" token, unlike every real browser on iOS
// (Mobile Safari and Chrome/Firefox/Edge-for-iOS all append one).
const IOS_WKWEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

const IOS_FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/441.0.0.32.113;FBBV/500594004;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]'

test('plain Android Chrome is not flagged as in-app', () => {
  assert.equal(inAppOf(ANDROID_CHROME), '')
})

test('Android WebView ("; wv") is flagged generic webview', () => {
  assert.equal(inAppOf(ANDROID_WEBVIEW), 'webview')
})

test('Chrome Custom Tab is indistinguishable from plain Chrome by user agent', () => {
  // Documents the limitation from the b.ts comment: Custom Tabs send the exact same UA
  // as standalone Chrome, so this MUST classify identically to plain Chrome, not 'webview'.
  assert.equal(inAppOf(ANDROID_CUSTOM_TAB), inAppOf(ANDROID_CHROME))
  assert.equal(inAppOf(ANDROID_CUSTOM_TAB), '')
})

test('Facebook in-app browser (Android) is named, not generic webview', () => {
  // This UA also carries "; wv)" — the named check must win over the generic one.
  assert.equal(inAppOf(ANDROID_FACEBOOK), 'facebook')
})

test('Facebook in-app browser (iOS) is named, not generic wkwebview', () => {
  assert.equal(inAppOf(IOS_FACEBOOK), 'facebook')
})

test('Instagram in-app browser is named', () => {
  assert.equal(inAppOf(ANDROID_INSTAGRAM), 'instagram')
})

test('TikTok in-app browser is named', () => {
  assert.equal(inAppOf(ANDROID_TIKTOK), 'tiktok')
})

test('Line in-app browser is named', () => {
  assert.equal(inAppOf(ANDROID_LINE), 'line')
})

test('Snapchat in-app browser is named', () => {
  assert.equal(inAppOf(ANDROID_SNAPCHAT), 'snapchat')
})

test('Pinterest in-app browser is named', () => {
  assert.equal(inAppOf(ANDROID_PINTEREST), 'pinterest')
})

test('Twitter/X in-app browser is named', () => {
  assert.equal(inAppOf(ANDROID_TWITTER), 'twitter')
})

test('Google app (GSA) in-app browser is named', () => {
  assert.equal(inAppOf(ANDROID_GOOGLE_APP), 'google_app')
})

test('iOS Safari is not flagged as in-app', () => {
  assert.equal(inAppOf(IOS_SAFARI), '')
})

test('iOS WKWebView without a Safari/ token is flagged', () => {
  assert.equal(inAppOf(IOS_WKWEBVIEW), 'wkwebview')
})

test('empty user agent is not flagged', () => {
  assert.equal(inAppOf(''), '')
})
