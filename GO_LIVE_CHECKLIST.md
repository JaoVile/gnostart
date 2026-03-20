# Gnostart Go-Live Checklist

Checklist operacional para publicar o mapa do evento sem perder nenhuma etapa critica.

## 1. GitHub e versionamento

- [ ] Confirmar que existem dois repositorios separados e ambos estao atualizados:
  - frontend: `https://github.com/JaoVile/gnostart`
  - backend: `https://github.com/JaoVile/nomonG`
- [ ] Rodar `git status` dentro de `gnostart/` e garantir que nao existem mudancas pendentes antes do deploy.
- [ ] Rodar `git status` dentro de `nomonG/` e garantir que nao existem mudancas pendentes antes do deploy.
- [ ] Commitar e fazer `push` do frontend.
- [ ] Commitar e fazer `push` do backend.
- [ ] Garantir que a VPS vai baixar exatamente os commits que passaram em build local.

## 2. Build local obrigatorio

- [ ] Rodar `npm run build` em `gnostart/`.
- [ ] Rodar `npm run build` em `nomonG/`.
- [ ] Se houver mudanca de banco ou seed, rodar no backend:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

- [ ] Se mexer em coordenadas ou assets depois disso, rodar novo build antes de publicar.

## 3. VPS minima recomendada

- [ ] Se o banco estiver fora da VPS: minimo aceitavel `1 vCPU + 1 GB RAM`.
- [ ] Se o banco estiver na mesma VPS: recomendado `2 vCPU + 2 GB RAM + 20 GB disco`.
- [ ] Garantir Node `20+` se for deploy manual.
- [ ] Garantir Docker e Docker Compose se for deploy por container.
- [ ] Garantir HTTPS real no dominio final.

## 4. Frontend `.env`

Arquivo base: [gnostart/.env.example](/C:/Projetos/gnostart/gnostart/.env.example)

- [ ] `VITE_API_BASE_URL` vazio se frontend e backend ficarem na mesma origem.
- [ ] `VITE_MAP_ID=default_map`
- [ ] `VITE_ADMIN_API_KEY` igual ao `ADMIN_API_KEY` do backend.
- [ ] Revisar se a tela de acesso interno continua ativa:
  - [ ] `VITE_REQUIRE_ACCESS_GATE`
  - [ ] `VITE_REQUIRE_TEMP_LOGIN`
  - [ ] `VITE_ACCESS_GATE_USERNAME`
  - [ ] `VITE_ACCESS_GATE_PASSWORD`

## 5. Backend `.env`

Arquivo base: [nomonG/.env.example](/C:/Projetos/gnostart/nomonG/.env.example)

- [ ] `NODE_ENV=production`
- [ ] `HOST=0.0.0.0`
- [ ] `PORT=3333`
- [ ] `DATABASE_URL` apontando para o banco real.
- [ ] `ADMIN_API_KEY` forte e igual ao usado no frontend.
- [ ] `DEFAULT_MAP_ID=default_map`
- [ ] `DEFAULT_MAP_OVERLAY_URL=/maps/mapa_oficial.svg`
- [ ] `GOOGLE_EVENT_LAT`, `GOOGLE_EVENT_LNG` e `GOOGLE_EVENT_RADIUS_METERS` alinhados com o local real.
- [ ] `GOOGLE_MAPS_API_KEY` configurada apenas se quiser contexto externo e geocoding do Google.
- [ ] `CORS_ORIGIN` ajustado se frontend e backend estiverem em dominios diferentes.

## 6. Persistencia e permissoes

- [ ] Garantir permissao de escrita na pasta `nomonG/storage`.
- [ ] Confirmar que o backend consegue criar/atualizar `storage/agenda-poi-links.json`.
- [ ] Garantir permissao de leitura dos assets e do overlay oficial.

## 7. Publicacao do frontend

