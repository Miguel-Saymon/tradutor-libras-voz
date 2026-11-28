import { emitir, falar as falarTexto } from '../comum/contrato.js'

/*
 * Montador de frase (Libras → Voz).
 *
 * Guarda os gestos aceitos pelo filtro (suavizacao.js), troca cada um pela
 * palavra de gestos-config.json e fala a frase com falar() de ../comum/contrato.js.
 * Não usa a tela (DOM): a tela reage pelos eventos.
 *
 * Caminho completo:
 *   câmera → maos.js (pontos) → vetorDaMao → classificar (knn.js)
 *     → filtro.atualizar (suavizacao.js) → frase.adicionar (este arquivo) → frase.falar
 *
 * Funções
 *   criarFrase(config)
 *     config é o conteúdo de gestos-config.json ({ gestos: [{ id, palavra, ... }] }).
 *     Gestos sem palavra preenchida ficam de fora, sem erro.
 *   frase.adicionar(gestoId) → palavra adicionada, ou null se o gesto não tem palavra
 *     cadastrada (nesse caso nada muda e nada é emitido).
 *   frase.texto()     → palavras separadas por espaço ('' quando vazia).
 *   frase.palavras()  → cópia da lista de palavras.
 *   frase.limpar()    → esvazia a frase.
 *   frase.falar()     → fala a frase em pt-BR. Retorna a utterance (para onend/onerror)
 *     ou null se a frase está vazia ou o navegador não tem síntese de voz. Não limpa
 *     a frase: chame limpar() depois, se quiser começar outra. O navegador só libera
 *     o áudio depois de algum clique na página (o Iniciar câmera já conta).
 *
 * Eventos (barramento de ../comum/contrato.js)
 *   EVENTO_FRASE_ALTERADA ('frase-alterada') com { texto, palavras } sempre que a
 *   frase muda (adicionar com palavra, ou limpar com algo dentro).
 *   O gesto aceito é avisado pelo filtro: EVENTOS.GESTO_RECONHECIDO com { gesto, confianca }.
 *
 * Exemplo de integração na tela (main.js de Libras → Voz):
 *
 *   import { EVENTOS, ouvir } from '../comum/contrato.js'
 *   import { criarFiltroEstabilidade } from './suavizacao.js'
 *   import { criarFrase, EVENTO_FRASE_ALTERADA } from './frase.js'
 *
 *   const filtro = criarFiltroEstabilidade()   // valores padrão em suavizacao.js
 *   const frase = criarFrase(config)           // o mesmo gestos-config.json que coleta.js carrega
 *
 *   // 1. Uma vez por quadro da câmera, com o retorno de classificar(), ou null
 *   //    quando não houver mão ou o modo não for Testar. Hoje essa previsão é
 *   //    calculada dentro de coleta.js (função prever); na integração é preciso
 *   //    expô-la, por exemplo com um callback aoPrever(resultado) em criarColeta.
 *   //    Mudar k ou o modo também chama prever(); repasse só as chamadas de quadro.
 *   function aoPrever(resultado) {
 *     const aceito = filtro.atualizar(resultado)
 *     if (aceito) frase.adicionar(aceito.gesto)
 *   }
 *
 *   // 2. A tela reage pelos eventos, sem depender deste código.
 *   ouvir(EVENTO_FRASE_ALTERADA, ({ texto }) => { saidaFrase.textContent = texto || '—' })
 *   ouvir(EVENTOS.GESTO_RECONHECIDO, ({ gesto }) => destacarGesto(gesto))
 *
 *   // 3. Botões.
 *   botaoFalar.addEventListener('click', () => frase.falar())
 *   botaoLimpar.addEventListener('click', () => frase.limpar())
 *
 *   // 4. Ao parar a câmera (função encerrar): filtro.reiniciar()
 */

export const EVENTO_FRASE_ALTERADA = 'frase-alterada'

export function criarFrase(config) {
  if (!config || !Array.isArray(config.gestos)) {
    throw new TypeError('criarFrase precisa da configuração de gestos ({ gestos: [...] }).')
  }
  const palavraDoGesto = new Map()
  for (const gesto of config.gestos) {
    const palavra = typeof gesto?.palavra === 'string' ? gesto.palavra.trim() : ''
    if (typeof gesto?.id === 'string' && gesto.id && palavra && !palavraDoGesto.has(gesto.id)) {
      palavraDoGesto.set(gesto.id, palavra)
    }
  }
  let palavras = []

  function texto() {
    return palavras.join(' ')
  }

  function avisar() {
    emitir(EVENTO_FRASE_ALTERADA, { texto: texto(), palavras: [...palavras] })
  }

  function adicionar(gestoId) {
    const palavra = palavraDoGesto.get(gestoId)
    if (!palavra) return null
    palavras.push(palavra)
    avisar()
    return palavra
  }

  function limpar() {
    if (!palavras.length) return
    palavras = []
    avisar()
  }

  function falar() {
    return falarTexto(texto())
  }

  return { adicionar, texto, palavras: () => [...palavras], limpar, falar }
}
