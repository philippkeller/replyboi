// Generate Chrome Web Store assets
// Run with: node generate-store-assets.js

const fs = require('fs');
const path = require('path');

function createPNG(width, height, drawFn) {
  const zlib = require('zlib');
  
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  
  // Create pixel data
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData.push(r, g, b, a);
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  
  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crcTable = null;
function getCRC32Table() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  return crcTable;
}

// Draw function for icon with "0"
function drawIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 2;
  const dx = x - cx + 0.5;
  const dy = y - cy + 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > radius) {
    return [0, 0, 0, 0]; // transparent
  }
  
  // Gradient background
  const t = (x + y) / (w + h);
  const r = Math.round(29 + t * 20);
  const g = Math.round(161 - t * 30);
  const b = Math.round(242 - t * 20);
  
  // Draw "0" in center
  const fontSize = w * 0.5;
  const charWidth = fontSize * 0.6;
  const charHeight = fontSize * 0.9;
  
  const charCx = cx;
  const charCy = cy;
  const charDx = Math.abs(x - charCx);
  const charDy = Math.abs(y - charCy);
  
  // Simple "0" shape (oval with hole)
  const outerA = charWidth / 2;
  const outerB = charHeight / 2;
  const innerA = charWidth / 2 - fontSize * 0.15;
  const innerB = charHeight / 2 - fontSize * 0.15;
  
  const outerDist = (charDx * charDx) / (outerA * outerA) + (charDy * charDy) / (outerB * outerB);
  const innerDist = (charDx * charDx) / (innerA * innerA) + (charDy * charDy) / (innerB * innerB);
  
  if (outerDist <= 1 && innerDist >= 1) {
    return [255, 255, 255, 255]; // white text
  }
  
  return [r, g, b, 255];
}

// Promotional tile background
function drawPromoTile(x, y, w, h) {
  // Dark gradient background
  const t = y / h;
  const r = Math.round(15 + t * 10);
  const g = Math.round(15 + t * 10);
  const b = Math.round(30 + t * 16);
  return [r, g, b, 255];
}

// Create assets directory
const assetsDir = path.join(__dirname, 'store-assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// Generate icon 128x128 (required)
const icon128 = createPNG(128, 128, drawIcon);
fs.writeFileSync(path.join(assetsDir, 'icon128.png'), icon128);
console.log('Created store-assets/icon128.png (128x128 icon)');

// Copy to icons folder too
fs.writeFileSync(path.join(__dirname, 'icons', 'icon128.png'), icon128);
console.log('Updated icons/icon128.png');

console.log(`
✅ Store assets created in ./store-assets/

📋 You still need to create manually:
   
1. Screenshots (1280x800 or 640x400) - at least 1, up to 5
   → Use your video frames or take screenshots of the extension in action
   
2. Promotional tile (440x280) - optional but recommended
   → Create in Figma/Canva with your branding

3. Description text for the store listing

📝 Store Listing Info to prepare:
   - Name: ReplyBoi
   - Short description (132 chars max): Count your replies on X (Twitter). See your reply count right in the extension icon!
   - Detailed description
   - Category: Social & Communication
   - Language: English
`);





