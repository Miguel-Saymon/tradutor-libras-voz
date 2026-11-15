import { criarCamera } from './camera.js'

const video = document.querySelector('#camera')
const canvas = document.querySelector('#pontos')
const iniciar = document.querySelector('#iniciar-camera')
const parar = document.querySelector('#parar-camera')
const estado = document.querySelector('#estado-camera')
const fps = document.querySelector('#fps')
const maos = document.querySelector('#quantidade-maos')
let rastreador = null
let sessao = 0
const camera = criarCamera(video, { aoEncerrar: () => encerrar('A câmera foi desconectada. Você pode tentar iniciar novamente.') })

function encerrar(mensagem = 'Câmera parada.') {
  sessao += 1
  rastreador?.parar()
  rastreador = null
  camera.parar()
  fps.textContent = '0'
  maos.textContent = '0'
  iniciar.disabled = false
  parar.disabled = true
  estado.textContent = mensagem
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
  estado.textContent = 'Aguardando permissão da câmera…'
  let etapa = 'camera'
  try {
    if (!await camera.iniciar() || atual !== sessao) return
    etapa = 'modelo'
    estado.textContent = 'Carregando o modelo de mãos…'
    // MediaPipe só é importado quando o usuário inicia esta tela.
    const { criarRastreador } = await import('./maos.js')
    if (atual !== sessao) return
    const novo = await criarRastreador(video, canvas, {
      aoMedir: dados => {
        if (atual !== sessao) return
        fps.textContent = String(dados.fps)
        maos.textContent = String(dados.maos)
      },
      aoErro: () => { if (atual === sessao) encerrar('O rastreamento foi interrompido. Tente iniciar novamente.') },
    })
    if (atual !== sessao) { novo.parar(); return }
    rastreador = novo
    rastreador.iniciar()
    estado.textContent = 'Câmera ativa. Mostre uma ou duas mãos dentro do enquadramento.'
  } catch (erro) {
    if (atual !== sessao) return
    encerrar(etapa === 'camera' ? mensagemErro(erro) : 'Não foi possível carregar o rastreador. Confira os arquivos locais em public/mediapipe e tente novamente.')
  }
})

parar.addEventListener('click', () => encerrar())
window.addEventListener('pagehide', () => encerrar())
document.addEventListener('visibilitychange', () => {
  if (document.hidden) encerrar('Câmera pausada ao sair da tela. Clique em Iniciar câmera para retomar.')
})
