import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Standard CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export function generatePng(
  width: number,
  height: number,
  drawPixel: (x: number, y: number) => [number, number, number, number]
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter 0
  ihdrData[12] = 0; // Non-interlaced
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // IDAT
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Pixel drawer for CampusFind
// Deep slate navy background (#0F172A) with rounded squircle or circle
// Crisp white university pillar & search symbol with subtle royal blue accent
export function renderCampusFindIcon(
  size: number,
  isMaskable: boolean
): Buffer {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 192; // baseline 192

  // Background color #0F172A = rgb(15, 23, 42)
  const bgR = 15, bgG = 23, bgB = 42;
  // Accent blue #3B82F6 = rgb(59, 130, 246)
  const accR = 59, accG = 130, accB = 246;
  // White #FFFFFF
  const fgR = 255, fgG = 255, fgB = 255;

  return generatePng(size, size, (x, y) => {
    // If not maskable, we can give gentle rounded corners (radius ~ 22% of size)
    if (!isMaskable) {
      const r = size * 0.22;
      let inCorner = false;
      if (x < r && y < r) {
        if (Math.hypot(x - r, y - r) > r) return [0, 0, 0, 0];
      } else if (x > size - r && y < r) {
        if (Math.hypot(x - (size - r), y - r) > r) return [0, 0, 0, 0];
      } else if (x < r && y > size - r) {
        if (Math.hypot(x - r, y - (size - r)) > r) return [0, 0, 0, 0];
      } else if (x > size - r && y > size - r) {
        if (Math.hypot(x - (size - r), y - (size - r)) > r) return [0, 0, 0, 0];
      }
    }

    // Normalized coordinates from center
    // In maskable mode, content should be scaled to ~75% to stay safely inside the inner safe zone
    const contentScale = isMaskable ? 0.72 : 0.88;
    const nx = (x - cx) / (scale * contentScale);
    const ny = (y - cy) / (scale * contentScale);

    // Draw University Library / Pediment emblem + Search magnifying glass
    // Pediment roof (triangle from y = -45 to -22, x from -44 to +44)
    if (ny >= -45 && ny <= -24) {
      const roofWidth = ((ny - -45) / 21) * 44;
      if (Math.abs(nx) <= roofWidth) {
        // Pediment cornice
        return [fgR, fgG, fgB, 255];
      }
    }
    // Roof cornice horizontal beam (y from -24 to -18, x from -46 to +46)
    if (ny >= -24 && ny <= -18 && Math.abs(nx) <= 46) {
      return [fgR, fgG, fgB, 255];
    }

    // 4 University Columns: x centers at -33, -11, +11, +33; width = 8, y from -16 to +22
    const columnXs = [-33, -11, 11, 33];
    for (const colX of columnXs) {
      if (Math.abs(nx - colX) <= 4.5 && ny >= -16 && ny <= 22) {
        return [fgR, fgG, fgB, 255];
      }
    }

    // Base podium beam (y from 22 to 28, x from -46 to +46)
    if (ny >= 22 && ny <= 28 && Math.abs(nx) <= 46) {
      return [fgR, fgG, fgB, 255];
    }
    // Bottom foundation step (y from 28 to 33, x from -48 to +48)
    if (ny >= 28 && ny <= 33 && Math.abs(nx) <= 48) {
      return [fgR, fgG, fgB, 255];
    }

    // Blue accent emblem in pediment center (small circle at nx = 0, ny = -31, radius 4)
    if (Math.hypot(nx, ny - -31) <= 4.5) {
      return [accR, accG, accB, 255];
    }

    // Search magnifier overlay on bottom right (center at nx = 25, ny = 16)
    // Ring radius 16 outer, 11 inner
    const mDist = Math.hypot(nx - 24, ny - 16);
    if (mDist <= 16.5 && mDist >= 10.5) {
      return [accR, accG, accB, 255];
    }
    // Handle for magnifier: angled at 45 deg, from (35, 27) to (47, 39), thickness 4
    if (nx >= 33 && nx <= 49 && ny >= 25 && ny <= 41) {
      const u = (nx - 24) - (ny - 16); // should be near 0 along diagonal
      const v = (nx - 24) + (ny - 16); // distance along diagonal
      if (Math.abs(u) <= 3 && v >= 22 && v <= 48) {
        return [accR, accG, accB, 255];
      }
    }

    // Background fill
    return [bgR, bgG, bgB, 255];
  });
}
