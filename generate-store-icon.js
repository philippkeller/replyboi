// Generate a nice store icon for ReplyBoi
// Run with: node generate-store-icon.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData.push(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
  
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
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Smooth step for anti-aliasing
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Distance to rounded rectangle
function sdRoundedRect(x, y, cx, cy, w, h, r) {
  const qx = Math.abs(x - cx) - w / 2 + r;
  const qy = Math.abs(y - cy) - h / 2 + r;
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - r;
}

// Distance to circle
function sdCircle(x, y, cx, cy, r) {
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - r;
}

// Draw chat bubble shape
function sdChatBubble(x, y, size) {
  const cx = size / 2;
  const cy = size / 2 - size * 0.05;
  const w = size * 0.75;
  const h = size * 0.55;
  const r = size * 0.15;
  
  // Main bubble
  let d = sdRoundedRect(x, y, cx, cy, w, h, r);
  
  // Tail (triangle at bottom left)
  const tailX = cx - size * 0.15;
  const tailY = cy + h / 2 - size * 0.02;
  const tailSize = size * 0.15;
  
  // Simple tail approximation
  const tx = x - tailX;
  const ty = y - tailY;
  if (ty > 0 && ty < tailSize && tx > -tailSize * 0.5 && tx < tailSize * 0.3) {
    const tailD = ty - tailSize + Math.abs(tx) * 1.5;
    d = Math.min(d, tailD);
  }
  
  return d;
}

// Generate icon
function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const aa = 1.5; // Anti-aliasing width
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      // Background - subtle gradient
      const bgT = (x + y) / (size * 2);
      const bgR = Math.round(lerp(20, 35, bgT));
      const bgG = Math.round(lerp(20, 30, bgT));
      const bgB = Math.round(lerp(40, 55, bgT));
      
      // Chat bubble distance
      const bubbleD = sdChatBubble(x, y, size);
      const bubbleAlpha = 1 - smoothstep(-aa, aa, bubbleD);
      
      // Bubble gradient (Twitter blue)
      const bubbleT = (x + y * 0.5) / (size * 1.5);
      const bubbleR = Math.round(lerp(29, 50, bubbleT));
      const bubbleG = Math.round(lerp(161, 180, bubbleT));
      const bubbleB = Math.round(lerp(242, 255, bubbleT));
      
      // Counter badge - red circle with number
      const badgeCx = size * 0.72;
      const badgeCy = size * 0.28;
      const badgeR = size * 0.18;
      const badgeD = sdCircle(x, y, badgeCx, badgeCy, badgeR);
      const badgeAlpha = 1 - smoothstep(-aa, aa, badgeD);
      
      // Badge border (white)
      const badgeBorderD = sdCircle(x, y, badgeCx, badgeCy, badgeR + size * 0.02);
      const badgeBorderAlpha = 1 - smoothstep(-aa, aa, badgeBorderD);
      
      // Number "1" in badge
      const numCx = badgeCx;
      const numCy = badgeCy;
      const numW = size * 0.06;
      const numH = size * 0.16;
      const numD = sdRoundedRect(x, y, numCx, numCy, numW, numH, size * 0.01);
      const numAlpha = 1 - smoothstep(-aa, aa, numD);
      
      // Compose layers
      let r = bgR, g = bgG, b = bgB, a = 255;
      
      // Bubble
      if (bubbleAlpha > 0) {
        r = Math.round(lerp(r, bubbleR, bubbleAlpha));
        g = Math.round(lerp(g, bubbleG, bubbleAlpha));
        b = Math.round(lerp(b, bubbleB, bubbleAlpha));
      }
      
      // Badge border (white)
      if (badgeBorderAlpha > 0 && badgeBorderAlpha > badgeAlpha) {
        const borderOnly = badgeBorderAlpha - badgeAlpha;
        r = Math.round(lerp(r, 255, borderOnly));
        g = Math.round(lerp(g, 255, borderOnly));
        b = Math.round(lerp(b, 255, borderOnly));
      }
      
      // Badge (red/orange gradient)
      if (badgeAlpha > 0) {
        const badgeGradT = (x - badgeCx + badgeR) / (badgeR * 2);
        const badgeR2 = Math.round(lerp(220, 255, badgeGradT));
        const badgeG2 = Math.round(lerp(50, 90, badgeGradT));
        const badgeB2 = Math.round(lerp(50, 70, badgeGradT));
        r = Math.round(lerp(r, badgeR2, badgeAlpha));
        g = Math.round(lerp(g, badgeG2, badgeAlpha));
        b = Math.round(lerp(b, badgeB2, badgeAlpha));
      }
      
      // Number (white)
      if (numAlpha > 0 && badgeAlpha > 0.5) {
        r = Math.round(lerp(r, 255, numAlpha));
        g = Math.round(lerp(g, 255, numAlpha));
        b = Math.round(lerp(b, 255, numAlpha));
      }
      
      // Make corners transparent (rounded square icon)
      const cornerR = size * 0.2;
      const cornerD = sdRoundedRect(x, y, size / 2, size / 2, size, size, cornerR);
      if (cornerD > 0) {
        a = Math.round(255 * (1 - smoothstep(0, aa, cornerD)));
      }
      
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }
  
  return pixels;
}

// Create store-assets directory
const assetsDir = path.join(__dirname, 'store-assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// Generate 128x128 store icon
const size = 128;
const pixels = generateIcon(size);
const png = createPNG(size, size, pixels);

fs.writeFileSync(path.join(assetsDir, 'store-icon-128.png'), png);
console.log('✅ Created store-assets/store-icon-128.png');

// Also generate larger version for promo (can be scaled down)
const size2 = 256;
const pixels2 = generateIcon(size2);
const png2 = createPNG(size2, size2, pixels2);
fs.writeFileSync(path.join(assetsDir, 'store-icon-256.png'), png2);
console.log('✅ Created store-assets/store-icon-256.png');

// Update the extension icons too
const sizes = [16, 48, 128];
for (const s of sizes) {
  const px = generateIcon(s);
  const p = createPNG(s, s, px);
  fs.writeFileSync(path.join(__dirname, 'icons', `icon${s}.png`), p);
  console.log(`✅ Updated icons/icon${s}.png`);
}

console.log('\n🎨 Icons generated! The store icon features:');
console.log('   - Blue chat bubble (Twitter/X style)');
console.log('   - Red notification badge with "1"');
console.log('   - Dark gradient background');
console.log('   - Rounded corners with anti-aliasing');


