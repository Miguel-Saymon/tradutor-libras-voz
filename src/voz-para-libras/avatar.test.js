import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let enviar
let area
let legenda
let repetir

beforeEach(async () => {
  vi.resetModules()
  area = { replaceChildren(video) { this.video = video } }
  legenda = {}
  repetir = new EventTarget()
  const elementos = { '#video-sinal': area, '#legenda-sinal': legenda, '#repetir-sinal': repetir }
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', {
    querySelector: (seletor) => elementos[seletor],
    createElement: () => ({ setAttribute: vi.fn(), play: vi.fn().mockResolvedValue(), pause: vi.fn() }),
  })
  const { criarPlanoB } = await import('./videos.js')
  enviar = criarPlanoB()
})

afterEach(() => vi.unstubAllGlobals())

it('encaminha dez pares consecutivos ao arquivo correto, sem perder repetições', () => {
  for (let i = 0; i < 10; i++) {
    enviar('Bom dia!')
    enviar('Tudo bem?')
  }
  for (let i = 0; i < 10; i++) {
    for (const arquivo of ['bom-dia.mp4', 'tudo-bem.mp4']) {
      const video = area.video
      expect(video.src).toBe(import.meta.env.BASE_URL + 'sinais/' + arquivo)
      expect(video.play).toHaveBeenCalledOnce()
      video.onended()
    }
  }
  expect(repetir.disabled).toBe(false)
})

it('repete a sequência inteira e avança só quando o vídeo termina', () => {
  enviar('Bom dia, tudo bem?')
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    expect(area.video.src).toMatch(/bom-dia\.mp4$/)
    area.video.onended()
    expect(area.video.src).toMatch(/tudo-bem\.mp4$/)
    area.video.onended()
    if (tentativa === 0) repetir.dispatchEvent(new Event('click'))
  }
})

it('avisa sobre frase desconhecida sem exibir tradução parcial', () => {
  enviar('bom dia Maria')
  expect(legenda.textContent).toBe('sinal ainda não disponível')
  expect(area.video).toBeUndefined()
})

it('avisa se o MP4 falha e aceita nova tentativa, ignorando eventos antigos', () => {
  enviar('bom dia')
  const anterior = area.video
  anterior.onerror()
  expect(legenda.textContent).toContain('bom-dia.mp4')
  expect(repetir.disabled).toBe(true)
  enviar('tudo bem')
  anterior.onended()
  anterior.onerror()
  expect(area.video.src).toMatch(/tudo-bem\.mp4$/)
})
