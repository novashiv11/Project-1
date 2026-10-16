# Google Drive sync: founder setup (10 min, once)

Sync keeps a private copy of all items in the user's own Drive, in the hidden app folder (`lifeos-items.json`). We never see it; the Claude key is never sent.

1. Go to https://console.cloud.google.com → top bar → **New project** → name `LifeOS` → Create.
2. **APIs & Services → Library** → search **Google Drive API** → Enable.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform): app name `LifeOS`, support email = yours, audience **External**, contact email = yours → Save.
4. **Data access → Add scopes** → paste `https://www.googleapis.com/auth/drive.appdata` → Update → Save. (Non-sensitive scope: no Google review needed.)
5. **Audience**: while in Testing, add your Gmail under **Test users**. When ready for everyone: **Publish app**. Privacy policy URL: `https://novashiv11.github.io/lifeos/privacy.html`.
6. **Clients → Create client** → type **Web application** → name `LifeOS PWA`.
   **Authorised JavaScript origins**: `https://novashiv11.github.io` (add `http://localhost:8000` for local testing). No redirect URI needed → Create.
7. Copy the **Client ID** (`…apps.googleusercontent.com`; it is public, not a secret).
8. Paste it into `app/ui/sync.js`, line `const GOOGLE_CLIENT_ID="";` → rebuild (`python3 scripts/build_pwa.py`) → publish.
   Empty ID = Me screen shows "Drive sync: coming soon".

## How it works
- Me → Your data → **Connect Google Drive** → Google popup → pull, merge, push. Then every save pushes after ~3 s.
- Merge: union by item id; same id → later `updated` (else `done_at`/`created`) wins, tie keeps this phone's copy.
- Deletes: id + time kept in `settings.syncDeleted` (newest 1000) and in the Drive file, so other devices drop it too.
- Token lives in memory only (~1 h). On app open we try a silent refresh; if the browser blocks it, the Me screen shows **Reconnect**.

## Limits (v1)
- Whole-file last-write-wins per item, no field-level merge. Two phones editing the same item offline: newer edit wins.
- Restore from file on one phone counts removed items as deletes on all devices.
- Disconnect stops syncing but leaves the Drive copy (remove via Google Account → Security → Third-party access).
