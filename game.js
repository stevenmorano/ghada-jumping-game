// Game Configurations & State
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 640;
const GROUND_Y = 480; // Elevated ground level to fit larger character sizes
const SCROLL_SPEED = 4; // Logical pixels per 60fps frame

const STATES = {
  START: 'START',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER',
  WIN: 'WIN'
};

const STAGES = {
  CAIRO: { name: 'Cairo, Egypt', start: 0, end: 300, type: 'runner', bg: 'cairo_bg' },
  PLANE: { name: 'Plane Flight', start: 300, end: 600, type: 'runner', bg: 'plane_bg' },
  JFK: { name: 'JFK Terminal', start: 600, end: 900, type: 'runner', bg: 'jfk_bg' },
  NYC: { name: 'NYC Streets', start: 900, end: 1200, type: 'runner', bg: 'nyc_bg' },
  RYE_BROOK: { name: 'Rye Brook, NY', start: 1200, end: 1500, type: 'runner', bg: 'ryebrook_bg' }
};

// Global Variable Declarations
let canvas, ctx;
let gameState = STATES.START;
let distance = 0;
let highScore = parseInt(localStorage.getItem('ghada_highscore')) || 0;
let currentStage = STAGES.CAIRO;
let lives = 3;
let isInvulnerable = false;
let invulnerabilityTimer = 0;
let keys = {};
let obstacles = [];
let items = [];
let textPopups = [];
let audioContext = null;
let soundEnabled = true;
let isPaused = false;

// Particle Object Pooling (Avoids Garbage Collection stutters)
const PARTICLE_POOL_SIZE = 150;
const particlePool = [];
for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
  particlePool.push({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    color: '',
    size: 0,
    life: 0,
    decay: 0
  });
}

// Asset cache
const assets = {
  ghada_run: null,
  ghada_jump: null,
  ghada_fly: null,
  husband: null,
  cozy_home: null,
  cairo_bg: null,
  plane_bg: null,
  jfk_bg: null,
  nyc_bg: null,
  ryebrook_bg: null,
  obs_camel: null,
  obs_scorpion: null,
  obs_food_cart: null,
  obs_baby: null,
  obs_tsa: null,
  obs_wetfloor: null,
  obs_cab: null,
  obs_pigeon: null,
  obs_dog: null,
  obs_hydrant: null
};

