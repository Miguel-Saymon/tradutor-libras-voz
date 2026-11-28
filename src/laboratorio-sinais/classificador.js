import { ESCALA, TAMANHO_QUADRO, X, Y, quadroValido } from './quadro.js'

/*
 * Classificador de sinais com movimento: DTW + vizinhos mais próximos.
 *
 * É a mesma ideia do KNN da Etapa 5, mas compara trechos inteiros. O DTW
 * (Dynamic Time Warping) alinha dois movimentos mesmo quando um é mais rápido
 * que o outro. Roda em JavaScript puro, sem treinamento.
 *
 * Como cada trecho vira uma sequência comparável
 *   1. É reamostrado para `pontos` quadros (o tempo de cada sinal varia).
 *   2. Cada quadro guarda o formato da mão (63 números) e o movimento do pulso.
 *   3. O movimento é medido em "tamanhos de mão" (dividido pela escala média) e
 *      só a parte rápida fica: tiramos a média móvel de `janelaMovimento` quadros.
 *      Assim o subir e descer da mão, igual em todos os sinais, quase some, e o
 *      aceno, o balanço e a troca de formato contam.
 *
 * Funções
 *   prepararModelos(exemplos, opcoes?) → preparado
 *     exemplos: [{ sinal, quadros }] (base de exemplos). Faça de novo quando a base mudar.
 *   classificarTrecho(quadros, preparado, { k, limiar, confiancaMinima, movimentoMinimo }?)
 *     → null (sem exemplos) ou { sinal, confianca, kEfetivo, distancia, movimento, aceito, motivo }
 *     confianca = votos do vencedor / k efetivo (como no knn.js).
 *     distancia = menor distância DTW até um exemplo do sinal vencedor.
 *     movimento = quanto a mão balançou no trecho ÷ o do exemplo mais calmo do
 *     sinal vencedor. Pega a mão parada no formato certo (punho parado não é SIM).
 *     aceito = distancia <= limiar, confianca >= confiancaMinima e
 *     movimento >= movimentoMinimo. motivo diz o que faltou ('distancia',
 *     'confianca' ou 'movimento'), ou null quando foi aceito.
 *   calibrarLimiar(preparado, fator?) → limiar sugerido: fator × percentil 90 da
 *     distância de cada exemplo ao vizinho mais próximo do mesmo sinal. Infinity
 *     quando nenhum sinal tem 2 exemplos.
 *   avaliarBase(preparado, k?) → acerto deixando cada exemplo de fora:
 *     { acertos, total, porSinal: { [sinal]: { acertos, total } } }
 *
 * Valores padrão (ajuste no teste real)
 *   pontos 32 · pesoFormato 1 · pesoMovimento 3 · janelaMovimento 7 · faixa 0.25
 *   k 3 · confiancaMinima 0.6 · movimentoMinimo 0.35 · fator do limiar 2
 */

export const PADROES_CLASSIFICADOR = Object.freeze({
  pontos: 32,
  pesoFormato: 1,
  pesoMovimento: 3,
  janelaMovimento: 7,
  faixa: 0.25,
})

export const PADROES_DECISAO = Object.freeze({ k: 3, confiancaMinima: 0.6, movimentoMinimo: 0.35, fatorLimiar: 2 })

/** Reamostra uma lista de vetores para n itens, por interpolação linear. */
export function reamostrar(vetores, n) {
  if (!Number.isInteger(n) || n < 2) throw new RangeError('n deve ser um inteiro maior ou igual a 2.')
  if (!Array.isArray(vetores) || !vetores.length) throw new Error('Nada para reamostrar.')
  if (vetores.length === 1) return Array.from({ length: n }, () => [...vetores[0]])
  return Array.from({ length: n }, (_, i) => {
    const posicao = i * (vetores.length - 1) / (n - 1)
    const j = Math.min(Math.floor(posicao), vetores.length - 2)
    const t = posicao - j
    return vetores[j].map((valor, d) => valor * (1 - t) + vetores[j + 1][d] * t)
  })
}

/** Média móvel centrada; nas pontas usa só os vizinhos que existem. */
export function mediaMovel(valores, janela) {
  const raio = Math.floor(janela / 2)
  return valores.map((_, i) => {
    let soma = 0, quantidade = 0
    for (let j = Math.max(0, i - raio); j <= Math.min(valores.length - 1, i + raio); j++) {
      soma += valores[j]
      quantidade += 1
    }
    return soma / quantidade
  })
}

