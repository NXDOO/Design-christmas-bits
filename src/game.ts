type Pos = { x: number; y: number };

export interface SimpleMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  data: number[];
  objects?: Array<{ type: string; tileX: number; tileY: number; [k: string]: any }>;
  layers?: Array<{ data: number[]; type: string; visible?: boolean; name?: string }>;
  tilesets?: Array<{ firstgid: number; imageElement: HTMLImageElement; tilewidth: number; tileheight: number; imagewidth: number }>;
}

import { MiniGame } from './mini_game';
import { QuestManager, NPCType } from './quest';
import Party from './party';
import { createPartyMap, createPartyNPCs } from './party_map';
import { loadTiledMap } from './tiled_loader';

export class Game {
  tileSize = 32;
  map: SimpleMap;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  player: Pos;
  // NPC Properties updated to include visualPos for smoothing
  npcs: Array<{ x: number; y: number; visualX?: number; visualY?: number; type: string; name?: string; dir?: number; lastMoveTime?: number; playingGiftAnim?: boolean; giftAnimStart?: number }> = [];
  taskUiEl: HTMLDivElement | null = null;
  dialogEl: HTMLDivElement;
  dialogOpen = false;
  tilesetImage: HTMLCanvasElement | HTMLImageElement;
  miniGames?: Record<string, any>;
  quest?: QuestManager;
  party?: Party;
  dialogScripts?: Record<string, any>;
  onDialogClose?: () => void;
  isPaused = false;
  
  // Camera State
  cameraPos: { x: number; y: number } | null = null;
  visualPos: { x: number; y: number } | null = null;
  lockCamera = false;
  isInPartyMap = false;

  // Hero Sprite properties
  heroStandImage: HTMLImageElement;
  heroRunImage: HTMLImageElement;
  
  // NPC Sprite properties
  npcImages: Record<string, { stand: HTMLImageElement; run: HTMLImageElement }> = {};
  npc5Images: { stand: HTMLImageElement; gift: HTMLImageElement };

  // UI Sprites
  questMarkImage: HTMLImageElement;
  bgm: HTMLAudioElement;

  // Dialog System
  dialogQueue: Array<{ text: string; name?: string; avatarUrl?: string }> = [];
  dialogIndex: number = 0;

  heroDir: number = 3; // 0: Right, 1: Up, 2: Left, 3: Down
  heroFrame: number = 0; // 0-5
  lastMoveTime: number = 0;
  animTimer: number = 0;
  
  constructor(canvas: HTMLCanvasElement, dialogEl: HTMLDivElement, map: SimpleMap, tilesetImage: HTMLCanvasElement | HTMLImageElement | null, miniGames?: Record<string, any>, quest?: QuestManager, party?: Party, dialogScripts?: Record<string, any>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.dialogEl = dialogEl;
    this.map = map;
    this.tileSize = map.tilewidth;
    this.tilesetImage = tilesetImage || new Image();
    this.miniGames = miniGames;
    this.quest = quest;
    this.party = party;
    this.dialogScripts = dialogScripts;

    // Load Hero Images
    this.heroStandImage = new Image();
    const v = Date.now();
    this.heroStandImage.src = `/hero_stand.png?v=${v}`;
    this.heroRunImage = new Image();
    this.heroRunImage.src = `/hero_run.png?v=${v}`;

    // Load UI Images
    this.questMarkImage = new Image();
    this.questMarkImage.src = `/quest_mark.png?v=${v}`;

    // Load BGM
    // Add timestamp to prevent caching old version
    this.bgm = new Audio('/bgm.mp3?v=' + Date.now());
    this.bgm.loop = true;
    this.bgm.volume = 0.2;
    this.bgm.muted = false; // Default unmuted

    // Load NPC Images
    const npcTypes = ['aa', 'decorator', 'photographer', 'bartender'];
    // Add 6 Extra NPCs: extra_1 to extra_6
    for (let i = 1; i <= 6; i++) {
        npcTypes.push(`extra_${i}`);
    }
    
    npcTypes.forEach(type => {
      this.npcImages[type] = {
        stand: new Image(),
        run: new Image()
      };
      const v = Date.now();
      this.npcImages[type].stand.src = `/${type}_stand.png?v=${v}`;
      this.npcImages[type].run.src = `/${type}_run.png?v=${v}`;
    });

    // Load NPC5 (Santa)
    this.npc5Images = {
        stand: new Image(),
        gift: new Image()
    };
    const v5 = Date.now();
    this.npc5Images.stand.src = `/Santa_stand.png?v=${v5}`;
    this.npc5Images.gift.src = `/Santa_gift.png?v=${v5}`;
    
    ctx.imageSmoothingEnabled = false;

    this.player = { x: 1, y: 1 };
    if (map.objects) {
      for (const o of map.objects) {
        if (o.type === 'player') {
            this.player = { x: o.tileX, y: o.tileY };
        } else {
            // Check if this NPC is blocking the start position (58, 47)
            let tx = o.tileX;
            let ty = o.tileY;
            
            // Move away if blocking start
            if (tx === 58 && ty === 47) {
                console.log(`Moved NPC ${o.name} from (58,47) to (60,47) to clear start pos.`);
                tx = 60;
            }

            this.npcs.push({ x: tx, y: ty, type: o.type, name: o.name });
        }
      }
    }

    this.createTaskUI();
    this.updateDebugCoords();
  }

  isOccupiedByNPC(x: number, y: number, ignore?: { x: number; y: number; type?: string }) {
    for (const n of this.npcs) {
      if (ignore && n === ignore) continue;
      
      if (n.type === 'npc5') {
          // Santa Special Collision:
          // User wants to be able to walk on the feet row (y=8): (10,8), (11,8), (12,8).
          // We only block the row above (y=7): (10,7), (11,7), (12,7).
          if (y === n.y - 1 && x >= n.x - 1 && x <= n.x + 1) {
              return true;
          }
          // Do NOT block (n.x, n.y) which is (11,8).
          continue;
      }

      // Standard Check
      if (n.x === x && n.y === y) return true;
    }
    return false;
  }

  start() {
    requestAnimationFrame(this.loop.bind(this));
  }

  async playIntroSequence() {
      // 1. Wait a moment for map load
      await this.sleep(500);
      
      this.lockCamera = true; // Lock camera to center on hero

      // 2. Walk from (58, 47) to (58, 56)
      // Visual feedback: ensure player is looking down (3) initially? 
      // He starts at 58,47. Target is down.
      await this.movePlayerCutscene(58, 56);

      // 3. Monologue
      const monologue = "The Christmas party is about to start! As a member of the entertainment committee, let me ask Alice what else needs to be prepared.";
      
      this.showDialog(monologue, { name: 'Tom' });
      await this.waitForDialogClose();
      
      this.lockCamera = false; // Release camera
  }

  sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

  async moveNPCToPlayer(npc: { x: number; y: number; type: string; dir?: number; lastMoveTime?: number }, ignoreCollision = false) {
    // Move NPC step-by-step until adjacent to player (Manhattan distance 1)
    const maxSteps = 200;
    let steps = 0;
    while (Math.abs(npc.x - this.player.x) + Math.abs(npc.y - this.player.y) > 1 && steps < maxSteps) {
      const dx = this.player.x > npc.x ? 1 : (this.player.x < npc.x ? -1 : 0);
      const dy = this.player.y > npc.y ? 1 : (this.player.y < npc.y ? -1 : 0);
      
      let moved = false;
      
      // Helper to try move
      const tryMove = (tx: number, ty: number, dir: number) => {
          // Check Walkable
          if (!this.isWalkable(tx, ty)) return false;
          
          // Check NPC Collision (unless ignored)
          if (!ignoreCollision && this.isOccupiedByNPC(tx, ty)) return false;
          
          // Always check Player Collision (don't walk on top of player)
          if (tx === this.player.x && ty === this.player.y) return false;

          npc.x = tx;
          npc.y = ty;
          npc.dir = dir;
          npc.lastMoveTime = Date.now();
          return true;
      };

      // 1. Try Vertical Move (Preferred, swapped based on user request)
      if (dy !== 0) {
          if (tryMove(npc.x, npc.y + dy, dy > 0 ? 3 : 1)) moved = true;
      }

      // 2. Try Horizontal Move (If V failed or dx is preferred/needed)
      if (!moved && dx !== 0) {
          if (tryMove(npc.x + dx, npc.y, dx > 0 ? 0 : 2)) moved = true;
      }
      
      // 3. Anti-Stuck / Sliding Logic
      if (!moved) {
          // If wanted to move Y but blocked: Try moving X (Left or Right)
          if (dy !== 0) {
               // Try Right
               if (tryMove(npc.x + 1, npc.y, 0)) moved = true;
               // If not, Try Left
               else if (tryMove(npc.x - 1, npc.y, 2)) moved = true;
          }
          // If wanted to move X but blocked: Try moving Y (Up or Down)
          else if (dx !== 0) {
              // Try Down
              if (tryMove(npc.x, npc.y + 1, 3)) moved = true;
              // If not, Try Up
              else if (tryMove(npc.x, npc.y - 1, 1)) moved = true;
          } 
      }

      this.render();
      await this.sleep(140);
      steps++;
    }
  }