// Player (Ghada) Object Definition
const player = {
  x: 50,
  y: GROUND_Y,
  width: 68,  // Scaled up by 40%
  height: 68, // Scaled up by 40%
  vy: 0,
  gravity: 0.48,
  jumpForce: -13.0,
  flapForce: -6.5,
  rotation: 0,
  runCycle: 0, // Used for programmatic bobbing animation

  reset() {
    this.x = 50;
    this.y = GROUND_Y;
    this.vy = 0;
    this.rotation = 0;
    this.runCycle = 0;
  },

  update(dt) {
    const isFlapper = currentStage.type === 'flapper';

    // Apply gravity scaled by delta time
    if (isFlapper) {
      this.gravity = 0.30;
      this.vy += this.gravity * dt;
      if (this.vy > 8) this.vy = 8;
    } else {
      this.gravity = 0.60;
      this.vy += this.gravity * dt;
    }

    this.y += this.vy * dt;

    // Boundary constraints
    if (isFlapper) {
      if (this.y < 40) {
        this.y = 40;
        this.vy = 0;
      }
      if (this.y > GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
      }
      this.rotation = this.vy * 0.04;
    } else {
      if (this.y > GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
      }
      this.rotation = 0;
    }

    // Increment run cycle animation
    const isJumping = this.y < GROUND_Y;
    if (!isFlapper && !isJumping && gameState === STATES.PLAYING && !victorySequenceActive) {
      this.runCycle += 0.25 * dt;
      
      // Spawn tiny dust particles at her heels
      if (Math.random() < 0.15 * dt) {
        spawnDustParticle(this.x + 8, GROUND_Y + this.height - 4);
      }
    }
  },

  draw() {
    const isFlapper = currentStage.type === 'flapper';
    const isJumping = this.y < GROUND_Y;

    // Draw dynamic ground shadow under the player
    if (gameState === STATES.PLAYING && !isFlapper) {
      const heightAboveGround = GROUND_Y - this.y;
      const shadowScale = Math.max(0.2, 1 - (heightAboveGround / 180));
      
      ctx.save();
      ctx.fillStyle = 'rgba(12, 8, 19, 0.3)';
      ctx.beginPath();
      ctx.ellipse(
        this.x + this.width / 2, 
        GROUND_Y + this.height - 2, 
        (this.width * 0.4) * shadowScale, 
        4, 
        0, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    ctx.save();

    // Programmatic Bobbing/Tilting running animations for extra juice
    let bobY = 0;
    let tiltAngle = 0;
    if (gameState === STATES.PLAYING && !isFlapper && !isJumping && !victorySequenceActive) {
      bobY = Math.sin(this.runCycle) * 3.5;
      tiltAngle = Math.cos(this.runCycle) * 0.04;
    }

    ctx.translate(this.x + this.width / 2, this.y + this.height / 2 + bobY);
    ctx.rotate(this.rotation + tiltAngle);

    // Flash when invulnerable
    if (isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }

    let spriteImg = assets.ghada_run;
    if (isFlapper) {
      spriteImg = assets.ghada_fly;
    } else if (isJumping) {
      spriteImg = assets.ghada_jump;
    }

    if (spriteImg) {
      ctx.drawImage(spriteImg, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      // Fallback placeholder
      ctx.fillStyle = '#ff6b8b'; 
      ctx.fillRect(-this.width / 2, -this.height / 2 + 10, this.width, this.height - 10);
      
      ctx.fillStyle = '#fce4ec'; 
      ctx.beginPath();
      ctx.arc(0, -this.height / 2 + 15, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#a1887f'; 
      ctx.beginPath();
      ctx.arc(0, -this.height / 2 + 10, 14, Math.PI, 0);
      ctx.fill();
    }

    ctx.restore();
  }
};

// Mobile Vibrate API Wrapper
function triggerHaptic(pattern) {
  if (soundEnabled && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.log("Vibration blocked or unsupported:", e);
    }
  }
}

// Sound Synthesizer via Web Audio API
class RetroAudio {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!soundEnabled || !this.ctx) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playFlap() {
    if (!soundEnabled || !this.ctx) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playHurt() {
    if (!soundEnabled || !this.ctx) return;
    this.init();
    const bufferSize = this.ctx.sampleRate * 0.2; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  }

  playHeal() {
    if (!soundEnabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.linearRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(523.25, now, 0.1);      
    playNote(659.25, now + 0.08, 0.15); 
  }

  playTransition() {
    if (!soundEnabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const playNote = (freq, start) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.linearRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    };
    playNote(261.63, now); 
    playNote(329.63, now + 0.1); 
    playNote(392.00, now + 0.2); 
    playNote(523.25, now + 0.3); 
  }

  playGameOver() {
    if (!soundEnabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [392.00, 349.23, 311.13, 261.63]; 
    
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + index * 0.18);
      
      gain.gain.setValueAtTime(0.1, now + index * 0.18);
      gain.gain.linearRampToValueAtTime(0.001, now + index * 0.18 + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + index * 0.18);
      osc.stop(now + index * 0.18 + 0.25);
    });
  }

  playWinMelody() {
    if (!soundEnabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [
      { f: 261.63, t: 0.0 },   
      { f: 329.63, t: 0.12 },  
      { f: 392.00, t: 0.24 },  
      { f: 523.25, t: 0.36 },  
      { f: 587.33, t: 0.48 },  
      { f: 659.25, t: 0.60 },  
      { f: 523.25, t: 0.72 },  
      { f: 659.25, t: 0.84 }   
    ];

    notes.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + note.t);
      
      const isLast = note.t > 0.8;
      const duration = isLast ? 0.6 : 0.15;
      gain.gain.setValueAtTime(0.12, now + note.t);
      gain.gain.linearRampToValueAtTime(0.001, now + note.t + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + note.t);
      osc.stop(now + note.t + duration);
    });
  }
}

const sounds = new RetroAudio();

