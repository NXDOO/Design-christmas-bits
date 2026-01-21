const fs = require('fs');
const path = 'public/map.json';

try {
    const map = JSON.parse(fs.readFileSync(path, 'utf8'));
    
    // Find floor layer
    const floorLayer = map.layers.find(l => l.name === 'floor');
    if (!floorLayer) {
        throw new Error('Floor layer not found');
    }

    const width = map.width;
    
    // Define updates: [sourceX, sourceY, targetX, targetY]
    // Copy (77, 17) -> (87, 17)
    // Copy (77, 18) -> (87, 18)
    const updates = [
        [77, 17, 87, 17],
        [77, 18, 87, 18]
    ];

    updates.forEach(([sx, sy, tx, ty]) => {
        const sIdx = sy * width + sx;
        const tIdx = ty * width + tx;
        
        if (tIdx >= floorLayer.data.length || sIdx >= floorLayer.data.length) {
            console.error(`Index out of bounds for (${sx},${sy})->(${tx},${ty})`);
            return;
        }

        const tileId = floorLayer.data[sIdx];
        floorLayer.data[tIdx] = tileId;
        console.log(`Copied tile ${tileId} from (${sx},${sy}) to (${tx},${ty})`);
    });

    fs.writeFileSync(path, JSON.stringify(map, null, 1));
    console.log('Map updated.');

} catch (e) {
    console.error(e);
}
