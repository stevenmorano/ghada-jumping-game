# Ghada's Journey 🎮✈️🏡

A romantic, 16-bit retro side-scrolling arcade web game built as a special gift for **Ghada**, tracing her journey all the way from Cairo, Egypt, to her home in Rye Brook, NY.

Developed with a portrait-first mobile layout, retro scanlines, pixelated artwork, and synthesized 8-bit chiptune sound effects.

---

## 📖 The Story

Ghada travels 1,500 miles across five distinct, dynamically changing stages to reach home:
1. **Cairo, Egypt**: Run past pyramids and Sphinx monuments, dodging dangerous scorpions and racing camels. Enjoy some delicious *Koshary* to heal!
2. **Plane Flight**: Run down the carpeted aisle of a commercial jet, jumping over crying babies and dodging food service carts while snacking on pretzels.
3. **JFK Terminal**: Dodge grumpy TSA security officers and avoid slippery wet floor signs. Grab a cup of airport coffee to stay energized!
4. **NYC Streets**: Navigate the busy streets of Manhattan, jumping over flocks of pigeons and yellow taxicabs. Grab a hotdog on the go!
5. **Rye Brook, NY**: Run down the peaceful leafy roads of Westchester, dodging golden retrievers and fire hydrants, until you arrive at the cozy suburban house where your husband is waiting for you!

---

## 🕹️ How to Play

The game is designed to be played holding your phone **vertically** (portrait mode).

* **On Mobile**: Tap anywhere on the screen.
* **On Desktop**: Click the screen or press **Spacebar** / **Up Arrow** key.

### Movement Styles:
* 🏃 **Runner Stages**: The game is a pure side-scrolling runner across all 5 stages. Tap once anywhere on the screen to jump over ground-based obstacles.
* ❤️ **Hearts & Health**: You start with 3 hearts. Hitting an obstacle costs 1 heart. Collect the matching food item of the stage to recover a heart!

---

## 🚀 Quick Start Guide

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18 or higher recommended).

### 1. Installation
Clone or navigate to the folder and install the dependencies:
```bash
npm install
```

### 2. Run the Development Server
Launch the local server:
```bash
npm run dev
```

The console will output the server URLs.
* **Open on computer**: [http://localhost:5173/](http://localhost:5173/)
* **Open on phone**: Open the network URL printed in the terminal (e.g. `http://192.168.1.X:5173/`) while connected to the same Wi-Fi.

### 3. Build for Production
To bundle the game into optimized static files for deployment (e.g., to GitHub Pages, Netlify, or Vercel):
```bash
npm run build
```
The output files will be in the `/dist` directory.

---

## 📁 Workspace Directory Structure

```files
├── assets/                  # Deprecated assets folder (now in public/assets)
├── public/
│   └── assets/              # Pixel art PNG assets (sprites & backgrounds)
├── docs/
│   ├── ARCHITECTURE.md      # Game engine, scaling, and audio synthesis details
│   └── DECISION_RECORDS.md  # Architectural decision records (ADRs)
├── index.html               # Game layout and screen overlays
├── style.css                # Retro style definitions & orientation warning
├── game.js                  # Engine, states, physics, sound synthesis
├── package.json             # Vite config and run commands
└── README.md                # This manual
```

---

## 🛠️ Technical Documentation
For deep dives into how the game works under the hood, read the dedicated guides:
* [Architecture and Systems Guide](file:///d:/AntigravityWorkspaces/ghadajumpinggame/docs/ARCHITECTURE.md)
* [Decision Log & Records](file:///d:/AntigravityWorkspaces/ghadajumpinggame/docs/DECISION_RECORDS.md)
