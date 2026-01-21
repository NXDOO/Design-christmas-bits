const fs = require('fs');
const path = 'public/map.json';

try {
    const map = JSON.parse(fs.readFileSync(path, 'utf8'));
    
    // Find floor layer
    const floorLayer = map.layers.find(l => l.name === 'floor');
    if (!floorLayer) {
        console.error('Floor layer not found');
        process.exit(1);
    }

    const width = map.width;
    const x = 78;
    
    const sourceY = 17;
    const targetY = 18;

    const sourceIndex = sourceY * width + x;
    const targetIndex = targetY * width + x;

    console.log(`Map Width: ${width}`);
    console.log(`Source (78, 17) Index: ${sourceIndex}`);
    console.log(`Target (78, 18) Index: ${targetIndex}`);

    if (targetIndex >= floorLayer.data.length) {
        console.error('Target index out of bounds');
        process.exit(1);
    }

    const tileId = floorLayer.data[sourceIndex];
    console.log(`Copying tile ID ${tileId} from (${x},${sourceY}) to (${x},${targetY})`);

    floorLayer.data[targetIndex] = tileId;

    fs.writeFileSync(path, JSON.stringify(map, null, 1));
    console.log('Map updated successfully.');

} catch (e) {
    console.error('Error:', e);
    process.exit(1);
}
