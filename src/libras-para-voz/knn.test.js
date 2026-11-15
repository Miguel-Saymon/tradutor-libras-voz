import { describe, expect, it } from 'vitest'
import { classificar } from './knn.js'

const vetor = x => [x, ...Array(62).fill(0)]
const exemplo = (gesto, x) => ({ gesto, vetor: vetor(x) })

describe('KNN', () => {
  it('k=1 usa o exemplo mais próximo e não modifica a base', () => {
    const base = [exemplo('a', 5), exemplo('b', 1)], copia = structuredClone(base)
    expect(classificar(vetor(0), base, 1)).toEqual({ gesto: 'b', confianca: 1, kEfetivo: 1 })
    expect(base).toEqual(copia)
  })
  it('k altera o voto e confiança é a fração de votos do vencedor', () => {
    const base = [exemplo('a', .1), exemplo('b', .2), exemplo('b', .3)]
    expect(classificar(vetor(0), base, 1).gesto).toBe('a')
    expect(classificar(vetor(0), base, 3)).toEqual({ gesto: 'b', confianca: 2 / 3, kEfetivo: 3 })
  })
  it('limita k à quantidade disponível e retorna null com base vazia', () => {
    expect(classificar(vetor(0), [exemplo('a', 0)], 9).kEfetivo).toBe(1)
    expect(classificar(vetor(0), [], 3)).toBeNull()
  })
  it('desempata pela soma das distâncias, depois pelo ID, sem depender da ordem', () => {
    expect(classificar(vetor(0), [exemplo('a', 2), exemplo('b', 1)], 2).gesto).toBe('b')
    const base = [exemplo('b', 1), exemplo('a', -1)]
    expect(classificar(vetor(0), base, 2).gesto).toBe('a')
    expect(classificar(vetor(0), base.reverse(), 2).gesto).toBe('a')
    expect(classificar(vetor(0), base, 1).gesto).toBe('a')
  })
  it('mede todas as coordenadas do vetor', () => {
    const consulta = vetor(0); consulta[62] = 10
    expect(classificar(consulta, [exemplo('a', 0), { gesto: 'b', vetor: consulta }], 1).gesto).toBe('b')
  })
  it('recusa k, vetores e exemplos inválidos', () => {
    for (const k of [0, -1, 1.5, NaN]) expect(() => classificar(vetor(0), [], k)).toThrow()
    expect(() => classificar([1], [])).toThrow()
    expect(() => classificar(vetor(NaN), [])).toThrow()
    expect(() => classificar(vetor(0), [exemplo('', 1)])).toThrow()
  })
})
