import { readdirSync, statSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'src', 'assets');
const ARCHIVE = join(ASSETS, '_originals');

const TARGETS = [
  join(ASSETS, 'fotopins'),
  join(ASSETS, 'PARCEIROSEARQUIVOS'),
];

const MAX_WIDTH = 1080;
const WEBP_QUALITY = 72;
const MIN_SIZE_BYTES = 80 * 1024;
const CONVERT_EXTS = new Set(['.png', '.jpg', '.jpeg']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (full.startsWith(ARCHIVE)) continue;
      walk(full, out);
    } else {
      out.push({ path: full, size: s.size });
    }
  }
  return out;
}

function fmt(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

async function convertFile(file) {
  const ext = extname(file.path).toLowerCase();
  if (!CONVERT_EXTS.has(ext)) return null;
  if (file.size < MIN_SIZE_BYTES) return null;

  const rel = relative(ASSETS, file.path);
  const archivePath = join(ARCHIVE, rel);
  mkdirSync(dirname(archivePath), { recursive: true });

  const webpPath = file.path.slice(0, -ext.length) + '.webp';

  const image = sharp(file.path, { failOn: 'none' });
  const metadata = await image.metadata();
  const width = metadata.width ?? MAX_WIDTH;
  const resized = width > MAX_WIDTH ? image.resize({ width: MAX_WIDTH }) : image;

  await resized.webp({ quality: WEBP_QUALITY, effort: 5 }).toFile(webpPath);

  const newSize = statSync(webpPath).size;

  renameSync(file.path, archivePath);

  return {
    from: rel,
    to: relative(ASSETS, webpPath),
    oldSize: file.size,
    newSize,
  };
}

async function main() {
  mkdirSync(ARCHIVE, { recursive: true });
  const files = [];
  for (const dir of TARGETS) {
    if (!existsSync(dir)) continue;
    walk(dir, files);
  }
  files.sort((a, b) => b.size - a.size);

  let totalOld = 0;
  let totalNew = 0;
  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const result = await convertFile(file);
      if (!result) {
        skipped += 1;
        continue;
      }
      totalOld += result.oldSize;
      totalNew += result.newSize;
      converted += 1;
      console.log(
        `OK  ${result.from.padEnd(55)} ${fmt(result.oldSize).padStart(10)} -> ${fmt(result.newSize).padStart(10)}  (${(
          (1 - result.newSize / result.oldSize) *
          100
        ).toFixed(0)}%)`,
      );
    } catch (err) {
      console.error(`ERR ${file.path}`, err.message);
    }
  }

  console.log('');
  console.log(`convertidos: ${converted}`);
  console.log(`ignorados:   ${skipped}`);
  console.log(`antes:       ${fmt(totalOld)}`);
  console.log(`depois:      ${fmt(totalNew)}`);
  if (totalOld > 0) {
    console.log(`reducao:     ${((1 - totalNew / totalOld) * 100).toFixed(1)}%`);
  }
  console.log('');
  console.log(`originais movidos para: ${relative(ROOT, ARCHIVE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
