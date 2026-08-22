# 📖 Velvet — Ebook Reader (Chrome Extension)

<p align="center">
  <img src="public/icons/icon128.png" alt="Velvet Logo" width="96" height="96" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <strong>A modern, distraction-free, and luxurious Ebook Reader extension for Google Chrome.</strong><br/>
  Designed with warm aesthetics, rich typography, smooth animations, and zero clutter.
</p>

<p align="center">
  <a href="#-key-features">Key Features</a> •
  <a href="#-architecture--storage">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-installation--development">Installation</a> •
  <a href="#-keyboard-shortcuts">Shortcuts</a> •
  <a href="#-license">License</a>
</p>

---

## ✨ Key Features

### 📚 Immersive & Distraction-Free Reading
* **Powered by Foliate-JS**: Ultra-fast pagination, accurate EPUB-CFI location tracking, smooth chapter navigation, and flow modes (Paginated or Scrolled).
* **Rich Typography & Custom Fonts**: Includes tailored serif and sans-serif typefaces (Playfair, Merriweather, Literata, Inter, Outfit, etc.) plus support for importing custom `.woff2` / `.ttf` / `.otf` fonts directly.
* **8 Curated Aesthetic Themes**: Dark Luxury, Silk Light, Sepia Paper, Nord Ice, Forest Matcha, Sunset Peach, Night Lavender, and Midnight Slate.
* **Instant Word Lookup & Smart Dictionary**: Click on any word or sentence to look up definitions and context instantly.
* **Text-to-Speech (TTS)**: Built-in voice narrator with speed controls and chapter playback.

### 🎨 Cozy Aesthetic Moods & Visual Atmosphere
* **Curated Cinematic Art Gallery**: Features over 100+ high-resolution, nostalgic scenic stills and hand-drawn backdrops to set a cozy, peaceful reading vibe.
* **Dynamic Reading Streak Heatmap**: Track daily reading habits with a theme-synced monthly calendar heatmap and active streak badges.
* **Ambient Soundscapes**: Built-in soothing background sounds (Rainy Cafe, Forest Night, Vinyl Crackle, Library Atmosphere).

### ⚡ Seamless Organization & Smart Shelves
* **Full-screen Drag & Drop**: Drop any `.epub` file anywhere onto the window to instantly parse, import, and read.
* **Categorized Shelves**: Filter by *All, Reading, Finished, Unread*, and search instantaneously with MiniSearch.
* **Highlights, Annotations & Notes**: Color-coded highlights with attached user notes and instant Markdown export.
* **AI Chapter Summaries**: Smart bullet summaries generated for chapters to retain key takeaways effortlessly.

### ☁️ Modular Google Drive Cloud Sync
* **Zero Bloat & Lightning Fast**: Syncs lightweight reading progress, annotations, highlights, and notes to your Google Drive AppData folder in milliseconds.
* **Autonomous File Storage**: Each book `.epub` binary is stored safely in high-performance local **OPFS (Origin Private File System)** and synced on-demand.
* **Multi-Device Restore**: Seamlessly switch computers and restore your entire library, bookmarks, and reading progress with one click.

---

## 🏛 Architecture & Storage

Velvet uses a **2-Tier Local-First Storage Pattern**:

```
 ┌────────────────────────────────────────────────────────┐
 │                     Velvet Reader                      │
 └──────────────┬───────────────────────────┬─────────────┘
                │                           │
         [Binary Storage]           [Relational / Meta]
                │                           │
                ▼                           ▼
      OPFS (Private Filesystem)     IndexedDB (Dexie.js)
      books/{bookId}.epub           • Books Metadata
                                    • Reading Progress (CFI)
                                    • Highlights & Notes
                                    • Reading Streak Logs
                                            │
                                            ▼
                               [Google Drive AppData Sync]
                               • Lightweight JSON metadata
                               • On-demand EPUB cloud archive
```

---

## 🛠 Tech Stack

* **Framework & Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [WXT (Next-gen Web Extension Framework)](https://wxt.dev/)
* **EPUB Engine**: [Foliate-js](https://github.com/johnfactotum/foliate-js)
* **Local Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper) & [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with native CSS variables for dynamic theming
* **Search Engine**: [MiniSearch](https://github.com/lucaong/minisearch)
* **Icons**: [Lucide React](https://lucide.dev/)

---

## 🚀 Installation & Quick Start

### 👥 For Users (Install Extension into Chrome)

1. **Download the latest release**:
   * Download the `velvet-chrome-extension.zip` from the [Releases](https://github.com/your-username/velvet-ebook-reader/releases) page and unzip it (or build it from source below).
2. **Load into Google Chrome**:
   * Open Chrome and navigate to `chrome://extensions` in the address bar.
   * Enable the **Developer mode** toggle in the top-right corner.
   * Click **Load unpacked** in the top-left corner.
   * Select the unzipped folder (or `dist/chrome-mv3`).
3. **Enjoy Reading**:
   * Pin the **Velvet** icon on your browser toolbar and click it to open your luxury bookshelf!

---

### 💻 For Developers (Build from Source)

#### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* [npm](https://www.npmjs.com/)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/velvet-ebook-reader.git
cd velvet-ebook-reader

# 2. Install dependencies
npm install

# 3. Start development mode (launches browser with auto-reload)
npm run dev

# 4. Build production bundle (outputs to dist/chrome-mv3)
npm run build
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Right Arrow` / `Space` / `Page Down` | Next Page / Screen |
| `Left Arrow` / `Shift + Space` / `Page Up` | Previous Page / Screen |
| `Esc` | Close Modal / Fullscreen Reader |
| `Cmd + Z` / `Ctrl + Z` | Undo Last Highlight |
| `Cmd + F` / `Ctrl + F` | Search Inside Book |

---

## 📄 License

This project is licensed under the **MIT License**.

