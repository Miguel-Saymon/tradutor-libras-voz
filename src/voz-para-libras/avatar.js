import { EVENTOS, ouvir } from '../comum/contrato.js'
import frases from './frases.json'
import { normalizar } from './normalizar.js'

const area = document.querySelector('#video-sinal')
const legenda = document.querySelector('#legenda-sinal')
const repetir = document.querySelector('#repetir-sinal')
const fila = []
const expressoes = Object.keys(frases).sort((a, b) => b.length - a.length)
let atual = null
let ultimaEntrada = ''

// Mantém expressões como "bom dia" inteiras. Só aceita a sequência completa.
function buscarSinais(texto) {
  let restante = normalizar(texto)
  const sinais = []
  while (restante) {
    const frase = expressoes.find((chave) =>
      restante === chave || restante.startsWith(chave + ' '),
    )
    if (!frase) return []
    sinais.push(frase)
    restante = restante.slice(frase.length).trimStart()
  }
  return sinais
}

function tocarProximo() {
  if (atual) return
  while (fila.length) {
    const entrada = fila[0]
    if (!entrada.sinais.length) {
      area.replaceChildren()
      legenda.textContent = 'sinal ainda não disponível'
      ultimaEntrada = ''
      fila.shift()
      continue
    }

    const frase = entrada.sinais.shift()
    const arquivo = frases[frase]
    const video = document.createElement('video')
    atual = video
    video.controls = true
    video.muted = true
    video.playsInline = true
    video.preload = 'none'
    video.setAttribute('aria-label', 'Sinal em Libras para ' + frase)
    legenda.textContent = 'Carregando o sinal de “' + frase + '”…'
    area.replaceChildren(video)
    video.onplaying = () => {
      if (atual === video) legenda.textContent = frase
    }
    video.onended = () => {
      if (atual !== video) return
      atual = null
      if (!entrada.sinais.length) {
        ultimaEntrada = entrada.texto
        fila.shift()
      }
      tocarProximo()
    }
    function falhar() {
      if (atual !== video) return
      atual = null
      area.replaceChildren()
      legenda.textContent = 'Vídeo de “' + frase + '” indisponível (' + arquivo + ').'
      ultimaEntrada = ''
      fila.shift()
      tocarProximo()
    }
    video.onerror = falhar
    video.src = import.meta.env.BASE_URL + 'sinais/' + arquivo
    video.play().catch((erro) => {
      if (atual !== video) return
      if (erro.name === 'NotAllowedError') {
        legenda.textContent = 'Toque em reproduzir no vídeo de “' + frase + '”.'
      } else {
        falhar()
      }
    })
    return
  }
  repetir.disabled = !ultimaEntrada
}

function enfileirar(texto) {
  fila.push({ texto, sinais: buscarSinais(texto) })
  repetir.disabled = true
  tocarProximo()
}

ouvir(EVENTOS.TEXTO_RECONHECIDO, ({ texto }) => enfileirar(texto))
repetir.addEventListener('click', () => enfileirar(ultimaEntrada))
window.addEventListener('pagehide', () => {
  fila.length = 0
  atual?.pause()
  atual = null
  ultimaEntrada = ''
  repetir.disabled = true
  area.replaceChildren()
  legenda.textContent = ''
})
