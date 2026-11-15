# Tradutor Libras ↔ Voz

Protótipo acadêmico. Voz → Libras reúne captura, glosa didática e avatar. Libras → Voz está na segunda parte da Etapa 5: câmera, coleta de exemplos e classificação de formas estáticas com KNN, ainda sem produzir fala automaticamente.

## Estrutura

```text
index.html                     Tela inicial e escolha da direção
src/
  voz-para-libras/index.html    Captura de fala, digitação e frases prontas
  voz-para-libras/main.js       Liga as entradas à interface e ao barramento
  voz-para-libras/reconhecimento.js  Controla as sessões da Web Speech API
  voz-para-libras/normalizar.js  Normaliza o texto antes da emissão
  voz-para-libras/estilos.css   Estilos básicos da captura
  libras-para-voz/index.html    Câmera espelhada, canvas e FPS
  libras-para-voz/camera.js     Captura local e liberação da câmera
  libras-para-voz/maos.js       MediaPipe, inferência e desenho dos pontos
  libras-para-voz/main.js       Controles e estado da sessão
  libras-para-voz/normalizacao.js  Vetor 3D relativo ao pulso e tamanho da mão
  libras-para-voz/coleta.js     Coleta, importação/exportação e interface de teste
  libras-para-voz/knn.js        Classificação por vizinhos em JavaScript puro
  comum/estilos.css            Layout, contraste e foco compartilhados
  comum/contrato.js            Síntese de voz e barramento de eventos
  comum/contrato.test.js       Testes unitários com Vitest
public/sinais/                 Vídeos MP4 de reserva
public/mediapipe/              Modelo de mãos e runtime WASM locais
public/gestos-config.json      Gestos, instruções, palavras e mão selecionada
public/gestos.json             Base de vetores (inicialmente vazia)
scripts/preparar-maos.mjs      Baixa o modelo e copia o WASM do pacote instalado
vite.config.js                 Entradas HTML e caminho base de publicação
.github/workflows/deploy.yml   Build e publicação no GitHub Pages
```

Cada direção tem endereço próprio e pode crescer separadamente. As páginas usam HTML e CSS compartilhado. Os cartões são links nativos e funcionam com toque, teclado e histórico do navegador.

## Rodar localmente

Instale o Node.js 24 LTS. No terminal, abra a pasta que contém o `package.json` e rode:

```sh
npm ci
npm run dev
```

Abra o endereço **Local** exibido no terminal. No PowerShell, use `npm.cmd` caso a política de execução bloqueie `npm.ps1`.

Para testar os arquivos de produção:

```sh
npm run build
npm run preview
```

## Contrato compartilhado

Os módulos importam `falar`, `ouvir`, `emitir` e `EVENTOS` de `../comum/contrato.js`. O arquivo inclui um exemplo completo em comentário. `ouvir` retorna uma função para remover a assinatura. Os eventos `texto-reconhecido` e `gesto-reconhecido` recebem, respectivamente, `{ texto }` e `{ gesto }`.

O barramento atua dentro da página atual. Ao navegar entre os documentos HTML, suas assinaturas são reiniciadas. A integração entre reconhecimento, interface e fala será feita pelos módulos que importarem o contrato.

`falar(texto)` enfileira a fala e retorna a utterance, permitindo atribuir `onend` e `onerror`. Retorna `null` para texto inválido ou API ausente. Erros síncronos são propagados. O idioma é sempre `pt-BR` e a voz brasileira é escolhida quando disponível na chamada. Se a lista ainda estiver vazia, o navegador seleciona pelo idioma. As chamadas seguintes consultam a lista novamente. A disponibilidade de voz e funcionamento offline dependem do dispositivo. [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)

Execute `npm test` para validar o contrato com APIs de áudio simuladas. O critério de pronto deste incremento é passar os testes e `npm run build`. A reprodução de áudio real precisa ser conferida no navegador, a partir de uma interação do usuário.

## Testar no celular

**Para usar o microfone**, abra a versão atualizada pelo endereço **HTTPS** do GitHub Pages, diretamente no Chrome. HTTP pelo IP do notebook (por exemplo, `http://192.168.15.4:5173/`) é uma origem insegura. O botão Falar fica indisponível nesse endereço e a tela explica o motivo. Os passos de Wi-Fi abaixo servem para navegação, digitação e atalhos.

