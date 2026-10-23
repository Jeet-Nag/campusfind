import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCampusFindIcon } from './generate-icons';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../client/public/icons');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log(`Writing PWA icons to ${targetDir}...`);

// 1. 192x192 standard icon
const icon192 = renderCampusFindIcon(192, false);
fs.writeFileSync(path.join(targetDir, 'icon-192.png'), icon192);
console.log('✓ Wrote icon-192.png (192x192,', icon192.length, 'bytes)');

// 2. 512x512 standard icon
const icon512 = renderCampusFindIcon(512, false);
fs.writeFileSync(path.join(targetDir, 'icon-512.png'), icon512);
console.log('✓ Wrote icon-512.png (512x512,', icon512.length, 'bytes)');

// 3. 192x192 maskable icon
const iconMaskable192 = renderCampusFindIcon(192, true);
fs.writeFileSync(path.join(targetDir, 'icon-maskable-192.png'), iconMaskable192);
console.log('✓ Wrote icon-maskable-192.png (192x192 maskable,', iconMaskable192.length, 'bytes)');

// 4. 512x512 maskable icon
const iconMaskable512 = renderCampusFindIcon(512, true);
fs.writeFileSync(path.join(targetDir, 'icon-maskable-512.png'), iconMaskable512);
console.log('✓ Wrote icon-maskable-512.png (512x512 maskable,', iconMaskable512.length, 'bytes)');

// 5. 180x180 Apple touch icon
const appleTouchIcon = renderCampusFindIcon(180, false);
fs.writeFileSync(path.join(targetDir, 'apple-touch-icon.png'), appleTouchIcon);
console.log('✓ Wrote apple-touch-icon.png (180x180,', appleTouchIcon.length, 'bytes)');

// 6. Scalable SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#0F172A"/>
  <!-- Pediment roof -->
  <polygon points="256,100 110,180 402,180" fill="#FFFFFF"/>
  <rect x="100" y="180" width="312" height="24" rx="4" fill="#FFFFFF"/>
  <!-- University Columns -->
  <rect x="140" y="210" width="28" height="130" rx="4" fill="#FFFFFF"/>
  <rect x="210" y="210" width="28" height="130" rx="4" fill="#FFFFFF"/>
  <rect x="274" y="210" width="28" height="130" rx="4" fill="#FFFFFF"/>
  <rect x="344" y="210" width="28" height="130" rx="4" fill="#FFFFFF"/>
  <!-- Steps -->
  <rect x="110" y="340" width="292" height="24" rx="4" fill="#FFFFFF"/>
  <rect x="90" y="364" width="332" height="24" rx="4" fill="#FFFFFF"/>
  <!-- Pediment circle accent -->
  <circle cx="256" cy="150" r="16" fill="#3B82F6"/>
  <!-- Search lens accent -->
  <circle cx="340" cy="310" r="50" fill="none" stroke="#3B82F6" stroke-width="20"/>
  <line x1="375" y1="345" x2="420" y2="390" stroke="#3B82F6" stroke-width="20" stroke-linecap="round"/>
</svg>`;
fs.writeFileSync(path.join(targetDir, 'icon.svg'), svgContent, 'utf-8');
console.log('✓ Wrote icon.svg');
