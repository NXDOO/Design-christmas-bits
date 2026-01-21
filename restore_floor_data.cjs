const fs = require('fs');
const targetPath = 'public/map.json';
const sourcePath = 'Map/map.json';

try {
    const targetMap = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const sourceMap = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    // Find target floor layer
    // In public/map.json, it was named 'floor' (at index 1 based on logs)
    const targetFloorIndex = targetMap.layers.findIndex(l => l.name === 'floor');
    if (targetFloorIndex === -1) {
        throw new Error("Could not find 'floor' layer in public/map.json");
    }

    // Find source floor layer
    // In Map/map.json, we saw ['Black', 'floor', 'floor', ...]
    // We assume the first 'floor' (index 1) is the base floor.
    const sourceFloorIndex = sourceMap.layers.findIndex(l => l.name === 'floor');
    if (sourceFloorIndex === -1) {
        throw new Error("Could not find 'floor' layer in Map/map.json");
    }

    console.log(`Restoring 'floor' data from source index ${sourceFloorIndex} to target index ${targetFloorIndex}`);

    // Verify dimensions match
    if (targetMap.width !== sourceMap.width || targetMap.height !== sourceMap.height) {
        console.warn("Warning: Map dimensions differ. Proceeding with caution.");
    }

    // Overwrite data
    targetMap.layers[targetFloorIndex].data = sourceMap.layers[sourceFloorIndex].data;
    
    // Ensure visibility is TRUE for both floor and floor2 (if it exists)
    targetMap.layers[targetFloorIndex].visible = true;
    
    const floor2 = targetMap.layers.find(l => l.name === 'floor2');
    if (floor2) {
        floor2.visible = true;
        console.log("Ensured 'floor2' is visible.");
    }

    fs.writeFileSync(targetPath, JSON.stringify(targetMap, null, 1));
    console.log('Restoration complete.');

} catch (e) {
    console.error('Error:', e);
    process.exit(1);
}