  waitForDialogClose(): Promise<void> {
    return new Promise((resolve) => {
      const iv = setInterval(() => {
        if (!this.dialogOpen) {
          clearInterval(iv);
          resolve();
        }
      }, 80);
    });
  }

  async handleAllTasksCompleted() {
    // Find AA and move them to the player, then show dialog and switch to party map
    const aa = this.npcs.find(n => n.type === 'aa');
    if (aa) {
      // Teleport if too far
      const dist = Math.abs(aa.x - this.player.x) + Math.abs(aa.y - this.player.y);
      // Threshold 18 (screen width approx 10-15 tiles depending on zoom). 
      // User requested "10 blocks" (10 grids) proximity. 
      // If > 12 tiles away, we teleport closer (to ~8-10 tiles away).
      if (dist > 12) {
          const w = Math.ceil(this.canvas.width / this.tileSize);
          const h = Math.ceil(this.canvas.height / this.tileSize);
          // Try to spawn at edge of screen or slightly offscreen (e.g. 10 tiles away)
          // Camera logic puts player at center. Screen radius is w/2, h/2.
          // Let's pick a spot approx 8-10 tiles away from player in a cardinal direction
          // But ensure it is walkable and reachable
          
          let spawned = false;
          // Search in a spiral or circle around player at radius 8-10
          for (let r = 8; r <= 10; r++) { 
             const dirs = [
                 { x: 0, y: r }, { x: 0, y: -r }, { x: r, y: 0 }, { x: -r, y: 0 },
                 { x: r, y: r }, { x: -r, y: -r }, { x: r, y: -r }, { x: -r, y: r }
             ];
             for (const d of dirs) {
                 const cx = this.player.x + d.x;
                 const cy = this.player.y + d.y;
                 if (cx >= 0 && cx < this.map.width && cy >= 0 && cy < this.map.height) {
                     // Ensure valid floor to prevent spawning in void/outside walls
                     const idx = cy * this.map.width + cx;
                     const f1 = this.map.layers?.find(l => l.name === 'floor')?.data?.[idx] || 0;
                     const f2 = this.map.layers?.find(l => l.name === 'floor2')?.data?.[idx] || 0;
                     const hasFloor = (f1 !== 0) || (f2 !== 0);
                     
                    if (hasFloor && this.isWalkable(cx, cy) && !this.isOccupiedByNPC(cx, cy)) {
                        aa.x = cx;
                        aa.y = cy;
                        aa.visualX = cx;
                        aa.visualY = cy;
                        spawned = true;
                        break;
                    }
                 }
             }
             if (spawned) break;
          }
      }

      // Force ignore collision with other NPCs to prevent getting stuck
      await this.moveNPCToPlayer(aa, true);
      this.showDialog('Everyone is waiting at the party room. Hurry up, we are taking a photo soon!', { name: 'Alice' });
      await this.waitForDialogClose();
    }

    // Load Party Map
    try {
        const { map: partyMap } = await loadTiledMap('/party_map.json');
        this.isInPartyMap = true;
        this.map = partyMap;
        this.cameraPos = null; // Reset camera
        this.npcs = [];
        
        // Setup Player and initial Map NPCs
        let playerSet = false;
        if (partyMap.objects) {
            for (const o of partyMap.objects) {
                if (o.type === 'player') {
                    this.player = { x: o.tileX, y: o.tileY };
                    playerSet = true;
                } else {
                    this.npcs.push({ 
                        x: o.tileX, y: o.tileY, 
                        type: o.type, 
                        name: o.name 
                    });
                }
            }
        }
        if (!playerSet) {
            // Default player position if not set in map
            this.player = { x: 15, y: 13 }; // Start at user requested (15, 13)
        } else {
             // Force override for Cutscene logic even if map has player object
             this.player.x = 15;
             this.player.y = 13;
        }
        
        // FIX: Reset visual pos to prevent "gliding" from previous map position
        this.visualPos = { x: this.player.x, y: this.player.y };
        this.cameraPos = null;

        // Trigger Auto-walk Cutscene
        // We use a timeout to let the map render first for a split second
        setTimeout(async () => {
             // Block Input? Ideally yes. For now we assume user won't interfere or we could add a flag.
             // Move to (10, 8)
             await this.movePlayerCutscene(10, 8);
        }, 500);

        // Ensure NPC5 is present and correctly positioned
        let npc5 = this.npcs.find(n => n.type === 'npc5');
        if (!npc5) {
            console.log("Adding Santa (NPC5) manually to party map");
            // Create the object and push it
            npc5 = { x: 11, y: 8, type: 'npc5', name: 'Santa' };
            this.npcs.push(npc5);
        } else {
             console.log("NPC5 found, enforcing position.");
             // Force move to center to ensure visibility
             npc5.x = 11;
             npc5.y = 8;
             npc5.name = 'Santa';
        }
        
        // Debug Log to confirm NPC5 exists in list
        console.log("Party Map NPCs List:", JSON.parse(JSON.stringify(this.npcs)));

        // Load fixed Party NPCs configuration
        const fixedNPCs = createPartyNPCs();
        fixedNPCs.forEach(n => {
            // Avoid duplicates if already added via map objects or previous manual check (like Santa)
            // Check by Type for unique characters
            const isUnique = ['npc5', 'roki', 'decorator', 'photographer', 'bartender', 'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5', 'extra_6'].includes(n.type);
            
            if (isUnique) {
                 const existing = this.npcs.find(ex => ex.type === n.type);
                 if (existing) {
                     // Update existing to the fixed position?
                     existing.x = n.x;
                     existing.y = n.y;
                     existing.name = n.name || existing.name;
                     return;
                 }
            } else {
                 // For generic 'talker' or others, check position collision
                 if (this.npcs.find(ex => ex.x === n.x && ex.y === n.y)) return;
            }
            
            this.npcs.push(n);
        });

    } catch (e) {
        console.error("Failed to load party map:", e);
        // Fallback or alert
    }

    // ensure tileset still works; re-render immediately
    this.render();
  }

  async movePlayerCutscene(tx: number, ty: number) {
      const maxSteps = 100;
      let steps = 0;
      
      // Store last blocked axis to encourage trying the other one consistently
      let forceAxis: 'x' | 'y' | null = null;
      let forceSteps = 0;

      while ((this.player.x !== tx || this.player.y !== ty) && steps < maxSteps) {
          const dx = tx > this.player.x ? 1 : (tx < this.player.x ? -1 : 0);
          const dy = ty > this.player.y ? 1 : (ty < this.player.y ? -1 : 0);
          
          let moved = false;
          
          // Try Move Helper
          const tryMove = (mx: number, my: number, dir: number) => {
              if (this.isWalkable(mx, my) && !this.isOccupiedByNPC(mx, my)) {
                  this.player.x = mx;
                  this.player.y = my;
                  this.heroDir = dir;
                  this.lastMoveTime = Date.now();
                  return true;
              }
              return false;
          };

          // Strategy:
          // 1. If we are forced to an axis, try that axis first.
          // 2. Otherwise try primary direction (X then Y).
          
          // Reset force axis if we reached destination on that axis? 
          // No, simple heuristic: If forced to Y, keep Y until X is free or ...
          // Actually, "finish horizontal then vertical" means:
          // If we can move X towards target, do it. 
          // If blocked X, move Y fully until X is open? Or just move Y once?
          // The user said: "Avoid back and forth". 
          // This implies: If I dodged Y to avoid X-block, don't immediately dodge back.
          
          // Implementation of "finish horizontal then vertical" preference:
          // Priority 1: Move X if needed and possible.
          // Priority 2: Move Y if needed and possible.
          // Priority 3: Avoidance (Side-step).

          // If we decided to 'Side-step', we should probably stick to it for a bit.

          const attemptX = () => {
              if (dx !== 0) return tryMove(this.player.x + dx, this.player.y, dx > 0 ? 0 : 2);
              return false;
          };
          const attemptY = () => {
              if (dy !== 0) return tryMove(this.player.x, this.player.y + dy, dy > 0 ? 3 : 1);
              return false;
          };

          // Main Move Logic
          if (!moved) {
               // Standard Priority: Try X, then Y
               if (attemptX()) {
                   moved = true;
                   // If we successfully moved X, clear any Y constraint unless we are still blocked?
                   // Actually just reset Avoidance state.
                   forceAxis = null; 
               }
               else if (attemptY()) {
                   moved = true;
               }
          }

          // Smart Avoidance / Sliding 
          // If blocked on intended path, side-step.
          if (!moved) {
               // Determine primary blockage
               const blockedX = dx !== 0; // Wanted to go X but couldn't (implied by !moved above logic sequence)
               const blockedY = dy !== 0;

               // Heuristic: If blocked on X, try to go Y (even if dy == 0, i.e., deviate)
               // But we need to choose Up or Down consistently.
               if (blockedX) {
                   // Prefer going towards target Y if applicable
                   // If dy is 0, we need to pick a direction. 
                   // Let's pick based on map center or consistent check (e.g. Down first).
                   const dir1 = (dy !== 0) ? dy : 1; // Default Down (1? No, 1 is Up in code? Wait. 
                   // heroDir: 0 Right, 1 Up, 2 Left, 3 Down.
                   // dy: y > player.y -> 1.  So delta +1 is Down.
                   
                   // Let's stick to Delta: +1 (Down), -1 (Up).
                   // If dy != 0, use dy. If dy == 0, try Down (+1).
                   
                   const sideDir = (dy !== 0) ? dy : 1; 
                   
                   // Try move Y in sideDir
                   // Note: We use dir code 3 (Down) or 1 (Up).
                   // sideDir 1 => Down (Y increases). Code: 3.
                   // sideDir -1 => Up (Y decreases). Code: 1.
                   const dirCode = sideDir > 0 ? 3 : 1;
                   
                   if (tryMove(this.player.x, this.player.y + sideDir, dirCode)) {
                       moved = true;
                   } else {
                       // Try opposite Y
                       const oppDir = -sideDir;
                       const oppCode = oppDir > 0 ? 3 : 1;
                       if (tryMove(this.player.x, this.player.y + oppDir, oppCode)) moved = true;
                   }
               }
               else if (blockedY) {
                   // Blocked on Y, try X
                   const sideDir = (dx !== 0) ? dx : 1; // Default Right
                   const dirCode = sideDir > 0 ? 0 : 2;
                   
                   if (tryMove(this.player.x + sideDir, this.player.y, dirCode)) {
                       moved = true;
                   } else {
                       const oppDir = -sideDir;
                       const oppCode = oppDir > 0 ? 0 : 2;
                       if (tryMove(this.player.x + oppDir, this.player.y, oppCode)) moved = true;
                   }
               }
          }

          if (!moved) {
              console.warn("Cutscene Player Stuck/Blocked at", this.player);
              // Force break to avoid infinite loop
              // break; 
              // Wait, maybe we just wait one cycle? 
          }
          
          this.render();
          await this.sleep(200); // Step interval
          steps++;
      }
      this.heroFrame = 0; // Reset to stand
      this.render();
  }

