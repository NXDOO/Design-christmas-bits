import { SimpleMap } from './game';

export interface TiledMapData {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Array<{
    data?: number[];
    objects?: Array<{ id: number; name: string; type: string; x: number; y: number; width: number; height: number }>;
    width?: number;
    height?: number;
    type: string;
    name: string;
    visible: boolean;
  }>;
  tilesets: Array<{
    firstgid: number;
    image: string;
    name: string;
    tilewidth: number;
    tileheight: number;
    imagewidth: number;
    imageheight: number;
  }>;
}

export async function loadTiledMap(url: string): Promise<{ map: SimpleMap }> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load map: ${response.statusText}`);
    const data: TiledMapData = await response.json();

    // Load tileset images
    const tilesets = await Promise.all(data.tilesets.map(async (ts: any) => {
      let imagePath = ts.image;

      // Handle external tilesets (source .tsx) by guessing the image filename
      if (!imagePath && ts.source) {
          // Extract filename without extension from the source path
          // e.g. "../Map/Interiors_32x32.tsx" -> "Interiors_32x32"
          const match = ts.source.match(/([^\/\\.]+)\.tsx$/i);
          if (match && match[1]) {
              imagePath = match[1] + '.png'; // Assume .png and in root/public
              // console.log(`Guessing image for external tileset ${ts.source}: ${imagePath}`);
          }
      }

      if (!imagePath) {
        console.warn(`Skipping invalid tileset (no image or source):`, ts);
        return null;
      }

      const img = new Image();
      // Simplify path: Assume all images are in the root public folder
      const filename = imagePath.split('/').pop()?.split('\\').pop();
      const cleanPath = '/' + filename;
      
      const v = Date.now();
      img.src = `${cleanPath}?v=${v}`; 
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = (e) => {
          console.warn(`Failed to load tileset image: ${cleanPath}. Ensure current file is in the project 'public/' folder.`, e);
          resolve(null);
        };
      });
      // We need to return the tileset structure merging properties
      // Note: External tilesets in JSON don't have tilewidth/image properties on the 'ts' object itself usually?
      // Actually usually Tiled JSON with external TSX just has { firstgid: N, source: "..." }.
      // We are hacking it, so we might lack 'tilewidth', 'tileheight', 'imagewidth', 'imageheight'.
      // If they are missing, we should infer from the image.
      
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const tw = ts.tilewidth || 32; // Fallback or hope it's in the TS object? (It is NOT usually in the minimal reference)
      const th = ts.tileheight || 32; 
      
      return { 
          firstgid: ts.firstgid,
          image: cleanPath,
          name: ts.name || filename,
          tilewidth: tw,
          tileheight: th,
          imagewidth: width,
          imageheight: height,
          imageElement: img 
      };
    }));

    const validTilesets = tilesets.filter(t => t !== null) as any;

    // Parse Object Layers
    const objects: any[] = [];
    data.layers.forEach(layer => {
      if (layer.type === 'objectgroup' && layer.objects) {
        layer.objects.forEach(obj => {
          const tileX = Math.floor(obj.x / data.tilewidth);
          const tileY = Math.floor(obj.y / data.tileheight);
          objects.push({
            type: obj.type || obj.name.toLowerCase() || 'npc',
            name: obj.name,
            tileX,
            tileY
          });
        });
      }
    });

    const map: SimpleMap = {
      width: data.width,
      height: data.height,
      tilewidth: data.tilewidth,
      tileheight: data.tileheight,
      data: [], // Legacy field
      layers: data.layers.filter(l => l.type === 'tilelayer' && l.visible !== false) as any,
      tilesets: validTilesets,
      objects: objects.length > 0 ? objects : undefined
    };

    return { map };
  } catch (e) {
    console.error("Tiled Map Loader Error:", e);
    // Return a dummy map to prevent crash
    return { 
      map: { width: 10, height: 10, tilewidth: 32, tileheight: 32, data: new Array(100).fill(0) } 
    };
  }
}
