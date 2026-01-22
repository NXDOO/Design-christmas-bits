export type MiniGameOptions = { levels?: number; diffsPerLevel?: number };

type Rect = { x: number; y: number; w: number; h: number };

export class MiniGame {
  overlay: HTMLDivElement;
  leftCanvas: HTMLCanvasElement;
  rightCanvas: HTMLCanvasElement;
  ctxL: CanvasRenderingContext2D;
  ctxR: CanvasRenderingContext2D;
  level = 0;
  totalLevels: number;
  options: MiniGameOptions;
  differences: Rect[] = [];
  found: boolean[] = [];

  // Hardcoded coordinates for the 3 levels as requested
  // Level 1: 16,380 to 145,440
  // Level 2: 406,270 to 488,350
  // Level 3: 380,330 to 520,370
  private levelData: Rect[][] = [
    // Level 1
    [
      { x: 120, y: 530, w: 120, h: 50 } // Corrected based on feedback
    ],
    // Level 2
    [
      { x: 406, y: 270, w: 82, h: 80 }
    ],
    // Level 3
    [
      { x: 380, y: 330, w: 140, h: 40 }
    ]
  ];

  constructor(opts?: MiniGameOptions) {
    this.options = opts || {};
    this.totalLevels = 3; // Fixed to 3 based on provided assets

    this.overlay = document.createElement('div');
    this.overlay.className = 'fullscreen-overlay hidden';
    this.overlay.style.zIndex = '9999'; // Ensure on top

    // Window Container (White Theme)
    const windowEl = document.createElement('div');
    windowEl.className = 'mini-window';
    windowEl.style.backgroundColor = '#fff';
    windowEl.style.padding = '8px';
    windowEl.style.border = '4px solid #000';
    windowEl.style.boxShadow = '8px 8px 0 rgba(0,0,0,0.2)';
    windowEl.style.color = '#000';
    windowEl.style.display = 'inline-block';
    windowEl.style.maxWidth = '95vw';
    windowEl.style.maxHeight = '95vh';
    windowEl.style.overflow = 'auto';
    windowEl.style.position = 'relative';

    const header = document.createElement('div');
    header.className = 'mini-header';
    header.textContent = 'Spot Differences (Bob)';
    header.style.background = '#0984e3'; // Bob Blue
    header.style.color = '#fff';
    header.style.padding = '10px';
    header.style.marginBottom = '12px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.className = 'close-btn-pixel';
    closeBtn.style.width = '24px';
    closeBtn.style.height = '24px';
    closeBtn.style.lineHeight = '20px';
    closeBtn.style.textAlign = 'center';
    closeBtn.style.background = '#e74c3c';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = '2px solid #000';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontFamily = "inherit";
    
    closeBtn.addEventListener('click', () => {
      this.overlay.classList.add('hidden');
      if ((this as any)._resolve) (this as any)._resolve(false);
    });
    header.appendChild(closeBtn);

    const container = document.createElement('div');
    container.className = 'mini-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column'; // Allow header to stack
    container.style.alignItems = 'center';

    // Instruction Text
    const instruction = document.createElement('div');
    instruction.textContent = "Find differences on the RIGHT image";
    instruction.style.fontFamily = "'Press Start 2P', cursive";
    instruction.style.fontSize = '12px';
    instruction.style.marginBottom = '12px';
    instruction.style.color = '#2c3e50'; 
    container.appendChild(instruction);

    // Add CSS for pulse animation and cursors
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse-green {
            0% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); order-color: #2ecc71; }
            70% { box-shadow: 0 0 0 6px rgba(46, 204, 113, 0); border-color: #2ecc71; }
            100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); border-color: #000; }
        }
        .mini-canvas-right {
            cursor: crosshair !important;
            animation: pulse-green 2s infinite;
        }
        .mini-canvas-left {
            cursor: not-allowed !important;
            filter: grayscale(20%);
        }
    `;
    document.head.appendChild(style);

    const canvasRow = document.createElement('div');
    canvasRow.style.display = 'flex';
    canvasRow.style.gap = '20px';
    canvasRow.style.justifyContent = 'center';
    canvasRow.style.flexWrap = 'wrap';

    this.leftCanvas = document.createElement('canvas');
    this.rightCanvas = document.createElement('canvas');
    
    // Left Column
    const leftCol = document.createElement('div');
    leftCol.style.display = 'flex';
    leftCol.style.flexDirection = 'column';
    leftCol.style.alignItems = 'center';
    const leftLabel = document.createElement('div');
    leftLabel.textContent = "ORIGINAL (Reference)";
    leftLabel.style.fontFamily = "'Press Start 2P', cursive";
    leftLabel.style.fontSize = '8px';
    leftLabel.style.marginBottom = '6px';
    leftLabel.style.color = '#7f8c8d';
    leftCol.appendChild(leftLabel);
    
    this.leftCanvas.className = 'mini-canvas-left';
    leftCol.appendChild(this.leftCanvas);

    // Right Column
    const rightCol = document.createElement('div');
    rightCol.style.display = 'flex';
    rightCol.style.flexDirection = 'column';
    rightCol.style.alignItems = 'center';
    const rightLabel = document.createElement('div');
    rightLabel.innerHTML = "CLICK HERE! &darr;";
    rightLabel.style.fontFamily = "'Press Start 2P', cursive";
    rightLabel.style.fontSize = '10px'; // Slightly larger
    rightLabel.style.marginBottom = '6px';
    rightLabel.style.color = '#27ae60';
    rightLabel.style.fontWeight = 'bold';
    rightCol.appendChild(rightLabel);

    this.rightCanvas.className = 'mini-canvas-right';
    rightCol.appendChild(this.rightCanvas);

    // Initial size setup
    this.leftCanvas.width = this.rightCanvas.width = 300;
    this.leftCanvas.height = this.rightCanvas.height = 200;
    
    const commonStyle = 'border: 4px solid #000; width: 320px; height: auto; image-rendering: pixelated; touch-action: none;';
    this.leftCanvas.setAttribute('style', commonStyle);
    this.rightCanvas.setAttribute('style', commonStyle);

    canvasRow.appendChild(leftCol);
    canvasRow.appendChild(rightCol);
    container.appendChild(canvasRow);

    const footer = document.createElement('div');
    footer.className = 'mini-footer';
    footer.style.marginTop = '12px';
    footer.style.textAlign = 'center';
    footer.innerHTML = `<span class="mini-progress">Level <b class="mini-level">0</b> / ${this.totalLevels}</span>`;

    windowEl.appendChild(header);
    windowEl.appendChild(container);
    windowEl.appendChild(footer);
    this.overlay.appendChild(windowEl);
    document.body.appendChild(this.overlay);

    this.ctxL = this.leftCanvas.getContext('2d')!;
    this.ctxR = this.rightCanvas.getContext('2d')!;

    this.rightCanvas.addEventListener('click', (e) => this.onClick(e));
  }

  async start(): Promise<boolean> {
    this.level = 0;
    this.overlay.classList.remove('hidden');
    
    return new Promise((resolve) => {
      (this as any)._resolve = resolve;
      this.nextLevel();
    });
  }

  async nextLevel() {
    this.level++;
    if (this.level > this.totalLevels) {
      this.overlay.classList.add('hidden');
      if ((this as any)._resolve) (this as any)._resolve(true);
      return;
    }
    await this.setupLevel(this.level);
  }

  loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.error(`Failed to load image: ${src}`, e);
        reject(e);
      };
      img.src = src;
    });
  }

  async setupLevel(n: number) {
    const levelDisplay = this.overlay.querySelector('.mini-level');
    if (levelDisplay) levelDisplay.textContent = String(n);

    try {
        // Load assets from public/ (served at root /)
        // Adjust paths if needed based on build setup. Assuming standard Vite/Webpack public folder behavior.
        const [imgSample, imgCheck] = await Promise.all([
            this.loadImage(import.meta.env.BASE_URL + `Sample${n}.png`),
            this.loadImage(import.meta.env.BASE_URL + `Check${n}.png`)
        ]);

        // Resize canvases to match image natural size to preserve PROPORTION
        // We use the image's actual size for the canvas resolution
        this.leftCanvas.width = imgSample.naturalWidth;
        this.leftCanvas.height = imgSample.naturalHeight;
        this.rightCanvas.width = imgCheck.naturalWidth;
        this.rightCanvas.height = imgCheck.naturalHeight;
        
        // Draw images at natural size
        this.ctxL.drawImage(imgSample, 0, 0);
        this.ctxR.drawImage(imgCheck, 0, 0);

        // Update CSS to keep width 320px but adjust height to match aspect ratio
        const aspect = imgSample.naturalHeight / imgSample.naturalWidth;
        const cssHeight = Math.floor(320 * aspect);
        
        // Apply CSS updates
        const updateStyle = (canvas: HTMLCanvasElement) => {
             canvas.style.width = '320px';
             canvas.style.height = `${cssHeight}px`;
        };
        updateStyle(this.leftCanvas);
        updateStyle(this.rightCanvas);

        // Setup logic
        const levelIndex = n - 1;
        this.differences = this.levelData[levelIndex] || [];
        this.found = this.differences.map(() => false);

    } catch (err) {
        console.error("Error setting up level " + n, err);
        // Fallback or error handling
        this.ctxL.fillStyle = 'red';
        this.ctxL.fillText('Error loading images', 10, 50);
    }
  }

  onClick(e: MouseEvent) {
    const rect = this.rightCanvas.getBoundingClientRect();
    
    // Calculate scale factor in case displayed size != actual canvas size (css resizing)
    const scaleX = this.rightCanvas.width / rect.width;
    const scaleY = this.rightCanvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check hit
    let hit = false;
    for (let i = 0; i < this.differences.length; i++) {
      if (this.found[i]) continue;
      
      const d = this.differences[i];
      if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) {
        this.found[i] = true;
        this.drawMarker(d);
        hit = true;
      }
    }

    if (hit) {
        // Check if all found
        if (this.found.every(Boolean)) {
            // Level Complete
             setTimeout(() => {
                this.nextLevel();
             }, 800);
        }
    }
  }

  drawMarker(d: Rect) {
    const ctx = this.ctxR;
    const pixelSize = 4;
    
    // Reset shadow to ensure no shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = '#2ecc71'; // Green Checkmark

    const cx = Math.floor(d.x + d.w / 2);
    const cy = Math.floor(d.y + d.h / 2);
    
    // 8-bit Checkmark Pattern (offsets from center)
    const offsets = [
        // Short stroke (Left)
        {x: -4, y: 0}, {x: -3, y: 1}, {x: -2, y: 2}, {x: -1, y: 3},
        // Pivot
        {x: 0, y: 2},
        // Long stroke (Right)
        {x: 1, y: 1}, {x: 2, y: 0}, {x: 3, y: -1}, {x: 4, y: -2}, {x: 5, y: -3}, {x: 6, y: -4}
    ];

    // Thicken it slightly for visibility
    const drawPixel = (ox: number, oy: number) => {
        ctx.fillRect(cx + ox * pixelSize, cy + oy * pixelSize, pixelSize, pixelSize);
        // Shadow/Outline effect (optional)
        // ctx.strokeRect(cx + ox * pixelSize, cy + oy * pixelSize, pixelSize, pixelSize); 
    };

    offsets.forEach(p => drawPixel(p.x, p.y));
    // Draw a second adjacent line to make it bold?
    // offsets.forEach(p => drawPixel(p.x, p.y + 1)); 
  }
}

export default MiniGame;