// Asset Loader: Dynamic Corner Color key-out (removes white/black background halos)
function loadKeyedImage(src, callback) {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    const offscreen = document.createElement('canvas');
    offscreen.width = img.width;
    offscreen.height = img.height;
    const oCtx = offscreen.getContext('2d');
    oCtx.drawImage(img, 0, 0);

    const imgData = oCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imgData.data;

    // Sample background color from the very top-left corner
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    const bgA = data[3];

    // Soft-alpha blending threshold to remove halos without jagged edges
    const tolerance = 50;
    const fadeRange = 40;

    if (bgA > 10) { // Only key if the corner is opaque
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate Euclidean distance in RGB space
        const diff = Math.sqrt(Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2));
        
        if (diff < tolerance) {
          data[i + 3] = 0; // Fully transparent
        } else if (diff < tolerance + fadeRange) {
          // Soft blending for anti-aliased edge pixels
          const alphaRatio = (diff - tolerance) / fadeRange;
          data[i + 3] = Math.floor(alphaRatio * 255);
        }
      }
    }
    
    oCtx.putImageData(imgData, 0, 0);
    callback(offscreen);
  };
  img.onerror = () => {
    console.warn(`Failed to load asset: ${src}. Drawing placeholders.`);
    callback(null);
  };
}

// Load all assets
function loadAllAssets(callback) {
  let loadedCount = 0;
  const assetPaths = {
    ghada_run: '/assets/ghada_run.png',
    ghada_jump: '/assets/ghada_jump.png',
    ghada_fly: '/assets/ghada_fly.png',
    husband: '/assets/husband.png',
    cozy_home: '/assets/cozy_home.png',
    cairo_bg: '/assets/cairo_bg.png',
    plane_bg: '/assets/plane_bg.png',
    jfk_bg: '/assets/jfk_bg.png',
    nyc_bg: '/assets/nyc_bg.png',
    ryebrook_bg: '/assets/ryebrook_bg.png',
    obs_camel: '/assets/obs_camel_new.png',
    obs_scorpion: '/assets/obs_scorpion.png',
    obs_food_cart: '/assets/obs_food_cart.png',
    obs_baby: '/assets/obs_baby.png',
    obs_tsa: '/assets/obs_tsa.png',
    obs_wetfloor: '/assets/obs_wetfloor.png',
    obs_cab: '/assets/obs_cab_new.png',
    obs_pigeon: '/assets/obs_pigeon.png',
    obs_dog: '/assets/obs_dog_new.png',
    obs_hydrant: '/assets/obs_hydrant_new.png'
  };

  const keys = Object.keys(assetPaths);
  const total = keys.length;

  keys.forEach(key => {
    loadKeyedImage(assetPaths[key], (result) => {
      assets[key] = result;
      loadedCount++;
      if (loadedCount === total) {
        callback();
      }
    });
  });
}