- [ ] Publicar o `dist/` do frontend em Nginx ou usar o [gnostart/Dockerfile](/C:/Projetos/gnostart/gnostart/Dockerfile).
- [ ] Garantir que `public/maps/mapa_oficial.svg` esta presente na publicacao.
- [ ] Confirmar que o build final inclui os novos assets da aba de parceiros.
- [ ] Validar que o `index.html` carregou sem erro 404 de asset.

## 8. Publicacao do backend

- [ ] Publicar o backend com `npm run build && npm start` ou usar o [nomonG/Dockerfile](/C:/Projetos/gnostart/nomonG/Dockerfile).
- [ ] Rodar `npm run prisma:deploy` na VPS antes de iniciar a API.
- [ ] Rodar `npm run prisma:seed` se precisar restaurar `default_map` e POIs.
- [ ] Confirmar que a API sobe em `:3333`.
- [ ] Confirmar resposta `200` em `/health`.

## 9. Proxy e HTTPS

- [ ] Frontend servido por HTTPS.
- [ ] Proxy de `/api` apontando para `http://127.0.0.1:3333`.
- [ ] Proxy de `/health` apontando para `http://127.0.0.1:3333/health`.
- [ ] Se usar mesma origem, manter `VITE_API_BASE_URL` vazio.
- [ ] Testar no celular pelo dominio final, nunca por IP cru sem HTTPS.

## 10. Smoke test de producao

- [ ] Abrir a home e validar carregamento do mapa.
- [ ] Confirmar que `GET /api/v1/map/bootstrap?mapId=default_map&includeGraph=false` responde `200`.
- [ ] Confirmar que `POST /api/v1/location/context` responde `200`.
- [ ] Abrir `Locais`, `Cronograma` e `Parceiros` e validar que o painel certo abre.
- [ ] Abrir um pin e validar preview, descricao e cronograma relacionado.
- [ ] Tocar em uma sessao do cronograma e validar foco no local correto.
- [ ] Testar o fluxo de rota com GPS funcionando.
- [ ] Testar o plano B: se a localizacao demorar, o app deve pedir para marcar no mapa ou usar pontos principais.
- [ ] Testar `Mudar posicao` depois de origem manual marcada.
- [ ] Validar criacao, edicao e remocao de POI no admin.

## 11. GPS no local do evento

- [ ] Testar no celular real, no local real, com HTTPS real.
- [ ] Aceitar permissao de GPS e confirmar que o aviso de `Locais` some na hora.
- [ ] Bloquear permissao de GPS e confirmar que o app nao trava.
- [ ] Recusar permissao de GPS e confirmar que o app continua navegavel.
- [ ] Confirmar que a rota nasce sem telas extras.
- [ ] Confirmar que `Voce esta aqui` faz sentido no mapa.
- [ ] Se houver desvio pequeno, ajustar o offset manual.

## 12. Calibracao final

- [ ] Validar centro e perimetro em [mapConfig.ts](/C:/Projetos/gnostart/gnostart/src/config/mapConfig.ts).
- [ ] Se ainda houver desvio no local, ajustar `EVENT_BOUNDARY_CALIBRATION_POINTS`.
- [ ] Se o perimetro estiver certo mas o ponto interno ainda desviar, ajustar `EVENT_INTERNAL_CALIBRATION_POINTS`.
- [ ] Fazer um ultimo build apos qualquer ajuste de coordenada.

## 13. Riscos ainda vivos

- [ ] Algumas imagens da aba de parceiros ainda estao grandes; se houver tempo, comprimir as maiores antes do deploy final.
- [ ] Se a VPS estiver apertada, priorizar banco fora da maquina da aplicacao.
- [ ] Se o backend nao tiver permissao de escrita em `storage/`, os vinculos manuais do cronograma nao vao persistir.

## 14. Rollback rapido

- [ ] Manter o commit anterior anotado antes do deploy.
- [ ] Manter backup do `.env` da VPS.
- [ ] Se der problema, voltar frontend e backend para o ultimo commit estavel.
- [ ] Reiniciar somente depois do rollback completo.
