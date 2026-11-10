export const EVENTOS = Object.freeze({
  TEXTO_RECONHECIDO: 'texto-reconhecido',
  GESTO_RECONHECIDO: 'gesto-reconhecido',
})

const ouvintes = new Map()

/**
 * Enfileira a fala em pt-BR. Retorna a utterance para acompanhar onend/onerror,
 * ou null quando o texto está vazio/inválido ou a API não está disponível.
 * Erros síncronos da API são propagados ao chamador.
 * Chame a partir de uma interação do usuário para habilitar áudio no navegador.
 */
export function falar(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return null

  const sintetizador = globalThis.speechSynthesis
  const Utterance = globalThis.SpeechSynthesisUtterance
  if (!sintetizador || typeof Utterance !== 'function') return null

  const fala = new Utterance(texto.trim())
  fala.lang = 'pt-BR'
  // Consulta novamente a cada chamada, pois as vozes podem carregar depois.
  const voz = sintetizador.getVoices().find(
    (candidata) => candidata.lang.toLowerCase() === 'pt-br',
  )
  if (voz) fala.voice = voz

  sintetizador.speak(fala)
  return fala
}

/**
 * Assina um evento nesta página. Cada assinatura é independente.
 * Retorna uma função idempotente para remover a assinatura ao sair da tela.
 */
export function ouvir(evento, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('O ouvinte deve ser uma função.')
  }
  if (!ouvintes.has(evento)) ouvintes.set(evento, new Set())
  const grupo = ouvintes.get(evento)
  const assinatura = { callback }
  grupo.add(assinatura)

  return () => {
    grupo.delete(assinatura)
    if (grupo.size === 0 && ouvintes.get(evento) === grupo) {
      ouvintes.delete(evento)
    }
  }
}

/**
 * Entrega o mesmo payload aos ouvintes, sincronamente, na ordem de assinatura.
 * Novas assinaturas durante a emissão participam da próxima emissão.
 * Exceções dos callbacks são propagadas e interrompem a emissão atual.
 * TEXTO_RECONHECIDO recebe { texto: string }.
 * GESTO_RECONHECIDO recebe { gesto: string } (rótulo do gesto reconhecido).
 */
export function emitir(evento, dados) {
  const grupo = ouvintes.get(evento)
  if (!grupo) return
  for (const assinatura of [...grupo]) {
    if (grupo.has(assinatura)) assinatura.callback(dados)
  }
}

/* Exemplo no módulo de uma tela:
import { EVENTOS, emitir, ouvir, falar } from '../comum/contrato.js'

const pararDeOuvir = ouvir(EVENTOS.GESTO_RECONHECIDO, ({ gesto }) => {
  const fala = falar(gesto)
  if (fala) fala.onerror = (evento) => console.error(evento.error)
})

emitir(EVENTOS.TEXTO_RECONHECIDO, { texto: 'Bom dia' })
emitir(EVENTOS.GESTO_RECONHECIDO, { gesto: 'Sim' })
pararDeOuvir() // Ao desmontar a tela.

O barramento conecta módulos carregados na mesma página. Navegar entre os
documentos HTML reinicia as assinaturas. Exiba também o texto na interface.
*/
