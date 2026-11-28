import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ouvir } from '../comum/contrato.js'
import { criarFrase, EVENTO_FRASE_ALTERADA } from './frase.js'
import configArquivo from '../../public/gestos-config.json'

const config = {
  gestos: [
    { id: 'mao-aberta', palavra: 'aberta' },
    { id: 'punho-fechado', palavra: '  fechado ' },
    { id: 'sem-palavra', palavra: '   ' },
    { id: 'sem-campo' },
  ],
}

const assinaturas = []
afterEach(() => {
  for (const remover of assinaturas.splice(0)) remover()
  vi.unstubAllGlobals()
})

function ouvirFrase() {
  const ouvinte = vi.fn()
  assinaturas.push(ouvir(EVENTO_FRASE_ALTERADA, ouvinte))
  return ouvinte
}

describe('montador de frase', () => {
  it('converte cada gesto do gestos-config.json na sua palavra', () => {
    const frase = criarFrase(configArquivo)
    for (const gesto of configArquivo.gestos) expect(frase.adicionar(gesto.id)).toBe(gesto.palavra)
    expect(frase.texto()).toBe(configArquivo.gestos.map(g => g.palavra).join(' '))
  })

  it('acumula as palavras na ordem e devolve cópias', () => {
    const frase = criarFrase(config)
    expect(frase.texto()).toBe('')
    expect(frase.adicionar('mao-aberta')).toBe('aberta')
    expect(frase.adicionar('punho-fechado')).toBe('fechado')
    frase.adicionar('mao-aberta')
    expect(frase.texto()).toBe('aberta fechado aberta')
    const palavras = frase.palavras()
    expect(palavras).toEqual(['aberta', 'fechado', 'aberta'])
    palavras.push('intrusa')
    expect(frase.palavras()).toHaveLength(3)
  })

  it('limpar esvazia a frase e avisa só quando havia algo', () => {
    const ouvinte = ouvirFrase()
    const frase = criarFrase(config)
    frase.limpar()
    expect(ouvinte).not.toHaveBeenCalled()
    frase.adicionar('mao-aberta')
    frase.limpar()
    expect(frase.texto()).toBe('')
    expect(frase.palavras()).toEqual([])
    expect(ouvinte).toHaveBeenLastCalledWith({ texto: '', palavras: [] })
    expect(ouvinte).toHaveBeenCalledTimes(2)
    expect(frase.adicionar('punho-fechado')).toBe('fechado')
    expect(frase.texto()).toBe('fechado')
  })

  it('ignora gesto sem palavra cadastrada sem causar erro', () => {
    const ouvinte = ouvirFrase()
    const frase = criarFrase(config)
    frase.adicionar('mao-aberta')
    ouvinte.mockClear()
    for (const gesto of ['desconhecido', 'sem-palavra', 'sem-campo', '', null, undefined, 42, {}]) {
      expect(() => frase.adicionar(gesto)).not.toThrow()
      expect(frase.adicionar(gesto)).toBeNull()
    }
    expect(frase.texto()).toBe('aberta')
    expect(ouvinte).not.toHaveBeenCalled()
  })

  it('avisa pelo barramento a cada palavra, sem expor a lista interna', () => {
    const ouvinte = ouvirFrase()
    const frase = criarFrase(config)
    frase.adicionar('mao-aberta')
    frase.adicionar('punho-fechado')
    expect(ouvinte.mock.calls).toEqual([
      [{ texto: 'aberta', palavras: ['aberta'] }],
      [{ texto: 'aberta fechado', palavras: ['aberta', 'fechado'] }],
    ])
    ouvinte.mock.calls[1][0].palavras.push('intrusa')
    expect(frase.palavras()).toEqual(['aberta', 'fechado'])
  })

  it('cada frase guarda suas próprias palavras', () => {
    const uma = criarFrase(config), outra = criarFrase(config)
    uma.adicionar('mao-aberta')
    expect(outra.texto()).toBe('')
  })

  it('recusa configuração ausente ou sem lista de gestos', () => {
    for (const invalida of [undefined, null, {}, { gestos: 'mao-aberta' }]) expect(() => criarFrase(invalida)).toThrow(TypeError)
  })

  describe('falar', () => {
    let sintetizador
    beforeEach(() => {
      sintetizador = { getVoices: vi.fn(() => []), speak: vi.fn() }
      vi.stubGlobal('speechSynthesis', sintetizador)
      vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(texto) { this.text = texto } })
    })

    it('fala a frase inteira em pt-BR e não a apaga', () => {
      const frase = criarFrase(config)
      frase.adicionar('mao-aberta')
      frase.adicionar('punho-fechado')
      const fala = frase.falar()
      expect(fala).toMatchObject({ text: 'aberta fechado', lang: 'pt-BR' })
      expect(sintetizador.speak).toHaveBeenCalledExactlyOnceWith(fala)
      expect(frase.texto()).toBe('aberta fechado')
    })

    it('não fala frase vazia', () => {
      expect(criarFrase(config).falar()).toBeNull()
      expect(sintetizador.speak).not.toHaveBeenCalled()
    })

    it('retorna null sem síntese de voz no navegador', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      const frase = criarFrase(config)
      frase.adicionar('mao-aberta')
      expect(frase.falar()).toBeNull()
    })
  })
})
