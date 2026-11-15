import { describe, expect, it } from 'vitest'
import { normalizarMao, vetorDaMao } from './normalizacao.js'

const mao = () => Array.from({ length: 21 }, (_, i) => ({ x: i / 100, y: i / 50, z: -i / 200 }))
const comparar = (a, b) => a.forEach((valor, i) => expect(valor).toBeCloseTo(b[i], 10))

describe('normalização dos pontos', () => {
  it('gera 63 valores com pulso zero e distância 0–9 unitária, sem alterar entrada', () => {
    const pontos = mao(), copia = structuredClone(pontos)
    const vetor = normalizarMao(pontos)
    expect(vetor).toHaveLength(63)
    expect(vetor.slice(0, 3)).toEqual([0, 0, 0])
    expect(Math.hypot(...vetor.slice(27, 30))).toBeCloseTo(1)
    expect(pontos).toEqual(copia)
    expect(vetor.slice(3, 6)).toEqual([pontos[1].x, pontos[1].y, pontos[1].z].map(x => x / Math.hypot(.09, .18, -.045)))
  })
  it('é invariante à translação', () => {
    comparar(normalizarMao(mao().map(p => ({ x: p.x + 5, y: p.y - 3, z: p.z + 2 }))), normalizarMao(mao()))
  })
  it('é invariante à escala positiva', () => {
    comparar(normalizarMao(mao().map(p => ({ x: p.x * 7, y: p.y * 7, z: p.z * 7 }))), normalizarMao(mao()))
  })
  it('preserva rotação e profundidade', () => {
    expect(normalizarMao(mao().map(p => ({ x: -p.y, y: p.x, z: p.z })))).not.toEqual(normalizarMao(mao()))
    expect(normalizarMao(mao())[5]).toBeLessThan(0)
  })
  it('recusa uma mão degenerada e pontos inválidos', () => {
    expect(normalizarMao(Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })))).toBeNull()
    const invalida = mao(); invalida[5].x = Infinity
    expect(normalizarMao(invalida)).toBeNull()
    expect(normalizarMao(mao().slice(1))).toBeNull()
    expect(normalizarMao(null)).toBeNull()
  })
  it('seleciona a direita pelo rótulo, independentemente da ordem das duas mãos', () => {
    const direita = mao(), esquerda = mao().map(p => ({ ...p, x: -p.x }))
    const resultado = { worldLandmarks: [esquerda, direita], handedness: [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]] }
    expect(vetorDaMao(resultado)).toEqual(normalizarMao(direita))
    resultado.worldLandmarks.reverse(); resultado.handedness.reverse()
    expect(vetorDaMao(resultado)).toEqual(normalizarMao(direita))
    expect(vetorDaMao(resultado, 'Left')).toEqual(normalizarMao(esquerda))
  })
  it('não substitui a mão ausente pela outra, nem inventa coordenadas world', () => {
    expect(vetorDaMao({ worldLandmarks: [mao()], handedness: [[{ categoryName: 'Left' }]] })).toBeNull()
    expect(vetorDaMao({ handedness: [[{ categoryName: 'Right' }]] })).toBeNull()
    expect(vetorDaMao(null)).toBeNull()
  })
})
