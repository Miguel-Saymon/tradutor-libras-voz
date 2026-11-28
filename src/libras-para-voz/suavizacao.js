import { EVENTOS, emitir } from '../comum/contrato.js'

/*
 * Filtro de estabilidade do gesto (Libras → Voz).
 *
 * A previsão do KNN oscila de quadro a quadro. Este filtro decide quando um
 * gesto vale de verdade, para a frase não receber palavras erradas nem a mesma
 * palavra dezenas de vezes por segundo. Não usa a tela (DOM): é testado sozinho.
 *
 * Caminho completo:
 *   câmera → maos.js (pontos) → vetorDaMao → classificar (knn.js)
 *     → filtro.atualizar (este arquivo) → frase.adicionar (frase.js) → frase.falar
 *
 * Funções
 *   criarFiltroEstabilidade(opcoes?)
 *     Cria um filtro. opcoes pode ser parcial; o que faltar vem de PADROES_ESTABILIDADE.
 *     Opção com nome desconhecido ou valor inválido gera erro na criação.
 *   filtro.atualizar(previsao, agora?)
 *     Chame UMA vez por quadro da câmera. previsao é o retorno de classificar()
 *     ({ gesto, confianca, ... }) ou null quando não há mão ou previsão.
 *     agora é o instante em milissegundos (padrão: performance.now()).
 *     Retorna null, ou { gesto, confianca } no quadro em que o gesto é aceito.
 *   filtro.reiniciar()
 *     Esquece a contagem e as travas. Chame ao parar a câmera ou sair do modo Testar.
 *   filtro.estado()
 *     { gesto, quadros, necessarios }: progresso da sequência atual (opcional, para a tela).
 *   filtro.configuracao
 *     Valores efetivos em uso (objeto congelado).
 *
 * Regras e valores padrão (ajuste no teste real)
 *   quadrosSeguidos      10    Quadros seguidos com o mesmo gesto para aceitar.
 *   confiancaMinima      0.6   Confiança mínima, inclusive. Com k = 3 a confiança
 *                              do KNN só vale 1/3, 2/3 ou 1; 0.6 aceita 2/3 e 1.
 *   intervaloRepeticaoMs 1500  Tempo antes de o mesmo gesto valer de novo.
 *   repetirSegurando     false Ver abaixo.
 *
 *   Gesto diferente, confiança abaixo do mínimo ou quadro sem mão (null) zeram
 *   a contagem. O mesmo gesto só é aceito de novo depois de intervaloRepeticaoMs
 *   desde a última aceitação dele; gestos diferentes não esperam um pelo outro.
 *
 *   repetirSegurando: false (padrão) → segurar a mão parada fala uma vez só.
 *     Depois de aceito, o gesto fica travado enquanto continuar aparecendo, mesmo
 *     com oscilações rápidas no meio. Ele destrava quando outro gesto é aceito
 *     ou quando some (sem mão, outro gesto ou confiança baixa) por
 *     intervaloRepeticaoMs. Ex.: "aberta, fechado, aberta" funciona; segurar
 *     "aberta" por 10 s dá uma palavra só.
 *   repetirSegurando: true → segurando parado, o gesto é aceito de novo a cada
 *     intervaloRepeticaoMs.
 *
 * Evento
 *   Ao aceitar, emite EVENTOS.GESTO_RECONHECIDO com { gesto, confianca } pelo
 *   barramento de ../comum/contrato.js. gesto é o id (ex.: 'mao-aberta'), não a
 *   palavra; a palavra vem de frase.adicionar() (frase.js).
 *
 * Uso mínimo (o exemplo completo de integração está no topo de frase.js):
 *   const filtro = criarFiltroEstabilidade()        // ou { quadrosSeguidos: 8 }
 *   const aceito = filtro.atualizar(resultado)      // resultado de classificar() ou null
 *   if (aceito) frase.adicionar(aceito.gesto)
 */

export const PADROES_ESTABILIDADE = Object.freeze({
  quadrosSeguidos: 10,
  confiancaMinima: 0.6,
  intervaloRepeticaoMs: 1500,
  repetirSegurando: false,
})

export function criarFiltroEstabilidade(opcoes = {}) {
  const configuracao = validarOpcoes(opcoes)
  const { quadrosSeguidos, confiancaMinima, intervaloRepeticaoMs, repetirSegurando } = configuracao
  let candidato = null
  let quadros = 0
  // gesto → instante da última aceitação (vale nos dois modos).
  const aceitoEm = new Map()
  // Só no modo padrão: gesto travado → último instante em que ele apareceu.
  const travados = new Map()

  function zerarSequencia() {
    candidato = null
    quadros = 0
  }

  function atualizar(previsao, agora = performance.now()) {
    if (!Number.isFinite(agora)) throw new TypeError('agora deve ser um número finito, em milissegundos.')
    const gesto = previsao?.gesto
    const confianca = previsao?.confianca
    if (typeof gesto !== 'string' || !gesto || !Number.isFinite(confianca) || confianca < confiancaMinima) {
      zerarSequencia()
      return null
    }

    if (gesto !== candidato) {
      candidato = gesto
      quadros = 0
      // Uma sequência nova destrava o gesto se ele ficou sumido tempo suficiente.
      if (travados.has(gesto) && agora - travados.get(gesto) >= intervaloRepeticaoMs) travados.delete(gesto)
    }
    quadros += 1
    if (travados.has(gesto)) travados.set(gesto, agora)

    if (quadros < quadrosSeguidos || travados.has(gesto)) return null
    if (aceitoEm.has(gesto) && agora - aceitoEm.get(gesto) < intervaloRepeticaoMs) return null

    aceitoEm.set(gesto, agora)
    if (!repetirSegurando) {
      // Aceitar outro gesto mostra que a pessoa mudou de sinal: destrava os anteriores.
      travados.clear()
      travados.set(gesto, agora)
    }
    const aceito = Object.freeze({ gesto, confianca })
    emitir(EVENTOS.GESTO_RECONHECIDO, aceito)
    return aceito
  }

  function reiniciar() {
    zerarSequencia()
    aceitoEm.clear()
    travados.clear()
  }

  function estado() {
    return { gesto: candidato, quadros, necessarios: quadrosSeguidos }
  }

  return { atualizar, reiniciar, estado, configuracao }
}

function validarOpcoes(opcoes) {
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) {
    throw new TypeError('As opções do filtro devem ser um objeto.')
  }
  for (const nome of Object.keys(opcoes)) {
    if (!Object.hasOwn(PADROES_ESTABILIDADE, nome)) throw new TypeError(`Opção desconhecida no filtro: ${nome}.`)
  }
  const valores = { ...PADROES_ESTABILIDADE, ...opcoes }
  if (!Number.isInteger(valores.quadrosSeguidos) || valores.quadrosSeguidos < 1) {
    throw new RangeError('quadrosSeguidos deve ser um inteiro maior ou igual a 1.')
  }
  if (!Number.isFinite(valores.confiancaMinima) || valores.confiancaMinima < 0 || valores.confiancaMinima > 1) {
    throw new RangeError('confiancaMinima deve ser um número entre 0 e 1.')
  }
  if (!Number.isFinite(valores.intervaloRepeticaoMs) || valores.intervaloRepeticaoMs < 0) {
    throw new RangeError('intervaloRepeticaoMs deve ser um número maior ou igual a 0.')
  }
  if (typeof valores.repetirSegurando !== 'boolean') {
    throw new TypeError('repetirSegurando deve ser true ou false.')
  }
  return Object.freeze(valores)
}
