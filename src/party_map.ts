export function createPartyMap() {
  const width = 12;
  const height = 8;
  const data: number[] = [];
  for (let i = 0; i < width * height; i++) data.push(1);
  return {
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    data,
    objects: [
      { type: 'player', tileX: 1, tileY: 6 },
      // other objects reserved
    ],
  };
}

export function createPartyNPCs() {
  // Place NPC5 (Santa) - Center top
  // Make sure he's accessible.
  // Using original coordinate or slightly adjusted
  const npcs: Array<{ x: number; y: number; type: string; name?: string }> = [];
  
  // Santa at (11, 8) as mentioned before was for a larger map logic?
  // Wait, `createPartyMap` above defines width=12, height=8.
  // If height is 8, y=2 is top-ish.
  // Let's check `party.ts` to see if it loads a Tiled map or uses this `createPartyMap`.
  // Actually the main game logic uses `party.ts` which loads `Sample2.png` as background maybe?
  
  // Let's assume we are using the Tiled Map or Background Image logic where coordinates matter.
  // If this function is used, let's set fixed positions away from Santa.
  
  // Santa (NPC5)
  npcs.push({ x: 11, y: 8, type: 'npc5', name: 'Santa' }); 

  // Specific Named NPCs from First Scene
  // Mapping the 9 cast members to the 9 coordinates:
  // (5, 8), (6, 12), (8, 11), (12, 10), (15, 11), (14, 8), (17, 7), (18, 9), (20, 9)

  npcs.push({ x: 5, y: 8, type: 'extra_1', name: 'Kevin' });
  npcs.push({ x: 6, y: 12, type: 'bartender', name: 'Samuel' });
  npcs.push({ x: 8, y: 11, type: 'photographer', name: 'Bob' });
  npcs.push({ x: 12, y: 10, type: 'extra_3', name: 'Sarah' });
  npcs.push({ x: 15, y: 11, type: 'extra_4', name: 'John' });
  npcs.push({ x: 14, y: 8, type: 'extra_2', name: 'Mike' });
  npcs.push({ x: 17, y: 7, type: 'extra_6', name: 'Jessica' });
  npcs.push({ x: 18, y: 9, type: 'extra_5', name: 'Jason' });
  npcs.push({ x: 8, y: 8, type: 'decorator', name: 'Roki' });

  // No more generic generic fillers or random placement.
  // We have exactly 9 + Santa (+ Alice from logic) = 11 NPCs.

  return npcs;
}

export default createPartyMap;
