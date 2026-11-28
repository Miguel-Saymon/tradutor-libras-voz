import { describe, expect, it } from 'vitest'
import {
  avaliarBase, calibrarLimiar, classificarTrecho, distanciaDTW, energiaDoTrecho, mediaMovel, PADROES_CLASSIFICADOR,
  PADROES_DECISAO, prepararModelos, reamostrar, sequenciaDoTrecho,
} from './classificador.js'
import { gerarSinal } from './maos-sinteticas.js'
import { ESCALA, quadroDaMao, X, Y } from './quadro.js'

const SINAIS = ['oi', 'tchau', 'sim', 'nao']
const quadrosDe = (sinal, opcoes) => gerarSinal(sinal, opcoes).map(r => quadroDaMao(r))

/** Cinco exemplos por sinal, com velocidade, amplitude, posição e ruído diferentes. */
function baseSintetica(porSinal = 5, sementeInicial = 1) {
  return SINAIS.flatMap((sinal, s) => Array.from({ length: porSinal }, (_, i) => ({
    sinal,
    quadros: quadrosDe(sinal, {
      semente: sementeInicial + s * 100 + i,
      velocidade: 0.8 + 0.1 * i,
      amplitude: 0.85 + 0.075 * i,
      deslocamento: [0.02 * (i - 2), 0.015 * (2 - i)],
      escala: 0.1 + 0.01 * i,
    }),
  })))
}

describe('preparação da sequência', () => {
  it('reamostra por interpolação linear, mantendo as pontas', () => {
    expect(reamostrar([[0], [10]], 3)).toEqual([[0], [5], [10]])
    expect(reamostrar([[0, 1], [2, 3], [4, 5]], 5)).toEqual([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]])
    expect(reamostrar([[7]], 3)).toEqual([[7], [7], [7]])
    expect(() => reamostrar([[1]], 1)).toThrow()
    expect(() => reamostrar([], 3)).toThrow()
  })

  it('média móvel centrada, encurtando a janela nas pontas', () => {
    expect(mediaMovel([1, 1, 1, 1], 3)).toEqual([1, 1, 1, 1])
    expect(mediaMovel([0, 3, 6, 9], 3)).toEqual([1.5, 3, 6, 7.5])
  })

  it('gera pontos × 65 números, com o formato pesado e o movimento à parte', () => {
    const quadros = quadrosDe('tchau')
    const sequencia = sequenciaDoTrecho(quadros)
    expect(sequencia).toHaveLength(PADROES_CLASSIFICADOR.pontos)
    expect(sequencia.every(v => v.length === 65)).toBe(true)
    const dobrado = sequenciaDoTrecho(quadros, { pesoFormato: 2, pesoMovimento: 0 })
    expect(dobrado[0][10]).toBeCloseTo(sequencia[0][10] * 2, 12)
    expect(dobrado.every(v => v[63] === 0 && v[64] === 0)).toBe(true)
  })

  it('não muda quando a pessoa está em outro lugar ou mais longe da câmera', () => {
    const quadros = quadrosDe('sim')
    const base = sequenciaDoTrecho(quadros)
    const deslocado = quadros.map(q => { const c = [...q]; c[X] += 0.2; c[Y] -= 0.1; return c })
    const longe = quadros.map(q => { const c = [...q]; c[X] *= 0.5; c[Y] *= 0.5; c[ESCALA] *= 0.5; return c })
    for (const outro of [deslocado, longe]) {
      sequenciaDoTrecho(outro).forEach((vetor, i) => vetor.forEach((valor, d) => expect(valor).toBeCloseTo(base[i][d], 9)))
    }
  })

  it('o deslocamento lento (subir e descer a mão) quase some do movimento', () => {
    const quadros = Array.from({ length: 40 }, (_, i) => { const q = Array(66).fill(0.1); q[Y] = 0.9 - i * 0.015; q[ESCALA] = 0.1; return q })
    const sequencia = sequenciaDoTrecho(quadros)
    for (const vetor of sequencia.slice(4, -4)) expect(Math.abs(vetor[64])).toBeLessThan(1e-9)
  })

  it('recusa trechos e opções inválidos', () => {
    const quadros = quadrosDe('oi')
    expect(() => sequenciaDoTrecho(quadros.slice(0, 1))).toThrow()
    expect(() => sequenciaDoTrecho([...quadros, [1, 2]])).toThrow()
    for (const opcoes of [{ pontos: 1 }, { janelaMovimento: 0 }, { pesoFormato: -1 }, { faixa: 2 }, { outra: 1 }]) {
      expect(() => sequenciaDoTrecho(quadros, opcoes)).toThrow()
    }
  })
})

