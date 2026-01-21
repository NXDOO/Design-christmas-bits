const fs = require('fs');
const path = require('path');

const files = ['public/map.json', 'public/party_map.json'];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    console.log(`Checking ${f}...`);
    try {
        const data = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (data.tilesets) {
            data.tilesets.forEach((ts, i) => {
                console.log(`  Tileset ${i}: Name="${ts.name}", Image="${ts.image}", Source="${ts.source}"`);
                
                let targetPath = null;
                if (!ts.image && ts.source) {
                    const match = ts.source.match(/([^\/\\.]+)\.tsx$/i);
                    if (match && match[1]) {
                        targetPath = match[1] + '.png';
                        console.log(`    -> Derived Image: ${targetPath}`);
                    }
                } else if (ts.image) {
                     targetPath = ts.image.split('/').pop().split('\\').pop();
                }

                if (targetPath) {
                    if (!fs.existsSync(path.join('public', targetPath))) {
                        console.log(`    !!! MISSING FILE: public/${targetPath}`);
                    } else {
                        console.log(`    [OK] Found public/${targetPath}`);
                    }
                } else {
                    console.log(`    [?] Could not determine target image path.`);
                }
            });
        }
    } catch (e) {
        console.error(`Error parsing ${f}:`, e.message);
    }
});
