import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarCamera } from './camera.js'

describe('câmera', () => {
  let video, track, fluxo, getUserMedia
  beforeEach(() => {
    video = { play: vi.fn().mockResolvedValue(), pause: vi.fn(), srcObject: null }
    track = { stop: vi.fn(), addEventListener: vi.fn() }
    fluxo = { getTracks: () => [track], getVideoTracks: () => [track] }
    getUserMedia = vi.fn().mockResolvedValue(fluxo)
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('abre sem áudio e libera a câmera ao parar', async () => {
    const camera = criarCamera(video)
    expect(await camera.iniciar()).toBe(true)
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ audio: false, video: { facingMode: 'user' } })
    expect(video.srcObject).toBe(fluxo)
    camera.parar()
    camera.parar()
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(video.srcObject).toBeNull()
  })
  it('descarta permissão concedida depois de parar', async () => {
    let resolver
    getUserMedia.mockReturnValue(new Promise(resolve => { resolver = resolve }))
    const camera = criarCamera(video)
    const inicio = camera.iniciar()
    camera.parar()
    resolver(fluxo)
    expect(await inicio).toBe(false)
    expect(track.stop).toHaveBeenCalledOnce()
    expect(video.play).not.toHaveBeenCalled()
  })
  it('não deixa uma solicitação antiga substituir a câmera nova', async () => {
    let resolver
    const antigo = { getTracks: () => [{ stop: vi.fn() }] }
    getUserMedia.mockReturnValueOnce(new Promise(resolve => { resolver = resolve }))
    const camera = criarCamera(video)
    const inicio = camera.iniciar()
    expect(await camera.iniciar()).toBe(true)
    resolver(antigo)
    expect(await inicio).toBe(false)
    expect(video.srcObject).toBe(fluxo)
    expect(track.stop).not.toHaveBeenCalled()
  })
  it('libera o fluxo se a reprodução falhar', async () => {
    video.play.mockRejectedValue(new Error('falha'))
    await expect(criarCamera(video).iniciar()).rejects.toThrow('falha')
    expect(track.stop).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
  })
  it('avisa quando o dispositivo encerra a captura', async () => {
    const aoEncerrar = vi.fn()
    await criarCamera(video, { aoEncerrar }).iniciar()
    track.addEventListener.mock.calls[0][1]()
    expect(aoEncerrar).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
  })
  it('explica HTTPS antes de solicitar permissão', async () => {
    vi.stubGlobal('isSecureContext', false)
    await expect(criarCamera(video).iniciar()).rejects.toThrow('HTTPS')
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