describe('DTW', () => {
  it('é zero para sequências iguais e simétrico', () => {
    const a = sequenciaDoTrecho(quadrosDe('tchau', { semente: 1 }))
    const b = sequenciaDoTrecho(quadrosDe('tchau', { semente: 2, velocidade: 1.3 }))
    expect(distanciaDTW(a, a)).toBe(0)
    expect(distanciaDTW(a, b)).toBeCloseTo(distanciaDTW(b, a), 12)
  })

  it('o mesmo sinal mais rápido fica mais perto que outro sinal', () => {
    const tchau = sequenciaDoTrecho(quadrosDe('tchau', { semente: 1 }))
    const tchauRapido = sequenciaDoTrecho(quadrosDe('tchau', { semente: 2, velocidade: 1.4 }))
    for (const outro of ['oi', 'sim', 'nao']) {
      expect(distanciaDTW(tchau, tchauRapido)).toBeLessThan(distanciaDTW(tchau, sequenciaDoTrecho(quadrosDe(outro, { semente: 2 }))))
    }
  })

  it('compara sequências de tamanhos diferentes', () => {
    const a = [[0], [1], [2], [3]].map(v => Float64Array.from(v))
    const b = [[0], [0], [1], [1], [2], [2], [3], [3]].map(v => Float64Array.from(v))
    expect(distanciaDTW(a, b, 0)).toBe(0)
    expect(() => distanciaDTW([], b)).toThrow()
  })
})

