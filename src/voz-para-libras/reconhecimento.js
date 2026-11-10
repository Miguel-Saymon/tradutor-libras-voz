/**
 * Uma frase por sessão, com parciais e finais separados.
 * Retorna null quando a API não está disponível.
 */
export function criarReconhecimento({ aoParcial, aoFinal, aoEstado, aoErro }) {
  const API = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition
  if (!API) return null

  let atual = null
  let parando = false
  let limite

  function encerrar(reconhecimento, erro, abortar = false) {
    if (atual !== reconhecimento) return
    clearTimeout(limite)
    atual = null
    parando = false
    // Invalida a sessão antes de abortar, pois o navegador pode emitir eventos.
    if (abortar) {
      try {
        reconhecimento.abort()
      } catch {
        // A sessão nativa pode já estar encerrada.
      }
    }
    aoParcial('')
    aoEstado('parado')
    if (erro) aoErro(erro)
  }

  function iniciar() {
    if (atual) return
    if (globalThis.isSecureContext === false) {
      aoErro('contexto-inseguro')
      return
    }
    let reconhecimento
    try {
      reconhecimento = new API()
    } catch (erro) {
      aoErro(erro.name || 'inicio')
      return
    }
    reconhecimento.lang = 'pt-BR'
    reconhecimento.interimResults = true
    reconhecimento.continuous = false
    atual = reconhecimento
    parando = false
    aoEstado('iniciando')

    reconhecimento.onstart = () => {
      if (atual !== reconhecimento || parando) return
      clearTimeout(limite)
      aoEstado('ouvindo')
    }
    reconhecimento.onresult = (evento) => {
      if (atual !== reconhecimento) return
      const parciais = []
      for (let indice = 0; indice < evento.results.length; indice++) {
        const resultado = evento.results[indice]
        if (!resultado.isFinal) parciais.push(resultado[0].transcript)
        else if (indice >= evento.resultIndex) aoFinal(resultado[0].transcript)
      }
      aoParcial(parciais.join(' '))
    }
    reconhecimento.onerror = (evento) => {
      encerrar(reconhecimento, evento.error || 'desconhecido', true)
    }
    reconhecimento.onend = () => {
      encerrar(reconhecimento)
    }

    limite = setTimeout(() => encerrar(reconhecimento, 'inicio-expirado', true), 20000)
    try {
      reconhecimento.start()
    } catch (erro) {
      encerrar(reconhecimento, erro.name || 'inicio', true)
    }
  }

  function parar() {
    if (!atual || parando) return
    parando = true
    aoEstado('parando')
    const reconhecimento = atual
    clearTimeout(limite)
    limite = setTimeout(() => encerrar(reconhecimento, 'fim-expirado', true), 4000)
    // stop permite receber um último resultado antes de onend.
    try {
      reconhecimento.stop()
    } catch (erro) {
      encerrar(reconhecimento, erro.name || 'parada', true)
    }
  }

  function cancelar() {
    if (!atual) return
    encerrar(atual, null, true)
  }

  return { iniciar, parar, cancelar }
}