**Teste local no Android por USB:** com a depuração USB autorizada no telefone e o Vite rodando no computador, abra `chrome://inspect/#devices` no Chrome do computador, selecione **Port forwarding**, habilite o encaminhamento e mapeie a porta **5173** do aparelho para **localhost:5173** do computador. Use a porta impressa pelo Vite caso seja diferente. No Chrome do Android, abra `http://localhost:5173/`. [Guia do Chrome para encaminhamento por USB](https://developer.chrome.com/docs/devtools/remote-debugging/local-server)

1. Conecte o celular e o computador à mesma rede Wi-Fi.
2. No computador, execute `npm run dev -- --host`.
3. No Chrome ou Edge do celular, abra o endereço **Network** mostrado pelo Vite. Exemplo: `http://192.168.1.10:5173/`. Use o IP e a porta do seu terminal.
4. Se o acesso falhar, verifique se a rede permite comunicação entre aparelhos e se o firewall libera o Node.js na rede privada.
5. Toque em **Voz → Libras**, confira o título e volte ao início. Repita com **Libras → Voz**. Gire o aparelho e confirme que o texto continua legível e que a página não rola na horizontal.

O HTTP na rede local serve para testar a digitação e os atalhos. Para testar o microfone no celular, use o endereço HTTPS do GitHub Pages. No notebook, use localhost ou HTTPS.

## Etapa 2 — testar a captura

1. Execute `npm test` e `npm run build`.
2. No notebook, copie o endereço **Local** do Vite (normalmente `http://localhost:5173/`) para uma aba do Chrome aberta diretamente no sistema. No celular, use o acesso seguro descrito acima. Abra **Voz → Libras**, toque em **Falar**, permita o microfone, aguarde **Ouvindo** e diga “bom dia”.
3. Confira o parcial em cinza e o final “bom dia” em preto. A sessão captura uma frase curta e pode encerrar automaticamente. O botão **Parar** também encerra a captura, aguardando o último resultado.
4. Digite “  Bom dia! ” e envie. Confira o mesmo final “bom dia”. Repita usando o atalho **bom dia**.
5. Repita o teste nos dois aparelhos. O critério de pronto é dizer “bom dia” e obter “bom dia” como texto final em ambos.

Se falhar, anote o código mostrado na tela. `not-allowed` indica bloqueio de acesso; confira o site e a permissão do navegador no sistema. `audio-capture` indica falha de captura; no computador, confira o microfone de entrada e teste-o no gravador do sistema. `network` indica falha de comunicação com o serviço de reconhecimento; `service-not-allowed` indica que o navegador não autorizou esse serviço. Liberar o microfone não resolve um bloqueio do serviço. [Códigos da Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error)

Durante a inicialização ou a finalização, **Cancelar** libera o botão para tentar novamente. Se o navegador ficar sem responder, a tela encerra a tentativa após 20 segundos ao iniciar ou 4 segundos ao parar.

As três entradas usam a mesma função para normalizar, apresentar e emitir `EVENTOS.TEXTO_RECONHECIDO` com `{ texto: 'bom dia' }`. Parciais ficam apenas na tela. Uma entrada manual cancela a captura ativa e descarta resultados atrasados. A normalização preserva acentos, converte para minúsculas e substitui pontuação por espaços para evitar juntar palavras.

Os testes cobrem normalização e fluxo da interface com reconhecimento e elementos simulados. O teste com microfone real em notebook e celular precisa ser feito nos dispositivos. O reconhecimento pode depender da internet e enviar áudio ao serviço do navegador. Digitação e atalhos funcionam sem esse serviço. Há uma mensagem básica para falha ou API ausente. [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

## Publicar no GitHub Pages

O build copia o player oficial em `public/vlibras/`, os dez MP4 de reserva em `public/sinais/` e o modelo/WASM em `public/mediapipe/` para o site. Inclua essas três pastas no Git.

1. Crie um repositório público no GitHub. Envie o conteúdo desta pasta para a raiz da branch `main`, incluindo o workflow em `.github/workflows/` e o `package-lock.json`.
2. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
3. Faça um push na `main` ou, na aba **Actions**, abra **Publicar no GitHub Pages** e selecione **Run workflow**.
4. Abra a URL HTTPS publicada pelo job. Teste os dois links, o retorno ao início e o recarregamento direto de cada tela.

O `base` em `vite.config.js` usa `/` localmente. No GitHub Actions, `configure-pages` fornece o caminho do site e o workflow o passa ao Vite como `VITE_BASE_PATH`. Para um site em `https://usuario.github.io/tradutor-libras-voz/`, o valor é `/tradutor-libras-voz/`. Para um site hospedado na raiz, use `/`. Os links HTML usam `%BASE_URL%`, que o Vite substitui durante o build. [Guia do Vite](https://vite.dev/guide/static-deploy) · [Configuração do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Para simular o caminho de um repositório em PowerShell:

```powershell
$env:VITE_BASE_PATH = '/tradutor-libras-voz/'
npm run build
npm run preview
# Após encerrar o preview com Ctrl+C:
Remove-Item Env:VITE_BASE_PATH
```

## Critério de pronto

- Em celular e notebook, as duas opções abrem a tela correspondente e **Voltar ao início** retorna à página inicial.
- Em 320 px de largura, os cartões ficam empilhados e sem rolagem horizontal. Com teclado, **Tab** mostra o foco e **Enter** segue o link.
- O build gera as três páginas. Na URL publicada, as três carregam com CSS e cada tela aceita recarregamento direto.

## Performance, limites e próxima etapa

Use o painel **Network** do DevTools para medir requisições, bytes transferidos e tempo de carregamento do build, com cache desabilitado e perfil móvel. O **Lighthouse** ajuda a registrar a linha de base de desempenho e acessibilidade. A interface usa fontes do sistema e arquivos locais. Em uma apresentação sem internet, sirva o build localmente com `npm run preview` depois de instalar e compilar o projeto.

## Etapa 3 — avatar oficial do VLibras

Ao receber o texto final de voz, digitação ou atalho, a página carrega o player Unity do widget público em um iframe local. Cada frase aguarda a anterior. O programa espera o evento de prontidão do Unity antes de enviar a glosa, e o evento de fim da animação antes de liberar a próxima frase. O botão **Repetir** volta a sinalizar a última entrada.

O widget oferece uma interface de seleção de texto. Seu manual de incorporação documenta o carregamento e os parâmetros do widget. Para acionar o avatar por código, esta integração usa o protocolo do player na revisão **d79ca86ad09109e77887537aa96cd485c89037e1** do repositório oficial. O widget faz POST de JSON com o campo `text` ao tradutor e passa a glosa ao método `playNow` do objeto `PlayerManager`. É um protocolo de implementação vinculado a essa revisão. [Manual do widget](https://www.vlibras.gov.br/doc/widget/installation/webpageintegration.html) · [Tradução de texto](https://github.com/spbgovbr-vlibras/vlibras-web-browsers/blob/d79ca86ad09109e77887537aa96cd485c89037e1/src/core/actions/index.ts) · [Ações do player](https://github.com/spbgovbr-vlibras/vlibras-web-browsers/blob/d79ca86ad09109e77887537aa96cd485c89037e1/src/player/actions/index.ts)

O repositório separado **spbgovbr-vlibras/vlibras-player-webjs** implementa `Player.translate(text)` e `Player.play(glosa)`. A versão 2.4.2 no npm declara outro URL de repositório e outra estrutura de código. Usamos o runtime do widget para manter o conjunto de scripts, manifesto e binários da mesma revisão oficial. Para a Etapa 4, uma glosa válida do dicionário pode ser enviada diretamente ao mesmo comando de reprodução. [Player WebJS](https://github.com/spbgovbr-vlibras/vlibras-player-webjs/blob/dev/src/Player.js) · [Metadados do npm](https://registry.npmjs.org/vlibras-player-webjs/2.4.2)

**Recursos locais.** O player usa o caminho do repositório fornecido por `import.meta.env.BASE_URL`. A pasta `public/vlibras/` ocupa aproximadamente **21,16 MB**. O maior arquivo mede **16.992.528 bytes**. O iframe adapta a ponte oficial para restringir mensagens à origem e à janela do aplicativo, fixa a versão do manifesto e comunica falha de WebGL à tela. O arquivo de licença acompanha a distribuição. [Fontes do Unity](https://github.com/spbgovbr-vlibras/vlibras-web-browsers/tree/d79ca86ad09109e77887537aa96cd485c89037e1/public/unity)

O conversor didático usa os identificadores confirmados no dicionário WebGL BR. Os sinais do vocabulário e as letras são servidos em `public/vlibras/sinais/`. A captura de voz pode exigir internet.

**Plano B.** Se o carregamento ou a animação falhar ou expirar, a tela avisa que entrou no modo de reserva. A frase atual, as pendentes e as seguintes usam os vídeos existentes de `public/sinais/`, conforme `frases.json`. Recarregue a página para tentar o avatar novamente. O código do componente é LGPL-3.0. Os termos do serviço VLibras restringem a aplicação das traduções automáticas em atividades educacionais. Confirme a adequação da apresentação acadêmica com os responsáveis pelo VLibras. [Licença do componente](https://github.com/spbgovbr-vlibras/vlibras-web-browsers/blob/d79ca86ad09109e77887537aa96cd485c89037e1/LICENSE) · [Termos do serviço](https://www.vlibras.gov.br/privacy.html)

**Teste de aceite.** Abra Voz → Libras pelo HTTPS publicado. Clique em **bom dia** e **tudo bem?** e aguarde o fim de cada animação. Repita pelo microfone no notebook e no celular. Confira o texto final, o mesmo avatar Ícaro e a animação completa sem aviso de reserva. Para o critério linguístico, peça a uma pessoa fluente em Libras que valide dez rodadas de cada frase.

## Etapa 4 — glosa por regras didáticas

A fala, o formulário e os atalhos produzem texto final normalizado. A tela apresenta o texto, a glosa didática e o avatar em três colunas no notebook. Em telas estreitas, os painéis aparecem na mesma ordem, empilhados.

`src/voz-para-libras/glosa.js` exporta a função pura `paraGlosa(texto)`. Cada chamada devolve um novo array com itens de sinal, soletração (lista de letras) ou sem sinal (token original). Expressões conhecidas têm prioridade sobre a remoção de artigos, preposições e formas de ser/estar. As tabelas de conjugação e vocabulário cobrem o demo. As palavras alfabéticas desconhecidas, inclusive nomes próprios, são soletradas. Como a entrada é minúscula, a regra não tenta identificar nomes pela inicial. Para a soletração, a tela preserva os acentos; o avatar usa as letras básicas disponíveis e mantém Ç. Tokens sem representação, como números, ficam marcados. Uma entrada inteiramente omitida ou com trecho sem sinal não inicia uma animação incompleta.

`glosaParaTela` e `glosaParaVLibras` leem os mesmos itens. “Bom dia” aparece como **BOM-DIA** e envia `BOM DIA` ao player. “Tudo bem?” usa `TUDO_BEM [INTERROGAÇÃO]`. São sequências confirmadas para essas expressões. O marcador de pergunta faz parte da entrada fixa do player. As regras didáticas não modelam expressão facial nem uso do espaço e precisam de validação linguística. O programa monta a sequência em JavaScript e a envia como string ao comando `PlayerManager.playNow`. [Ações oficiais do player](https://github.com/spbgovbr-vlibras/vlibras-web-browsers/blob/d79ca86ad09109e77887537aa96cd485c89037e1/src/player/actions/index.ts)

Para testar, execute `npm ci`, `npm test` e `npm run dev`. Abra **Voz → Libras** e envie “eu gosto de café”. O texto final deve aparecer junto de **EU · GOSTAR · CAFÉ**, e Ícaro deve executar a sequência. Envie “eu sou João” e confira a soletração. Envie “o a uma” para conferir a saída vazia. Os 15 casos de Vitest verificam entradas, saídas didáticas e tokens para o player. O plano B usa o texto original normalizado para localizar os MP4 de reserva. Antes da apresentação, peça a uma pessoa fluente em Libras para revisar os sinais e as regras.

## Etapa 5 — parte 1: câmera e mãos

Abra **Libras → Voz**, clique em **Iniciar câmera** e permita o acesso. O vídeo e o canvas são espelhados juntos, com a proporção original da câmera. O Hand Landmarker funciona em `VIDEO`, com `numHands: 2`; cada mão detectada recebe 21 pontos e suas conexões. **Parar** libera a câmera e o modelo. Sair da aba também encerra a captura; ao voltar, inicie novamente.

`camera.js` pede a câmera frontal, sem áudio, com resolução preferida de 640 × 480 e até 30 quadros/s. `maos.js` usa `requestAnimationFrame`, processa somente quadros novos do vídeo e limpa o desenho quando não encontra mãos. Tenta GPU e usa CPU se a inicialização por GPU falhar. O contador mostra os quadros processados por segundo, atualizado a cada segundo, inclusive quando não há mãos. [API oficial e exemplo de vídeo](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker?tab=Web)

### Baixar e servir os recursos locais

Os arquivos já acompanham este projeto. Para baixá-los novamente, execute na raiz, com internet:

```powershell
npm ci
npm run preparar:maos
npm run build
npm run preview
```

O script `scripts/preparar-maos.mjs` baixa a versão 1 do [modelo oficial FP16](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task) e valida seu SHA-256. Ele copia a pasta `node_modules/@mediapipe/tasks-vision/wasm/` inteira, incluindo os carregadores JavaScript, para `public/mediapipe/wasm/`. O pacote está fixado em **1.2.3**. Se atualizar a dependência, copie novamente os WASM para manter SDK e runtime da mesma versão.

```text
public/mediapipe/
  hand_landmarker.task               7.819.105 bytes
  wasm/
    vision_wasm_internal.js            336.624 bytes
    vision_wasm_internal.wasm       14.665.716 bytes
    vision_wasm_module_internal.js     336.662 bytes
    vision_wasm_module_internal.wasm 14.665.738 bytes
  LICENSE
  README.md
```

O conjunto ocupa aproximadamente **37,84 MB**. Nenhum arquivo novo excede 15 MB. Os caminhos são `${import.meta.env.BASE_URL}mediapipe/wasm` e `${import.meta.env.BASE_URL}mediapipe/hand_landmarker.task`. No Pages, por exemplo, o modelo fica em `/tradutor-libras-voz/mediapipe/hand_landmarker.task`. Envie a pasta `public/mediapipe/`, os fontes e os dois arquivos de dependências ao GitHub; o workflow já copia tudo para o site, sem baixar modelos no build.

O SDK dessa versão tenta enviar telemetria de uso. A página da câmera restringe conexões à própria origem com a política `connect-src 'self'`, bloqueando esse envio. Um aviso de CSP no console sobre `odml.pa.googleapis.com` é esperado. Nenhum quadro é gravado ou enviado pelo aplicativo. [Aviso de privacidade oficial do MediaPipe](https://developers.google.com/edge/mediapipe/solutions/privacy)

### Apresentar sem internet e testar nos aparelhos

Prepare as dependências e o build antes da apresentação. No notebook, mantenha `npm run preview` aberto e use o endereço `http://localhost:4173/` informado pelo terminal (incluindo o caminho base, se configurado). O rastreamento não precisa de CDN nem serviço de reconhecimento remoto. Não abra o HTML por `file://`.

No celular, use o endereço **HTTPS** do GitHub Pages para o teste normal. `http://192.168.15.4:5173/` não oferece um contexto seguro e não libera a câmera. Para uma apresentação móvel sem internet, é necessário um servidor HTTPS local com certificado confiável no celular, ou encaminhar a porta por USB no Chrome/Android para acessar o servidor como `localhost`. Ter Wi-Fi local não é o mesmo que ter internet. O Pages precisa de conexão para abrir/recarregar o site; este projeto não instala cache offline/service worker. [Requisito de contexto seguro de getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

Roteiro de aceite no notebook e no celular:

1. Inicie a câmera e mostre uma mão aberta bem iluminada. Confira os pontos nos dedos e no pulso.
2. Mova a mão para os lados e aproxime/afaste. O desenho deve acompanhar a imagem espelhada.
3. Mostre duas mãos e confira a contagem `2 / 2`; retire ambas e confira que os pontos desaparecem.
4. Observe o FPS por pelo menos 30 segundos. Registre aparelho, navegador e intervalo observado; FPS medido em emulação não representa o desempenho do celular real.
5. Pare e inicie de novo. A câmera deve desligar ao parar e retomar ao iniciar. Negue a permissão uma vez e confira o aviso e a possibilidade de tentar novamente.
6. Para conferir os recursos locais, abra DevTools → Network: modelo e WASM devem vir da mesma origem, sem erros 404. Depois de carregar a tela e os recursos, desconecte a internet mantendo o servidor local acessível e continue movendo as mãos.

**Validação automatizada:** `npm test` cobre os fluxos existentes e a câmera, incluindo permissão tardia, falha de reprodução e encerramento do dispositivo. O teste de navegador usa o modelo real com uma imagem oficial de duas mãos convertida em fluxo de vídeo, além de uma câmera de teste do Chromium. Isso verifica integração, desenho e caminhos locais; o aceite de movimento e desempenho em hardware físico continua sendo feito pelo roteiro acima.

**Limite de performance:** `detectForVideo` é síncrono. Nesta base, inferência e desenho ficam na thread principal, evitando transferência de quadros e complexidade de Worker antes de medir nos aparelhos. A captura limitada e o descarte de quadros repetidos reduzem trabalho. Se o painel Performance mostrar travamentos nos dispositivos-alvo, o próximo ajuste é levar a inferência para um Web Worker e manter apenas o desenho no `requestAnimationFrame` da tela. Esta entrega ainda não reconhece sinais de Libras. A próxima parte é coletar exemplos e implementar normalização/KNN; valide os gestos com uma pessoa que saiba Libras.

## Etapa 5 — parte 2: coleta e KNN

A tela **Libras → Voz** tem os modos **Coletar** e **Testar**, compartilhando a câmera e o rastreador da parte 1. `camera.js` foi preservado. `maos.js` ganhou somente o callback `aoResultado`, chamado depois de desenhar cada resultado. O código novo está em `normalizacao.js`, `coleta.js` e `knn.js`; nenhuma dependência foi adicionada.

### Vetor e escolha da mão

`normalizarMao(pontos)` recebe os 21 pontos **worldLandmarks** do MediaPipe, com coordenadas 3D na mesma unidade (metros). Para cada ponto, subtrai o pulso (índice 0) e divide pela distância euclidiana 3D entre o pulso e a base do dedo médio (índice 9). A saída tem 63 números na ordem `[x0, y0, z0, x1, y1, z1, ..., x20, y20, z20]`. O pulso vira zero e a distância 0–9 vira 1. Pontos ausentes, inválidos ou escala quase zero retornam `null`. [Coordenadas e índices oficiais do MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker?tab=Web)

A normalização remove translação e escala uniforme; não remove rotação nem transforma uma mão esquerda em direita. Usamos `worldLandmarks`, em vez de misturar x e y normalizados por dimensões diferentes da imagem. O espelhamento CSS afeta só a exibição. `vetorDaMao` escolhe a mão por `handedness`, independentemente da ordem retornada pelo detector. Com duas mãos, apenas a configurada entra no vetor: **Right (direita)** por padrão. Se só a outra mão estiver presente, não há coleta nem previsão. Para usar a esquerda, altere `mao` para `Left` em `public/gestos-config.json` e faça uma base nova com essa mão. Arquivos de mãos ou normalizações diferentes não são misturados.

### Gravar e salvar

1. Abra a tela por HTTPS ou localhost e inicie a câmera. Selecione **Coletar**.
2. Escolha o gesto e faça a forma indicada com a mão direita. Clique em **Gravar exemplo**: cada clique salva um vetor do quadro atual, sem imagens nem vídeo.
3. Faça **30 a 50 exemplos por gesto**, equilibrando as quantidades. Varie distância, ângulo e iluminação, e inclua mais de uma pessoa. Mude a pose entre cliques; repetir muitas vezes o mesmo quadro não cria diversidade.
4. Clique em **Exportar gestos.json** e guarde o download. A coleta fica em memória e se perde ao recarregar ou fechar sem exportar.
5. **Importar gestos.json** substitui a base em memória após validar todo o arquivo. Um arquivo inválido deixa os exemplos anteriores intactos. A configuração e os vetores são reconstruídos com campos permitidos; campos extras, inclusive imagens, são descartados. O limite é de 5.000 exemplos e 8 MB por importação.
6. Para carregar automaticamente, copie o download para **public/gestos.json**. No GitHub Pages, envie esse arquivo ao repositório e publique novamente. Importar pelo navegador não altera os arquivos do projeto nem o site publicado.

A base entregue está vazia de propósito: não há exemplos humanos coletados ainda. Tanto `gestos.json` quanto `gestos-config.json` são buscados com `import.meta.env.BASE_URL`, sem CDN. O arquivo de exemplos contém `versao: 1`, `normalizacao: "pulso-medio-world-xyz-v1"`, `mao: "Right"` e `exemplos`, uma lista de objetos `{ gesto, vetor }`. Preserve esses metadados ao exportar/importar.

Os três gestos iniciais confirmados são associações para testar o classificador:

| ID | Forma | Palavra associada |
| --- | --- | --- |
| mao-aberta | Palma com os cinco dedos estendidos | aberta |
| punho-fechado | Dedos fechados em punho | fechado |
| indicador-cima | Somente o indicador estendido para cima | apontando |

Essas associações não são traduções validadas de Libras. `public/gestos-config.json` define `id`, `nome`, `palavra` e `instrucao` de cada gesto. Alterar `palavra` troca a associação sem mexer em JavaScript. Nesta parte ela é mostrada na tela; suavização temporal e fala automática ficam para a próxima parte.

### Testar e medir a precisão

Depois da coleta, selecione **Testar**. O KNN usa distância euclidiana nos 63 valores e votos dos k exemplos mais próximos. O padrão é `k = 3`; a tela aceita inteiros de 1 a 99. Se k exceder a base, o k efetivo é a quantidade disponível. Para habilitar a previsão, grave pelo menos um exemplo de cada gesto configurado. Recomenda-se completar os 30–50 antes de avaliar.

A tela mostra gesto, palavra e **confiança = votos do vencedor / k efetivo**. Isso não é uma probabilidade calibrada: com k=1 sempre será 100%, mesmo se o gesto estiver errado. Empates usam a menor soma de distâncias e, persistindo o empate, o ID em ordem alfabética. O KNN é de vocabulário fechado e não rejeita formas desconhecidas. Ausência da mão configurada, câmera parada ou pontos antigos limpam a previsão. Esta versão mostra a previsão de cada quadro, ainda sem estabilização temporal.

Para uma avaliação simples, separe a coleta da avaliação: use poses novas, preferencialmente outra sessão e uma pessoa que não participou da coleta. Faça **10 tentativas independentes por gesto**, retirando a mão e refazendo a pose entre elas. Em cada tentativa, anote a previsão uma vez após 2 segundos; se estiver ausente ou errada, conte como erro. Não grave essas tentativas na base e não escolha apenas os quadros que acertaram.

| Gesto esperado | Tentativas | Acertos | Precisão |
| --- | ---: | ---: | ---: |
| Mão aberta | 10 | preencher | acertos ÷ 10 × 100% |
| Punho fechado | 10 | preencher | acertos ÷ 10 × 100% |
| Indicador para cima | 10 | preencher | acertos ÷ 10 × 100% |
| Total | 30 | soma | soma ÷ 30 × 100% |

Anote aparelho, navegador, k e quantidade de exemplos. Faça a tabela separadamente no notebook e no celular. Se ajustar a base ou k após ver os erros, repita com novas tentativas. A validação automatizada cobre normalização, votação, formato dos arquivos e integração com o modelo real usando entradas de câmera de teste; isso não mede precisão com pessoas nem substitui esse aceite nos aparelhos.

### Adicionar um gesto

Adicione um objeto com ID novo e único à lista `gestos` em `public/gestos-config.json`, com nome, palavra e instrução. Escolha uma forma estática bem distinta, mantendo a mesma mão. Recarregue, importe a base anterior se necessário, colete 30–50 exemplos do novo gesto e exporte a base completa. Copie para `public/gestos.json`, publique e repita a avaliação de todos os gestos. Ao remover ou renomear um ID, os exemplos com o ID antigo precisam ser removidos ou migrados no JSON antes da importação; mudar só o nome ou a palavra mantém os vetores válidos. Peça a uma pessoa que saiba Libras para validar os gestos antes de apresentá-los como sinais.
