// Protocolo do iframe oficial fixado na revisão indicada no README.
const raiz = new URL(import.meta.env.BASE_URL + 'vlibras/', location.href)
const dicionario = 'https://dicionario2.vlibras.gov.br/2018.3.1/WEBGL/BR/'
const tradutor = 'https://traducao2.vlibras.gov.br/translate'

// Respostas reais do tradutor para as duas frases do aceite.
const demonstracao = new Map([
  ['bom dia', 'BOM DIA'],
  ['tudo bem', 'TUDO_BEM [INTERROGAÇÃO]'],
])

async function traduzir(texto, signal) {
  const resposta = await fetch(tradutor, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  if (!resposta.ok) throw new Error('Serviço de tradução indisponível.')
  const corpo = (await resposta.text()).trim()
  const glosa = corpo.startsWith('{') ? JSON.parse(corpo).traducao : corpo
  if (typeof glosa !== 'string' || !glosa.trim() || glosa.startsWith('<')) {
    throw new Error('O tradutor retornou uma resposta inválida.')
  }
  return glosa
}

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
    async sinalizar(texto) {
      await pronto
      const local = demonstracao.get(texto)
      const glosa = local || await traduzir(texto, sessao.signal)
      sessao.signal.throwIfAborted()
      comando('setBaseUrl', local ? new URL('sinais/', raiz).href : dicionario)
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
