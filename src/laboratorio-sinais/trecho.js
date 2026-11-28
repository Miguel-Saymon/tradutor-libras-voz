/*
 * Segmentador: decide onde cada sinal começa e termina.
 *
 * Um sinal é um trecho: começa quando a mão configurada aparece e termina quando
 * ela some por mais de toleranciaAusenciaMs. Para quem sinaliza: "levante a mão,
 * faça o sinal e abaixe a mão". Falhas curtas na detecção não cortam o trecho.
 * Não usa a tela (DOM): é testado sozinho.
 *
 * Funções
 *   criarSegmentador(opcoes?) → { atualizar, estado, reiniciar, configuracao }
 *   atualizar(quadro, agora?)
 *     Chame uma vez por quadro da câmera com o retorno de quadroDaMao() (ou null
 *     sem mão). agora em milissegundos (padrão: performance.now()).
 *     Retorna null ou, no quadro em que o trecho termina, { quadros, inicio, fim, duracao }.
 *   estado() → { fase, quadros, duracao, descarte }
 *     fase: 'aguardando' | 'gravando' | 'esperando-saida'
 *     descarte: null, 'curto' ou 'longo' (motivo do último trecho jogado fora).
 *   reiniciar() → volta para 'aguardando' e esquece o trecho atual.
 *
 * Valores padrão (ajuste no teste real)
 *   toleranciaAusenciaMs 250   Falha de detecção mais curta que isso não encerra o trecho.
 *   duracaoMinimaMs      300   Trecho mais curto é descartado (mão só passando).
 *   duracaoMaximaMs      4000  Trecho mais longo é descartado; aí o segmentador
 *                              espera a mão sair da câmera para recomeçar.
 *   quadrosMinimos       8     Menos quadros que isso também é descartado.
 */

export const PADROES_TRECHO = Object.freeze({
  toleranciaAusenciaMs: 250,
  duracaoMinimaMs: 300,
  duracaoMaximaMs: 4000,
  quadrosMinimos: 8,
})

export function criarSegmentador(opcoes = {}) {
  const configuracao = validarOpcoes(opcoes)
  const { toleranciaAusenciaMs, duracaoMinimaMs, duracaoMaximaMs, quadrosMinimos } = configuracao
  let fase = 'aguardando'
  let quadros = []
  let inicio = 0
  let ultimoVisto = 0
  let descarte = null

  function atualizar(quadro, agora = performance.now()) {
    if (!Number.isFinite(agora)) throw new TypeError('agora deve ser um número finito, em milissegundos.')
    const presente = Array.isArray(quadro)

    if (fase === 'esperando-saida') {
      if (presente) ultimoVisto = agora
      else if (agora - ultimoVisto > toleranciaAusenciaMs) fase = 'aguardando'
      return null
    }

    if (fase === 'aguardando') {
      if (presente) {
        fase = 'gravando'
        quadros = [quadro]
        inicio = ultimoVisto = agora
        descarte = null
      }
      return null
    }

    // fase === 'gravando'
    if (presente) {
      if (agora - inicio > duracaoMaximaMs) {
        quadros = []
        descarte = 'longo'
        fase = 'esperando-saida'
        ultimoVisto = agora
        return null
      }
      quadros.push(quadro)
      ultimoVisto = agora
      return null
    }
    if (agora - ultimoVisto <= toleranciaAusenciaMs) return null

    const trecho = { quadros, inicio, fim: ultimoVisto, duracao: ultimoVisto - inicio }
    quadros = []
    fase = 'aguardando'
    if (trecho.duracao < duracaoMinimaMs || trecho.quadros.length < quadrosMinimos) {
      descarte = 'curto'
      return null
    }
    return trecho
  }

  function estado() {
    return { fase, quadros: quadros.length, duracao: fase === 'gravando' ? ultimoVisto - inicio : 0, descarte }
  }

  function reiniciar() {
    fase = 'aguardando'
    quadros = []
    inicio = ultimoVisto = 0
    descarte = null
  }

  return { atualizar, estado, reiniciar, configuracao }
}

function validarOpcoes(opcoes) {
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) {
    throw new TypeError('As opções do segmentador devem ser um objeto.')
  }
  for (const nome of Object.keys(opcoes)) {
    if (!Object.hasOwn(PADROES_TRECHO, nome)) throw new TypeError(`Opção desconhecida no segmentador: ${nome}.`)
  }
  const valores = { ...PADROES_TRECHO, ...opcoes }
  for (const nome of ['toleranciaAusenciaMs', 'duracaoMinimaMs', 'duracaoMaximaMs']) {
    if (!Number.isFinite(valores[nome]) || valores[nome] < 0) throw new RangeError(`${nome} deve ser um número maior ou igual a 0.`)
  }
  if (valores.duracaoMaximaMs <= valores.duracaoMinimaMs) {
    throw new RangeError('duracaoMaximaMs deve ser maior que duracaoMinimaMs.')
  }
  if (!Number.isInteger(valores.quadrosMinimos) || valores.quadrosMinimos < 2) {
    throw new RangeError('quadrosMinimos deve ser um inteiro maior ou igual a 2.')
  }
  return Object.freeze(valores)
}
