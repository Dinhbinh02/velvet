# 📖 Velvet — Modern Luxury Ebook Reader (Web App & PWA)

<p align="center">
  <img src="public/icons/icon128.png" alt="Velvet Logo" width="96" height="96" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <strong>A modern, distraction-free, and luxurious Ebook Reader web application & Progressive Web App (PWA).</strong><br/>
  Designed with Apple Books aesthetic elegance, rich typography, local-first storage, real-time cloud sync, and edge-to-edge mobile UI.
</p>

<p align="center">
  <a href="https://velvetreader.pages.dev"><strong>🌐 Live Demo: velvetreader.pages.dev</strong></a>
</p>

<p align="center">
  <a href="#-key-features">Key Features</a> •
  <a href="#-architecture--storage">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-keyboard-shortcuts">Shortcuts</a> •
  <a href="#-license">License</a>
</p>

---

## ✨ Key Features

### 📚 Immersive & Distraction-Free Reading
* **Powered by Foliate-JS**: Ultra-fast pagination, accurate EPUB-CFI location tracking, smooth chapter navigation, and dual-mode flow (Paginated or Continuous Scroll).
* **Rich Typography & Custom Fonts**: High-contrast, zero-ghosting serif and sans-serif typefaces (*Bookerly, Literata, Source Serif 4, Lora, Merriweather, Atkinson Hyperlegible, Inter*) with direct import for custom `.zip`, `.woff2`, `.ttf`, and `.otf` fonts.
* **Curated Themes & Real-time Safari Status Sync**: *Light, Paper, Sepia, Dark, OLED, and Nord* with dynamic real-time theme synchronization for iOS Safari notch status bars and translucent bottom bars.
* **Smart Touch Gestures**: Smooth horizontal swipe page turning with haptic feedback, zero chapter boundary flashes, and continuous reading flow.
* **Natural Voice Narrator (TTS)**: Built-in Text-To-Speech player with speed pitch controls, multi-voice selection, and auto-scrolling synchronization.

### 🤖 Gemini AI Assistant & Smart Dictionary
* **Dynamic AI Word Definition**: Click any word to trigger an AI lookup modal with phonetic IPA pronunciation, contextual meaning, and synonyms, automatically scaled to match your font size preferences.
* **AI Chapter Summaries & Insights**: Generate structured chapter summaries, key takeaways, and character breakdowns directly into your table of contents and reading view.

### ☁️ Real-time Cloud Sync & Multi-Device Library
* **Supabase PostgreSQL & Cloudflare R2**: Seamlessly syncs books, reading progress, highlights, notes, comments, custom fonts, and settings across all your devices.
* **Smart Conflict Resolution & Cross-device Tombstones**: Guarantees zero stale settings rollbacks and ensures deleted books/fonts disappear across all secondary devices in real-time.
* **Local-First & Offline First**: Books are safely archived in your browser's high-speed **Origin Private File System (OPFS)** and IndexedDB for full offline reading capability.

### 🎨 Cozy Atmospheric Moods & Discoveries
* **Curated Scenic Banners**: High-resolution, nostalgic scenic backdrops to set a cozy, peaceful reading vibe.
* **Dynamic Reading Streak Heatmap**: Track daily reading habits with a theme-synced monthly calendar heatmap and active streak counters.
* **Ambient Soundscapes**: Built-in soothing focus sounds (Rain, Ocean Waves, Cafe, Vinyl Crackle, Forest Night).
* **Great Library Book Discovery**: Search and import classic curated public domain masterpieces directly with one click.

---

## 🏛 Architecture & Storage

Velvet follows a **Local-First 3-Tier Storage Pattern**:

```
 ┌────────────────────────────────────────────────────────┐
 │                      Velvet Web App                    │
 └──────────────┬───────────────────────────┬─────────────┘
                │                           │
         [Binary Storage]           [Relational / Meta]
                │                           │
                ▼                           ▼
      OPFS (Origin Private FS)      IndexedDB (Dexie.js)
      books/{bookId}.epub           • Books Metadata & Formats
                                    • Reading Progress (CFI)
                                    • Highlights, Notes & Comments
                                    • Custom Fonts & Tombstones
                                    • Theme & Typography Settings
                │                           │
                ▼                           ▼
      [Cloudflare R2 Storage]      [Supabase Cloud Sync]
      • Encrypted cloud backup     • Realtime PostgreSQL Sync
      • Fast edge CDN delivery     • Multi-device Authentication
```

---

## 🛠 Tech Stack

* **Frontend Framework**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
* **EPUB & Reader Engine**: [Foliate-js](https://github.com/johnfactotum/foliate-js)
* **Local Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper) & [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
* **Backend & Cloud Sync**: [Supabase](https://supabase.com/) (PostgreSQL & Realtime Auth) & [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with native CSS variables
* **AI Engine**: Google Gemini API (`gemini-2.5-flash`)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* [npm](https://www.npmjs.com/)

```bash
# 1. Clone the repository
git clone https://github.com/Dinhbinh02/velvet.git
cd velvet

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Build production bundle
npm run build

# 5. Deploy to Cloudflare Pages (Optional)
npx wrangler pages deploy dist --project-name=velvetreader
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Right Arrow` / `Space` / `Page Down` | Next Page / Screen |
| `Left Arrow` / `Shift + Space` / `Page Up` | Previous Page / Screen |
| `Esc` | Close Drawer / Modal |
| `H` | Quick Highlight Selection |
| `Shift` (or Custom) | Quick AI Read & Voice Pronunciation |
| `Cmd + F` / `Ctrl + F` | Search Inside Book |

---

## 📱 Progressive Web App (PWA)

Velvet is a fully functional Progressive Web App. You can install it directly onto your desktop or mobile home screen:
* **iOS (Safari)**: Tap the **Share** button at the bottom and select **Add to Home Screen**.
* **Android (Chrome)**: Tap the menu and select **Install App** or **Add to Home screen**.
* **Desktop (Chrome/Edge/Brave)**: Click the **Install Velvet** icon in your browser address bar.

---

## 📄 License

This project is licensed under the **MIT License**.
