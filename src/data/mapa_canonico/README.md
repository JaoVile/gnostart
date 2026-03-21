# Mapa Canonico

Use esta pasta como referencia central do mapa.

Arquivos:

- `mapa-base-canonica.json`: fonte tecnica do sistema. Guarda os 20 pins canonicos e a configuracao da `logica_nova.svg` / `logica_nova.png`.
- `pins-canonicos.txt`: lista humana rapida no formato `nome/x: valor | y: valor/foto`.

Fluxo correto:

1. Edite os pins e a configuracao da rota em `mapa-base-canonica.json`.
2. Rode `npm run build:map-base` na pasta `gnostart`.
3. Isso regenera o `navGraph.json` pela `logica_nova` e recria o `locaisEventoSocialSeed.json` com `nodeId` correto para cada pin.
4. Depois rode `npm run sync:map-base` na pasta `nomonG` para sincronizar o backend.

Ajuste manual da malha logica:

- Arquivo: `src/data/mapa_canonico/mapa-base-canonica.json`
- Bloco: `route.alignment`
- `offsetX`: move a malha para a direita com valor positivo e para a esquerda com valor negativo
- `offsetY`: move a malha para baixo com valor positivo e para cima com valor negativo
- `scaleX`: estica ou encolhe a malha na largura
- `scaleY`: estica ou encolhe a malha na altura
- Se quiser aumentar ou diminuir tudo sem deformar, use o mesmo valor em `scaleX` e `scaleY`

Exemplo:

```json
"alignment": {
  "offsetX": -6,
  "offsetY": 3,
  "scaleX": 1.01,
  "scaleY": 1
}
```

Como recalcular depois de mexer:

1. Salve o `mapa-base-canonica.json`
2. Rode `npm run build:graph` em `gnostart`
3. Rode `npm run sync:map-base` em `gnostart`
4. Se o backend estiver ligado aos POIs, rode `npm run sync:map-base` em `nomonG`

Observacao importante:

- Esse ajuste agora vale para as duas coisas ao mesmo tempo: a sobreposicao visual da `logica_nova.png` no mapa e a geracao do `navGraph`
- Ou seja, se você empurrar a malha 5px para a esquerda, a comparacao visual e a rota passam a usar exatamente o mesmo deslocamento

Arquivos atualizados pelo fluxo:

- `src/data/navGraph.json`
- `src/data/locaisEventoSocialSeed.json`
- `src/data/mapa_canonico/pins-canonicos.txt`

Regra de rota:

- andar somente no branco da `logica_nova`
- ignorar tudo que for preto
- se um pin estiver fora do corredor branco, o sistema prende o `nodeId` no ponto branco mais proximo da malha principal
