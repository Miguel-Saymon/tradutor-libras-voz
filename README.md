# Tradutor Libras ↔ Voz

Protótipo acadêmico. A base entrega a navegação e o contrato compartilhado. A Etapa 2 adiciona voz, digitação e frases prontas na tela Voz → Libras.

## Estrutura

```text
index.html                     Tela inicial e escolha da direção
src/
  voz-para-libras/index.html    Captura de fala, digitação e frases prontas
  voz-para-libras/main.js       Liga as entradas à interface e ao barramento
  voz-para-libras/reconhecimento.js  Controla as sessões da Web Speech API
  voz-para-libras/normalizar.js  Normaliza o texto antes da emissão
  voz-para-libras/estilos.css   Estilos básicos da captura
  libras-para-voz/index.html    Tela que receberá o reconhecimento de gestos
  comum/estilos.css            Layout, contraste e foco compartilhados
  comum/contrato.js            Síntese de voz e barramento de eventos
  comum/contrato.test.js       Testes unitários com Vitest
public/sinais/.gitkeep         Reserva o diretório dos futuros vídeos locais
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

Antes de publicar os sinais, adicione as gravações a `public/sinais/` e inclua os MP4 no mesmo commit do projeto. O Vite copia essa pasta para `dist/sinais/`.

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

## Etapa 3 — sinalização por vídeos locais

A tela Voz → Libras utiliza o caminho B. O widget VLibras está disponível para incorporação por script. O manual descreve a seleção de um elemento de texto e a entrada manual em **Menu → Tradutor**. A documentação de integração consultada não especifica uma chamada pública para entregar diretamente uma string ao avatar e acompanhar o fim da animação. [Integração oficial](https://www.vlibras.gov.br/doc/widget/installation/webpageintegration.html) · [Seleção de texto](https://www.vlibras.gov.br/doc/widget/functionalities/text-translation.html) · [Tradutor](https://www.vlibras.gov.br/doc/widget/functionalities/translator.html)

O repositório do widget indica LGPL-3.0 para o código. Os termos do serviço informam que o acesso é gratuito, sujeito a interrupções, e restringem o uso das traduções automáticas em atividades educacionais e produções audiovisuais. Os vídeos próprios permitem validar as dez frases antecipadamente e servir o sinal pelo mesmo endereço do aplicativo. Para apresentar sem internet, prepare o build no notebook e use a digitação ou os atalhos com o servidor local. [Licença do código](https://github.com/spbgovbr-vlibras/vlibras-web-browsers/blob/dev/LICENSE) · [Termos do serviço](https://www.vlibras.gov.br/privacy.html)

`src/voz-para-libras/frases.json` associa cada expressão normalizada a um MP4. `avatar.js` ouve o evento de texto final das três entradas. Expressões inteiras podem ser enfileiradas, inclusive em uma única entrada como “bom dia, tudo bem?”. O player inicia o próximo vídeo quando o anterior termina. **Repetir** reproduz a última entrada concluída. Uma entrada com trecho desconhecido recebe o aviso “sinal ainda não disponível”. Uma gravação ausente ou ilegível é identificada pelo nome do arquivo.

### Gravar os sinais

1. Comece por **bom dia** e **tudo bem?**. Combine a variante com uma pessoa fluente em Libras e peça autorização de quem aparecerá nos vídeos para uso no demo e publicação no GitHub Pages.
2. Fixe a câmera de frente e enquadre da cintura até acima da cabeça. Deixe espaço lateral para que as duas mãos, os cotovelos e o rosto permaneçam visíveis durante o sinal. Use fundo neutro, boa iluminação frontal e roupa que contraste com as mãos.
3. Grave uma expressão inteira por clipe, em ritmo natural. Mire em 2 a 4 segundos, com uma breve pausa no início e no fim. Preserve os movimentos e a expressão facial da pessoa, inclusive na pergunta “tudo bem?”. Confira o vídeo antes de cortar.
4. Exporte como MP4 com vídeo H.264. O áudio é dispensável. Use os nomes abaixo, em minúsculas, sem acentos e com hífen entre as palavras. Copie os arquivos para `public/sinais/`.

| Frase | Arquivo | Frase | Arquivo |
|---|---|---|---|
| oi | oi.mp4 | obrigado | obrigado.mp4 |
| bom dia | bom-dia.mp4 | por favor | por-favor.mp4 |
| boa tarde | boa-tarde.mp4 | tchau | tchau.mp4 |
| boa noite | boa-noite.mp4 | sim | sim.mp4 |
| tudo bem? | tudo-bem.mp4 | não | nao.mp4 |

### Validar as dez tentativas

Rode `npm ci`, `npm test` e `npm run dev`. Abra **Voz → Libras** e confira as duas gravações com alguém fluente em Libras. Em cada rodada, diga “bom dia”, espere o sinal terminar, diga “tudo bem?” e espere novamente. Anote o texto final, o sinal exibido e se a reprodução chegou ao fim para cada frase. Repita dez rodadas. O aceite exige **10/10 para cada frase**, com o sinal correto e completo. Se o texto final divergir, teste a mesma frase pelo atalho para verificar o vídeo separadamente da transcrição.

O projeto foi preparado sem gravações próprias. Os testes do player exercitam a seleção e a fila com eventos de mídia simulados. O aceite linguístico depende dos MP4 reais e da revisão de uma pessoa fluente. A próxima etapa é a conversão para glosa por regras, que também precisa de validação antes da apresentação.