/** Transforma os quadros de um trecho na sequência usada pelo DTW. */
export function sequenciaDoTrecho(quadros, opcoes = {}) {
  return prepararTrecho(quadros, validarOpcoes(opcoes)).sequencia
}

/**
 * Quanto a mão balançou no trecho: média quadrática do movimento rápido, em
 * tamanhos de mão. Só a metade do meio do trecho conta, para a subida e a
 * descida da mão (no começo e no fim) não parecerem balanço.
 */
export function energiaDoTrecho(quadros, opcoes = {}) {
  return prepararTrecho(quadros, validarOpcoes(opcoes)).energia
}

function prepararTrecho(quadros, { pontos, pesoFormato, pesoMovimento, janelaMovimento }) {
  if (!Array.isArray(quadros) || quadros.length < 2 || !quadros.every(quadroValido)) {
    throw new Error(`Trecho inválido: são necessários 2 ou mais quadros de ${TAMANHO_QUADRO} números.`)
  }
  const escala = quadros.reduce((soma, q) => soma + q[ESCALA], 0) / quadros.length
  const amostras = reamostrar(quadros, pontos)
  const xs = amostras.map(q => q[X] / escala)
  const ys = amostras.map(q => q[Y] / escala)
  const mediaX = mediaMovel(xs, janelaMovimento)
  const mediaY = mediaMovel(ys, janelaMovimento)
  const meioInicio = Math.floor(pontos / 4), meioFim = Math.max(meioInicio + 1, Math.ceil(pontos * 3 / 4))
  let somaQuadrados = 0
  const sequencia = amostras.map((q, i) => {
    const mx = xs[i] - mediaX[i], my = ys[i] - mediaY[i]
    if (i >= meioInicio && i < meioFim) somaQuadrados += mx * mx + my * my
    const vetor = new Float64Array(65)
    for (let d = 0; d < 63; d++) vetor[d] = q[d] * pesoFormato
    vetor[63] = mx * pesoMovimento
    vetor[64] = my * pesoMovimento
    return vetor
  })
  return { sequencia, energia: Math.sqrt(somaQuadrados / (meioFim - meioInicio)) }
}

/** Distância DTW normalizada pelo tamanho das sequências, com faixa de Sakoe-Chiba. */
export function distanciaDTW(a, b, faixa = PADROES_CLASSIFICADOR.faixa) {
  const n = a.length, m = b.length
  if (!n || !m) throw new Error('Sequências vazias não podem ser comparadas.')
  const largura = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * faixa))
  let anterior = new Float64Array(m + 1).fill(Infinity)
  let atual = new Float64Array(m + 1)
  anterior[0] = 0
  for (let i = 1; i <= n; i++) {
    atual.fill(Infinity)
    for (let j = Math.max(1, i - largura); j <= Math.min(m, i + largura); j++) {
      atual[j] = distancia(a[i - 1], b[j - 1]) + Math.min(anterior[j], atual[j - 1], anterior[j - 1])
    }
    ;[anterior, atual] = [atual, anterior]
  }
  return anterior[m] / (n + m)
}

export function prepararModelos(exemplos, opcoes = {}) {
  const config = validarOpcoes(opcoes)
  if (!Array.isArray(exemplos)) throw new Error('A base de exemplos deve ser uma lista.')
  const modelos = exemplos.map(e => {
    if (!e || typeof e.sinal !== 'string' || !e.sinal) throw new Error('Cada exemplo precisa do id do sinal.')
    return { sinal: e.sinal, ...prepararTrecho(e.quadros, config) }
  })
  return { opcoes: config, modelos }
}

export function classificarTrecho(quadros, preparado, {
  k = PADROES_DECISAO.k, limiar = Infinity,
  confiancaMinima = PADROES_DECISAO.confiancaMinima, movimentoMinimo = PADROES_DECISAO.movimentoMinimo,
} = {}) {
  validarK(k)
  if (!(limiar >= 0)) throw new RangeError('limiar deve ser um número maior ou igual a 0 (ou Infinity).')
  if (!(movimentoMinimo >= 0)) throw new RangeError('movimentoMinimo deve ser um número maior ou igual a 0.')
  if (!preparado?.modelos?.length) return null
  const { sequencia, energia } = prepararTrecho(quadros, preparado.opcoes)
  const resultado = votar(sequencia, preparado.modelos, k, preparado.opcoes.faixa)
  const maisCalmo = Math.min(...preparado.modelos.filter(m => m.sinal === resultado.sinal).map(m => m.energia))
  const movimento = maisCalmo > 0 ? energia / maisCalmo : Infinity
  const motivo = resultado.distancia > limiar ? 'distancia'
    : resultado.confianca < confiancaMinima ? 'confianca'
      : movimento < movimentoMinimo ? 'movimento' : null
  return { ...resultado, movimento, aceito: motivo === null, motivo }
}

