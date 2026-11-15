// Protocolo do iframe oficial fixado na revisão indicada no README.
const raiz = new URL(import.meta.env.BASE_URL + 'vlibras/', location.href)
export function criarAvatar(area) {
  const frame = document.createElement('iframe')
  frame.title = 'Ícaro, avatar 3D do VLibras'
  frame.src = new URL('unity/index.html', raiz).href
  const sessao = new AbortController()
  let pendente
  let reproduzindo = false

  function aguardar(ms, erro) {
    return new Promise((resolve, reject) => {
      const tempo = setTimeout(() => concluir(new Error(erro)), ms)
      pendente = (falha) => {
        clearTimeout(tempo)
        if (falha) reject(falha)
        else resolve()
      }
    })
  }

  function concluir(erro) {
    const resolver = pendente
    pendente = null
    resolver?.(erro)
  }

  function comando(method, params) {
    frame.contentWindow.postMessage({ type: 'unity', object: 'PlayerManager', method, params }, location.origin)
  }

  let carregado = false
  const pronto = aguardar(90000, 'O avatar não iniciou a tempo.')
  window.addEventListener('message', ({ origin, source, data }) => {
    if (origin !== location.origin || source !== frame.contentWindow || data?.type !== 'unity_event') return
    if (data.event === 'on_load_player' && !carregado) {
      carregado = true
      concluir()
    }
    if (data.event === 'on_error') concluir(new Error('WebGL indisponível.'))
    if (data.event === 'on_playing_state_change' && carregado && pendente) {
      const [tocando, pausado, , carregando] = data.data
      if (tocando === 'True' && pausado !== 'True') reproduzindo = true
      if (reproduzindo && tocando === 'False' && carregando === 'False' && pausado !== 'True') concluir()
    }
  }, { signal: sessao.signal })
  frame.onerror = () => concluir(new Error('Falha ao abrir o player.'))
  area.replaceChildren(frame)

  return {
    async sinalizar(glosa) {
      await pronto
      sessao.signal.throwIfAborted()
      comando('setBaseUrl', new URL('sinais/', raiz).href)
      reproduzindo = false
      const terminou = aguardar(90000, 'O avatar não concluiu a animação.')
      comando('playNow', glosa)
      await terminou
    },
    fechar() {
      sessao.abort()
      concluir(new Error('Player encerrado.'))
      frame.remove()
    },
  }
}
