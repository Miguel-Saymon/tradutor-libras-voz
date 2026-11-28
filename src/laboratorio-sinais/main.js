import { EVENTOS, emitir, falar, ouvir } from '../comum/contrato.js'
import { criarCamera } from '../libras-para-voz/camera.js'
import { criarFrase, EVENTO_FRASE_ALTERADA } from '../libras-para-voz/frase.js'
import { criarBaseSinais, LIMITE_EXEMPLOS, LIMITE_QUADROS, paraExportar, validarBaseSinais, validarConfigSinais } from './base.js'
import { avaliarBase, calibrarLimiar, classificarTrecho, prepararModelos } from './classificador.js'
import { quadroDaMao } from './quadro.js'
import { criarSegmentador } from './trecho.js'

/*
 * Laboratório de sinais com movimento: liga câmera → quadro → trecho →
 * classificador → frase → voz. Toda a lógica está nos módulos testados;
 * aqui fica só a tela.
 */

const el = id => document.querySelector(`#${id}`)
const video = el('camera'), canvas = el('pontos')
const iniciar = el('iniciar-camera'), parar = el('parar-camera'), estadoCamera = el('estado-camera'), fps = el('fps')
const caixaTrecho = el('caixa-trecho'), estadoTrecho = el('estado-trecho'), duracaoTrecho = el('duracao-trecho')
const modo = el('modo-sinais'), seletor = el('sinal-coleta'), instrucao = el('instrucao-sinal'), referencia = el('video-referencia')
const desfazer = el('desfazer-exemplo'), exportar = el('exportar-sinais'), importar = el('importar-sinais'), estadoColeta = el('estado-coleta')
const sinalReconhecido = el('sinal-reconhecido'), detalhe = el('detalhe-resultado')
const fraseMontada = el('frase-montada'), falarFrase = el('falar-frase'), limparFrase = el('limpar-frase'), falarAoReconhecer = el('falar-ao-reconhecer')
const campoK = el('k-vizinhos'), campoLimiar = el('limiar-distancia'), avaliar = el('avaliar-base'), resultadoAvaliacao = el('resultado-avaliacao')

const segmentador = criarSegmentador()
const contadores = new Map()
let config = null, base = null, preparado = null, frase = null
let ocupado = true, limiarDesatualizado = true, gravadosNaSessao = 0
let rastreador = null, sessao = 0, cameraAtiva = false, vigia = null, ultimaFase = ''
const camera = criarCamera(video, { aoEncerrar: () => encerrar('A câmera foi desconectada. Você pode tentar iniciar novamente.') })

const nomeDo = id => config?.sinais.find(s => s.id === id)?.nome ?? id
const numero = (valor, casas = 2) => Number.isFinite(valor)
  ? valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  : 'sem limite'

function avisoColeta(texto) { estadoColeta.textContent = texto }
function mostrarResultado(titulo, texto = '') {
  sinalReconhecido.textContent = titulo
  detalhe.textContent = texto
}
function lerK() {
  const valor = Number(campoK.value)
  return Number.isInteger(valor) && valor >= 1 && valor <= 99 ? valor : null
}
function lerLimiar() {
  const valor = campoLimiar.valueAsNumber
  return Number.isFinite(valor) && valor >= 0 ? valor : Infinity
}

function atualizarControles() {
  const coleta = modo.value === 'coleta'
  modo.disabled = ocupado
  seletor.disabled = ocupado
  importar.disabled = ocupado
  exportar.disabled = ocupado || !base?.exemplos.length
  desfazer.disabled = ocupado || gravadosNaSessao === 0
  avaliar.disabled = ocupado || !base || base.exemplos.length < 2
  el('painel-coleta').hidden = !coleta
  el('painel-teste').hidden = coleta
}

/** Refaz os modelos depois de qualquer mudança na base. */
function atualizarBase() {
  preparado = prepararModelos(base.exemplos)
  limiarDesatualizado = true
  if (modo.value === 'teste') calibrar()
  for (const [id, contador] of contadores) contador.textContent = String(base.exemplos.filter(e => e.sinal === id).length)
  resultadoAvaliacao.textContent = ''
  atualizarControles()
}

