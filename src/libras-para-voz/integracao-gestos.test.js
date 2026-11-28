import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTOS, ouvir } from '../comum/contrato.js'
import { classificar } from './knn.js'
import { criarFiltroEstabilidade } from './suavizacao.js'
import { criarFrase, EVENTO_FRASE_ALTERADA } from './frase.js'
import configArquivo from '../../public/gestos-config.json'
import baseArquivo from '../../public/gestos.json'

const QUADRO = 33
const palavra = id => configArquivo.gestos.find(g => g.id === id).palavra
const [A, B, C] = configArquivo.gestos.map(g => g.id)
const previsao = (gesto, confianca = 1) => ({ gesto, confianca, kEfetivo: 3 })
const vezes = (item, n) => Array(n).fill(item)

const assinaturas = []
let sintetizador
beforeEach(() => {
  sintetizador = { getVoices: vi.fn(() => []), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', sintetizador)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(texto) { this.text = texto } })
})
afterEach(() => {
  for (const remover of assinaturas.splice(0)) remover()
  vi.unstubAllGlobals()
})

/** O que a tela vai fazer a cada quadro: previsão → filtro → frase. */
function ligar(filtro, frase, previsoes) {
  previsoes.forEach((p, i) => {
    const aceito = filtro.atualizar(p, i * QUADRO)
    if (aceito) frase.adicionar(aceito.gesto)
  })
}

describe('gesto para voz: previsão → filtro → frase → voz', () => {
  it('uma sessão com ruído vira uma frase limpa e falada', () => {
    const gestos = vi.fn(), frases = vi.fn()
    assinaturas.push(ouvir(EVENTOS.GESTO_RECONHECIDO, gestos), ouvir(EVENTO_FRASE_ALTERADA, frases))
    const filtro = criarFiltroEstabilidade()
    const frase = criarFrase(configArquivo)
    ligar(filtro, frase, [
      ...vezes(null, 15),                                        // mão entrando
      ...Array.from({ length: 8 }, (_, i) => previsao(i % 2 ? A : B, 2 / 3)), // oscilando
      ...vezes(previsao(A), 60), previsao(B), ...vezes(previsao(A), 20),      // segura A, com uma piscada
      ...vezes(previsao(B, 1 / 3), 5),                           // transição incerta
      ...vezes(previsao(B, 2 / 3), 40),
      ...vezes(null, 10),
      ...vezes(previsao(C), 40),
    ])
    expect(frase.texto()).toBe([palavra(A), palavra(B), palavra(C)].join(' '))
    expect(gestos.mock.calls.map(([dados]) => dados.gesto)).toEqual([A, B, C])
    expect(frases).toHaveBeenCalledTimes(3)
    expect(frase.falar()).toMatchObject({ text: frase.texto(), lang: 'pt-BR' })
    expect(sintetizador.speak).toHaveBeenCalledTimes(1)
  })

  it('funciona com o KNN e os exemplos reais de public/gestos.json', () => {
    const filtro = criarFiltroEstabilidade()
    const frase = criarFrase(configArquivo)
    const exemploDe = id => baseArquivo.exemplos.find(e => e.gesto === id).vetor
    const previsoes = [A, B, C].flatMap(id => [...vezes(classificar(exemploDe(id), baseArquivo.exemplos, 3), 15), ...vezes(null, 5)])
    ligar(filtro, frase, previsoes)
    expect(frase.palavras()).toEqual([palavra(A), palavra(B), palavra(C)])
  })
})
