# Getting LifeOS on the Play Store

The app is a PWA at https://novashiv11.github.io/lifeos/. The Play Store version wraps it as a Trusted Web Activity (TWA):
same app, real Play install, auto-updates whenever we deploy to GitHub Pages.

This environment can't reach dl.google.com (Android SDK), so the package is built with PWABuilder (free, online).

## Steps
1. **Google Play Console account:** https://play.google.com/console/signup, $25 one-time, personal account. Needs ID verification.
2. **Build the package:** https://www.pwabuilder.com → paste `https://novashiv11.github.io/lifeos/` → *Package for stores* → **Android** →
   package id e.g. `ie.lifeos.app`, app name `LifeOS` → *Generate*. Download the zip.
   - The zip holds the `.aab` (upload this), a **signing key + passwords (back these up; losing them means you can never update the app)**,
     and `assetlinks.json`.
3. **Remove the browser bar:** Android only trusts the app if `https://novashiv11.github.io/.well-known/assetlinks.json` exists (site root).
   Create a public repo named exactly `novashiv11.github.io` and send Claude the `assetlinks.json`; Claude pushes it to
   `.well-known/assetlinks.json` (with `.nojekyll`). Your other sites (`/lifeos/`, `/novas-pack/`) are unaffected.
   With Play App Signing on, also add the SHA-256 from Play Console → *Setup → App signing* to that file.
4. **Upload:** Play Console → *Create app* → *Testing → Closed testing* → upload the `.aab`.
   New personal accounts must run a **closed test with at least 12 testers for 14 days** before Google allows production.
   Testers can be friends; they join via a link.
5. **Store listing:** short description, screenshots (phone), privacy policy URL (data stays on device; Jarvis sends chats/photos
   to Anthropic only when the user adds their own key). Content rating questionnaire, Data safety form.
6. **Pricing (later):** free app + €1.99/month subscription needs Play Billing; that requires a small server to verify purchases.
   Start free, add the subscription once people use it.
