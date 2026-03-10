# Gnocenter

Aplicacao web de navegacao interna para eventos sociais no GNOCENTER.

## O que o mapa entrega

- visualizacao de pontos do evento (atividades, servicos, entradas e banheiros)
- busca rapida por pontos
- calculo de rota entre origem e destino
- estimativa de distancia e tempo medio de caminhada
- modo admin para cadastrar/editar pontos no proprio mapa

## Estrutura

```text
gnocenter/
|- frontend/   # app React + Vite
|- backend/    # reservado
|- scripts/    # utilitarios para gerar navGraph
`- README.md
```

## Pre-requisitos

- Node.js 20+
- npm

## Como rodar

```powershell
cd frontend
npm install
npm run dev
```

## Build

```powershell
cd frontend
npm run build
```

## Atualizar malha de rotas (navGraph)

1. Exporte o mapa logico para imagem (`.png` recomendado).
2. Use o arquivo exportado no `scripts/`.
3. Gere o grafo:

```powershell
cd scripts
npm install
npm run build:graph
```

O comando sobrescreve:

- `frontend/src/data/navGraph.json`

### Variaveis opcionais para o gerador

- `MAP_LOGIC_IMAGE` (padrao: `mapa-logica.png`)
- `MAP_GRAPH_OUTPUT` (padrao: `../frontend/src/data/navGraph.json`)
- `GRID_SIZE` (padrao: `15`)
- `WALKABLE_MODE`:
  - `light` -> pixels claros sao caminhaveis (use quando preto = proibido)
  - `dark` -> pixels escuros sao caminhaveis
- `COLOR_THRESHOLD` (padrao: `200`)

Exemplo (preto = bloqueado, branco = caminhavel):

```powershell
cd scripts
$env:MAP_LOGIC_IMAGE='mapa-logica-export.png'
$env:WALKABLE_MODE='light'
npm run build:graph
```
