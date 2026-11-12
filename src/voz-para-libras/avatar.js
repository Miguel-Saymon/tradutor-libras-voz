import { EVENTOS, ouvir } from '../comum/contrato.js'
import { criarAvatar } from './vlibras.js'
import { criarPlanoB } from './videos.js'

const area = document.querySelector('#avatar-vlibras')
const legenda = document.querySelector('#legenda-sinal')
const aviso = document.querySelector('#aviso-avatar')
const repetir = document.querySelector('#repetir-sinal')
const fila = []
let avatar
let planoB
let ultimo = ''
let executando = false
let geracao = 0

async function enviar(texto) {
  if (planoB) return planoB(texto)
  fila.push(texto)
  if (executando) return
  executando = true
  repetir.disabled = true
  const sessao = geracao
  while (fila.length && geracao === sessao) {
    const frase = fila.shift()
    try {
      aviso.textContent = avatar ? '' : 'Carregando o avatar VLibras…'
      avatar ??= criarAvatar(area)
      legenda.textContent = frase
      await avatar.sinalizar(frase)
      if (geracao !== sessao) return
      aviso.textContent = ''
      ultimo = frase
    } catch {
      if (geracao !== sessao) return
      avatar?.fechar()
      avatar = null
      aviso.textContent = 'VLibras indisponível. Usando os vídeos de reserva.'
      planoB = criarPlanoB()
      planoB(frase)
      for (const proxima of fila.splice(0)) planoB(proxima)
    }
  }
  executando = false
  if (!planoB) repetir.disabled = !ultimo
}

ouvir(EVENTOS.TEXTO_RECONHECIDO, ({ texto }) => enviar(texto))
repetir.addEventListener('click', () => {
  if (!planoB && ultimo) enviar(ultimo)
})
window.addEventListener('pagehide', () => {
  geracao++
  fila.length = 0
  avatar?.fechar()
  avatar = null
  ultimo = ''
  executando = false
  repetir.disabled = true
})