  showEndScreen() {
    this.isPaused = true;
    const endOverlay = document.createElement('div');
    endOverlay.style.position = 'fixed';
    endOverlay.style.top = '0';
    endOverlay.style.left = '0';
    endOverlay.style.width = '100%';
    endOverlay.style.height = '100%';
    endOverlay.style.backgroundColor = '#000';
    endOverlay.style.color = '#fff';
    endOverlay.style.display = 'flex';
    endOverlay.style.flexDirection = 'column';
    endOverlay.style.alignItems = 'center';
    endOverlay.style.justifyContent = 'center';
    endOverlay.style.zIndex = '9999';
    endOverlay.style.animation = 'fadeIn 2s ease-in';

    const title = document.createElement('h1');
    title.textContent = 'MERRY CHRISTMAS\n& HAPPY NEW YEAR';
    title.style.whiteSpace = 'pre-line'; // Allow newline
    title.style.textAlign = 'center';
    title.style.fontFamily = "'Press Start 2P', cursive";
    title.style.color = '#e74c3c';
    title.style.marginBottom = '20px';
    title.style.textShadow = '4px 4px 0px #fff';
    title.style.lineHeight = '1.5';

    const subtitle = document.createElement('h2');
    subtitle.textContent = 'FROM STUDIO 8';
    subtitle.style.fontFamily = "'Press Start 2P', cursive";
    subtitle.style.fontSize = '24px';
    subtitle.style.color = '#2ecc71';
    subtitle.style.marginBottom = '40px';

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'PLAY AGAIN';
    restartBtn.style.padding = '15px 30px';
    restartBtn.style.fontFamily = "'Press Start 2P', cursive";
    restartBtn.style.fontSize = '16px';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.backgroundColor = '#f1c40f';
    restartBtn.style.border = '4px solid #fff';
    restartBtn.style.color = '#000';
    restartBtn.addEventListener('click', () => {
        window.location.reload();
    });

    const credit = document.createElement('div');
    credit.textContent = 'Author: Naixuan';
    credit.style.fontFamily = "'Press Start 2P', cursive";
    credit.style.fontSize = '12px';
    credit.style.color = '#95a5a6';
    credit.style.marginTop = '60px';

    endOverlay.appendChild(title);
    endOverlay.appendChild(subtitle);
    endOverlay.appendChild(restartBtn);
    endOverlay.appendChild(credit);

    document.body.appendChild(endOverlay);
  }

  async playDialog(id: string) {
    if (!this.dialogScripts) return;
    const script = this.dialogScripts[id] || this.dialogScripts[id.toLowerCase()];
    if (!script) return;
    
    const frames: Array<{ text: string; name?: string; avatarUrl?: string }> = [];
    for (const page of script.pages || []) {
        const lines: string[] = page.lines || [];
        const name = page.speaker || '';
        const avatar = page.avatarUrl || '';
        for (const line of lines) {
            frames.push({ text: line, name, avatarUrl: avatar });
        }
    }
    if (frames.length > 0) {
        this.startDialog(frames);
        await this.waitForDialogClose();
    }
  }

  renderDialog() {
      if (this.dialogIndex < 0 || this.dialogIndex >= this.dialogQueue.length) return;
      
      const frame = this.dialogQueue[this.dialogIndex];
      const textEl = this.dialogEl.querySelector('.dialog-text');
      const nameEl = this.dialogEl.querySelector('.dialog-name');
      const avatarContainer = this.dialogEl.querySelector('.dialog-avatar'); // .dialog-avatar is div, img is inside

      const nameColorMap: Record<string, string> = {
        'Alice': '#e84393', // Pink
        'AA': '#e84393',
        'Tom': '#0984e3',   // Blue
        'Hero': '#0984e3',
        'Roki': '#6c5ce7',  // Purple
        'Bob': '#d63031',   // Red
        'Samuel': '#00b894' // Green
      };

      if (textEl) {
        let formattedText = frame.text;
        // Highlight names in text
        Object.keys(nameColorMap).forEach(name => {
           // Skip current speaker's own name in their own text if you want, but usually highlighted is fine.
           // Use word boundaries to avoid partial matches
           const regex = new RegExp(`\\b${name}\\b`, 'g');
           if (formattedText.match(regex)) {
               formattedText = formattedText.replace(regex, `<span style="color: ${nameColorMap[name]}">${name}</span>`);
           }
        });
        textEl.innerHTML = formattedText;
      }

      if (nameEl) {
          nameEl.textContent = frame.name || '';
          (nameEl as HTMLElement).style.display = frame.name ? 'block' : 'none';
          // Default yellow if not in map
          (nameEl as HTMLElement).style.color = nameColorMap[frame.name || ''] || '#f1c40f';
      }
      
      const img = avatarContainer?.querySelector('img');
      if (img) {
          if (frame.avatarUrl) {
              img.src = frame.avatarUrl;
              img.style.display = 'block';
          } else {
              img.style.display = 'none';
          }
      }

      // Ensure indicator exists
      let indicator = this.dialogEl.querySelector('.dialog-next-indicator');
      if (!indicator) {
          indicator = document.createElement('div');
          indicator.className = 'dialog-next-indicator';
          this.dialogEl.querySelector('.dialog-inner')?.appendChild(indicator);
      }
  }

  showDialog(text: string, options: { name?: string; avatarUrl?: string } = {}) {
     this.startDialog([{ text, name: options.name, avatarUrl: options.avatarUrl }]);
  }

  startDialog(frames: Array<{ text: string; name?: string; avatarUrl?: string }>) {
      if (!frames || frames.length === 0) return;
      this.dialogQueue = frames;
      this.dialogIndex = 0;
      this.dialogOpen = true;
      this.dialogEl.classList.remove('hidden');
      this.renderDialog();
  }

  advanceDialog() {
      if (!this.dialogOpen) return;
      if (this.dialogIndex < this.dialogQueue.length - 1) {
          this.dialogIndex++;
          this.renderDialog();
      } else {
          this.hideDialog();
      }
  }

  hideDialog() {
    this.dialogOpen = false;
    this.dialogEl.classList.add('hidden');
    this.dialogQueue = [];
    this.dialogIndex = 0;
    
    if (this.onDialogClose) {
        const cb = this.onDialogClose;
        this.onDialogClose = undefined;
        cb();
    }
  }

