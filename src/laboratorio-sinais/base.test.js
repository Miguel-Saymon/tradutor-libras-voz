import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import configArquivo from '../../public/sinais-config.json'
import baseArquivo from '../../public/sinais-exemplos.json'
import { criarBaseSinais, FORMATO_QUADROS, LIMITE_QUADROS, paraExportar, validarBaseSinais, validarConfigSinais } from './base.js'
import { avaliarBase, prepararModelos } from './classificador.js'
import { gerarSinal } from './maos-sinteticas.js'
import { quadroDaMao } from './quadro.js'

const config = validarConfigSinais(configArquivo)
const exemplo = (sinal = 'tchau') => ({ sinal, quadros: gerarSinal(sinal).map(r => quadroDaMao(r)) })

describe('configuração dos sinais', () => {
  it('aceita o arquivo publicado, com os quatro sinais e vídeos que existem', () => {
    expect(config.mao).toBe('Right')
    expect(config.sinais.map(s => s.id)).toEqual(['oi', 'tchau', 'sim', 'nao'])
    for (const sinal of config.sinais) {
      expect(existsSync(new URL(`../../public/sinais/${sinal.video}`, import.meta.url))).toBe(true)
    }
  })

  it('recusa configurações ambíguas ou com caminho de vídeo', () => {
    const [primeiro] = configArquivo.sinais
    for (const invalida of [
      null, {}, { ...configArquivo, mao: 'qualquer' }, { ...configArquivo, sinais: [] },
      { ...configArquivo, sinais: [primeiro, primeiro] },
      { ...configArquivo, sinais: [{ ...primeiro, id: 'Com Espaço' }] },
      { ...configArquivo, sinais: [{ ...primeiro, palavra: ' ' }] },
      { ...configArquivo, sinais: [{ ...primeiro, video: '../segredo.mp4' }] },
      { ...configArquivo, sinais: [{ ...primeiro, video: 'video.webm' }] },
    ]) expect(() => validarConfigSinais(invalida)).toThrow()
    const semVideo = { ...primeiro }
    delete semVideo.video
    expect(validarConfigSinais({ ...configArquivo, sinais: [semVideo] }).sinais[0]).not.toHaveProperty('video')
  })
})

describe('base de exemplos dos sinais', () => {
  it('aceita o arquivo publicado, preservando todos os quadros', () => {
    expect(validarBaseSinais(baseArquivo, config)).toEqual(baseArquivo)
    expect(baseArquivo.formato).toBe(FORMATO_QUADROS)
  })

  it('os exemplos reais publicados se reconhecem entre si (deixando cada um de fora)', () => {
    const { acertos, total, porSinal } = avaliarBase(prepararModelos(baseArquivo.exemplos))
    expect(total).toBe(baseArquivo.exemplos.length)
    // Coleta de 27/11/2026: 99 de 100. Se cair, alguma mudança piorou o reconhecimento.
    expect(acertos / total).toBeGreaterThanOrEqual(0.95)
    for (const sinal of config.sinais) expect(porSinal[sinal.id]?.total ?? 0).toBeGreaterThan(0)
  })

  it('exportar e importar preserva os quadros, sem compartilhar referências', () => {
    const base = { ...criarBaseSinais(), exemplos: [exemplo('tchau'), exemplo('oi')] }
    const importada = validarBaseSinais(JSON.parse(JSON.stringify(paraExportar(base))), config)
    expect(importada.exemplos.map(e => e.sinal)).toEqual(['tchau', 'oi'])
    importada.exemplos.forEach((e, i) => e.quadros.forEach((q, j) => q.forEach((valor, d) => {
      expect(valor).toBeCloseTo(base.exemplos[i].quadros[j][d], 4)
    })))
    importada.exemplos[0].quadros[0][0] = 99
    expect(base.exemplos[0].quadros[0][0]).not.toBe(99)
  })

  it('descarta campos extras', () => {
    const base = { ...criarBaseSinais(), video: 'não guardar', exemplos: [{ ...exemplo(), imagem: 'não guardar' }] }
    const validada = validarBaseSinais(base, config)
    expect(validada).not.toHaveProperty('video')
    expect(validada.exemplos[0]).not.toHaveProperty('imagem')
  })

  it('recusa formato, versão, mão, sinais e quadros incompatíveis', () => {
    const bom = exemplo()
    for (const dados of [null, {}, { ...criarBaseSinais(), versao: 2 }, { ...criarBaseSinais(), formato: 'outro' },
      { ...criarBaseSinais(), mao: 'Left' }, { ...criarBaseSinais(), exemplos: 'nada' }]) {
      expect(() => validarBaseSinais(dados, config)).toThrow()
    }
    for (const e of [{ ...bom, sinal: 'obrigado' }, { ...bom, quadros: bom.quadros.slice(0, 1) },
      { ...bom, quadros: Array(LIMITE_QUADROS + 1).fill(bom.quadros[0]) }, { ...bom, quadros: [...bom.quadros, [1, 2, 3]] }]) {
      expect(() => validarBaseSinais({ ...criarBaseSinais(), exemplos: [e] }, config)).toThrow()
    }
  })
})
