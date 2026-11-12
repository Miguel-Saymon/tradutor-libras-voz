import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const simulados = vi.hoisted(() => ({
  criarAvatar: vi.fn(), criarPlanoB: vi.fn(),
}))
vi.mock('./vlibras.js', () => ({ criarAvatar: simulados.criarAvatar }))
vi.mock('./videos.js', () => ({ criarPlanoB: simulados.criarPlanoB }))

let enviar
beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubGlobal('document', { querySelector: () => new EventTarget() })
  vi.stubGlobal('window', new EventTarget())
  const { EVENTOS, emitir } = await import('../comum/contrato.js')
  enviar = texto => emitir(EVENTOS.TEXTO_RECONHECIDO, { texto })
  await import('./avatar.js')
})
afterEach(() => vi.unstubAllGlobals())

it('envia textos finais em ordem para uma única instância do avatar', async () => {
  const sinalizar = vi.fn().mockResolvedValue(undefined)
  simulados.criarAvatar.mockReturnValue({ sinalizar })
  enviar('bom dia')
  enviar('tudo bem')
  enviar('outra frase')
  await vi.waitFor(() => expect(sinalizar.mock.calls.flat()).toEqual(['bom dia', 'tudo bem', 'outra frase']))
  expect(simulados.criarAvatar).toHaveBeenCalledTimes(1)
  expect(simulados.criarPlanoB).not.toHaveBeenCalled()
})

it('transfere a frase que falhou e a fila para os vídeos', async () => {
  const video = vi.fn()
  const fechar = vi.fn()
  simulados.criarAvatar.mockReturnValue({ fechar, sinalizar: vi.fn().mockRejectedValue(new Error('WebGL')) })
  simulados.criarPlanoB.mockReturnValue(video)
  enviar('bom dia')
  enviar('tudo bem')
  await vi.waitFor(() => expect(video.mock.calls.flat()).toEqual(['bom dia', 'tudo bem']))
  expect(fechar).toHaveBeenCalledOnce()
})
