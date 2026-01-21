import { Game } from './game';
import { loadSampleMap } from './loader';
import { loadTiledMap } from './tiled_loader';
import { MiniGame } from './mini_game';
import { QuestManager } from './quest';
import DecoratorGame from './decorator_game';
import BartenderGame from './bartender_game';
import Party from './party';
import dialogs from './data/dialogs.json';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const dialog = document.getElementById('dialog') as HTMLDivElement;

function resize() {
  // 目标：让游戏元素看起来变小 (50% scale)，通过提高 Canvas 的内部分辨率来实现
  // 同时让 Canvas 居中并只占屏幕 80% 的面积
  const scale = 0.8; 
  
  // 1. Set CSS size to 80% of viewport
  canvas.style.width = '80vw';
  canvas.style.height = '80vh';

  // 2. Center the canvas
  canvas.style.position = 'absolute';
  canvas.style.top = '50%';
  canvas.style.left = '50%';
  canvas.style.transform = 'translate(-50%, -50%)';
  canvas.style.border = 'none'; // Remove border
  canvas.style.boxShadow = '0 0 50px rgba(0,0,0,0.8)'; // Deep shadow for focus
  
  // 3. Read the actual display size 
  // (We calculate manually to ensure sync with CSS logic if clientWidth isn't ready)
  const displayWidth = window.innerWidth * 0.8;
  const displayHeight = window.innerHeight * 0.8;

  // 4. Set internal resolution matching the aspect ratio of the display size
  canvas.width = Math.floor(displayWidth / scale);
  canvas.height = Math.floor(displayHeight / scale);

  // Reset background
  document.body.style.background = '#111';

  console.log(`Canvas resized to ${canvas.width}x${canvas.height} (Display: ${displayWidth}x${displayHeight}) - Scale: ${scale}`);
}
resize();
window.addEventListener('resize', resize);

async function init() {
  const loading = document.createElement('div');
  loading.style.position = 'absolute';
  loading.style.top = '10px';
  loading.style.left = '10px';
  loading.style.color = 'white';
  loading.style.background = 'black';
  loading.style.padding = '5px';
  loading.style.fontFamily = "'Press Start 2P', system-ui"; // Apply font here too
  loading.innerText = 'Loading map...';
  document.body.appendChild(loading);

  console.log('Starting map load...');
  // To use your Tiled map:
  // 1. Export it as JSON (e.g. 'map.json') and put it in 'public/'
  // 2. Put tileset images in 'public/'
  // 3. Uncomment the line below:
  const { map } = await loadTiledMap('/map.json'); 
  console.log('Map loaded', map);
  loading.remove();
  
  // Default sample map:
  //const { map: sampleMap, tilesetImage } = await loadSampleMap();
  
  const mini = new MiniGame({ levels: 3, diffsPerLevel: 1 });
  const decorator = new DecoratorGame();
  const bartender = new BartenderGame();
  const quest = new QuestManager();
  const miniGames: Record<string, any> = {
    photographer: mini,
    decorator,
    bartender,
  };

  const party = new Party();
  const game = new Game(canvas, dialog, map, null, miniGames, quest, party, dialogs);

  // Use visualPos immediately to prevent visual glitch on load
  game.visualPos = { x: 58, y: 47 };

  // --- 修改初始位置 (Modify Start Position) ---
  // 你可以在这里手动设置主角的初始坐标 (x, y)
  // You can manually set the player start coordinates here
  game.player.x = 58; 
  game.player.y = 47;
  // ------------------------------------------
  // --- 手动添加缺失的任务 NPC (Add Missing NPCs) ---
  // 如果地图里没有配置这些 NPC，我们在这里手动添加到主角附近方便测试
  // Coordinates are relative to player start (2,2) for visibility
  if (!game.npcs.find(n => n.type === 'aa')) {
    game.npcs.push({ x: 44, y: 55, type: 'aa', name: 'AA' });
  }
  if (!game.npcs.find(n => n.type === 'decorator')) {
    game.npcs.push({ x: 17, y: 40, type: 'decorator', name: 'Roki' });
  }
  if (!game.npcs.find(n => n.type === 'photographer')) {
    game.npcs.push({ x: 16, y: 25, type: 'photographer', name: 'Bob' });
  }
  if (!game.npcs.find(n => n.type === 'bartender')) {
    game.npcs.push({ x: 38, y: 16, type: 'bartender', name: 'Samuel' });
  }
  
  // Add 6 Extra NPCs (Scatter them around the map)
  const extraPositions = [
      { x: 16, y: 12 }, { x: 22, y: 28 }, { x: 34, y: 12 },
      { x: 53, y: 52 }, { x: 66, y: 37 }, { x: 77, y: 12 }
  ];
  
  const extraNames = ["Anna", "Mike", "Sarah", "John", "Emily", "David"];

  for(let i=0; i<6; i++) {
      if (!game.npcs.find(n => n.type === `extra_${i+1}`)) {
          game.npcs.push({ 
              x: extraPositions[i].x, 
              y: extraPositions[i].y, 
              type: `extra_${i+1}`, 
              name: extraNames[i] 
          });
      }
  }

  // -----------------------------------------------
  // add global key handler
  window.addEventListener('keydown', (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    game.handleKey(e);
  });

  // add global click handler for dialogs
  window.addEventListener('click', () => {
    if (game.dialogOpen) {
      game.advanceDialog();
    }
  });

  // START SCREEN
  const startScreen = document.createElement('div');
  startScreen.className = 'start-screen';
  startScreen.innerHTML = `
    <div class="start-panel">
      <h1>DESIGN CHRISTMAS BITS</h1>
      <button id="start-btn">START GAME</button>
    </div>
  `;
  document.body.appendChild(startScreen);
  const startBtn = startScreen.querySelector('#start-btn') as HTMLButtonElement;
  
  // Trigger UI Fade In after animation starts (e.g., 2.5 seconds in)
  setTimeout(() => {
     startScreen.classList.add('show-ui');
  }, 2500);

  startBtn.addEventListener('click', () => {
    // Fade out
    startScreen.style.transition = 'opacity 0.5s';
    startScreen.style.opacity = '0';
    setTimeout(() => startScreen.remove(), 500);
    
    // Play BGM via game instance's bgm property
    if (game.bgm) {
      game.bgm.play().catch(e => console.error("BGM Play failed:", e));
    }
    game.start();
    game.playIntroSequence();
  });
}

init();