  createTaskUI() {
    const el = document.createElement('div');
    el.className = 'task-ui-container';
    el.style.position = 'fixed';
    el.style.top = '12px';
    el.style.right = '12px';
    el.style.zIndex = '60';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'flex-end';

    // Unified UI Panel
    const panelStyle = `
        background: rgba(44, 62, 80, 0.4); 
        padding: 12px; 
        border: 2px solid #ecf0f1; 
        color: #ecf0f1; 
        font-family: 'Press Start 2P', cursive; 
        font-size: 8px; 
        text-align: left; 
        box-shadow: 4px 4px 0px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 200px;
    `;

    el.innerHTML = `
      <div class="game-dashboard" style="${panelStyle.replace(/\n/g, '')}">
        
        <!-- Controls Section -->
        <div>
            <div style="color: #f1c40f; margin-bottom: 8px; font-size: 10px;">CONTROLS</div>
            
            <div style="display: flex; flex-direction: row; gap: 12px; align-items: center;">
                <!-- Movement -->
                <div style="display: flex; flex-direction: row; gap: 4px; margin-bottom: 0px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                        <!-- Up -->
                        <div style="width: 14px; height: 14px; border: 1px solid #ecf0f1; background: #2c3e50; display: flex; align-items: center; justify-content: center; position: relative;">
                            <span style="color: #ecf0f1; font-family: sans-serif; font-size: 10px; line-height: 1; padding-bottom: 2px;">&uarr;</span>
                            <span style="position: absolute; top: -8px; font-size: 6px; color: #f1c40f;">W</span>
                        </div>
                        <!-- Left Down Right -->
                        <div style="display: flex; gap: 2px;">
                            <div style="width: 14px; height: 14px; border: 1px solid #ecf0f1; background: #2c3e50; display: flex; align-items: center; justify-content: center; position: relative;">
                                <span style="color: #ecf0f1; font-family: sans-serif; font-size: 10px; line-height: 1; padding-bottom: 2px;">&larr;</span>
                                <span style="position: absolute; left: -8px; font-size: 6px; color: #f1c40f;">A</span>
                            </div>
                            <div style="width: 14px; height: 14px; border: 1px solid #ecf0f1; background: #2c3e50; display: flex; align-items: center; justify-content: center; position: relative;">
                                <span style="color: #ecf0f1; font-family: sans-serif; font-size: 10px; line-height: 1; padding-bottom: 2px;">&darr;</span>
                                <span style="position: absolute; bottom: -8px; font-size: 6px; color: #f1c40f;">S</span>
                            </div>
                            <div style="width: 14px; height: 14px; border: 1px solid #ecf0f1; background: #2c3e50; display: flex; align-items: center; justify-content: center; position: relative;">
                                <span style="color: #ecf0f1; font-family: sans-serif; font-size: 10px; line-height: 1; padding-bottom: 2px;">&rarr;</span>
                                <span style="position: absolute; right: -8px; font-size: 6px; color: #f1c40f;">D</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                 <div style="display: flex; flex-direction: row; align-items: center; gap: 6px;">
                    <div style="height: 12px; padding: 2px 4px; border: 1px solid #ecf0f1; background: #2c3e50; display: flex; align-items: center; justify-content: center; font-size: 6px; color: #fff;">ENTER</div>
                    <div style="height: 12px; padding: 2px 4px; border: 1px solid #ecf0f1; background: #2c3e50; display: flex; align-items: center; justify-content: center; font-size: 6px; color: #fff;">SPACE</div>
                    <div style="font-size: 6px; color: #bdc3c7;">NEXT</div>
                 </div>
             </div>
        </div>

        <div style="height: 1px; background: #fff; opacity: 0.2; margin: 2px 0;"></div>

        <!-- Tasks Section -->
        <div class="task-ui">
            <!-- Content will be populated by renderTaskUI -->
        </div>

        <div style="height: 1px; background: #fff; opacity: 0.2; margin: 2px 0;"></div>

        <!-- Settings Section -->
        <div>
            <div style="color: #f1c40f; margin-bottom: 6px;">MUSIC</div>
            <div style="display: flex; align-items: center; justify-content: flex-start; gap: 6px;">
                <input type="range" id="volume-slider" min="0" max="1" step="0.1" value="0.2" style="width: 40px;">
                <label style="cursor: pointer; display: flex; align-items: center;" title="Toggle Mute">
                    <input type="checkbox" id="mute-toggle" style="margin: 0; cursor: pointer;">
                    <span style="margin-left: 4px; font-size: 8px;">MUTE</span>
                </label>
            </div>
        </div>

        <!-- Debug Info -->
        <div id="debug-coords" style="font-size: 6px; color: #95a5a6; margin-top: 2px;">
            Pos: 0, 0
        </div>
        
        <button id="debug-complete-btn" style="background: #e74c3c; color: white; border: 1px solid white; font-family: inherit; font-size: 6px; cursor: pointer; padding: 2px 4px; align-self: flex-start; margin-top: 4px;">
            DEBUG: FINISH ALL
        </button>
      </div>
    `;
    document.body.appendChild(el);
    this.taskUiEl = el.querySelector('.task-ui');
    
    // Debug Button Listener
    const debugBtn = document.getElementById('debug-complete-btn');
    if (debugBtn) {
        debugBtn.addEventListener('click', () => {
             // Ensure quest manager exists
             if (!this.quest) {
                 this.quest = new QuestManager();
                 this.quest.startQuest();
             }
             if (!this.quest.questStarted) this.quest.startQuest();

             // Complete ALL tasks
             const tasks = ['decorator', 'photographer', 'bartender'];
             tasks.forEach(t => {
                 if (!this.quest!.isCompleted(t)) {
                     this.quest!.markCompleted(t);
                 }
             });
             
             this.renderTaskUI();
             // Trigger end sequence
             this.handleAllTasksCompleted();
        });
    }
    
    // Volume Control Listener
    const volSlider = document.getElementById('volume-slider') as HTMLInputElement;
    const muteToggle = document.getElementById('mute-toggle') as HTMLInputElement;

    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (this.bgm) {
          this.bgm.volume = val;
          // If user moves slider, ensure we unmute if it was muted? 
          // Or just leave it. Standard behavior is usually independent, but here let's keep it simple.
        }
      });
      // Set initial volume
      if (this.bgm) volSlider.value = this.bgm.volume.toString();
    }

    if (muteToggle) {
        muteToggle.addEventListener('change', (e) => {
            if (this.bgm) {
                this.bgm.muted = (e.target as HTMLInputElement).checked;
            }
        });
        if (this.bgm) muteToggle.checked = this.bgm.muted;
    }

    this.renderTaskUI();
  }

  renderTaskUI() {
    if (!this.taskUiEl) return;
    
    // Explicitly enforce vertical layout on the container
    this.taskUiEl.style.display = 'flex';
    this.taskUiEl.style.flexDirection = 'column';
    this.taskUiEl.style.alignItems = 'flex-start'; // Align children to left
    this.taskUiEl.style.padding = '0';
    
    // Clear content
    this.taskUiEl.innerHTML = '';
    
    // Header
    const title = document.createElement('div');
    title.className = 'task-title';
    title.style.color = '#f1c40f'; // Original Gold color
    title.style.marginBottom = '6px';
    title.style.alignSelf = 'flex-start'; // Ensure left alignment
    title.textContent = 'TASKS';
    this.taskUiEl.appendChild(title);

    const list = document.createElement('div');
    list.className = 'task-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '4px';
    list.style.alignItems = 'flex-start'; // Left align the items in the list
    list.style.width = '100%'; 
    list.style.padding = '0'; // Ensure no padding
    list.style.margin = '0';
    
    const createItem = (label: string, done: boolean) => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'flex-start'; // Align content to left
        item.style.gap = '6px';
        item.style.width = '100%';
        item.style.padding = '0';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.disabled = true;
        cb.checked = done;
        cb.style.margin = '0';
        
        const span = document.createElement('span');
        span.style.fontSize = '6px';
        span.style.textAlign = 'left'; 
        span.textContent = label;
        if (done) {
            span.style.color = '#27ae60';
            span.style.textDecoration = 'line-through';
        } else {
             span.style.color = '#ecf0f1';
        }
        
        item.appendChild(cb);
        item.appendChild(span);
        return item;
    };

    if (!this.quest || !this.quest.questStarted) {
        // State 0: Find Alice
        list.appendChild(createItem('FIND ALICE', false));
    } else {
        // State 1: 3 Subtasks
        const tasks = [
            { id: 'decorator', label: 'HELP ROKI DECORATE' },
            { id: 'photographer', label: 'FIND BOB FOR PHOTOS' },
            { id: 'bartender', label: 'HELP SAMUEL MAKE DRINKS' }
        ];
        
        tasks.forEach(t => {
            const isDone = this.quest!.isCompleted(t.id);
            list.appendChild(createItem(t.label, isDone));
        });
    }
    
    this.taskUiEl.appendChild(list);
  }

  async handleKey(e: KeyboardEvent) {
    if (this.isPaused) return;

    if (this.dialogOpen) {
      if (e.code === 'Escape') {
          this.hideDialog();
          return;
      }
      if (e.code === 'Space' || e.code === 'Enter') this.advanceDialog();
      return;
    }

    let dx = 0, dy = 0;
    // Log key press for debugging
    // console.log('Key pressed:', e.code);
    
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        dy = -1; 
        this.heroDir = 1; // Up
        break;
      case 'ArrowDown':
      case 'KeyS':
        dy = 1; 
        this.heroDir = 3; // Down
        break;
      case 'ArrowLeft':
      case 'KeyA':
        dx = -1; 
        this.heroDir = 2; // Left
        break;
      case 'ArrowRight':
      case 'KeyD':
        dx = 1; 
        this.heroDir = 0; // Right
        break;
      case 'Space':
      case 'Enter':
        {
          // Interaction Logic... (omitted)
          const npc = this.getNearbyNPC();
          if (!npc) return;
          // if AA and quest not started, start quest
          if (npc.type === 'aa') {
             if (!this.quest) this.quest = new QuestManager();
             if (!this.quest.questStarted) {
               this.quest.startQuest();
               this.renderTaskUI(); 
             }
             // Fall through to generic script handler
          }

          // task NPCs
            if (this.quest && npc.type === 'photographer') {
                if (this.quest.isCompleted('photographer')) {
                    this.showDialog('Thanks for helping me, I\'ll go find Alice in a bit.', { name: 'Bob' });
                    return;
                }

                const startMiniGame = () => {
                  const mg = this.miniGames ? this.miniGames['photographer'] : null;
                  if (mg && typeof mg.start === 'function') {
                    this.isPaused = true;
                    mg.start().then((success: boolean) => {
                      this.isPaused = false;
                      if (success) {
                          this.quest?.markCompleted('photographer');
                          this.renderTaskUI();
                          this.showDialog('Thanks for helping me, I\'ll go find Alice in a bit.', { name: 'Bob' });
                          if (this.quest?.allTasksCompleted()) {
                            this.handleAllTasksCompleted();
                          }
                      } else {
                        this.showDialog('I really need that review done...', { name: 'Bob' });
                      }
                    });
                  }
                };

                this.onDialogClose = () => {
                    this.onDialogClose = undefined;
                    startMiniGame();
                };

                // Start the dialogue sequence
                this.startDialog([
                    { text: "Hi Bob, Alice asked me to find you for the photo.", name: "Tom" },
                    { text: "Oh right, but I suddenly have a design review I haven't finished.", name: "Bob" },
                    { text: "I need to find the error in each of these three design drafts.", name: "Bob" },
                    { text: "Can you help me?", name: "Bob" },
                    { text: "Sure, I'll help you with the design review.", name: "Tom" }
                ]);
                return;
            }

            // Decorator (Roki) 
            if (this.quest && npc.type === 'decorator') {
                if (this.quest.isCompleted('decorator') || this.isInPartyMap) {
                    this.showDialog('Thanks for helping me!', { name: 'Roki' });
                    return;
                }

                const startMiniGame = () => {
                    const mg = this.miniGames ? this.miniGames['decorator'] : null;
                    if (mg && typeof mg.start === 'function') {
                        this.isPaused = true;
                        mg.start().then((success: boolean) => {
                            this.isPaused = false;
                            if (success) {
                                this.quest?.markCompleted('decorator');
                                this.renderTaskUI();
                                this.showDialog('Thanks for helping me!', { name: 'Roki' });
                                if (this.quest?.allTasksCompleted()) {
                                    this.handleAllTasksCompleted();
                                }
                            } else {
                                this.showDialog('Please help me decorate...', { name: 'Roki' });
                            }
                        });
                    }
                };

                this.onDialogClose = () => {
                    this.onDialogClose = undefined;
                    startMiniGame();
                };

                this.startDialog([
                    { text: "Hi Roki, Alice asked me to help you decorate the venue.", name: "Tom" },
                    { text: "Thank you so much! I really need a hand.", name: "Roki" }
                ]);
                return;
            }

            if (this.quest && (npc.type === 'bartender')) {
              // if already completed, don't open the mini-game again
              if (this.quest.isCompleted(npc.type) || this.isInPartyMap) {
                this.showDialog('Samuel: Thank you for helping me!');
                return;
              }

              // Interaction flow
              this.startDialog([
                  { text: "Alice sent me to get more drinks for the party.", name: "Tom" },
                  { text: "I'm extremely busy! Can you help me make some drinks? I'll give you the recipes.", name: "Samuel" }
              ]);

              // When dialog closes, start the game
              this.onDialogClose = () => {
                  const mg = this.miniGames ? this.miniGames[npc.type] : null;
                  if (mg && typeof mg.start === 'function') {
                    this.isPaused = true;
                    mg.start().then((success: boolean) => {
                      this.isPaused = false;
                      if (success) {
                          this.quest?.markCompleted(npc.type);
                          this.renderTaskUI();
                          this.showDialog('Samuel: Thank you!');
                          if (this.quest?.allTasksCompleted()) {
                            this.handleAllTasksCompleted();
                          }
                      } else {
                        this.showDialog('Samuel: You gave up.');
                      }
                    });
                  }
              };
              return;
          }

          // party NPC5 (Santa) on party map: triggers gift selection
          if (npc.type === 'npc5') {
            // Callback for when the dialog closes
            this.onDialogClose = () => {
                // Play gift animation
                const oldAnim = npc.playingGiftAnim;
                npc.playingGiftAnim = true;
                this.render(); // force update sprite
                
                // Wait for animation duration (e.g., 1.5s for 6 frames at 200ms approx + buffer)
                setTimeout(() => {
                    // Open Gift Selection UI
                    if (!this.party) return;
                    this.party.start().then(() => {
                         // Santa Closing Dialog
                         const closingCallback = () => {
                            this.onDialogClose = undefined;
                            npc.playingGiftAnim = false; // Reset sprite
                            this.showEndScreen();
                         };
                         
                         // Wait for popup to fully disappear (it has a 4000s delay internally, but resolving happens after)
                         // But we want to ensure the UI is clean before showing dialog
                         setTimeout(() => {
                             // Temporarily hook dialog closing
                             this.onDialogClose = closingCallback;
                             
                             // Split closing dialog into short sentences
                             this.startDialog([
                                 { text: "Great choice!", name: 'Santa' },
                                 { text: "Thanks again for your hard work and great designs.", name: 'Santa' },
                                 { text: "May your wishes come true in the new year.", name: 'Santa' },
                                 { text: "Studio 8 thanks you! HOHOHO...", name: 'Santa' }
                             ]);
                         }, 500); // 0.5s delay
                    });
                }, 1000); 
            };

            // Split opening dialog into short sentences
            this.startDialog([
                { text: "Hohoho, Merry Christmas!", name: 'Santa' },
                { text: "Thanks for your excellent design work this past year!", name: 'Santa' },
                { text: "It's your turn to pick a gift.", name: 'Santa' },
                { text: "Choose one from the three!", name: 'Santa' }
            ]);
            return;
          }

          // simple talkers
          // Check for Extra NPCs first
          if (npc.type.startsWith('extra_')) {
              const extraDialogs: Record<string, string[]> = {
                  'extra_1': [ // Anna (formerly Colleague A - but request: Colleague A -> Man, Colleague C -> Woman)
                      // User Request: A -> Man "Mike" (position wise, main.ts maps specific positions to extra_1..6)
                      // Let's rely on main.ts logical mapping.
                      // Wait, main.ts maps:
                      // extra_1 (Pos 1): Anna (User: Colleague A -> Man?)
                      // Let's check main.ts mapping again mentally.
                      // Current main.ts: extraNames = ["Anna", "Mike", "Sarah", "John", "Emily", "David"];
                      // So extra_1=Anna, extra_2=Mike, extra_3=Sarah, extra_4=John, extra_5=Emily, extra_6=David
                      
                      // User Requirements mapping to indexes:
                      // "Colleague A" (Manual Check: User said "ColleagueA改人名男..."). BUT main.ts now says extra_1 is Anna.
                      // User wants me to CHANGE the names/dialogs. I should align ID with Request.
                      
                      // Let's assume:
                      // extra_1 (Anna) = "Colleague A" in original prompt logic? No, let's just specific logic per ID based on main.ts names mostly.
                      
                      // Wait, I will rewrite the logic to use specific dialogs per extra_ID.
                      
                      // extra_1 (Anna - User: "Colleague A (Man)"?? -> Let's make extra_1 "Mike" (Man) and extra_2 "Anna" (Woman) to easier fit? No, main.ts is file of truth.)
                      // Main.ts: 1=Anna, 2=Mike, 3=Sarah, 4=John, 5=Emily, 6=David.
                      
                      // Let's map User Request to these IDs:
                      // "Colleague B" -> Mike (extra_2) -> Dialog: "So excited for the party!" / "Wonder what gift I'll get." / "Everyone will love my gift."
                      // "Colleague A" -> Anna (Refactoring: User wanted A to be Man. I will stick to main.ts Name which is Anna? Or change both?)
                      
                      // *** Correction *** 
                      // User said: "Colleague B改个人名, ... Colleague A改人名男..., Colleague C改个女生名字..., Colleague F改个女名..., Colleague E, 换男名..." 
                      // I should update main.ts names to match genders requested if they don't fit.
                      // Main.ts currently: 1=Anna(F), 2=Mike(M), 3=Sarah(F), 4=John(M), 5=Emily(F), 6=David(M).
                      
                      // Request:
                      // A (extra_1) -> Man. (Currently Anna). CHANGE TO MAN name in UI loop here or ignore main.ts? 
                      // Better to use the requested dialogs for specific IDs and I will update names in main.ts if needed later or just Override display name here.
                  ], 
              };

              // Let's implement the specific logic:
              
              let lines: string[] = [];
              let displayName = npc.name || 'Colleague';

              switch(npc.type) {
                  case 'extra_1': // Formerly A. Request: Man. Rename "Kevin".
                      displayName = "Kevin"; 
                      lines = [
                          "Do you know about Studio 8's AI transformation?",
                          "I heard designers can do anything now.",
                          "I need to think about starting a new project too."
                      ];
                      break;
                  case 'extra_2': // Formerly B. Request: "Mike". 
                      displayName = "Mike";
                      lines = [
                          "So excited! The party is starting soon!",
                          "I wonder what gift I will receive...",
                          "I'm sure everyone will love the gift I prepared!"
                      ];
                      break;
                  case 'extra_3': // Formerly C. Request: Woman. "Sarah".
                       displayName = "Sarah";
                       lines = [
                           "Christmas is over, soon it will be New Year's.",
                           "I'm going to take a good long vacation.",
                           "I'm planning to learn how to ski!"
                       ];
                       break;
                  case 'extra_6': // Formerly F (extra_6). Request: Woman. "Jessica".
                       displayName = "Jessica";
                       lines = [
                           "In this mysterious corner of Studio 8...",
                           "You can taste the most unique coffee flavors!",
                           "Also, want to join my fitness team? Walk 5000 steps every day!"
                       ];
                       break;
                  case 'extra_5': // Formerly E (extra_5). Request: Man. "Tom" (Wait hero is Tom? Use "Jason").
                       displayName = "Jason";
                       lines = [
                           "Have you heard the secret of Studio 8?",
                           "I heard someone here used to be super legendary...",
                           "Do you really not know?"
                       ];
                       break;
                   case 'extra_4': // Formerly D. Generic filler? 
                       displayName = "John";
                       lines = [
                           "Merry Christmas!",
                           "The decorations look great this year.",
                           "Have a good time!"
                       ];
                       break;
                   default:
                       lines = ["Hello.", "Merry Christmas!"];
              }
              
              const frames = lines.map(line => ({ text: line, name: displayName }));
              this.startDialog(frames);
              return;
          }

          // show scripted dialogue if available (by name or type), otherwise fallback
          let useScriptId = null;
          if (this.dialogScripts) {
             const nameKey = npc.name;
             const typeKey = npc.type;
             
             // Check Name (Case insensitive)
             if (nameKey && (this.dialogScripts[nameKey] || this.dialogScripts[nameKey.toLowerCase()])) {
                 useScriptId = nameKey;
             } 
             // Check Type (Case insensitive)
             else if (typeKey && (this.dialogScripts[typeKey] || this.dialogScripts[typeKey.toLowerCase()])) {
                 useScriptId = typeKey;
             }
          }

          if (useScriptId) {
            await this.playDialog(useScriptId);
          } else {
            this.showDialog(npc.name ? `${npc.name}: Hello!` : 'NPC: Hello!');
          }
        }
        return;
      default:
        return;
    }
    if (dx !== 0 || dy !== 0) this.tryMove(dx, dy);
  }

  tryMove(dx: number, dy: number) {
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    // prevent moving into tiles occupied by NPCs
    if (this.isOccupiedByNPC(nx, ny)) return;
    if (this.isWalkable(nx, ny)) {
      this.player.x = nx;
      this.player.y = ny;
      this.lastMoveTime = Date.now();
      this.updateDebugCoords();
    }
  }

  updateDebugCoords() {
    const el = document.getElementById('debug-coords');
    if (el) {
      el.textContent = `Pos: ${this.player.x}, ${this.player.y} | Screen: ${this.canvas.width}x${this.canvas.height}`;
    }
  }

  isWalkable(x: number, y: number) {
    if (y < 0 || y >= this.map.height) return false;
    if (x < 0 || x >= this.map.width) return false;

    // Tiled Map Multi-Layer Check
    try {
      if (this.map.layers && this.map.layers.length > 0) {
        
        // 1. Check for specific "Collision" layer (Priority 1)
        // If "Collision" or "Collisions" layer exists, any tile on it strictly BLOCKS movement.
        // This allows creating invisible walls or restricted areas.
        const collisionLayer = this.map.layers.find(l => {
            const name = l.name ? String(l.name).toLowerCase() : '';
            return name.includes('collision') || name === 'block';
        });
        
        if (collisionLayer && collisionLayer.data) {
             const width = (collisionLayer as any).width || this.map.width;
             const idx = y * width + x;
             if (idx >= 0 && idx < collisionLayer.data.length && collisionLayer.data[idx] !== 0) {
                 return false; // Hand-painted collision found
             }
        }

        // 2. Iterate all visible layers for "Auto-Collision" from props/walls
        for (const layer of this.map.layers) {
          if (!layer) continue;
          
          const name = layer.name ? String(layer.name).toLowerCase() : '';
          
          // STRICT COLLISION FOR OBJECT LAYERS
          // If the user used "Insert Tile" on an Object Layer, treat those objects as blocks
          if (layer.type === 'objectgroup' && layer.objects) {
              // Convert pixel coordinates to tile coordinates for collision check
              // Objects usually have x, y (pixels)
              // We check if any object overlaps the current tile (x,y)
              
              // This is O(N) per tile check, heavily unoptimized, but safe for small counts.
              // For optimization, we should pre-calc an occupancy grid.
              // Given this is a small 8-bit game, linear scan might be okay or we implement basic AABB.
              
              const targetTileX = x * this.tileSize;
              const targetTileY = y * this.tileSize;
              const tileSize = this.tileSize;

              // Simple Point-in-Rect or Rect-Overlap check
              for (const obj of layer.objects) {
                  // Skip if object is explicitly named "walkable"
                  if (obj.name && obj.name.toLowerCase().includes('walkable')) continue;
                  
                  // Object coordinates in Tiled are usually Bottom-Left for tiles? 
                  // Or Top-Left for Rects.
                  // Let's assume standard Rect overlap.
                  
                  // Tiled Object: x,y, width, height.
                  // Note: Tile Objects (Insert Tile) have x,y at bottom-left!
                  // Rect Objects have x,y at top-left.
                  
                  let ox = obj.x;
                  let oy = obj.y;
                  let ow = obj.width || 0;
                  let oh = obj.height || 0;
                  
                  // Correction for Tile Objects (gid present)
                  if ((obj as any).gid) {
                      oy -= oh; // Move origin to top-left
                  }

                  // Check overlap with the target tile
                  // TileRect: [targetTileX, targetTileY, tileSize, tileSize]
                  // ObjRect:  [ox, oy, ow, oh]
                  
                  if (targetTileX < ox + ow &&
                      targetTileX + tileSize > ox &&
                      targetTileY < oy + oh &&
                      targetTileY + tileSize > oy) {
                      return false; // Blocked by Object
                  }
              }
              continue; 
          }

          if (layer.type !== 'tilelayer') continue;

          // Skip layers that are explicitly defined as Walkable
          // Added 'decoration', 'rug', 'carpet' as common walkable decoration layers
          if (name.includes('floor') || 
              name.includes('black') || 
              name.includes('ground') || 
              name.includes('shadow') || 
              name.includes('decoration') ||
              name.includes('rug') || 
              name.includes('carpet')) {
            continue;
          }
          
          // STRICT BLOCKING: Wall, Furniture, Obstacles
          // If a tile exists in these layers, it blocks.
          // Note: "wall front", "wall", "wall back", "table", "chair" etc. will fall through here
          // SPECIAL: Handle "half grid" transparency?
          // If the tile is not empty, it blocks.
          if (layer.data) {
            const width = (layer as any).width || this.map.width;
            const idx = y * width + x;
            
            // Check if tile exists (gid != 0)
            if (idx >= 0 && idx < layer.data.length && layer.data[idx] !== 0) {
              // This is a strict block.
              return false;
            }
          }
        }
        return true;
      }
    } catch (e) {
      console.error("isWalkable error:", e);
      return false;
    }

    // Legacy single-layer check
    if (this.map.data && this.map.data.length > 0) {
      const gid = this.map.data[y * this.map.width + x];
      if (gid === 0) return true;
      return gid === 1;
    }

    return true; // Default to walkable if no map data
  }



  isNearNPC() {
    return !!this.getNearbyNPC();
  }

  getNearbyNPC() {
    for (const n of this.npcs) {
      if (n.type === 'npc5') {
          // Santa has a large collision box (3x2 or 3x3), so we allow interaction from further away
          // Center is (11,8). Blocked area roughly (10,7) to (12,8)
          const dx = Math.abs(this.player.x - n.x);
          const dy = Math.abs(this.player.y - n.y);
          // Allow distance <= 2 (covers adjacent to the 3x3 block)
          if (dx <= 2 && dy <= 2) return n;
      } else {
          const d = Math.abs(this.player.x - n.x) + Math.abs(this.player.y - n.y);
          if (d === 1) return n;
      }
    }
    return null;
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }

  update() {
    // Update animation frames
    // Determine if running or standing
    const isRunning = (Date.now() - this.lastMoveTime) < 150; // considered running if moved in last 150ms
    
    // Animation Speed: Run faster (e.g., every 100ms), Stand slower (e.g., every 200ms)
    const animSpeed = isRunning ? 100 : 200; 
    
    // Simple timer accumulation could go here, but roughly using Date.now() for frames is easier
    // Or we use a tick counter in loop. Let's use a simple frame calculation based on time.
    const now = Date.now();
    
    // We want a continuous frame index 0-5
    const frameIndex = Math.floor(now / animSpeed) % 6;
    this.heroFrame = frameIndex;

    // Smooth NPC Movement
    const lerpSpeed = 0.2;
    for (const npc of this.npcs) {
        if (npc.visualX === undefined) npc.visualX = npc.x;
        if (npc.visualY === undefined) npc.visualY = npc.y;
        
        // Lerp X
        if (Math.abs(npc.x - npc.visualX) > 0.001) {
            npc.visualX += (npc.x - npc.visualX) * lerpSpeed;
        } else {
            npc.visualX = npc.x;
        }
        // Lerp Y
        if (Math.abs(npc.y - npc.visualY) > 0.001) {
            npc.visualY += (npc.y - npc.visualY) * lerpSpeed;
        } else {
            npc.visualY = npc.y;
        }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Initialize visual position if needed
    if (!this.visualPos) {
        this.visualPos = { x: this.player.x, y: this.player.y };
    }

    // Smoothly interpolate visual position towards logical player position
    // Lerp factor 0.1 gives a nice smooth delayed feel ("Stardew style")
    // Use a small epsilon to snap when close
    const lerpSpeed = 0.15;
    
    // Smooth X
    if (Math.abs(this.player.x - this.visualPos.x) > 0.001) {
        this.visualPos.x += (this.player.x - this.visualPos.x) * lerpSpeed;
    } else {
        this.visualPos.x = this.player.x;
    }

    // Smooth Y
    if (Math.abs(this.player.y - this.visualPos.y) > 0.001) {
        this.visualPos.y += (this.player.y - this.visualPos.y) * lerpSpeed;
    } else {
        this.visualPos.y = this.player.y;
    }

    // Support Tiled Layers and Multiple Tilesets
    if (this.map.layers && this.map.tilesets) {
      // Basic Camera / Viewport logic
      const screenTilesW = Math.ceil(this.canvas.width / this.tileSize);
      const screenTilesH = Math.ceil(this.canvas.height / this.tileSize);

      // Initialize Camera if needed
      if (!this.cameraPos) {
          this.cameraPos = {
              x: this.visualPos.x - Math.floor(screenTilesW / 2),
              y: this.visualPos.y - Math.floor(screenTilesH / 2)
          };
      }

      // Dead Zone / Edge Scrolling Logic
      // Camera only moves when player is close to the edge (padding)
      let paddingX = 6; // Tiles from edge before scrolling starts
      let paddingY = 4;
      
      if (this.lockCamera) {
          paddingX = Math.floor(screenTilesW / 2);
          paddingY = Math.floor(screenTilesH / 2);
      }

      // Use visualPos instead of player.x to make camera follow smooth movement
      const targetX = this.visualPos.x;
      const targetY = this.visualPos.y;

      // Right Edge
      if (targetX > this.cameraPos.x + screenTilesW - paddingX) {
          this.cameraPos.x = targetX - (screenTilesW - paddingX);
      }
      // Left Edge
      if (targetX < this.cameraPos.x + paddingX) {
          this.cameraPos.x = targetX - paddingX;
      }
      // Bottom Edge
      if (targetY > this.cameraPos.y + screenTilesH - paddingY) {
          this.cameraPos.y = targetY - (screenTilesH - paddingY);
      }
      // Top Edge
      if (targetY < this.cameraPos.y + paddingY) {
          this.cameraPos.y = targetY - paddingY;
      }

      // Clamp camera
      const maxCamX = Math.max(0, this.map.width - screenTilesW);
      const maxCamY = Math.max(0, this.map.height - screenTilesH);
      
      this.cameraPos.x = Math.max(0, Math.min(this.cameraPos.x, maxCamX));
      this.cameraPos.y = Math.max(0, Math.min(this.cameraPos.y, maxCamY));

      // Use the stateful camera position
      const cameraX = this.cameraPos.x;
      const cameraY = this.cameraPos.y;
      
      // Calculate centering offset if map is smaller than canvas
      let centeringOffsetX = 0;
      let centeringOffsetY = 0;
      const mapPixelWidth = this.map.width * this.tileSize;
      const mapPixelHeight = this.map.height * this.tileSize;

      if (mapPixelWidth < this.canvas.width) {
          centeringOffsetX = Math.floor((this.canvas.width - mapPixelWidth) / 2);
      }
      if (mapPixelHeight < this.canvas.height) {
          centeringOffsetY = Math.floor((this.canvas.height - mapPixelHeight) / 2);
      }

      // Render offset
      const offsetX = Math.floor(-cameraX * this.tileSize + centeringOffsetX);
      const offsetY = Math.floor(-cameraY * this.tileSize + centeringOffsetY);

      for (const layer of this.map.layers) {
        if (layer.type !== 'tilelayer') continue;
        // Respect layer visibility from Tiled
        if (layer.visible === false) continue;

        // SKIP Rendering "Collision" layer (Logic only)
        // We don't want to see the red collision tiles in-game
        const layerName = layer.name ? String(layer.name).toLowerCase() : '';
        if (layerName.includes('collision') || layerName === 'block') continue;

        const data = layer.data;
        const layerWidth = (layer as any).width || this.map.width; 
        
        // Optimize: Only render visible tiles
        // We need to be careful not to render outside map bounds
        const startX = Math.floor(cameraX);
        const startY = Math.floor(cameraY);
        // Ensure we render enough tiles to cover the screen (including partial tiles)
        const endX = Math.min(this.map.width, startX + screenTilesW + 1);
        const endY = Math.min(this.map.height, startY + screenTilesH + 1);

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = y * layerWidth + x;
            if (idx >= data.length) continue;
            
            const gid = data[idx];
            if (gid === 0) continue;

            // Find the right tileset for this gid
            let tileset = this.map.tilesets[0];
            for (let i = this.map.tilesets.length - 1; i >= 0; i--) {
              if (gid >= this.map.tilesets[i].firstgid) {
                tileset = this.map.tilesets[i];
                break;
              }
            }

            if (tileset && tileset.imageElement) {
              const localId = gid - tileset.firstgid;
              const tilesPerRow = Math.floor(tileset.imagewidth / tileset.tilewidth);
              const sx = (localId % tilesPerRow) * tileset.tilewidth;
              const sy = Math.floor(localId / tilesPerRow) * tileset.tileheight;
              // px, py are now relative to the camera
              const px = x * this.tileSize + offsetX;
              const py = y * this.tileSize + offsetY;
              
              if (tileset.imageElement.complete && tileset.imageElement.naturalWidth > 0) {
                  ctx.drawImage(tileset.imageElement, sx, sy, tileset.tilewidth, tileset.tileheight, px, py, this.tileSize, this.tileSize);
              } else {
                  // Fallback for broken tileset
                  ctx.fillStyle = 'magenta';
                  ctx.fillRect(px, py, this.tileSize, this.tileSize);
              }
            }
          }
        }
      }

      // Adjust Entity Rendering for Camera
      // Unified Rendering (Depth Sort)
      const renderList: { y: number, type: 'npc' | 'player', data: any }[] = [];

      // Add NPCs
      for (const n of this.npcs) {
          const vY = (n.visualY !== undefined) ? n.visualY : n.y;
          renderList.push({ y: vY, type: 'npc', data: n });
      }

      // Add Player
      const pY = this.visualPos ? this.visualPos.y : this.player.y;
      renderList.push({ y: pY, type: 'player', data: null });

      // Sort
      renderList.sort((a, b) => a.y - b.y);

      // Render Loop
      for (const entity of renderList) {
        if (entity.type === 'npc') {
            const n = entity.data;
            
            let renderType = n.type;
            if (renderType === 'roki') renderType = 'decorator';
            if (renderType === 'talker') renderType = 'extra_1';
            if (renderType === 'man') renderType = 'extra_1';
            if (renderType === 'woman') renderType = 'extra_3';
            
            if (!this.npcImages[renderType] && renderType !== 'npc5') {
                 if (!this.npcImages[renderType]) renderType = 'extra_1';
            }

            let npcImgSet = this.npcImages[renderType];
            if (n.type === 'npc5') {
                npcImgSet = {
                    stand: this.npc5Images.stand,
                    run: n.playingGiftAnim ? this.npc5Images.gift : this.npc5Images.stand
                };
            }

            if (npcImgSet) {
               const isMoving = n.lastMoveTime ? (Date.now() - n.lastMoveTime) < 200 : false;
               const isGiftAnim = (n.type === 'npc5' && !!n.giftAnimStart);
               
               let img = isMoving ? npcImgSet.run : npcImgSet.stand;
               if (isGiftAnim && n.type === 'npc5') {
                   img = this.npc5Images.gift;
               }

               if (n.type === 'npc5' && (!img || !img.complete || img.naturalWidth === 0)) {
                    if (Math.random() < 0.01) console.warn("NPC5 Image not loaded!", img ? img.src : 'null');
               }

               if (img && img.complete && img.naturalWidth > 0) {
                   let spriteW = 32;
                   let spriteH = 64;
                   
                   if (n.type === 'npc5') {
                       spriteW = 96;
                       spriteH = 96;
                   }

                   const framesPerDir = 6;
                   const dir = n.dir !== undefined ? n.dir : 3; 
                   
                   let sx = 0;
                   let sy = 0;

                   if (n.type === 'npc5') {
                       const speed = 250;
                       let frame = Math.floor(Date.now() / speed) % framesPerDir;
                       
                       if (isGiftAnim && n.giftAnimStart) {
                           const elapsed = Date.now() - n.giftAnimStart;
                           const animSpeed = 200;
                           frame = Math.floor(elapsed / animSpeed);
                           if (frame >= framesPerDir) frame = framesPerDir - 1;
                       }
                       
                       sx = frame * spriteW;
                       sy = 0; 
                   } else if (isGiftAnim && n.giftAnimStart) {
                       const speed = 200; 
                       const elapsed = Date.now() - n.giftAnimStart;
                       const totalFrames = framesPerDir; 
                       let frame = Math.floor(elapsed / speed);
                       if (frame >= totalFrames) frame = totalFrames - 1;
                       sx = frame * spriteW;
                   } else {
                       const speed = isMoving ? 100 : 250;
                       const frame = Math.floor(Date.now() / speed) % framesPerDir;
                       const totalIndex = dir * framesPerDir + frame;
                       sx = totalIndex * spriteW;
                   }

                   const vX = (n.visualX !== undefined) ? n.visualX : n.x;
                   const vY = (n.visualY !== undefined) ? n.visualY : n.y;
                   
                   const drawY = vY * this.tileSize + offsetY - (spriteH - this.tileSize);
                   const drawX = vX * this.tileSize + offsetX - (spriteW - this.tileSize) / 2;

                   ctx.drawImage(img, sx, sy, spriteW, spriteH, drawX, drawY, spriteW, spriteH);
               } else {
                   const vX = (n.visualX !== undefined) ? n.visualX : n.x;
                   const vY = (n.visualY !== undefined) ? n.visualY : n.y;
                   ctx.fillStyle = n.type === 'talker' ? '#9b59b6' : '#2ecc71';
                   ctx.fillRect(vX * this.tileSize + 4 + offsetX, vY * this.tileSize + 4 + offsetY, this.tileSize - 8, this.tileSize - 8);
               }
            } else {
                 const vX = (n.visualX !== undefined) ? n.visualX : n.x;
                 const vY = (n.visualY !== undefined) ? n.visualY : n.y;
                 ctx.fillStyle = n.type === 'talker' ? '#9b59b6' : '#2ecc71';
                 ctx.fillRect(vX * this.tileSize + 4 + offsetX, vY * this.tileSize + 4 + offsetY, this.tileSize - 8, this.tileSize - 8);
            }

            // Name Label
            const dX = Math.abs(n.x - this.player.x);
            const dY = Math.abs(n.y - this.player.y);
            const dist = Math.sqrt(dX*dX + dY*dY);
            
            const keyNPCs: Record<string, string> = {
                'aa': 'Alice',
                'photographer': 'Bob',
                'bartender': 'Samuel',
                'decorator': 'Roki'
            };

            if (keyNPCs[n.type] && dist > 3 && !this.isInPartyMap) {
                const label = keyNPCs[n.type];
                const vX = (n.visualX !== undefined) ? n.visualX : n.x;
                const vY = (n.visualY !== undefined) ? n.visualY : n.y;
                
                const lblX = vX * this.tileSize + offsetX + this.tileSize / 2;
                const lblY = vY * this.tileSize + offsetY + this.tileSize + 10; 

                ctx.font = '8px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.strokeText(label, lblX, lblY);
                ctx.fillStyle = 'white';
                ctx.fillText(label, lblX, lblY);
            }

            // Quest Mark
            let showMark = false;
            if (n.type === 'aa') {
                if (!this.quest || !this.quest.questStarted) showMark = true;
            }
            else if (this.quest && this.quest.questStarted && this.quest.isTaskNPC(n.type)) {
                if (!this.quest.isCompleted(n.type)) showMark = true;
            }
            else if (n.type === 'npc5') {
                if (!n.playingGiftAnim) showMark = true;
            }

            if (showMark && this.questMarkImage && this.questMarkImage.complete && this.questMarkImage.naturalWidth > 0) {
                const iconW = 32;
                const iconH = 64; 
                const numFrames = 8; 
                const speed = 150; 
                const markFrame = Math.floor(Date.now() / speed) % numFrames;
                
                const mx = markFrame * iconW;
                const my = 0;
                
                const vX = (n.visualX !== undefined) ? n.visualX : n.x;
                const vY = (n.visualY !== undefined) ? n.visualY : n.y;

                let mDrawX = vX * this.tileSize + offsetX;
                let mDrawY = vY * this.tileSize + offsetY - 96;

                if (n.type === 'npc5') {
                   mDrawX = 10 * this.tileSize + offsetX;
                   mDrawY = 5 * this.tileSize + offsetY - 32; 
                }

                ctx.drawImage(this.questMarkImage, mx, my, iconW, iconH, mDrawX, mDrawY, this.tileSize, iconH);
            }
        
        } else if (entity.type === 'player') { 
            // Player Drawing
            const isRunning = (Date.now() - this.lastMoveTime) < 150;
            const currentImage = isRunning ? this.heroRunImage : this.heroStandImage;
            
            if (currentImage && currentImage.complete && currentImage.naturalWidth > 0) {
                const spriteW = 32;
                const spriteH = 64;
                const framesPerDir = 6;
                const totalIndex = this.heroDir * framesPerDir + this.heroFrame;
                const sx = totalIndex * spriteW;
                const sy = 0; 
                
                const drawX = this.visualPos!.x * this.tileSize + offsetX;
                const drawY = this.visualPos!.y * this.tileSize + offsetY - (spriteH - this.tileSize);

                ctx.drawImage(
                currentImage, 
                sx, sy, spriteW, spriteH,
                drawX, 
                drawY, 
                this.tileSize, spriteH 
                );
            } else {
                ctx.fillStyle = '#3498db';
                const vx = this.visualPos ? this.visualPos.x : this.player.x;
                const vy = this.visualPos ? this.visualPos.y : this.player.y;
                ctx.fillRect(vx * this.tileSize + 4 + offsetX, vy * this.tileSize + 4 + offsetY, this.tileSize - 8, this.tileSize - 8);
            }
        }
      }

    } else {
      // Legacy rendering (omitted for brevity, but you might want to update it too if needed)
      // ...
      const tilesPerRow = Math.max(1, Math.floor((this.tilesetImage as any).width / this.tileSize));
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < this.map.width; x++) {
          const idx = y * this.map.width + x;
          const gid = this.map.data[idx];
          const px = x * this.tileSize;
          const py = y * this.tileSize;
          if (gid === 0) {
            ctx.fillStyle = '#111';
            ctx.fillRect(px, py, this.tileSize, this.tileSize);
          } else {
            const tileIndex = gid - 1;
            const sx = (tileIndex % tilesPerRow) * this.tileSize;
            const sy = Math.floor(tileIndex / tilesPerRow) * this.tileSize;
            ctx.drawImage(this.tilesetImage, sx, sy, this.tileSize, this.tileSize, px, py, this.tileSize, this.tileSize);
          }
        }
      }

      // Draw NPCs (Legacy - no camera offset)
      for (const n of this.npcs) {
        ctx.fillStyle = n.type === 'talker' ? '#9b59b6' : '#2ecc71';
        ctx.fillRect(n.x * this.tileSize + 4, n.y * this.tileSize + 4, this.tileSize - 8, this.tileSize - 8);
      }
  
      ctx.fillStyle = '#3498db';
      ctx.fillRect(this.player.x * this.tileSize + 4, this.player.y * this.tileSize + 4, this.tileSize - 8, this.tileSize - 8);
    }
  }
}

export default Game;

