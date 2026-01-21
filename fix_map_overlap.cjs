const fs = require('fs');
const path = 'public/map.json';

try {
    const data = fs.readFileSync(path, 'utf8');
    const map = JSON.parse(data);

    // Find layers
    const floorLayer = map.layers.find(l => l.name === 'floor');
    const floor2Layer = map.layers.find(l => l.name === 'floor2');

    if (!floorLayer || !floor2Layer) {
        console.error('Could not find both floor and floor2 layers');
        process.exit(1);
    }

    console.log('Found layers. Processing...');

    // Make both visible
    floorLayer.visible = true;
    floor2Layer.visible = true;

    // "Punch out" floor where floor2 exists
    if (floorLayer.data && floor2Layer.data) {
        if (floorLayer.data.length !== floor2Layer.data.length) {
            console.warn('Warning: Layer data lengths differ!');
        }

        let changedCount = 0;
        for (let i = 0; i < floor2Layer.data.length; i++) {
            if (floor2Layer.data[i] !== 0) {
                // If floor2 has a tile, clear floor1's tile at this index
                if (floorLayer.data[i] !== 0) {
                    floorLayer.data[i] = 0;
                    changedCount++;
                }
            }
        }
        console.log(`Updated ${changedCount} tiles in 'floor' layer to avoid overlap with 'floor2'.`);
    }

    fs.writeFileSync(path, JSON.stringify(map, null, 1));
    console.log('Map updated successfully.');

} catch (e) {
    console.error('Error processing map:', e);
}
