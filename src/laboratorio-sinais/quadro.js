import { normalizarMao } from '../libras-para-voz/normalizacao.js'

/*
 * O que guardamos de cada quadro da câmera para os sinais com movimento.
 *
 * quadroDaMao(resultado, mao?, proporcao?) recebe o resultado do MediaPipe
 * (o mesmo que maos.js entrega em aoResultado) e devolve um array de 66 números:
 *   [0..62]  formato da mão: normalizarMao() dos worldLandmarks (o mesmo da Etapa 5)
 *   [63, 64] x e y do pulso na imagem (0 a 1). x é multiplicado pela proporção
 *            largura/altura do vídeo, para x e y terem a mesma unidade.
 *   [65]     escala: distância na imagem entre o pulso (0) e a base do dedo médio (9).
 *            Serve para o movimento não depender da distância até a câmera.
 * Usa só a mão configurada (pelo rótulo do MediaPipe), como o resto do projeto.
 * Retorna null quando essa mão não aparece ou os pontos são inválidos.
 */

export const TAMANHO_QUADRO = 66
export const X = 63
export const Y = 64
export const ESCALA = 65

export function quadroDaMao(resultado, mao = 'Right', proporcao = 1) {
  if (!Number.isFinite(proporcao) || proporcao <= 0) return null
  const indice = resultado?.handedness?.findIndex(categorias => categorias[0]?.categoryName === mao) ?? -1
  if (indice < 0) return null
  const formato = normalizarMao(resultado.worldLandmarks?.[indice])
  const pontos = resultado.landmarks?.[indice]
  if (!formato || !Array.isArray(pontos) || pontos.length !== 21) return null
  const pulso = pontos[0], base = pontos[9]
  const x = pulso?.x * proporcao
  const y = pulso?.y
  const escala = Math.hypot((base?.x - pulso?.x) * proporcao, base?.y - pulso?.y)
  if (![x, y, escala].every(Number.isFinite) || escala < 1e-6) return null
  return [...formato, x, y, escala]
}

export function quadroValido(quadro) {
  return Array.isArray(quadro) && quadro.length === TAMANHO_QUADRO && quadro.every(Number.isFinite) && quadro[ESCALA] > 0
}
