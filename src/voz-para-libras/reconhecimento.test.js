import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let elementos
let sessoes
let receberTexto
let removerOuvinte

class Elemento extends EventTarget {
  textContent = ''
  value = ''
  disabled = false
  dataset = {}
  setAttribute = vi.fn()
}

function resultado(texto, final = false) {
  return Object.assign([{ transcript: texto }], { isFinal: final })
}

function clicar(seletor) {
  elementos[seletor].dispatchEvent(new Event('click'))
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  sessoes = []
  elementos = Object.fromEntries(
    ['#falar', '#parcial', '#final', '#status', '#frase', '#formulario', 'atalho']
      .map((nome) => [nome, new Elemento()]),
  )
  elementos.atalho.dataset.frase = 'bom dia'
  vi.stubGlobal('document', {
    querySelector: (seletor) => elementos[seletor],
    querySelectorAll: () => [elementos.atalho],
  })
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('SpeechRecognition', undefined)
  vi.stubGlobal('webkitSpeechRecognition', class {
    start = vi.fn()
    stop = vi.fn()
    abort = vi.fn()
    constructor() { sessoes.push(this) }
  })
  const { ouvir, EVENTOS } = await import('../comum/contrato.js')
  receberTexto = vi.fn()
  removerOuvinte = ouvir(EVENTOS.TEXTO_RECONHECIDO, receberTexto)
})

afterEach(() => {
  removerOuvinte()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('mostra parciais e emite somente os novos resultados finais normalizados', async () => {
  await import('./main.js')
  clicar('#falar')
  const sessao = sessoes[0]
  expect(sessao).toMatchObject({ lang: 'pt-BR', interimResults: true, continuous: false })
  expect(sessao.start).toHaveBeenCalledOnce()
  sessao.onstart()
  sessao.onresult({ resultIndex: 0, results: [resultado('Bom')] })
  expect(elementos['#parcial'].textContent).toBe('Bom')
  expect(receberTexto).not.toHaveBeenCalled()
  sessao.onresult({ resultIndex: 0, results: [resultado('Bom dia!', true)] })
  expect(elementos['#final'].textContent).toBe('bom dia')
  expect(elementos['#parcial'].textContent).toBe('')
  expect(receberTexto).toHaveBeenCalledExactlyOnceWith({ texto: 'bom dia' })
  sessao.onresult({
    resultIndex: 1,
    results: [resultado('Bom dia!', true), resultado('Tudo')],
  })
  expect(receberTexto).toHaveBeenCalledTimes(1)
})

it('o botão para e aguarda o resultado final antes de liberar uma nova sessão', async () => {
  await import('./main.js')
  clicar('#falar')
  sessoes[0].onstart()
  clicar('#falar')
  const sessao = sessoes[0]
  expect(sessao.stop).toHaveBeenCalledOnce()
  expect(elementos['#falar'].disabled).toBe(false)
  expect(elementos['#falar'].textContent).toBe('Cancelar')
  sessao.onstart()
  sessao.onresult({ resultIndex: 0, results: [resultado('Bom dia', true)] })
  sessao.onend()
  expect(elementos['#falar'].disabled).toBe(false)
  expect(elementos['#falar'].textContent).toBe('Falar')
  expect(receberTexto).toHaveBeenCalledExactlyOnceWith({ texto: 'bom dia' })
  clicar('#falar')
  expect(sessoes).toHaveLength(2)
})

it('digitação e atalhos usam o mesmo evento e descartam resultados de captura cancelada', async () => {
  await import('./main.js')
  clicar('#falar')
  const sessao = sessoes[0]
  elementos['#frase'].value = '  NÃO, obrigado! '
  elementos['#formulario'].dispatchEvent(new Event('submit', { cancelable: true }))
  expect(sessao.abort).toHaveBeenCalledOnce()
  expect(receberTexto).toHaveBeenLastCalledWith({ texto: 'não obrigado' })
  sessao.onresult({ resultIndex: 0, results: [resultado('atrasado', true)] })
  sessao.onend()
  expect(elementos['#final'].textContent).toBe('não obrigado')
  clicar('atalho')
  expect(elementos['#final'].textContent).toBe('bom dia')
  expect(receberTexto).toHaveBeenNthCalledWith(2, { texto: 'bom dia' })
  expect(receberTexto).toHaveBeenCalledTimes(2)
})

it('mantém digitação disponível sem SpeechRecognition e ignora frase vazia', async () => {
  vi.stubGlobal('webkitSpeechRecognition', undefined)
  await import('./main.js')
  expect(elementos['#falar'].disabled).toBe(true)
  elementos['#frase'].value = ' ... '
  elementos['#formulario'].dispatchEvent(new Event('submit'))
  expect(receberTexto).not.toHaveBeenCalled()
  clicar('atalho')
  expect(receberTexto).toHaveBeenCalledExactlyOnceWith({ texto: 'bom dia' })
})

it.each(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'no-speech'])(
  'libera o botão após %s mesmo sem onend e ignora eventos atrasados', async (erro) => {
  await import('./main.js')
  clicar('#falar')
  sessoes[0].onerror({ error: erro })
  expect(elementos['#status'].textContent).toContain('Código: ' + erro)
  expect(elementos['#falar'].textContent).toBe('Falar')
  expect(elementos['#falar'].disabled).toBe(false)
  clicar('#falar')
  expect(sessoes).toHaveLength(2)
  sessoes[1].onstart()
  sessoes[0].onend()
  sessoes[0].onresult({ resultIndex: 0, results: [resultado('atrasado', true)] })
  expect(receberTexto).not.toHaveBeenCalled()
  expect(elementos['#falar'].textContent).toBe('Parar')
})

it('orienta a usar HTTPS na rede local e mantém os atalhos disponíveis', async () => {
  vi.stubGlobal('isSecureContext', false)
  await import('./main.js')
  expect(elementos['#falar'].disabled).toBe(true)
  expect(elementos['#status'].textContent).toContain('HTTPS')
  clicar('atalho')
  expect(elementos['#final'].textContent).toBe('bom dia')
  expect(sessoes).toHaveLength(0)
})

it('cancela de imediato antes de onstart e enquanto espera onend', async () => {
  await import('./main.js')
  clicar('#falar')
  clicar('#falar')
  expect(sessoes[0].abort).toHaveBeenCalledOnce()
  clicar('#falar')
  sessoes[1].onstart()
  clicar('#falar')
  clicar('#falar')
  expect(sessoes[1].abort).toHaveBeenCalledOnce()
  expect(elementos['#falar'].textContent).toBe('Falar')
})

it('libera sessões sem resposta na inicialização e na parada', async () => {
  await import('./main.js')
  clicar('#falar')
  vi.advanceTimersByTime(20000)
  expect(elementos['#status'].textContent).toContain('inicio-expirado')
  clicar('#falar')
  sessoes[1].onstart()
  clicar('#falar')
  vi.advanceTimersByTime(4000)
  expect(elementos['#status'].textContent).toContain('fim-expirado')
  expect(elementos['#falar'].textContent).toBe('Falar')
})

it('recupera uma exceção em stop mesmo se abort também falhar', async () => {
  await import('./main.js')
  clicar('#falar')
  sessoes[0].onstart()
  const falhar = () => { throw new DOMException('Sessão encerrada', 'InvalidStateError') }
  sessoes[0].stop.mockImplementation(falhar)
  sessoes[0].abort.mockImplementation(falhar)
  clicar('#falar')
  expect(elementos['#status'].textContent).toContain('InvalidStateError')
  clicar('#falar')
  expect(sessoes).toHaveLength(2)
})