describe('classificação de trechos', () => {
  const preparado = prepararModelos(baseSintetica())
  const limiar = calibrarLimiar(preparado)

  it('registra os valores padrão', () => {
    expect(PADROES_CLASSIFICADOR).toEqual({ pontos: 32, pesoFormato: 1, pesoMovimento: 3, janelaMovimento: 7, faixa: 0.25 })
    expect(PADROES_DECISAO).toEqual({ k: 3, confiancaMinima: 0.6, movimentoMinimo: 0.35, fatorLimiar: 2 })
  })

  it('mão parada no formato certo não vira sinal: falta movimento', () => {
    for (const sinal of ['tchau', 'sim', 'nao']) {
      const resultado = classificarTrecho(quadrosDe(sinal, { semente: 777, amplitude: 0 }), preparado, { limiar })
      expect(resultado).toMatchObject({ sinal, aceito: false, motivo: 'movimento' })
      expect(resultado.movimento).toBeLessThan(PADROES_DECISAO.movimentoMinimo)
    }
    // Com movimentoMinimo 0 a regra fica desligada.
    expect(classificarTrecho(quadrosDe('sim', { semente: 777, amplitude: 0 }), preparado, { limiar, movimentoMinimo: 0 }).aceito).toBe(true)
  })

  it('mede o movimento em tamanhos de mão', () => {
    const parado = energiaDoTrecho(quadrosDe('sim', { semente: 5, amplitude: 0 }))
    const quadros = quadrosDe('sim', { semente: 5 })
    const sim = energiaDoTrecho(quadros)
    expect(sim).toBeGreaterThan(parado * 3)
    expect(energiaDoTrecho(quadrosDe('sim', { semente: 5, amplitude: 2 }))).toBeGreaterThan(sim * 1.5)
    // Mais longe da câmera: mão e movimento encolhem juntos, a medida não muda.
    const longe = quadros.map(q => { const c = [...q]; c[X] *= 0.5; c[Y] *= 0.5; c[ESCALA] *= 0.5; return c })
    expect(energiaDoTrecho(longe)).toBeCloseTo(sim, 9)
  })

  it('reconhece trechos novos dos quatro sinais', () => {
    for (const [s, sinal] of SINAIS.entries()) {
      for (const semente of [901, 902, 903]) {
        const quadros = quadrosDe(sinal, { semente: semente + s, velocidade: 0.9 + (semente % 3) * 0.15, amplitude: 1.1, deslocamento: [0.03, -0.02] })
        const resultado = classificarTrecho(quadros, preparado, { limiar })
        expect(resultado).toMatchObject({ sinal, aceito: true, motivo: null, kEfetivo: 3 })
        expect(resultado.confianca).toBeGreaterThanOrEqual(2 / 3)
        expect(resultado.distancia).toBeLessThanOrEqual(limiar)
      }
    }
  })

  it('recusa por distância acima do limiar, mas mostra o sinal mais parecido', () => {
    const resultado = classificarTrecho(quadrosDe('sim', { semente: 77 }), preparado, { limiar: 0 })
    expect(resultado).toMatchObject({ sinal: 'sim', aceito: false, motivo: 'distancia' })
  })

  it('recusa por confiança quando os vizinhos se dividem', () => {
    const mistura = prepararModelos([
      { sinal: 'sim', quadros: quadrosDe('sim', { semente: 1 }) },
      { sinal: 'sim', quadros: quadrosDe('sim', { semente: 2 }) },
      { sinal: 'nao', quadros: quadrosDe('nao', { semente: 3 }) },
    ])
    const resultado = classificarTrecho(quadrosDe('sim', { semente: 4 }), mistura, { confiancaMinima: 1 })
    expect(resultado).toMatchObject({ sinal: 'sim', confianca: 2 / 3, aceito: false, motivo: 'confianca' })
  })

  it('devolve null sem exemplos e recusa k ou limiar inválidos', () => {
    expect(classificarTrecho(quadrosDe('oi'), prepararModelos([]))).toBeNull()
    for (const k of [0, 1.5, NaN]) expect(() => classificarTrecho(quadrosDe('oi'), preparado, { k })).toThrow()
    expect(() => classificarTrecho(quadrosDe('oi'), preparado, { limiar: -1 })).toThrow()
    expect(() => classificarTrecho(quadrosDe('oi'), preparado, { movimentoMinimo: NaN })).toThrow()
    expect(() => prepararModelos([{ sinal: '', quadros: quadrosDe('oi') }])).toThrow()
  })

  it('calibra o limiar só quando há pelo menos dois exemplos do mesmo sinal', () => {
    expect(limiar).toBeGreaterThan(0)
    expect(Number.isFinite(limiar)).toBe(true)
    expect(calibrarLimiar(prepararModelos(baseSintetica(1)))).toBe(Infinity)
    expect(calibrarLimiar(preparado, 4)).toBeCloseTo(limiar * 2, 9)
    expect(() => calibrarLimiar(preparado, 0)).toThrow()
  })

  it('avalia a base deixando cada exemplo de fora', () => {
    const avaliacao = avaliarBase(preparado)
    expect(avaliacao).toEqual({
      acertos: 20, total: 20,
      porSinal: { oi: { acertos: 5, total: 5 }, tchau: { acertos: 5, total: 5 }, sim: { acertos: 5, total: 5 }, nao: { acertos: 5, total: 5 } },
    })
    expect(avaliarBase(prepararModelos([]))).toEqual({ acertos: 0, total: 0, porSinal: {} })
    expect(() => avaliarBase(preparado, 0)).toThrow()
  })
})
