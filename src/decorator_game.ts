  

export class DecoratorGame {
  overlay: HTMLDivElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tileSize = 32;
  
  // Interaction state
  selectedId: string | null = null;
  cursorImg: HTMLImageElement;
  
  // Define items with their grid positions (x,y) and size (w,h in tiles)
  // Added offsetX/offsetY for fine adjustments (in pixels)
  items = [
    { id: 'tree', name: 'Tree', x: 6, y: 2, w: 3, h: 3, placed: false, imgSrc: '/tree.png', offsetX: 0, offsetY: 0 },
    { id: 'flower', name: 'Flower', x: 1, y: 3, w: 2, h: 2, placed: false, imgSrc: '/flower.png', offsetX: 32, offsetY: -32 },
    { id: 'balloon', name: 'Balloon', x: 4, y: 0, w: 1, h: 2, placed: false, imgSrc: '/balloon.png', offsetX: 0, offsetY: 32 }
  ];
  
  images: Record<string, HTMLImageElement> = {};
  bgImage: HTMLImageElement;
  
  _resolve: ((val: boolean) => void) | null = null;
  paletteEls: Record<string, HTMLDivElement> = {}; // Track palette elements to update UI

  constructor() {
    // Preload images
    this.bgImage = new Image();
    const base = import.meta.env.BASE_URL;
    this.bgImage.src = base + 'party.png?v=' + Date.now();
    
    this.items.forEach(item => {
        const img = new Image();
        // Assume item.imgSrc has a leading slash
        img.src = base + item.imgSrc.substring(1) + '?v=' + Date.now();
        this.images[item.id] = img;
    });

    // Create the "floating" cursor image
    this.cursorImg = document.createElement('img');
    this.cursorImg.style.position = 'fixed';
    this.cursorImg.style.pointerEvents = 'none'; // Click through it
    this.cursorImg.style.zIndex = '9999';
    this.cursorImg.style.opacity = '0.8';
    this.cursorImg.style.display = 'none';
    this.cursorImg.style.imageRendering = 'pixelated';
    document.body.appendChild(this.cursorImg);

    // Global Mouse Tracking for cursor item
    document.addEventListener('mousemove', (e) => {
        if (this.selectedId && !this.overlay.classList.contains('hidden')) {
            // Center the image on the cursor
            const w = this.cursorImg.width || 32;
            const h = this.cursorImg.height || 32;
            this.cursorImg.style.left = (e.clientX - w/2) + 'px';
            this.cursorImg.style.top = (e.clientY - h/2) + 'px';
        }
    });

    // Cancel selection on right click
    document.addEventListener('contextmenu', (e) => {
        if (this.selectedId && !this.overlay.classList.contains('hidden')) {
            e.preventDefault();
            this.deselect();
        }
    });

    this.overlay = document.createElement('div');
    this.overlay.className = 'fullscreen-overlay hidden'; 
    
    // Create a Window Container for the game to simulate a popup
    const windowEl = document.createElement('div');
    windowEl.className = 'mini-window';
    windowEl.style.backgroundColor = '#fff'; // White background
    windowEl.style.padding = '8px'; 
    windowEl.style.border = '4px solid #000'; // Black border
    windowEl.style.boxShadow = '8px 8px 0 rgba(0,0,0,0.2)';
    windowEl.style.display = 'block'; 
    windowEl.style.width = '420px'; 
    windowEl.style.maxWidth = '90vw'; 
    windowEl.style.position = 'relative';

    const header = document.createElement('div');
    header.className = 'mini-header';
    header.textContent = 'Click to Pick & Place';
    header.style.background = '#e67e22'; 
    header.style.color = '#fff';
    header.style.padding = '10px';
    header.style.fontFamily = "'Press Start 2P', cursive";
    header.style.fontSize = '12px';
    header.style.marginBottom = '8px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    // Close Button (Pixel Art Style)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.className = 'close-btn-pixel';
    closeBtn.style.width = '24px';
    closeBtn.style.height = '24px';
    closeBtn.style.lineHeight = '20px'; 
    closeBtn.style.padding = '0';
    closeBtn.style.textAlign = 'center';
    closeBtn.style.background = '#e74c3c';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = '2px solid #000'; // Black border for white theme
    closeBtn.style.boxShadow = '2px 2px 0px #000';  
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '10px';
    closeBtn.style.fontFamily = "'Press Start 2P', cursive";
    
    closeBtn.addEventListener('click', () => {
      this.overlay.classList.add('hidden');
      this.deselect(); // Cleanup
      if (this._resolve) this._resolve(false);
    });
    header.appendChild(closeBtn);
    windowEl.appendChild(header);

    const container = document.createElement('div');
    container.className = 'mini-container';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.background = 'transparent';
    container.style.padding = '0';

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 288;
    this.canvas.height = 192; 
    this.canvas.style.width = '288px';
    this.canvas.style.height = '192px';
    this.canvas.style.border = '4px solid #bdc3c7';
    this.canvas.style.background = '#222';
    this.canvas.style.borderRadius = '0px';
    this.canvas.style.imageRendering = 'pixelated';
    
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    // Click to Place Logic
    this.canvas.addEventListener('click', (e) => {
        if (!this.selectedId) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const gridX = Math.floor(x / this.tileSize);
        const gridY = Math.floor(y / this.tileSize);

        // Check if selected item fits here
        const item = this.items.find(i => i.id === this.selectedId);
        if (item) {
             let hit = false;
             // Loose check: Expand target area by 1 tile tolerance in all directions
             const tolerance = 1;
             
             if (gridX >= item.x - tolerance && gridX < item.x + item.w + tolerance && 
                 gridY >= item.y - tolerance && gridY < item.y + item.h + tolerance) {
                 hit = true;
             }
             
             if (hit) {
                 item.placed = true;
                 this.render();
                 this.checkWin();
                 this.deselect();
                 this.updatePaletteUI();
             } else {
                 // Feedback for bad placement?
                 console.log("Missed placement");
             }
        }
    });

    // Palette / Controls
    const palette = document.createElement('div');
    palette.style.display = 'flex';
    palette.style.gap = '40px';
    palette.style.marginBottom = '30px';
    palette.style.marginTop = '12px';
    palette.style.justifyContent = 'center';
    palette.style.alignItems = 'flex-end'; // Bottom align items
    palette.style.width = '100%';
    palette.style.minHeight = '60px'; // Reserve space for items

    this.items.forEach(item => {
        const itemContainer = document.createElement('div');
        itemContainer.style.display = 'flex';
        itemContainer.style.flexDirection = 'column';
        itemContainer.style.alignItems = 'center';
        itemContainer.style.cursor = 'pointer';
        itemContainer.style.padding = '4px';
        itemContainer.className = 'palette-item'; // For easier styling
        
        // Image Icon
        const img = document.createElement('img');
        img.src = base + item.imgSrc.substring(1);
        // img.style.width = '32px'; // Removed fixed width
        img.style.height = 'auto'; 
        img.style.imageRendering = 'pixelated';
        img. draggable = false; // Disable native drag
        
        // Click Handler (Pick Up / Put Back)
        itemContainer.addEventListener('click', () => {
            if (item.placed) return;

            if (this.selectedId === item.id) {
                // Drop it back (deselect)
                this.deselect();
            } else {
                // Pick it up
                this.selectItem(item.id);
            }
        });

        // Removed Label
        // const label = document.createElement('span');
        // label.textContent = item.name; 
        
        itemContainer.appendChild(img);
        // itemContainer.appendChild(label);
        
        this.paletteEls[item.id] = itemContainer;
        palette.appendChild(itemContainer);
    });

    container.appendChild(this.canvas);
    container.appendChild(palette);

    windowEl.appendChild(container);
    this.overlay.appendChild(windowEl);
    document.body.appendChild(this.overlay);
  }

