# Architectural Decision Records (ADRs)

This document contains the decision log for the technical design of Ghada's Journey.

---

## ADR 01: Hybrid Game Mechanics (Runner + Flapper)

### Context
The game follows a journey from Cairo to Westchester, including a Plane Flight stage. We need to define the controls and character movement.

### Decision
Implement a **hybrid mechanic**: ground-running (tap to jump) for land stages, and flapping/flying (tap to flap upwards) during the plane flight stage.

### Alternatives
* **Pure Runner**: She runs on top of the plane wings or clouds during the flight. (Rejected: Less thematic variety).
* **Pure Flapper**: She is floating/flying through Cairo, JFK airport, and NYC. (Rejected: Unnatural for airport terminal and suburban stages).

### Rationale
*Initial decision:* A hybrid control scheme aligns with the storytelling and keeps the player engaged. 
*Update (Visual Overhaul):* The flapper mechanic was later removed in favor of a pure runner mechanic across all stages, as the plane stage was reimagined to be an interior cabin run rather than exterior flight, making the gameplay more consistent and the hitboxes fairer.

---

## ADR 02: Pure Canvas Rendering vs. DOM Elements

### Context
We need to render character sprites, obstacles, background, and particles smoothly on mobile browsers.

### Decision
Use **HTML5 Canvas** (Approach 1) with a classic `requestAnimationFrame` game loop.

### Alternatives
* **DOM Elements**: Using absolute-positioned `div` tags and updating them via CSS transforms/JS style overrides.

### Rationale
Canvas is highly optimized for drawing multiple moving elements. It operates on a single rendering context, eliminating DOM overhead and layout recalculations, which guarantees a locked 60fps on modern mobile Safari/Chrome.

---

## ADR 03: Web Audio API vs. External Audio Files

### Context
We want to play sound effects for jumps, flaps, hits, heals, victory, and game over.

### Decision
Use the browser's built-in **Web Audio API** to programmatically synthesize chiptune waveforms.

### Alternatives
* **MP3/WAV Asset Files**: Loading external sound files from the `/public` directory.

### Rationale
Loading audio files on mobile browsers often encounters network latency, autoplay bans, or caching issues. Web Audio API has zero asset overhead, guarantees immediate sound playing on user tap, and fits the retro chiptune theme.

---

## ADR 04: Dynamically Keyed sprites vs. Pre-processed Sprites

### Context
The generated pixel art sprites have solid black backgrounds. We need transparency.

### Decision
Perform **real-time color keying** in JavaScript on load using an off-screen canvas.

### Alternatives
* **Manual Editing**: Manually cropping and editing PNG transparency in an external image editor.

### Rationale
Real-time filtering allows us to use generated image assets immediately without requiring the developer or user to perform manual graphics editing. It makes iterating on sprites using the image generator incredibly fast and automated.

---

## ADR 05: Continuous Single Run vs. Stage-by-Stage Levels

### Context
We need to decide the structure of game progression.

### Decision
Implement a **continuous single run** where backgrounds and obstacles shift dynamically as distance increases. Dying restarts the run from Cairo.

### Alternatives
* **Stage-by-Stage Levels**: Players complete Cairo, see a "Level Clear" screen, load JFK, etc., and can restart from the current stage.

### Rationale
A continuous run is selected by the user to preserve the classic, high-stakes arcade feel. To keep this fun rather than frustrating, we implemented a 3-heart health system rather than a one-hit game over.

---

## ADR 06: Visual Scale, Shadows, and Dimming Overlays

### Context
The characters and obstacles were too small on high-resolution viewports, and their color palettes blended into the detailed background details. Canvas drop-shadows also caused visual bugs.

### Decision
* Increase player and obstacle scale by **$40\%$**.
* Disable global canvas drop-shadows on sprite images to prevent invisible compression halos from casting giant, solid "boxes". We rely solely on dynamic ground shadows for depth.

### Rationale
Scaling assets improves phone readability. Removing programmatic drop-shadows from compressed images prevents rendering glitches ("boxes") around sprites, leading to a much cleaner aesthetic. The previously used dimming overlay was also removed because it muddied the improved background assets.

---

## ADR 07: Forgiving Collision Padding (Hitbox Leniency)

### Context
Scaling sprites up by 40% made clearing taller and wider obstacles (like TSA security check barricades and yellow cabs) extremely difficult, breaking the gameplay flow state.

### Decision
* Shrink the bounding box padding inside `checkCollision()` to extremely forgiving dimensions:
  $$\text{paddingX} = 24\text{px}$$
  $$\text{paddingY} = 16\text{px}$$
* Optimize jumping for float time: Decrease jump launch to $-13.0$ and lower gravity to $0.48$. This maintains vertical height ($\approx 176\text{px}$) but drastically increases hang-time, allowing the player to safely drift over wide obstacles.

### Rationale
Making the player's collision hitbox smaller than the visual asset is a golden design rule in 2D platformers. It allows the player to graze the edge of an obstacle without crashing, creating dramatic close-call moments that reward progression rather than punishing excessively.

---

## ADR 08: Dynamic Corner-Pixel Transparency Keying

### Context
Sprites were generated with different background colors (black for Cairo/NYC, white for the Plane Flight). Our old hard-threshold keyer left jagged edges or rigid "boxes" due to anti-aliased compression rings around the generated characters.

### Decision
Implement a **soft-alpha blending** keyer using Euclidean RGB distance. Pixels within $50$ distance are erased entirely, and pixels within the next $40$ distance are faded out linearly based on their difference from the background color.

### Rationale
This creates a pseudo-feathered edge, effectively erasing compression halos and eliminating the ugly "box" outlines around characters and obstacles without requiring manual image editing in Photoshop.

---

## ADR 09: Background Aspect Ratio Preservation

### Context
When square AI-generated backgrounds (e.g. 1024x1024) were drawn onto a 9:16 portrait canvas (360x640), forcing them to fit `CANVAS_WIDTH` caused severe horizontal squishing.

### Decision
Calculate a dynamic `drawnWidth` that preserves the original aspect ratio of the image based on `CANVAS_HEIGHT`:
`drawnWidth = bgImg.width * (CANVAS_HEIGHT / bgImg.height)`.
Update the scrolling physics to wrap at `-drawnWidth` rather than `-CANVAS_WIDTH`.

### Rationale
This ensures that any generated background asset, regardless of its original aspect ratio, scales to fill the vertical height of the screen and pans naturally without distorting the pixels.