function calibrar() {
  const limiar = calibrarLimiar(preparado)
  campoLimiar.value = Number.isFinite(limiar) ? limiar.toFixed(3) : ''
  limiarDesatualizado = false
}

function mostrarSinal() {
  const sinal = config?.sinais.find(s => s.id === seletor.value)
  instrucao.textContent = sinal?.instrucao || ''
  referencia.closest('figure').hidden = !sinal?.video
  if (sinal?.video) referencia.src = `${import.meta.env.BASE_URL}sinais/${encodeURIComponent(sinal.video)}`
  else referencia.removeAttribute('src')
}

function mostrarEstadoTrecho() {
  const { fase, duracao, descarte } = segmentador.estado()
  const faseVisivel = cameraAtiva ? fase : 'desligado'
  duracaoTrecho.textContent = faseVisivel === 'gravando' ? `${numero(duracao / 1000, 1)} s` : ''
  const chave = `${faseVisivel}:${descarte}`
  if (chave === ultimaFase) return
  ultimaFase = chave
  caixaTrecho.dataset.fase = faseVisivel
  const mao = config?.mao === 'Left' ? 'esquerda' : 'direita'
  const maximo = numero(segmentador.configuracao.duracaoMaximaMs / 1000, 0)
  estadoTrecho.textContent = {
    desligado: 'Inicie a câmera para coletar ou testar sinais.',
    gravando: 'Gravando o sinal… abaixe a mão quando terminar.',
    'esperando-saida': `Passou de ${maximo} segundos e foi descartado. Abaixe a mão para recomeçar.`,
    aguardando: descarte === 'curto'
      ? 'Trecho curto demais, descartado. Levante a mão, faça o sinal e abaixe.'
      : `Pronto: levante a mão ${mao}, faça o sinal e abaixe a mão.`,
  }[faseVisivel]
}

function processar(resultado) {
  const proporcao = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3
  const quadro = config ? quadroDaMao(resultado, config.mao, proporcao) : null
  tratar(segmentador.atualizar(quadro))
  // Se os quadros pararem de chegar (vídeo travado), o trecho termina mesmo assim.
  clearTimeout(vigia)
  vigia = setTimeout(() => tratar(segmentador.atualizar(null)), segmentador.configuracao.toleranciaAusenciaMs + 150)
}

function tratar(trecho) {
  mostrarEstadoTrecho()
  if (!trecho || ocupado || !config) return
  if (modo.value === 'coleta') gravarExemplo(trecho)
  else reconhecer(trecho)
}

function gravarExemplo(trecho) {
  if (base.exemplos.length >= LIMITE_EXEMPLOS) {
    avisoColeta(`Limite de ${LIMITE_EXEMPLOS} exemplos atingido. Exporte e comece outra base.`)
    return
  }
  if (trecho.quadros.length > LIMITE_QUADROS) {
    avisoColeta('Exemplo longo demais para a base; faça o sinal mais rápido.')
    return
  }
  base.exemplos.push({ sinal: seletor.value, quadros: trecho.quadros })
  gravadosNaSessao += 1
  atualizarBase()
  const total = base.exemplos.filter(e => e.sinal === seletor.value).length
  avisoColeta(`Exemplo ${total} de ${nomeDo(seletor.value)} gravado (${numero(trecho.duracao / 1000, 1)} s). Exporte para salvar.`)
}

