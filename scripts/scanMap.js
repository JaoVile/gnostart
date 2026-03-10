const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const INPUT_IMAGE = process.env.MAP_LOGIC_IMAGE || 'mapa-logica.png';
const OUTPUT_FILE = process.env.MAP_GRAPH_OUTPUT || '../frontend/src/data/navGraph.json';
const GRID_SIZE = Number.parseInt(process.env.GRID_SIZE || '15', 10);
const WALKABLE_MODE = (process.env.WALKABLE_MODE || 'light').trim().toLowerCase();
const COLOR_THRESHOLD = Number.parseInt(process.env.COLOR_THRESHOLD || '200', 10);

const resolveFromScriptsDir = (targetPath) =>
  path.isAbsolute(targetPath) ? targetPath : path.resolve(__dirname, targetPath);

const validateInputExtension = (inputPath) => {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.bmp') {
    throw new Error(
      `Formato ${ext || '(sem extensao)'} nao suportado. Exporte o mapa logico para PNG/JPG antes de gerar o grafo.`,
    );
  }
};

const isWalkablePixel = (rgba) => {
  const avg = (rgba.r + rgba.g + rgba.b) / 3;
  if (WALKABLE_MODE === 'dark') {
    return avg <= COLOR_THRESHOLD;
  }
  return avg >= COLOR_THRESHOLD;
};

async function generateGraph() {
  const inputPath = resolveFromScriptsDir(INPUT_IMAGE);
  const outputPath = resolveFromScriptsDir(OUTPUT_FILE);

  if (!Number.isFinite(GRID_SIZE) || GRID_SIZE <= 0) {
    throw new Error('GRID_SIZE precisa ser um inteiro positivo.');
  }

  if (!['light', 'dark'].includes(WALKABLE_MODE)) {
    throw new Error("WALKABLE_MODE invalido. Use 'light' (padrao) ou 'dark'.");
  }

  validateInputExtension(inputPath);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo de entrada nao encontrado: ${inputPath}`);
  }

  console.log(`Lendo mapa logico: ${inputPath}`);
  console.log(
    `Modo caminhavel: ${WALKABLE_MODE} | limiar: ${COLOR_THRESHOLD} | grid: ${GRID_SIZE}px`,
  );

  const image = await Jimp.read(inputPath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  console.log(`Dimensoes da imagem: ${width}x${height}`);

  const graph = {};
  const nodes = [];

  for (let y = 0; y < height; y += GRID_SIZE) {
    for (let x = 0; x < width; x += GRID_SIZE) {
      const pixelColor = image.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(pixelColor);
      if (!isWalkablePixel(rgba)) continue;

      const id = `${x}_${y}`;
      graph[id] = { x, y, neighbors: [] };
      nodes.push({ id, x, y });
    }
  }

  console.log(`Nos caminhaveis: ${nodes.length}`);
  console.log('Criando conexoes...');

  nodes.forEach((node) => {
    const { x, y, id } = node;
    const candidates = [
      `${x + GRID_SIZE}_${y}`,
      `${x - GRID_SIZE}_${y}`,
      `${x}_${y + GRID_SIZE}`,
      `${x}_${y - GRID_SIZE}`,
    ];

    candidates.forEach((neighborId) => {
      if (graph[neighborId]) {
        graph[id].neighbors.push(neighborId);
      }
    });
  });

  fs.writeFileSync(outputPath, JSON.stringify(graph));
  console.log(`Grafo salvo em: ${outputPath}`);
}

generateGraph().catch((error) => {
  console.error('Erro ao gerar navGraph:', error.message);
  process.exitCode = 1;
});