  selectItem(id: string) {
      this.selectedId = id;
      const item = this.items.find(i => i.id === id);
      if (item) {
          // Update cursor image
          this.cursorImg.src = import.meta.env.BASE_URL + item.imgSrc.substring(1);
          this.cursorImg.style.display = 'block';
          // Initial Position (will update on mousemove)
      }
      this.updatePaletteUI();
  }

  deselect() {
      this.selectedId = null;
      this.cursorImg.style.display = 'none';
      this.updatePaletteUI();
  }

  updatePaletteUI() {
      this.items.forEach(item => {
          const el = this.paletteEls[item.id];
          if (el) {
              // Reset styles
              // Use transparent border to prevent layout jitter (height change) when switching between border/no-border
              el.style.border = '2px solid transparent'; 
              el.style.backgroundColor = 'transparent';
              el.style.borderRadius = '4px';

              if (item.placed) {
                  el.style.opacity = '0.3';
                  el.style.cursor = 'default';
              } else {
                  el.style.opacity = '1';
                  el.style.cursor = 'pointer';
                  
                  if (item.id === this.selectedId) {
                      // Highlight selected
                      el.style.border = '2px dashed #e67e22';
                      el.style.backgroundColor = 'rgba(230, 126, 34, 0.1)';
                  }
              }
          }
      });
  }

