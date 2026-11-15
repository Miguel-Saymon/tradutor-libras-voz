import { DIMENSOES } from './normalizacao.js'

export function vetorValido(vetor) {
  return Array.isArray(vetor) && vetor.length === DIMENSOES && vetor.every(Number.isFinite)
}

/** KNN com distância euclidiana e votação simples, sem treinamento assíncrono.
 * Confiança = votos do vencedor / k efetivo; não é probabilidade de acerto.
 * Empates: menor soma das distâncias e, por último, ID em ordem alfabética.
 * Um gesto desconhecido também recebe o rótulo mais próximo desta base fechada.
 */
export function classificar(vetor, exemplos, k = 3) {
  if (!Number.isInteger(k) || k < 1) throw new Error('k deve ser um inteiro positivo.')
  if (!vetorValido(vetor)) throw new Error('Vetor inválido: são necessários 63 números finitos.')
  if (!Array.isArray(exemplos) || exemplos.some(e => !e || typeof e.gesto !== 'string' || !e.gesto || !vetorValido(e.vetor))) {
    throw new Error('Base de exemplos inválida.')
  }
  if (!exemplos.length) return null
  const vizinhos = exemplos.map(e => ({
    gesto: e.gesto,
    distancia: Math.hypot(...vetor.map((valor, i) => valor - e.vetor[i])),
  })).sort((a, b) => a.distancia - b.distancia || compararId(a.gesto, b.gesto)).slice(0, k)
  const votos = new Map()
  for (const vizinho of vizinhos) {
    const voto = votos.get(vizinho.gesto) || { gesto: vizinho.gesto, votos: 0, distancia: 0 }
    voto.votos += 1
    voto.distancia += vizinho.distancia
    votos.set(vizinho.gesto, voto)
  }
  const vencedor = [...votos.values()].sort((a, b) => b.votos - a.votos || a.distancia - b.distancia || compararId(a.gesto, b.gesto))[0]
  return { gesto: vencedor.gesto, confianca: vencedor.votos / vizinhos.length, kEfetivo: vizinhos.length }
}

function compararId(a, b) { return a < b ? -1 : a > b ? 1 : 0 }
