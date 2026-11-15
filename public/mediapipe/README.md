# Recursos locais do rastreamento

- SDK/runtime: `@mediapipe/tasks-vision` **1.2.3**, fixado em `package.json` e `package-lock.json`.
- `wasm/`: cópia integral da pasta homônima do pacote npm, incluindo os carregadores `.js`. Não renomeie esses arquivos.
- Modelo: [Hand Landmarker FP16, versão 1](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task).
- SHA-256 do modelo: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.
- [Código e licença MediaPipe](https://github.com/google-ai-edge/mediapipe); licença Apache-2.0 acompanha esta pasta em `LICENSE`.

O modelo tem 7.819.105 bytes. Os dois pares de carregador/WASM somam 30.004.740 bytes. São cerca de 37,84 MB com a licença, antes da compressão HTTP. Cada navegador escolhe o par compatível; não precisa baixar ambos durante o uso.

Para reproduzir, na raiz do projeto, execute `npm ci` e `npm run preparar:maos` com internet. O script confere o SHA-256 antes de substituir o modelo. Depois, `npm run build` copia os recursos para `dist/mediapipe/`. O rastreador usa `import.meta.env.BASE_URL`, sem CDN.

Esta versão do SDK tenta transmitir métricas de uso. A tela da câmera aplica `connect-src 'self'` para impedir conexões externas, inclusive telemetria. Não há API de opt-out usada aqui. Um aviso de CSP no console para `odml.pa.googleapis.com` indica o bloqueio esperado; a inferência continua local.
