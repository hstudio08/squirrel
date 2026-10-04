const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Look for directories that match __next.* 
    if (entry.isDirectory()) {
      if (entry.name.startsWith('__next.')) {
        // e.g., __next.settings
        const pageTxtPath = path.join(fullPath, '__PAGE__.txt');
        if (fs.existsSync(pageTxtPath)) {
          // The router looks for a file named __next.settings.__PAGE__.txt
          const newFileName = `${entry.name}.__PAGE__.txt`;
          const newFilePath = path.join(dir, newFileName);
          console.log(`Fixing RSC payload: Copying ${pageTxtPath} to ${newFilePath}`);
          fs.copyFileSync(pageTxtPath, newFilePath);
        }
      }
      // Recursively process subdirectories
      processDir(fullPath);
    }
  }
}

console.log('Running Next.js RSC payload fix for Capacitor...');
processDir(outDir);
console.log('Fix complete.');