// Background Manager (parallax scrolling and stage crossfading)
const backgroundManager = {
  bgX: 0,
  bgWidth: CANVAS_WIDTH,

  update(dt) {
    this.bgX -= (SCROLL_SPEED * 0.5) * dt; 
    
    const bgImg = assets[currentStage.bg];
    if (bgImg) {
      this.bgWidth = bgImg.width * (CANVAS_HEIGHT / bgImg.height);
    } else {
      this.bgWidth = CANVAS_WIDTH;
    }

    if (this.bgX <= -this.bgWidth) {
      this.bgX += this.bgWidth;
    }
  },

  draw() {
    const drawBg = (bgName, offset, alpha = 1) => {
      ctx.globalAlpha = alpha;
      const bgImg = assets[bgName];
      if (bgImg) {
        const drawnWidth = bgImg.width * (CANVAS_HEIGHT / bgImg.height);
        // Draw the full background, relying on the prompt to create the floor at the bottom
        ctx.drawImage(
          bgImg, 
          0, 0, bgImg.width, bgImg.height, // Source crop (no crop)
          offset, 0, drawnWidth, CANVAS_HEIGHT // Destination
        );
        ctx.drawImage(
          bgImg, 
          0, 0, bgImg.width, bgImg.height, 
          offset + drawnWidth, 0, drawnWidth, CANVAS_HEIGHT
        );
      } else {
        let grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        if (bgName === 'cairo_bg') {
          grad.addColorStop(0, '#ff9800'); grad.addColorStop(1, '#ffc107'); 
        } else if (bgName === 'plane_bg') {
          grad.addColorStop(0, '#0288d1'); grad.addColorStop(1, '#e0f7fa'); 
        } else if (bgName === 'jfk_bg') {
          grad.addColorStop(0, '#3f51b5'); grad.addColorStop(1, '#b3e5fc'); 
        } else if (bgName === 'nyc_bg') {
          grad.addColorStop(0, '#000822'); grad.addColorStop(1, '#4a148c'); 
        } else {
          grad.addColorStop(0, '#2e7d32'); grad.addColorStop(1, '#a5d6a7'); 
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    };

    drawBg(currentStage.bg, this.bgX, 1);
    ctx.globalAlpha = 1;
  }
};

// Obstacle & Item classes
class Obstacle {
  constructor(x, type) {
    this.x = x;
    this.type = type; 
    this.width = 40;
    this.height = 40;
    this.y = GROUND_Y;
    
    // Scaled up all obstacles by ~40% for better mobile visibility
    if (type === 'camel') {
      this.width = 68;
      this.height = 68;
      this.y = GROUND_Y + 4; 
    } else if (type === 'scorpion') {
      this.width = 44;
      this.height = 30;
      this.y = GROUND_Y + 36;
    } else if (type === 'food_cart') {
      this.width = 48;
      this.height = 76;
      this.y = GROUND_Y - 4;
    } else if (type === 'baby') {
      this.width = 40;
      this.height = 40;
      this.y = GROUND_Y + 28;
    } else if (type === 'tsa') {
      this.width = 50;
      this.height = 70;
      this.y = GROUND_Y - 2; 
    } else if (type === 'wetfloor') {
      this.width = 38;
      this.height = 50;
      this.y = GROUND_Y + 18;
    } else if (type === 'cab') {
      this.width = 85;
      this.height = 52;
      this.y = GROUND_Y + 16;
    } else if (type === 'pigeon') {
      this.width = 32;
      this.height = 32;
      this.y = GROUND_Y + 36;
    } else if (type === 'dog') {
      this.width = 64;
      this.height = 48;
      this.y = GROUND_Y + 20;
    } else if (type === 'hydrant') {
      this.width = 30;
      this.height = 46;
      this.y = GROUND_Y + 22;
    }
  }

  update(dt) {
    this.x -= SCROLL_SPEED * dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    const spriteKey = `obs_${this.type}`;
    const spriteImg = assets[spriteKey];

    if (spriteImg) {
      ctx.drawImage(spriteImg, 0, 0, this.width, this.height);
    } else {
      // Fallback geometric drawings with NO outline borders
      if (this.type === 'cactus') {
        ctx.fillStyle = '#2e7d32'; 
        ctx.fillRect(8, 0, 8, this.height);
        ctx.fillRect(0, 10, 16, 6);
        ctx.fillRect(8, 18, 16, 6);
      } else if (this.type === 'camel') {
        ctx.fillStyle = '#c5a059'; 
        ctx.fillRect(10, 0, 12, 12); 
        ctx.fillRect(6, 12, 28, 16); 
        ctx.fillRect(16, 8, 8, 8); 
        ctx.fillRect(8, 28, 6, 16); 
        ctx.fillRect(26, 28, 6, 16);
      } else if (this.type === 'suitcase') {
        ctx.fillStyle = '#8d6e63'; 
        ctx.fillRect(0, 4, this.width, this.height - 4);
        ctx.fillStyle = '#4e342e'; 
        ctx.fillRect(4, 0, 8, 4); 
        ctx.fillRect(12, 4, 4, this.height - 4);
        ctx.fillRect(24, 4, 4, this.height - 4);
      } else if (this.type === 'security') {
        ctx.fillStyle = '#1a237e'; 
        ctx.fillRect(4, 10, 20, this.height - 10);
        ctx.fillStyle = '#ffb300'; 
        ctx.fillRect(10, 0, 8, 10);
        ctx.fillStyle = '#b71c1c'; 
        ctx.fillRect(-6, 8, 10, 10);
        ctx.fillRect(-2, 18, 2, 12);
      } else if (this.type === 'cab') {
        ctx.fillStyle = '#fbc02d'; 
        ctx.fillRect(4, 10, this.width - 8, this.height - 10); 
        ctx.fillRect(10, 2, 20, 10); 
        ctx.fillStyle = '#000000'; 
        ctx.fillRect(8, this.height - 4, 8, 6);
        ctx.fillRect(this.width - 16, this.height - 4, 8, 6);
      } else if (this.type === 'hydrant') {
        ctx.fillStyle = '#d84315'; 
        ctx.fillRect(4, 4, 12, this.height - 4);
        ctx.fillRect(0, 10, 20, 6);
        ctx.fillRect(4, 0, 12, 4);
      } else if (this.type === 'mailbox') {
        ctx.fillStyle = '#1565c0'; 
        ctx.fillRect(2, 0, 18, 24);
        ctx.fillStyle = '#ff3366'; 
        ctx.fillRect(20, 4, 2, 6);
        ctx.fillStyle = '#37474f'; 
        ctx.fillRect(9, 24, 4, 10);
      } else if (this.type === 'bird') {
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(4, 4, 18, 8);
        const wingOffset = Math.floor(Date.now() / 150) % 2 === 0 ? 0 : 8;
        ctx.fillRect(10, wingOffset, 6, 6);
      } else if (this.type === 'stormcloud') {
        ctx.fillStyle = '#546e7a'; 
        ctx.fillRect(8, 0, this.width - 16, this.height);
        ctx.fillRect(0, 12, this.width, this.height - 12);
        ctx.fillStyle = '#ffeb3b'; 
        if (Math.floor(Date.now() / 300) % 4 === 0) {
          ctx.fillRect(20, 28, 4, 16);
          ctx.fillRect(16, 36, 12, 4);
        }
      }
    }

    ctx.restore();
  }
}

class Item {
  constructor(x, type) {
    this.x = x;
    this.type = type; 
    this.width = 32;  // Scaled up item dimensions
    this.height = 32; 
    this.y = GROUND_Y + 32;

    if (currentStage.type === 'flapper') {
      this.y = 100 + Math.random() * 340; // Spawns floating items throughout the sky
    }
  }

  update(dt) {
    this.x -= SCROLL_SPEED * dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    const pulse = Math.sin(Date.now() * 0.01) * 3;
    ctx.shadowBlur = 6 + pulse;
    ctx.shadowColor = '#ff3366';

    // Draws a beautiful, glowing 16-bit pixel art style heart container
    const pixelSize = this.width / 8;
    const heartGrid = [
      [0,1,1,0,0,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,0,0,0,0,0,0]
    ];
    
    ctx.fillStyle = (lives === 3) ? '#00ffcc' : '#ff3366';
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (heartGrid[r][c] === 1) {
          ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
        }
      }
    }

    ctx.restore();
  }
}

