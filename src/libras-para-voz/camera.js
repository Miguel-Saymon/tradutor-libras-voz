/** Captura local, sem áudio. O espelhamento é aplicado por CSS ao vídeo e canvas. */
export function criarCamera(video, { aoEncerrar = () => {} } = {}) {
  let fluxo = null
  let sessao = 0

  function parar() {
    sessao += 1
    fluxo?.getTracks().forEach(track => track.stop())
    fluxo = null
    video.pause()
    video.srcObject = null
  }

  async function iniciar() {
    parar()
    const atual = sessao
    if (!globalThis.isSecureContext) {
      throw new Error('A câmera precisa de HTTPS ou localhost. No celular, abra o site HTTPS; o endereço http://192.168… não permite a câmera.')
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador não oferece acesso à câmera. Abra a página no Chrome ou Edge atualizado.')
    }
    const recebido = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 640 }, height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    })
    // Parar também funciona enquanto o diálogo de permissão está aberto.
    if (atual !== sessao) {
      recebido.getTracks().forEach(track => track.stop())
      return false
    }
    fluxo = recebido
    video.srcObject = recebido
    recebido.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (atual === sessao) { parar(); aoEncerrar() }
    }, { once: true }))
    try {
      await video.play()
      return atual === sessao
    } catch (erro) {
      if (atual !== sessao) return false
      parar()
      throw erro
    }
  }

  return { iniciar, parar }
}
