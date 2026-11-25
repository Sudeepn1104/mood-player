# Mood Player

Plays your saved Instagram reels by mood (Confidence, Songs, My Feelings…), **best ones first**.
After each reel you tap 🔥 / 👍 / ⏭, and the reels that help you most rise to the top.
Reels open in the Instagram app. Your list and ratings stay only on your phone.

---

## Step 1 — Put it online with GitHub Pages (free, one time)

1. Go to https://github.com/new
   - Repository name: `mood-player`
   - Public
   - Click **Create repository**
2. On the new repo page click **uploading an existing file**.
3. Drag in everything from `D:\Mood Player`:
   `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `README.md`, and the **`icons`** folder.
   Click **Commit changes**.
4. Repo → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → **Save**.
5. Wait 1–2 minutes. Your app is at:
   `https://<your-github-username>.github.io/mood-player/`

## Step 2 — Install it on your Android phone

1. Open that link in **Chrome** on your phone.
2. Tap **⋮** → **Add to Home screen** → **Install**.
3. Open **Mood Player** from your home screen (not from Chrome). The share-menu feature only works once it's installed.

## Step 3 — Bring in your Instagram collections

1. Instagram → profile → ☰ → **Accounts Center** → **Your information and permissions** → **Download your information**.
2. **Some of your information** → tick **Saved** → **Download to device** → Format **JSON**, Date range **All time** → **Create files**.
3. Instagram emails you when it's ready (minutes to a couple of days). Download the zip, then in the **Files** app tap it → **Extract**.
4. Mood Player → ⚙ → **Choose Instagram download (.zip)** → pick the zip (no need to extract it).

Your collections appear as mood buttons. You can rename them or change their emoji in ⚙.

## Daily use

- Tap a mood → **▶ Watch in Instagram** → watch → press back → tap 🔥 / 👍 / ⏭.
  With "open next automatically" on, rating opens the next reel straight away.
- When a mood has 🔥 reels, **⭐ Only my best** plays just your top ones.
- **✍ Save a line** keeps a quote (or song name) from a reel. **📜 Saved lines** shows them, and it works without internet.
- New reel? In Instagram tap **Share** → **Mood Player** → pick the mood.

## Backup

Your reels and ratings are stored only in the app on your phone. Clearing Chrome's data or uninstalling deletes them.
Use ⚙ → **Save backup** now and then.

## Updating the app

Upload the changed files to the same GitHub repo. The phone picks up the new version the next time you open the app with internet.