// Spawns particle from object pool (prevents garbage collection stutters)
function spawnParticle(x, y, color) {
  const p = particlePool.find(item => !item.active);
  if (p) {
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = (Math.random() * 2 - 1) * 3;
    p.vy = (Math.random() * 2 - 1) * 3 - 2;
    p.color = color;
    p.size = 2 + Math.random() * 4;
    p.life = 1;
    p.decay = 0.02 + Math.random() * 0.03;
  }
}

function spawnDustParticle(x, y) {
  const p = particlePool.find(item => !item.active);
  if (p) {
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = -1.5 - Math.random() * 2.0; 
    p.vy = -0.3 - Math.random() * 0.8; 
    p.color = '#c5a059'; 
    p.size = 1.5 + Math.random() * 3.0;
    p.life = 0.6;
    p.decay = 0.03 + Math.random() * 0.04;
  }
}

function createExplosion(x, y, color = '#ff00ff', count = 12) {
  for (let i = 0; i < count; i++) {
    spawnParticle(x, y, color);
  }
}

// Retro text popup system (e.g. "+1 Heart")
class TextPopup {
  constructor(text, x, y, color = '#ffd700') {
    this.text = text;
    this.x = x;
    this.y = y;
    this.vy = -1.2;
    this.life = 1;
    this.decay = 0.015;
    this.color = color;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.life -= this.decay * dt;
  }