  start(): Promise<boolean> {
/* Lines 218-266 omitted */
    this.overlay.classList.remove('hidden');
    
    // Reset
    this.items.forEach(i => i.placed = false);
    this.updatePaletteUI();
    
    this.render();
    
    return new Promise((resolve) => {
        this._resolve = resolve;
    });
  }

  render() {
      // Clear
      this.ctx.fillStyle = '#34495e'; // default bg color
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw Background
      if (this.bgImage.complete && this.bgImage.naturalWidth > 0) {
          // Draw image to fit canvas (9x9 tiles = 288x288)
          // User said image is 9x6. 
          // We should center it vertically or draw it at top?
          // Since items are at y=7, y=8 which is row 8 and 9 (0-indexed 7,8 are 8th and 9th row).
          // If bg is 6 rows high (0-5), it won't cover items at 7,8.
          // User said "9=32*9，6=32*6，是格子的意思".
          // If the BG is only 6 tiles high, the items at y=7,8 will be on black background.
          // Unless the user meant the game logical area is larger, or BG should stretch/tile.
          // Let's draw it at (0,0).
          this.ctx.drawImage(this.bgImage, 0, 0, this.bgImage.width, this.bgImage.height, 0, 0, 288, 192);
      }

      // Draw Items
      this.items.forEach(item => {
          if (item.placed) {
              const img = this.images[item.id];
              if (img && img.complete && img.naturalWidth > 0) {
                  // Draw raw image at grid position + offset
                  this.ctx.drawImage(
                      img, 
                      item.x * this.tileSize + (item.offsetX || 0), 
                      item.y * this.tileSize + (item.offsetY || 0)
                  );
              } else {
                  // Fallback
                  this.ctx.fillStyle = item.id === 'tree' ? '#27ae60' : (item.id === 'flower' ? '#e84393' : '#e17055');
                  this.ctx.fillRect(item.x * this.tileSize, item.y * this.tileSize, item.w * this.tileSize, item.h * this.tileSize);
                  this.ctx.fillStyle = '#fff';
                  this.ctx.font = '10px monospace';
                  this.ctx.fillText(item.name, item.x * this.tileSize + 5, item.y * this.tileSize + 15);
              }
          } else {
              // Maybe draw ghost? Optional.
              // For now draw nothing.
          }
      });
  }

  checkWin() {
      if (this.items.every(i => i.placed)) {
          setTimeout(() => {
              this.overlay.classList.add('hidden');
              if (this._resolve) this._resolve(true);
          }, 500);
      }
  }
}

export default DecoratorGame;
