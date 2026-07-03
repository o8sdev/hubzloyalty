// One-off PWA icon generation (run: node scripts/generate-icons.mjs).
// Café-print mark: ember roundel, cream "L", paper backdrop for maskable
// safe zones. Outputs are committed — this script only reruns on rebrand.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const EMBER = "#d4551e";
const CREAM = "#fbf7ee";
const PAPER = "#f6f0e4";

/** The roundel scaled into a canvas; pad>0 leaves maskable safe area. */
function svg(size, pad) {
  const inner = size - pad * 2;
  const r = inner / 2;
  const cx = size / 2;
  const fontSize = Math.round(inner * 0.52);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="${EMBER}"/>
  <text x="${cx}" y="${cx}" font-family="Georgia, 'Times New Roman', serif" font-weight="700"
        font-size="${fontSize}" fill="${CREAM}" text-anchor="middle" dominant-baseline="central">L</text>
</svg>`);
}

mkdirSync("public/icons", { recursive: true });

const jobs = [
  { file: "public/icons/icon-192.png", size: 192, pad: 12 },
  { file: "public/icons/icon-512.png", size: 512, pad: 32 },
  { file: "public/icons/maskable-512.png", size: 512, pad: 96 },
  { file: "public/icons/apple-touch-icon.png", size: 180, pad: 0 },
];

for (const job of jobs) {
  await sharp(svg(job.size, job.pad)).png().toFile(job.file);
  console.log("wrote", job.file);
}