  draw() {
    ctx.save();
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life;
    ctx.textAlign = 'center';
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// Spawn Obstacles & Items based on Stage Distance
let spawnTimer = 0;
let stageMessageTriggered = false;

function handleSpawning(dt) {
  spawnTimer += dt;

  if (!stageMessageTriggered) {
    let alertColor = '#00f0ff';
    if (currentStage === STAGES.PLANE) alertColor = '#ffd700';
    if (currentStage === STAGES.JFK) alertColor = '#ff3366';
    
    textPopups.push(new TextPopup(currentStage.name.toUpperCase(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50, alertColor));
    sounds.playTransition();
    stageMessageTriggered = true;
  }

  const isFlapper = currentStage.type === 'flapper';
  const spawnInterval = isFlapper ? 110 : 130;

  if (spawnTimer > spawnInterval) {
    spawnTimer = 0;

    let obstacleType = 'cactus';
    let foodType = 'koshary';

    if (currentStage === STAGES.CAIRO) {
      obstacleType = Math.random() < 0.5 ? 'scorpion' : 'camel';
      foodType = 'koshary';
    } else if (currentStage === STAGES.PLANE) {
      obstacleType = Math.random() < 0.6 ? 'food_cart' : 'baby';
      foodType = 'snack';
    } else if (currentStage === STAGES.JFK) {
      obstacleType = Math.random() < 0.5 ? 'tsa' : 'wetfloor';
      foodType = 'coffee';
      
      if (Math.random() < 0.4) {
        const warnings = ["Liquids over 3oz!", "Take shoes off!", "Passport Check!", "TSA inspection!"];
        const phrase = warnings[Math.floor(Math.random() * warnings.length)];
        textPopups.push(new TextPopup(phrase, CANVAS_WIDTH + 50, GROUND_Y - 80, '#ff3366'));
      }
    } else if (currentStage === STAGES.NYC) {
      obstacleType = Math.random() < 0.6 ? 'cab' : 'pigeon';
      foodType = 'hotdog';
    } else if (currentStage === STAGES.RYE_BROOK) {
      obstacleType = Math.random() < 0.5 ? 'dog' : 'hydrant';
      foodType = 'apple';
    }

    obstacles.push(new Obstacle(CANVAS_WIDTH + 40, obstacleType));

    if (Math.random() < 0.25) {
      items.push(new Item(CANVAS_WIDTH + 140, foodType));
    }
  }
}

// Stage Switch logic based on Distance (m)
function updateStage() {
  let prevStage = currentStage;

  if (distance < STAGES.PLANE.start) {
    currentStage = STAGES.CAIRO;
  } else if (distance < STAGES.JFK.start) {
    currentStage = STAGES.PLANE;
  } else if (distance < STAGES.NYC.start) {
    currentStage = STAGES.JFK;
  } else if (distance < STAGES.RYE_BROOK.start) {
    currentStage = STAGES.NYC;
  } else if (distance < STAGES.RYE_BROOK.end) {
    currentStage = STAGES.RYE_BROOK;
  } else {
    triggerVictorySequence();
  }

  if (currentStage !== prevStage) {
    stageMessageTriggered = false;
    spawnTimer = 0; 
  }
}

// Win Scene Animation Variables
let victorySequenceActive = false;
let victoryTimer = 0;
let husbandX = CANVAS_WIDTH + 100;
const houseY = GROUND_Y - 80;

function triggerVictorySequence() {
  victorySequenceActive = true;
}

function updateVictorySequence(dt) {
  victoryTimer += dt;
  
  player.x += 2 * dt;
  
  if (husbandX > CANVAS_WIDTH - 120) {
    husbandX -= 1.5 * dt;
  }

  if (player.x >= husbandX - 44) {
    player.x = husbandX - 44;
    player.vy = 0;
    
    if (Math.floor(victoryTimer) % 12 === 0) {
      createExplosion(player.x + 20, player.y + 10, '#ffd700', 3);
      createExplosion(husbandX + 20, player.y + 10, '#ff3366', 3);
    }

    if (victoryTimer > 180) {
      gameState = STATES.WIN;
      sounds.playWinMelody();
      document.getElementById('winScreen').classList.add('active');
    }
  }
}

// Collision Check: AABB Box check (Using 2D game rules for simplified, forgiving hitboxes)
function checkCollision(r1, r2) {
  const paddingX = 24; // 48px total horizontal leniency
  const paddingY = 16; // 32px total vertical leniency
  return (
    r1.x + paddingX < r2.x + r2.width &&
    r1.x + r1.width - paddingX > r2.x &&
    r1.y + paddingY < r2.y + r2.height &&
    r1.y + r1.height - paddingY > r2.y
  );
}

// Reset Game State for a Fresh Run
function restartGame() {
  gameState = STATES.PLAYING;
  distance = 0;
  lives = 3;
  isInvulnerable = false;
  invulnerabilityTimer = 0;
  victorySequenceActive = false;
  victoryTimer = 0;
  husbandX = CANVAS_WIDTH + 100;
  currentStage = STAGES.CAIRO;
  stageMessageTriggered = false;

  obstacles = [];
  items = [];
  textPopups = [];

  // Reset particle pool
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    particlePool[i].active = false;
  }
  
  player.reset();

  document.getElementById('startScreen').classList.remove('active');
  document.getElementById('gameOverScreen').classList.remove('active');
  document.getElementById('winScreen').classList.remove('active');
  updateHUD();
  
  sounds.init();
}

function updateHUD() {
  const heartsContainer = document.getElementById('heartsContainer');
  let heartsStr = '';
  for (let i = 0; i < lives; i++) {
    heartsStr += '❤️';
  }
  for (let i = lives; i < 3; i++) {
    heartsStr += '🖤';
  }
  heartsContainer.textContent = heartsStr;
  document.getElementById('distanceDisplay').textContent = Math.floor(distance);
}

// Main Core Loop with Delta-Time (Decoupled refresh rate)
let lastTimestamp = 0;

function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  
  let dt = (timestamp - lastTimestamp) / 16.67;
  if (dt > 4) dt = 4; 
  lastTimestamp = timestamp;

  if (isPaused) dt = 0; // Freeze all physics and movement

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (gameState === STATES.PLAYING) {
    if (!victorySequenceActive) {
      distance += 0.2 * dt; 
      updateHUD();
      backgroundManager.update(dt);
      updateStage();
      handleSpawning(dt);
    } else {
      updateVictorySequence(dt);
    }

    // 1. Draw the Background
    backgroundManager.draw();

    // Removed the background dimming overlay to reveal true colors of the assets

    if (currentStage === STAGES.RYE_BROOK) {
      const remainingDist = STAGES.RYE_BROOK.end - distance;
      const homeScreenX = remainingDist * 10 + 100; 
      
      ctx.save();
      if (assets.cozy_home) {
        ctx.drawImage(assets.cozy_home, homeScreenX, houseY, 128, 128);
      } else {
        ctx.fillStyle = '#8d6e63'; 
        ctx.fillRect(homeScreenX, houseY + 48, 100, 80);
        ctx.fillStyle = '#b71c1c'; 
        ctx.beginPath();
        ctx.moveTo(homeScreenX - 10, houseY + 48);
        ctx.lineTo(homeScreenX + 50, houseY + 10);
        ctx.lineTo(homeScreenX + 110, houseY + 48);
        ctx.fill();
      }
      ctx.restore();

      if (victorySequenceActive) {
        ctx.save();
        if (assets.husband) {
          // Flip husband horizontally so he faces left towards Ghada
          ctx.translate(husbandX + 34, GROUND_Y + 34);
          ctx.scale(-1, 1);
          ctx.drawImage(assets.husband, -34, -34, 68, 68);
        } else {
          ctx.fillStyle = '#2196f3'; 
          ctx.fillRect(husbandX, GROUND_Y + 16, 44, 52);
          ctx.fillStyle = '#ffe082'; 
          ctx.beginPath();
          ctx.arc(husbandX + 22, GROUND_Y + 10, 10, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 3. Update & Draw Player
    player.update(dt);
    player.draw();

    // 4. Update & Draw Items
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (!victorySequenceActive) item.update(dt);
      item.draw();

      if (checkCollision(player, item)) {
        sounds.playHeal();
        triggerHaptic([50, 50]); 
        
        if (lives < 3) {
          lives++;
          updateHUD();
          textPopups.push(new TextPopup("+1 HEART", player.x + 20, player.y - 10, '#00ffcc'));
        } else {
          textPopups.push(new TextPopup("+50m BONUS", player.x + 20, player.y - 10, '#ffd700'));
          distance += 50; 
        }
        createExplosion(item.x + 16, item.y + 16, '#ff3366', 8);
        items.splice(i, 1);
        continue;
      }

      if (item.x < -40) {
        items.splice(i, 1);
      }
    }

    // 5. Update & Draw Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      if (!victorySequenceActive) obs.update(dt);
      obs.draw();

      if (!isInvulnerable && !victorySequenceActive && checkCollision(player, obs)) {
        sounds.playHurt();
        triggerHaptic([100]); 
        
        lives--;
        updateHUD();
        createExplosion(player.x + 34, player.y + 34, '#ff3366', 15);
        textPopups.push(new TextPopup("OUCH!", player.x + 20, player.y - 20, '#ff3366'));

        if (lives <= 0) {
          gameState = STATES.GAME_OVER;
          sounds.playGameOver();
          
          if (Math.floor(distance) > highScore) {
            highScore = Math.floor(distance);
            localStorage.setItem('ghada_highscore', highScore);
          }
          
          document.getElementById('gameOverDistance').textContent = Math.floor(distance);
          document.getElementById('gameOverBest').textContent = highScore;
          document.getElementById('gameOverScreen').classList.add('active');
        } else {
          isInvulnerable = true;
          invulnerabilityTimer = 90; 
        }
        
        obstacles.splice(i, 1);
        continue;
      }

      if (obs.x < -80) {
        obstacles.splice(i, 1);
      }
    }

    if (isInvulnerable) {
      invulnerabilityTimer -= dt;
      if (invulnerabilityTimer <= 0) {
        isInvulnerable = false;
      }
    }

    // 6. Draw particles (No shadows for performance)
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = particlePool[i];
      if (p.active) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.1 * dt; 
        p.life -= p.decay * dt;
        if (p.life <= 0) {
          p.active = false;
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
    }
    ctx.globalAlpha = 1.0; 

    // 7. Draw text popups (No shadows)
    for (let i = textPopups.length - 1; i >= 0; i--) {
      const pop = textPopups[i];
      pop.update(dt);
      pop.draw();
      if (pop.life <= 0) {
        textPopups.splice(i, 1);
      }
    }

  } else {
    backgroundManager.draw();
    player.draw();
  }

  requestAnimationFrame(gameLoop);
}

// Jump / Flap Trigger action
function handleScreenTap(e) {
  if (gameState !== STATES.PLAYING || victorySequenceActive || isPaused) return;

  if (e) {
    e.preventDefault();
  }

  const isFlapper = currentStage.type === 'flapper';

  if (isFlapper) {
    player.vy = player.flapForce;
    sounds.playFlap();
    createExplosion(player.x, player.y + 24, '#ffffff', 4);
  } else {
    if (player.y >= GROUND_Y) {
      player.vy = player.jumpForce;
      sounds.playJump();
      createExplosion(player.x + 34, player.y + 68, '#c5a059', 6);
    }
  }
}

// Window Event Listeners & Bootstrapping
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      handleScreenTap();
    }
  });

  canvas.addEventListener('touchstart', handleScreenTap, { passive: false });
  canvas.addEventListener('mousedown', handleScreenTap);

  document.getElementById('startButton').addEventListener('click', (e) => {
    e.stopPropagation();
    sounds.init();
    restartGame();
  });

  document.getElementById('retryButton').addEventListener('click', (e) => {
    e.stopPropagation();
    restartGame();
  });

  document.getElementById('restartButton').addEventListener('click', (e) => {
    e.stopPropagation();
    restartGame();
  });

  const soundBtn = document.getElementById('soundToggle');
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
  });

  document.getElementById('pauseButton').addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState === STATES.PLAYING) {
      isPaused = !isPaused;
      document.getElementById('pauseButton').textContent = isPaused ? '▶️' : '⏸️';
      if (isPaused) {
        document.getElementById('pauseScreen').classList.add('active');
      } else {
        document.getElementById('pauseScreen').classList.remove('active');
      }
    }
  });

  document.getElementById('resumeButton').addEventListener('click', (e) => {
    e.stopPropagation();
    isPaused = false;
    document.getElementById('pauseButton').textContent = '⏸️';
    document.getElementById('pauseScreen').classList.remove('active');
  });

  loadAllAssets(() => {
    console.log("Assets loaded. Launching loop.");
    requestAnimationFrame(gameLoop);
  });
});
