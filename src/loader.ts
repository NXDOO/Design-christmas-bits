import type { SimpleMap } from './game';

export async function loadSampleMap(): Promise<{ map: SimpleMap; tilesetImage: HTMLCanvasElement }> {
  // Create a simple tileset: two tiles (floor and wall)
  const tileSize = 32;
  const tilesPerRow = 2;
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * tilesPerRow;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d')!;

  // tile 1: floor
  ctx.fillStyle = '#444';
  ctx.fillRect(0, 0, tileSize, tileSize);
  ctx.fillStyle = '#666';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect((i * 5) % tileSize, (i * 8) % tileSize, 2, 2);
  }

  // tile 2: wall
  ctx.fillStyle = '#222';
  ctx.fillRect(tileSize, 0, tileSize, tileSize);
  ctx.fillStyle = '#999';
  ctx.fillRect(tileSize + 6, 6, 6, 6);

  // build a simple map
  const width = 12;
  const height = 8;
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // border walls
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) data.push(2);
      else data.push(1);
    }
  }

  const map: SimpleMap = {
    width,
    height,
    tilewidth: tileSize,
    tileheight: tileSize,
    data,
    // place player and 10 NPCs. Four of them have tasks (decorator, photographer, bartender, aa)
    objects: [
      { type: 'player', tileX: 2, tileY: 2 },
      { type: 'decorator', tileX: 4, tileY: 2 },
      { type: 'photographer', tileX: 6, tileY: 2 },
      { type: 'bartender', tileX: 8, tileY: 2 },
      { type: 'aa', tileX: 10, tileY: 2 },
      { type: 'talker', name: 'Alice', tileX: 3, tileY: 4 },
      { type: 'talker', name: 'Bob', tileX: 5, tileY: 4 },
      { type: 'talker', name: 'Cara', tileX: 7, tileY: 4 },
      { type: 'talker', name: 'Dan', tileX: 9, tileY: 4 },
      { type: 'talker', name: 'Eve', tileX: 4, tileY: 6 },
      { type: 'talker', name: 'Fay', tileX: 8, tileY: 6 }
    ]
  };

  return { map, tilesetImage: canvas };
}

export default loadSampleMap;
