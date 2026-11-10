import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTOS, emitir, falar, ouvir } from './contrato.js'

const assinaturas = []

afterEach(() => {
  for (const remover of assinaturas.splice(0)) remover()
  vi.unstubAllGlobals()
})

describe('falar', () => {
  let sintetizador

  beforeEach(() => {
    sintetizador = { getVoices: vi.fn(() => []), speak: vi.fn() }
    vi.stubGlobal('speechSynthesis', sintetizador)
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      constructor(texto) {
        this.text = texto
      }
    })
  })

  it('fala o texto em pt-BR e prefere a voz brasileira', () => {
    const voz = { lang: 'pt-BR' }
    sintetizador.getVoices.mockReturnValue([{ lang: 'pt-PT' }, voz])
    const fala = falar('  Bom dia  ')
    expect(fala).toMatchObject({ text: 'Bom dia', lang: 'pt-BR', voice: voz })
    expect(sintetizador.speak).toHaveBeenCalledExactlyOnceWith(fala)
  })

  it('usa lang pt-BR quando não há voz brasileira', () => {
    sintetizador.getVoices.mockReturnValue([{ lang: 'en-US' }])
    const fala = falar('Oi')
    expect(fala.lang).toBe('pt-BR')
    expect(fala.voice).toBeUndefined()
    expect(sintetizador.speak).toHaveBeenCalledWith(fala)
  })

  it('considera vozes carregadas entre chamadas e ignora caixa do idioma', () => {
    falar('Oi')
    const voz = { lang: 'pt-br' }
    sintetizador.getVoices.mockReturnValue([voz])
    expect(falar('Tudo bem').voice).toBe(voz)
    expect(sintetizador.speak).toHaveBeenCalledTimes(2)
  })

  it.each(['', '   ', null, 42])('ignora texto inválido %s', (texto) => {
    expect(falar(texto)).toBeNull()
    expect(sintetizador.speak).not.toHaveBeenCalled()
  })

  it.each(['speechSynthesis', 'SpeechSynthesisUtterance'])(
    'retorna null sem suporte a %s', (api) => {
      vi.stubGlobal(api, undefined)
      expect(falar('Oi')).toBeNull()
    },
  )

  it('permite tratar falhas síncronas no chamador', () => {
    sintetizador.speak.mockImplementation(() => { throw new Error('Falha de áudio') })
    expect(() => falar('Oi')).toThrow('Falha de áudio')
  })
})

describe('eventos', () => {
  it('entrega o payload aos ouvintes do evento correto', () => {
    const texto = vi.fn()
    const outroTexto = vi.fn()
    const gesto = vi.fn()
    assinaturas.push(ouvir(EVENTOS.TEXTO_RECONHECIDO, texto))
    assinaturas.push(ouvir(EVENTOS.TEXTO_RECONHECIDO, outroTexto))
    assinaturas.push(ouvir(EVENTOS.GESTO_RECONHECIDO, gesto))
    const dados = { texto: 'Bom dia' }
    emitir(EVENTOS.TEXTO_RECONHECIDO, dados)
    expect(texto).toHaveBeenCalledExactlyOnceWith(dados)
    expect(outroTexto).toHaveBeenCalledExactlyOnceWith(dados)
    expect(gesto).not.toHaveBeenCalled()
    emitir(EVENTOS.GESTO_RECONHECIDO, { gesto: 'Sim' })
    expect(gesto).toHaveBeenCalledExactlyOnceWith({ gesto: 'Sim' })
    expect(texto).toHaveBeenCalledTimes(1)
  })

  it('remove apenas a assinatura solicitada, inclusive para o mesmo callback', () => {
    const callback = vi.fn()
    const remover = ouvir(EVENTOS.TEXTO_RECONHECIDO, callback)
    assinaturas.push(remover, ouvir(EVENTOS.TEXTO_RECONHECIDO, callback))
    remover()
    remover()
    emitir(EVENTOS.TEXTO_RECONHECIDO, { texto: 'Oi' })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('uma remoção antiga não apaga novas assinaturas', () => {
    const remover = ouvir(EVENTOS.TEXTO_RECONHECIDO, vi.fn())
    remover()
    const callback = vi.fn()
    assinaturas.push(ouvir(EVENTOS.TEXTO_RECONHECIDO, callback))
    remover()
    emitir(EVENTOS.TEXTO_RECONHECIDO, { texto: 'Oi' })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('aceita emissão sem ouvintes', () => {
    expect(() => emitir(EVENTOS.TEXTO_RECONHECIDO, { texto: 'Oi' })).not.toThrow()
  })

  it('rejeita callback inválido', () => {
    expect(() => ouvir(EVENTOS.TEXTO_RECONHECIDO, null)).toThrow(TypeError)
  })
})
