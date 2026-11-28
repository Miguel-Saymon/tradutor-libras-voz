import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVENTOS, ouvir } from '../comum/contrato.js'
import { classificar } from './knn.js'
import { criarFiltroEstabilidade, PADROES_ESTABILIDADE } from './suavizacao.js'

const QUADRO = 33 // ~30 FPS
const A = 'mao-aberta'
const B = 'punho-fechado'
const previsao = (gesto, confianca = 1) => ({ gesto, confianca, kEfetivo: 3 })
const vezes = (item, n) => Array(n).fill(item)

/** Envia uma previsão por quadro a partir de `inicio`; devolve as aceitações e o próximo instante. */
function rodar(filtro, previsoes, inicio = 0) {
  const aceitos = []
  let agora = inicio
  for (const p of previsoes) {
    const aceito = filtro.atualizar(p, agora)
    if (aceito) aceitos.push({ gesto: aceito.gesto, agora })
    agora += QUADRO
  }
  return { aceitos, agora }
}

const assinaturas = []
afterEach(() => { for (const remover of assinaturas.splice(0)) remover() })

describe('filtro de estabilidade', () => {
  it('registra os valores padrão e aceita ajustes parciais', () => {
    expect(PADROES_ESTABILIDADE).toEqual({ quadrosSeguidos: 10, confiancaMinima: 0.6, intervaloRepeticaoMs: 1500, repetirSegurando: false })
    expect(criarFiltroEstabilidade().configuracao).toEqual(PADROES_ESTABILIDADE)
    expect(criarFiltroEstabilidade({ quadrosSeguidos: 8 }).configuracao).toEqual({ ...PADROES_ESTABILIDADE, quadrosSeguidos: 8 })
  })

  it('aceita uma sequência estável no 10º quadro e avisa pelo barramento', () => {
    const ouvinte = vi.fn()
    assinaturas.push(ouvir(EVENTOS.GESTO_RECONHECIDO, ouvinte))
    const filtro = criarFiltroEstabilidade()
    for (let i = 0; i < 9; i++) expect(filtro.atualizar(previsao(A), i * QUADRO)).toBeNull()
    expect(ouvinte).not.toHaveBeenCalled()
    expect(filtro.atualizar(previsao(A, 2 / 3), 9 * QUADRO)).toEqual({ gesto: A, confianca: 2 / 3 })
    expect(ouvinte).toHaveBeenCalledExactlyOnceWith({ gesto: A, confianca: 2 / 3 })
  })

  it('respeita o número de quadros configurado', () => {
    expect(rodar(criarFiltroEstabilidade({ quadrosSeguidos: 3 }), vezes(previsao(A), 3)).aceitos).toEqual([{ gesto: A, agora: 2 * QUADRO }])
    expect(rodar(criarFiltroEstabilidade({ quadrosSeguidos: 1 }), [previsao(A)]).aceitos).toHaveLength(1)
  })

  it('rejeita uma sequência que oscila', () => {
    const ouvinte = vi.fn()
    assinaturas.push(ouvir(EVENTOS.GESTO_RECONHECIDO, ouvinte))
    const alternando = Array.from({ length: 60 }, (_, i) => previsao(i % 2 ? B : A))
    expect(rodar(criarFiltroEstabilidade(), alternando).aceitos).toEqual([])
    // Uma troca no meio zera a contagem: só o 10º quadro seguido depois dela vale.
    const filtro = criarFiltroEstabilidade()
    const { aceitos } = rodar(filtro, [...vezes(previsao(A), 9), previsao(B), ...vezes(previsao(A), 10)])
    expect(aceitos).toEqual([{ gesto: A, agora: 19 * QUADRO }])
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('ignora confiança baixa e zera a contagem', () => {
    expect(rodar(criarFiltroEstabilidade(), vezes(previsao(A, 1 / 3), 30)).aceitos).toEqual([])
    const quebrada = [...vezes(previsao(A), 9), previsao(A, 1 / 3), ...vezes(previsao(A), 9)]
    expect(rodar(criarFiltroEstabilidade(), quebrada).aceitos).toEqual([])
  })

  it('a confiança mínima é configurável e inclusiva', () => {
    expect(rodar(criarFiltroEstabilidade({ confiancaMinima: 0.6 }), vezes(previsao(A, 0.6), 10)).aceitos).toHaveLength(1)
    expect(rodar(criarFiltroEstabilidade({ confiancaMinima: 1 }), vezes(previsao(A, 2 / 3), 30)).aceitos).toEqual([])
    expect(rodar(criarFiltroEstabilidade({ confiancaMinima: 0.3 }), vezes(previsao(A, 1 / 3), 10)).aceitos).toHaveLength(1)
  })

  it('quadro sem mão ou previsão inválida zera a contagem sem erro', () => {
    for (const invalida of [null, undefined, {}, { gesto: '' , confianca: 1 }, { gesto: A, confianca: NaN }, { gesto: 42, confianca: 1 }, { gesto: A }]) {
      const filtro = criarFiltroEstabilidade()
      expect(() => rodar(filtro, [...vezes(previsao(A), 9), invalida, ...vezes(previsao(A), 9)])).not.toThrow()
      expect(filtro.estado().quadros).toBe(9)
    }
  })

  it('mão parada fala uma vez só (padrão)', () => {
    const { aceitos } = rodar(criarFiltroEstabilidade(), vezes(previsao(A), 300)) // ~10 s
    expect(aceitos).toEqual([{ gesto: A, agora: 9 * QUADRO }])
  })

  it('oscilações rápidas no meio do gesto não repetem a palavra', () => {
    const sequencia = [
      ...vezes(previsao(A), 100), previsao(B),
      ...vezes(previsao(A), 60), ...vezes(null, 3),
      ...vezes(previsao(A), 60), ...vezes(previsao(A, 1 / 3), 2),
      ...vezes(previsao(A), 60),
    ]
    expect(rodar(criarFiltroEstabilidade(), sequencia).aceitos).toEqual([{ gesto: A, agora: 9 * QUADRO }])
  })

  it('respeita o intervalo antes de aceitar o mesmo gesto de novo', () => {
    const filtro = criarFiltroEstabilidade()
    let r = rodar(filtro, vezes(previsao(A), 20))          // aceito em 297 ms; último quadro em 627 ms
    expect(r.aceitos).toHaveLength(1)
    r = rodar(filtro, vezes(null, 30), r.agora)            // ~1 s sem mão: menos que o intervalo
    r = rodar(filtro, vezes(previsao(A), 90), r.agora)     // refaz e segura 3 s: continua travado
    expect(r.aceitos).toEqual([])
    r = rodar(filtro, vezes(null, 46), r.agora)            // ~1,5 s sem mão
    r = rodar(filtro, vezes(previsao(A), 10), r.agora)
    expect(r.aceitos).toHaveLength(1)
  })

  it('o intervalo é inclusivo e uma tentativa bloqueada renova a trava', () => {
    const filtro = criarFiltroEstabilidade({ quadrosSeguidos: 1, intervaloRepeticaoMs: 1500 })
    expect(filtro.atualizar(previsao(A), 0)).not.toBeNull()
    filtro.atualizar(null, 10)
    expect(filtro.atualizar(previsao(A), 1499)).toBeNull()
    filtro.atualizar(null, 1500)
    expect(filtro.atualizar(previsao(A), 2998)).toBeNull()   // 1499 ms desde a última vez que apareceu
    filtro.atualizar(null, 3000)
    expect(filtro.atualizar(previsao(A), 4498)).not.toBeNull() // exatamente 1500 ms
  })

  it('outro gesto não espera e destrava o anterior: "aberta, fechado, aberta"', () => {
    const sequencia = [...vezes(previsao(A), 40), ...vezes(previsao(B), 15), ...vezes(previsao(A), 30)]
    const { aceitos } = rodar(criarFiltroEstabilidade(), sequencia)
    expect(aceitos.map(a => a.gesto)).toEqual([A, B, A])
    expect(aceitos[1].agora - aceitos[0].agora).toBeLessThan(1500)
  })

  it('o mesmo gesto espera o intervalo desde a última aceitação, mesmo com outro no meio', () => {
    const filtro = criarFiltroEstabilidade({ quadrosSeguidos: 1, intervaloRepeticaoMs: 1500 })
    expect(filtro.atualizar(previsao(A), 0)).not.toBeNull()
    expect(filtro.atualizar(previsao(B), 100)).not.toBeNull()
    expect(filtro.atualizar(previsao(A), 200)).toBeNull()
    expect(filtro.atualizar(previsao(A), 1499)).toBeNull()
    expect(filtro.atualizar(previsao(A), 1500)).not.toBeNull()
    expect(filtro.atualizar(previsao(A), 1533)).toBeNull()
  })

  it('com repetirSegurando, a mão parada repete a cada intervalo', () => {
    const filtro = criarFiltroEstabilidade({ repetirSegurando: true })
    const { aceitos } = rodar(filtro, vezes(previsao(A), 160)) // ~5,3 s
    expect(aceitos.map(a => a.agora)).toEqual([297, 1815, 3333, 4851])
  })

  it('reiniciar esquece a contagem e as travas', () => {
    const filtro = criarFiltroEstabilidade()
    rodar(filtro, vezes(previsao(A), 9))
    expect(filtro.estado()).toEqual({ gesto: A, quadros: 9, necessarios: 10 })
    filtro.reiniciar()
    expect(filtro.estado()).toEqual({ gesto: null, quadros: 0, necessarios: 10 })
    expect(filtro.atualizar(previsao(A), 300)).toBeNull()
    const r = rodar(filtro, vezes(previsao(A), 9), 333)
    expect(r.aceitos).toHaveLength(1)
    filtro.reiniciar()
    expect(rodar(filtro, vezes(previsao(A), 10), r.agora).aceitos).toHaveLength(1)
  })

  it('usa performance.now() quando o instante não é informado', () => {
    const filtro = criarFiltroEstabilidade()
    const resultados = vezes(previsao(A), 10).map(p => filtro.atualizar(p))
    expect(resultados.filter(Boolean)).toEqual([{ gesto: A, confianca: 1 }])
  })

  it('aceita o retorno de classificar() direto', () => {
    const vetor = x => [x, ...Array(62).fill(0)]
    const base = [{ gesto: A, vetor: vetor(0) }, { gesto: A, vetor: vetor(0.1) }, { gesto: B, vetor: vetor(0.2) }]
    const { aceitos } = rodar(criarFiltroEstabilidade(), vezes(null, 10).map(() => classificar(vetor(0.05), base, 3)))
    expect(aceitos.map(a => a.gesto)).toEqual([A])
  })

  it('recusa opções e instantes inválidos', () => {
    for (const opcoes of [null, [], { quadros: 5 }, { quadrosSeguidos: 0 }, { quadrosSeguidos: 2.5 },
      { confiancaMinima: -0.1 }, { confiancaMinima: 1.1 }, { confiancaMinima: NaN },
      { intervaloRepeticaoMs: -1 }, { intervaloRepeticaoMs: Infinity }, { repetirSegurando: 'sim' }]) {
      expect(() => criarFiltroEstabilidade(opcoes)).toThrow()
    }
    const filtro = criarFiltroEstabilidade()
    for (const agora of [NaN, Infinity, '10', null]) expect(() => filtro.atualizar(previsao(A), agora)).toThrow(TypeError)
  })
})
