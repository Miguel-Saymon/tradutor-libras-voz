import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ouvir } from '../comum/contrato.js'
import { criarFrase, EVENTO_FRASE_ALTERADA } from '../libras-para-voz/frase.js'
import configArquivo from '../../public/sinais-config.json'
import { validarConfigSinais } from './base.js'
import { calibrarLimiar, classificarTrecho, prepararModelos } from './classificador.js'
import { sessao } from './maos-sinteticas.js'
import { quadroDaMao } from './quadro.js'
import { criarSegmentador } from './trecho.js'

const config = validarConfigSinais(configArquivo)
const palavra = id => config.sinais.find(s => s.id === id).palavra

/** O que a página faz a cada quadro: resultado → quadro → segmentador → trechos. */
function trechosDa(quadros) {
  const segmentador = criarSegmentador()
  const trechos = []
  for (const { resultado, agora } of quadros) {
    const trecho = segmentador.atualizar(quadroDaMao(resultado, config.mao), agora)
    if (trecho) trechos.push(trecho)
  }
  return trechos
}

let sintetizador
const assinaturas = []
beforeEach(() => {
  sintetizador = { getVoices: vi.fn(() => []), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', sintetizador)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(texto) { this.text = texto } })
})
afterEach(() => {
  for (const remover of assinaturas.splice(0)) remover()
  vi.unstubAllGlobals()
})

describe('sinais com movimento: câmera → trecho → classificador → frase → voz', () => {
  it('coleta cinco exemplos por sinal e depois reconhece uma frase', () => {
    // Coleta: a pessoa faz cada sinal cinco vezes, abaixando a mão entre eles.
    const coleta = config.sinais.flatMap(({ id }, s) => Array.from({ length: 5 }, (_, i) => [
      { sinal: id, opcoes: { semente: 10 * s + i + 1, velocidade: 0.85 + 0.08 * i, amplitude: 0.9 + 0.05 * i } },
      { pausa: 600 },
    ]).flat())
    const ordem = coleta.filter(item => item.sinal).map(item => item.sinal)
    const trechosColetados = trechosDa(sessao([{ pausa: 500 }, ...coleta]))
    expect(trechosColetados).toHaveLength(20)
    const preparado = prepararModelos(trechosColetados.map((trecho, i) => ({ sinal: ordem[i], quadros: trecho.quadros })))
    const limiar = calibrarLimiar(preparado)

    // Teste: "tchau sim não oi", com uma falha curta na detecção no meio do "sim".
    const frase = criarFrase({ gestos: config.sinais })
    const frases = vi.fn()
    assinaturas.push(ouvir(EVENTO_FRASE_ALTERADA, frases))
    const teste = sessao([
      { pausa: 400 }, { sinal: 'tchau', opcoes: { semente: 501, velocidade: 1.1 } }, { pausa: 700 },
      { sinal: 'sim', opcoes: { semente: 502, amplitude: 1.2 } }, { pausa: 700 },
      { sinal: 'nao', opcoes: { semente: 503, deslocamento: [0.05, 0.03] } }, { pausa: 700 },
      { sinal: 'oi', opcoes: { semente: 504, velocidade: 0.9 } }, { pausa: 700 },
    ])
    const meioDoSim = teste.findIndex((q, i) => i > 60 && q.resultado.handedness.length) + 20
    teste.splice(meioDoSim, 4, ...teste.slice(meioDoSim, meioDoSim + 4).map(q => ({ ...q, resultado: { landmarks: [], worldLandmarks: [], handedness: [] } })))

    for (const trecho of trechosDa(teste)) {
      const resultado = classificarTrecho(trecho.quadros, preparado, { limiar })
      if (resultado?.aceito) frase.adicionar(resultado.sinal)
    }
    expect(frase.texto()).toBe(['tchau', 'sim', 'nao', 'oi'].map(palavra).join(' '))
    expect(frases).toHaveBeenCalledTimes(4)
    expect(frase.falar()).toMatchObject({ text: 'tchau sim não oi', lang: 'pt-BR' })
    expect(sintetizador.speak).toHaveBeenCalledTimes(1)
  })
})