function reconhecer(trecho) {
  const faltando = config.sinais.filter(s => !base.exemplos.some(e => e.sinal === s.id))
  if (faltando.length) {
    mostrarResultado('Grave exemplos de todos os sinais antes de testar.', `Faltam: ${faltando.map(s => s.nome).join(', ')}.`)
    return
  }
  const k = lerK()
  if (!k) { mostrarResultado('Informe k inteiro entre 1 e 99.'); return }
  if (limiarDesatualizado) calibrar()
  const limiar = lerLimiar()
  const resultado = classificarTrecho(trecho.quadros, preparado, { k, limiar })
  const sinal = config.sinais.find(s => s.id === resultado.sinal)
  const numeros = `distância ${numero(resultado.distancia, 3)} (limite ${numero(limiar, 3)}) · `
    + `votos ${Math.round(resultado.confianca * 100)}% · movimento ${numero(resultado.movimento)}`
  if (!resultado.aceito) {
    const porque = {
      distancia: 'ficou longe dos exemplos',
      confianca: 'os vizinhos não concordaram',
      movimento: 'a mão quase não se mexeu',
    }[resultado.motivo]
    mostrarResultado('Não reconhecido', `Mais parecido com ${sinal.nome}, mas ${porque}. ${numeros}.`)
    return
  }
  mostrarResultado(`${sinal.nome} → “${sinal.palavra}”`, `${numeros}.`)
  emitir(EVENTOS.GESTO_RECONHECIDO, { gesto: sinal.id, confianca: resultado.confianca })
  frase.adicionar(sinal.id)
  if (falarAoReconhecer.checked) {
    try { falar(sinal.palavra) } catch { detalhe.textContent += ' Não foi possível tocar a voz.' }
  }
}

function encerrar(mensagem = 'Câmera parada.') {
  sessao += 1
  rastreador?.parar()
  rastreador = null
  camera.parar()
  cameraAtiva = false
  clearTimeout(vigia)
  segmentador.reiniciar()
  mostrarEstadoTrecho()
  fps.textContent = '0'
  iniciar.disabled = false
  parar.disabled = true
  estadoCamera.textContent = mensagem
}

function mensagemErro(erro) {
  if (erro.name === 'NotAllowedError') return 'Permita o uso da câmera nas configurações do navegador e tente novamente.'
  if (erro.name === 'NotFoundError') return 'Nenhuma câmera foi encontrada neste aparelho.'
  if (erro.name === 'NotReadableError') return 'Não foi possível abrir a câmera. Feche outros aplicativos que a estejam usando e tente novamente.'
  return erro.message || 'Não foi possível iniciar a câmera e o rastreamento.'
}

iniciar.addEventListener('click', async () => {
  const atual = ++sessao
  iniciar.disabled = true
  parar.disabled = false
  estadoCamera.textContent = 'Aguardando permissão da câmera…'
  let etapa = 'camera'
  try {
    if (!await camera.iniciar() || atual !== sessao) return
    etapa = 'modelo'
    estadoCamera.textContent = 'Carregando o modelo de mãos…'
    const { criarRastreador } = await import('../libras-para-voz/maos.js')
    if (atual !== sessao) return
    const novo = await criarRastreador(video, canvas, {
      aoResultado: resultado => { if (atual === sessao) processar(resultado) },
      aoMedir: dados => { if (atual === sessao) fps.textContent = String(dados.fps) },
      aoErro: () => { if (atual === sessao) encerrar('O rastreamento foi interrompido. Tente iniciar novamente.') },
    })
    if (atual !== sessao) { novo.parar(); return }
    rastreador = novo
    rastreador.iniciar()
    cameraAtiva = true
    segmentador.reiniciar()
    mostrarEstadoTrecho()
    estadoCamera.textContent = 'Câmera ativa.'
  } catch (erro) {
    if (atual !== sessao) return
    encerrar(etapa === 'camera' ? mensagemErro(erro) : 'Não foi possível carregar o rastreador. Confira os arquivos locais em public/mediapipe e tente novamente.')
  }
})

parar.addEventListener('click', () => encerrar())
window.addEventListener('pagehide', () => encerrar())
document.addEventListener('visibilitychange', () => {
  // parar habilitado = câmera ativa ou iniciando.
  if (document.hidden && !parar.disabled) encerrar('Câmera pausada ao sair da tela. Clique em Iniciar câmera para retomar.')
})

modo.addEventListener('change', () => {
  segmentador.reiniciar()
  mostrarEstadoTrecho()
  if (modo.value === 'teste') calibrar()
  atualizarControles()
})
seletor.addEventListener('change', mostrarSinal)

desfazer.addEventListener('click', () => {
  if (desfazer.disabled || !gravadosNaSessao) return
  const removido = base.exemplos.pop()
  gravadosNaSessao -= 1
  atualizarBase()
  avisoColeta(`Último exemplo (${nomeDo(removido.sinal)}) removido.`)
})

