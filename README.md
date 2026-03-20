# gnostart frontend

Frontend web do mapa operacional do evento, com foco em:

- mapa interno com overlay oficial
- GPS em tempo real
- rota ate os pontos do evento
- cronograma vinculado aos pins
- painel de operacao para POIs

## Estrutura principal

- `src/components/Maps/Gnomon.tsx`: orquestracao do mapa, estado principal e integracao geral
- `src/components/Maps/buttons/`: botoes fixos de `Cronograma`, `Locais` e `Parceiros`
- `src/components/Maps/header/`: header e logo do Gnomon
- `src/components/Maps/location/`: cartao e estado visual de localizacao
- `src/components/Maps/routes-pins-previews/`: rota, painel de pins, previews e estagios visuais ligados ao mapa
- `src/components/Maps/tutorial/`: overlay e fluxo do tutorial
- `src/config/mapConfig.ts`: calibracao do evento, limites do overlay e configuracao de zoom

## Ambiente

Crie `.env` a partir de `.env.example`.

```env
VITE_API_BASE_URL=
VITE_MAP_ID=default_map
VITE_ADMIN_API_KEY=
VITE_REQUIRE_ACCESS_GATE=true
VITE_REQUIRE_TEMP_LOGIN=true
VITE_ACCESS_GATE_USERNAME=admin
VITE_ACCESS_GATE_PASSWORD=654321
```

Notas:

- Em desenvolvimento local, deixe `VITE_API_BASE_URL` vazio e use o proxy do Vite.
- Em VPS same-origin, deixe `VITE_API_BASE_URL` vazio e faça proxy de `/api` e `/health`.
- Em frontend e backend separados, configure `VITE_API_BASE_URL=https://api.seu-dominio.com`.
- Se quiser manter a tela de acesso interno, configure `VITE_ACCESS_GATE_USERNAME` e `VITE_ACCESS_GATE_PASSWORD`.

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Entrega

Antes de publicar:

- confira `GO_LIVE_CHECKLIST.md`
- valide o GPS em aparelho real no local do evento
- confirme que `src/config/mapConfig.ts` reflete o perimetro final