export function calibrarLimiar(preparado, fator = PADROES_DECISAO.fatorLimiar) {
  if (!(fator > 0)) throw new RangeError('fator deve ser maior que 0.')
  const { modelos, opcoes } = preparado
  const maisProximos = []
  modelos.forEach((modelo, i) => {
    let menor = Infinity
    modelos.forEach((outro, j) => {
      if (i !== j && outro.sinal === modelo.sinal) menor = Math.min(menor, distanciaDTW(modelo.sequencia, outro.sequencia, opcoes.faixa))
    })
    if (Number.isFinite(menor)) maisProximos.push(menor)
  })
  if (!maisProximos.length) return Infinity
  maisProximos.sort((a, b) => a - b)
  return maisProximos[Math.ceil(0.9 * maisProximos.length) - 1] * fator
}

export function avaliarBase(preparado, k = PADROES_DECISAO.k) {
  validarK(k)
  const { modelos, opcoes } = preparado
  const porSinal = new Map()
  let acertos = 0, total = 0
  modelos.forEach((modelo, i) => {
    const outros = modelos.filter((_, j) => j !== i)
    if (!outros.length) return
    const { sinal } = votar(modelo.sequencia, outros, k, opcoes.faixa)
    if (!porSinal.has(modelo.sinal)) porSinal.set(modelo.sinal, { acertos: 0, total: 0 })
    const conta = porSinal.get(modelo.sinal)
    conta.total += 1
    total += 1
    if (sinal === modelo.sinal) { conta.acertos += 1; acertos += 1 }
  })
  return { acertos, total, porSinal: Object.fromEntries(porSinal) }
}

function votar(sequencia, modelos, k, faixa) {
  const vizinhos = modelos
    .map(m => ({ sinal: m.sinal, distancia: distanciaDTW(sequencia, m.sequencia, faixa) }))
    .sort((a, b) => a.distancia - b.distancia || compararId(a.sinal, b.sinal))
    .slice(0, k)
  const votos = new Map()
  for (const vizinho of vizinhos) {
    const voto = votos.get(vizinho.sinal) || { sinal: vizinho.sinal, votos: 0, soma: 0, menor: Infinity }
    voto.votos += 1
    voto.soma += vizinho.distancia
    voto.menor = Math.min(voto.menor, vizinho.distancia)
    votos.set(vizinho.sinal, voto)
  }
  const vencedor = [...votos.values()].sort((a, b) => b.votos - a.votos || a.soma - b.soma || compararId(a.sinal, b.sinal))[0]
  return { sinal: vencedor.sinal, confianca: vencedor.votos / vizinhos.length, kEfetivo: vizinhos.length, distancia: vencedor.menor }
}

function distancia(a, b) {
  let soma = 0
  for (let d = 0; d < a.length; d++) {
    const diferenca = a[d] - b[d]
    soma += diferenca * diferenca
  }
  return Math.sqrt(soma)
}

function validarK(k) {
  if (!Number.isInteger(k) || k < 1) throw new RangeError('k deve ser um inteiro positivo.')
}

function validarOpcoes(opcoes) {
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) throw new TypeError('As opções do classificador devem ser um objeto.')
  for (const nome of Object.keys(opcoes)) {
    if (!Object.hasOwn(PADROES_CLASSIFICADOR, nome)) throw new TypeError(`Opção desconhecida no classificador: ${nome}.`)
  }
  const valores = { ...PADROES_CLASSIFICADOR, ...opcoes }
  if (!Number.isInteger(valores.pontos) || valores.pontos < 2) throw new RangeError('pontos deve ser um inteiro maior ou igual a 2.')
  if (!Number.isInteger(valores.janelaMovimento) || valores.janelaMovimento < 1) throw new RangeError('janelaMovimento deve ser um inteiro positivo.')
  for (const nome of ['pesoFormato', 'pesoMovimento']) {
    if (!Number.isFinite(valores[nome]) || valores[nome] < 0) throw new RangeError(`${nome} deve ser um número maior ou igual a 0.`)
  }
  if (!Number.isFinite(valores.faixa) || valores.faixa < 0 || valores.faixa > 1) throw new RangeError('faixa deve ser um número entre 0 e 1.')
  return Object.freeze(valores)
}

function compararId(a, b) { return a < b ? -1 : a > b ? 1 : 0 }