exportar.addEventListener('click', () => {
  if (exportar.disabled) return
  const blob = new Blob([JSON.stringify(paraExportar(base))], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sinais-exemplos.json'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  avisoColeta('Exportação solicitada. Copie sinais-exemplos.json para public/ para a página já abrir com esses exemplos.')
})

importar.addEventListener('change', async () => {
  const arquivo = importar.files[0]
  if (!arquivo || ocupado) return
  ocupado = true
  atualizarControles()
  try {
    if (arquivo.size > 32 * 1024 * 1024) throw new Error('Arquivo muito grande: limite de 32 MB.')
    base = validarBaseSinais(JSON.parse(await arquivo.text()), config)
    gravadosNaSessao = 0
    avisoColeta('Base importada: substituiu os exemplos em memória.')
  } catch (erro) {
    avisoColeta(`Importação recusada; exemplos anteriores preservados. ${erro.message}`)
  } finally {
    ocupado = false
    importar.value = ''
    atualizarBase()
  }
})

avaliar.addEventListener('click', () => {
  const k = lerK()
  if (!k) { resultadoAvaliacao.textContent = 'Informe k inteiro entre 1 e 99.'; return }
  avaliar.disabled = true
  resultadoAvaliacao.textContent = 'Avaliando…'
  // Deixa a tela mostrar "Avaliando…" antes do cálculo.
  setTimeout(() => {
    const { acertos, total, porSinal } = avaliarBase(preparado, k)
    const partes = config.sinais.filter(s => porSinal[s.id]).map(s => `${s.nome} ${porSinal[s.id].acertos}/${porSinal[s.id].total}`)
    resultadoAvaliacao.textContent = total
      ? `Acerto deixando um de fora: ${acertos}/${total} (${Math.round(100 * acertos / total)}%) · ${partes.join(' · ')}`
      : 'Grave pelo menos dois exemplos para avaliar.'
    atualizarControles()
  }, 30)
})

falarFrase.addEventListener('click', () => {
  try {
    if (!frase?.falar()) detalhe.textContent = frase?.texto() ? 'Este navegador não oferece voz.' : 'A frase está vazia.'
  } catch {
    detalhe.textContent = 'Não foi possível tocar a voz.'
  }
})
limparFrase.addEventListener('click', () => frase?.limpar())
ouvir(EVENTO_FRASE_ALTERADA, ({ texto }) => { fraseMontada.textContent = texto || '—' })

async function carregar() {
  atualizarControles()
  try {
    const resposta = await fetch(`${import.meta.env.BASE_URL}sinais-config.json`, { cache: 'no-store' })
    if (!resposta.ok) throw new Error(`sinais-config.json: HTTP ${resposta.status}`)
    config = validarConfigSinais(await resposta.json())
  } catch (erro) {
    avisoColeta(`Não foi possível carregar a configuração. ${erro.message} Corrija public/sinais-config.json e recarregue.`)
    return
  }
  base = criarBaseSinais(config.mao)
  frase = criarFrase({ gestos: config.sinais })
  for (const sinal of config.sinais) {
    const opcao = document.createElement('option')
    opcao.value = sinal.id
    opcao.textContent = `${sinal.nome} → “${sinal.palavra}”`
    seletor.append(opcao)
    const linha = document.createElement('tr'), nome = document.createElement('th'), contador = document.createElement('td')
    nome.scope = 'row'
    nome.textContent = sinal.nome
    contador.textContent = '0'
    linha.append(nome, contador)
    el('contagens-sinais').append(linha)
    contadores.set(sinal.id, contador)
  }
  try {
    const resposta = await fetch(`${import.meta.env.BASE_URL}sinais-exemplos.json`, { cache: 'no-store' })
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    base = validarBaseSinais(await resposta.json(), config)
    avisoColeta(base.exemplos.length
      ? 'Exemplos de public/sinais-exemplos.json carregados. Você pode coletar mais ou testar.'
      : 'Base vazia. Grave de 15 a 20 exemplos de cada sinal e exporte antes de fechar.')
  } catch (erro) {
    avisoColeta(`Não foi possível carregar sinais-exemplos.json (${erro.message}). Começamos uma base vazia.`)
  }
  ocupado = false
  atualizarBase()
  mostrarSinal()
  mostrarEstadoTrecho()
}

carregar()
