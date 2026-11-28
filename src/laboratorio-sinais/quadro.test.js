import { describe, expect, it } from 'vitest'
import { normalizarMao } from '../libras-para-voz/normalizacao.js'
import { FORMATOS, resultadoDaMao, SEM_MAO } from './maos-sinteticas.js'
import { ESCALA, quadroDaMao, quadroValido, TAMANHO_QUADRO, X, Y } from './quadro.js'

describe('quadro da mão', () => {
  it('junta o formato da Etapa 5 com a posição e a escala do pulso na imagem', () => {
    const resultado = resultadoDaMao(FORMATOS.aberta, [0.4, 0.3], { escala: 0.1 })
    const quadro = quadroDaMao(resultado)
    expect(quadro).toHaveLength(TAMANHO_QUADRO)
    expect(quadro.slice(0, 63)).toEqual(normalizarMao(resultado.worldLandmarks[0]))
    const pulso = resultado.landmarks[0][0], base = resultado.landmarks[0][9]
    expect(quadro[X]).toBe(pulso.x)
    expect(quadro[Y]).toBe(pulso.y)
    expect(quadro[ESCALA]).toBeCloseTo(Math.hypot(base.x - pulso.x, base.y - pulso.y), 12)
    expect(quadroValido(quadro)).toBe(true)
  })

  it('aplica a proporção da imagem ao eixo x', () => {
    const resultado = resultadoDaMao(FORMATOS.aberta, [0.4, 0.3])
    resultado.landmarks[0][9] = { ...resultado.landmarks[0][9], x: resultado.landmarks[0][9].x + 0.05 } // mão inclinada
    const quadro = quadroDaMao(resultado, 'Right', 16 / 9)
    const pulso = resultado.landmarks[0][0], base = resultado.landmarks[0][9]
    expect(quadro[X]).toBeCloseTo(pulso.x * 16 / 9, 12)
    expect(quadro[ESCALA]).toBeCloseTo(Math.hypot((base.x - pulso.x) * 16 / 9, base.y - pulso.y), 12)
    expect(quadro[ESCALA]).not.toBeCloseTo(quadroDaMao(resultado)[ESCALA], 3)
  })

  it('usa a mão configurada pelo rótulo, em qualquer ordem', () => {
    const direita = resultadoDaMao(FORMATOS.punho, [0.6, 0.4])
    const esquerda = resultadoDaMao(FORMATOS.aberta, [0.3, 0.4], { mao: 'Left' })
    const juntas = {
      landmarks: [esquerda.landmarks[0], direita.landmarks[0]],
      worldLandmarks: [esquerda.worldLandmarks[0], direita.worldLandmarks[0]],
      handedness: [esquerda.handedness[0], direita.handedness[0]],
    }
    expect(quadroDaMao(juntas)).toEqual(quadroDaMao(direita))
    expect(quadroDaMao(juntas, 'Left')).toEqual(quadroDaMao(esquerda, 'Left'))
    expect(quadroDaMao(esquerda)).toBeNull()
  })

  it('devolve null sem mão ou com dados inválidos', () => {
    const valido = resultadoDaMao(FORMATOS.aberta, [0.4, 0.3])
    expect(quadroDaMao(SEM_MAO)).toBeNull()
    expect(quadroDaMao(null)).toBeNull()
    expect(quadroDaMao({ ...valido, landmarks: [] })).toBeNull()
    expect(quadroDaMao({ ...valido, landmarks: [valido.landmarks[0].slice(1)] })).toBeNull()
    expect(quadroDaMao({ ...valido, landmarks: [Array(21).fill({ x: 0.5, y: 0.5, z: 0 })] })).toBeNull()
    for (const proporcao of [0, -1, NaN]) expect(quadroDaMao(valido, 'Right', proporcao)).toBeNull()
  })

  it('reconhece quadros inválidos', () => {
    const quadro = quadroDaMao(resultadoDaMao(FORMATOS.aberta, [0.4, 0.3]))
    expect(quadroValido(quadro.slice(1))).toBe(false)
    expect(quadroValido([...quadro.slice(0, 65), 0])).toBe(false)
    expect(quadroValido([...quadro.slice(0, 65), NaN])).toBe(false)
    expect(quadroValido(null)).toBe(false)
  })
})
