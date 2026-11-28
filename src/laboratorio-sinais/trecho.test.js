import { describe, expect, it } from 'vitest'
import { criarSegmentador, PADROES_TRECHO } from './trecho.js'

const QUADRO = 33
const MAO = Array(66).fill(0.5)
const vezes = (item, n) => Array(n).fill(item)

/** Envia um quadro por vez a partir de `inicio`; devolve os trechos e o próximo instante. */
function rodar(segmentador, quadros, inicio = 0) {
  const trechos = []
  let agora = inicio
  for (const quadro of quadros) {
    const trecho = segmentador.atualizar(quadro, agora)
    if (trecho) trechos.push(trecho)
    agora += QUADRO
  }
  return { trechos, agora }
}

describe('segmentador de trechos', () => {
  it('registra os valores padrão', () => {
    expect(PADROES_TRECHO).toEqual({ toleranciaAusenciaMs: 250, duracaoMinimaMs: 300, duracaoMaximaMs: 4000, quadrosMinimos: 8 })
    expect(criarSegmentador().configuracao).toEqual(PADROES_TRECHO)
  })

  it('o trecho começa quando a mão aparece e termina depois que ela some', () => {
    const segmentador = criarSegmentador()
    const quadros = Array.from({ length: 30 }, (_, i) => Array(66).fill(i + 1))
    let r = rodar(segmentador, [...vezes(null, 5), ...quadros, ...vezes(null, 7)])
    expect(r.trechos).toEqual([])
    expect(segmentador.estado().fase).toBe('gravando')
    r = rodar(segmentador, [null], r.agora) // 8º quadro sem mão: 264 ms > 250 ms
    expect(r.trechos).toHaveLength(1)
    const [trecho] = r.trechos
    expect(trecho.quadros).toEqual(quadros)
    expect(trecho.inicio).toBe(5 * QUADRO)
    expect(trecho.fim).toBe(34 * QUADRO)
    expect(trecho.duracao).toBe(29 * QUADRO)
    expect(segmentador.estado()).toEqual({ fase: 'aguardando', quadros: 0, duracao: 0, descarte: null })
  })

  it('uma falha curta na detecção não corta o trecho', () => {
    const segmentador = criarSegmentador()
    const { trechos } = rodar(segmentador, [...vezes(MAO, 15), ...vezes(null, 7), ...vezes(MAO, 15), ...vezes(null, 10)])
    expect(trechos).toHaveLength(1)
    expect(trechos[0].quadros).toHaveLength(30)
  })

  it('descarta trechos curtos demais', () => {
    const segmentador = criarSegmentador()
    expect(rodar(segmentador, [...vezes(MAO, 5), ...vezes(null, 10)]).trechos).toEqual([])
    expect(segmentador.estado().descarte).toBe('curto')
    const poucosQuadros = criarSegmentador({ quadrosMinimos: 20 })
    expect(rodar(poucosQuadros, [...vezes(MAO, 15), ...vezes(null, 10)]).trechos).toEqual([])
  })

  it('descarta trechos longos demais e espera a mão sair para recomeçar', () => {
    const segmentador = criarSegmentador()
    let r = rodar(segmentador, vezes(MAO, 200)) // ~6,6 s com a mão parada
    expect(r.trechos).toEqual([])
    expect(segmentador.estado()).toMatchObject({ fase: 'esperando-saida', descarte: 'longo' })
    r = rodar(segmentador, [...vezes(null, 5), ...vezes(MAO, 20)], r.agora) // sumiu menos que a tolerância
    expect(segmentador.estado().fase).toBe('esperando-saida')
    r = rodar(segmentador, vezes(null, 10), r.agora)
    expect(segmentador.estado()).toMatchObject({ fase: 'aguardando', descarte: 'longo' })
    r = rodar(segmentador, [...vezes(MAO, 20), ...vezes(null, 10)], r.agora)
    expect(r.trechos).toHaveLength(1)
    expect(segmentador.estado().descarte).toBeNull()
  })

  it('informa o progresso enquanto grava', () => {
    const segmentador = criarSegmentador()
    rodar(segmentador, vezes(MAO, 10))
    expect(segmentador.estado()).toEqual({ fase: 'gravando', quadros: 10, duracao: 9 * QUADRO, descarte: null })
  })

  it('reiniciar esquece o trecho atual', () => {
    const segmentador = criarSegmentador()
    const r = rodar(segmentador, vezes(MAO, 20))
    segmentador.reiniciar()
    expect(segmentador.estado()).toEqual({ fase: 'aguardando', quadros: 0, duracao: 0, descarte: null })
    expect(rodar(segmentador, vezes(null, 10), r.agora).trechos).toEqual([])
  })

  it('trata qualquer valor que não seja quadro como mão ausente', () => {
    const segmentador = criarSegmentador()
    const { trechos } = rodar(segmentador, [...vezes(MAO, 15), undefined, {}, 'mão', 0, 1, 2, 3, 4])
    expect(trechos).toHaveLength(1)
  })

  it('recusa opções e instantes inválidos', () => {
    for (const opcoes of [null, [], { tolerancia: 1 }, { toleranciaAusenciaMs: -1 }, { duracaoMinimaMs: NaN },
      { duracaoMaximaMs: 200 }, { quadrosMinimos: 1 }, { quadrosMinimos: 2.5 }]) {
      expect(() => criarSegmentador(opcoes)).toThrow()
    }
    for (const agora of [NaN, '1', null]) expect(() => criarSegmentador().atualizar(MAO, agora)).toThrow(TypeError)
  })
})
