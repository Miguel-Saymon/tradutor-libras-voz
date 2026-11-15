export const DIMENSOES = 63
export const NORMALIZACAO = 'pulso-medio-world-xyz-v1'

/**
 * Recebe os 21 worldLandmarks (x, y, z em metros) do MediaPipe.
 * Subtrai o pulso (0), divide pela distância 3D entre 0 e 9 e retorna
 * [x0, y0, z0, x1, y1, z1, ..., x20, y20, z20]. Não altera a entrada.
 * Não remove rotação nem espelha os pontos: varie ângulos na coleta.
 */
export function normalizarMao(pontos) {
  if (!Array.isArray(pontos) || pontos.length !== 21 ||
      pontos.some(p => !p || ![p.x, p.y, p.z].every(Number.isFinite))) return null
  const pulso = pontos[0]
  const escala = Math.hypot(pontos[9].x - pulso.x, pontos[9].y - pulso.y, pontos[9].z - pulso.z)
  if (!Number.isFinite(escala) || escala < 1e-8) return null
  const vetor = pontos.flatMap(p => [(p.x - pulso.x) / escala, (p.y - pulso.y) / escala, (p.z - pulso.z) / escala])
  return vetor.every(Number.isFinite) ? vetor : null
}

/**
 * Usa só a mão configurada (Right por padrão), nunca concatena as duas.
 * Se ela não estiver presente, retorna null em vez de usar a outra mão.
 * A ordem das mãos do detector pode mudar; a seleção usa handedness.
 * O espelhamento visual por CSS não altera os pontos usados aqui.
 */
export function vetorDaMao(resultado, mao = 'Right') {
  const indice = resultado?.handedness?.findIndex(categorias => categorias[0]?.categoryName === mao) ?? -1
  return indice < 0 ? null : normalizarMao(resultado.worldLandmarks?.[indice])
}
