import { describe, expect, it } from 'vitest'
import { criarBase, validarBase, validarConfig } from './coleta.js'
import configArquivo from '../../public/gestos-config.json'
import baseArquivo from '../../public/gestos.json'

const config = validarConfig(configArquivo)
const amostra = () => ({ gesto: config.gestos[0].id, vetor: Array(63).fill(0) })

describe('arquivos da coleta', () => {
  it('aceita a configuração e os exemplos publicados, preservando todos os vetores', () => {
    expect(config.gestos).toHaveLength(3)
    expect(validarBase(baseArquivo, config)).toEqual(baseArquivo)
  })
  it('exportar e importar JSON preserva vetores, sem compartilhar referências', () => {
    const base = { ...criarBase(), exemplos: [amostra()] }
    const importada = validarBase(JSON.parse(JSON.stringify(base)), config)
    expect(importada).toEqual(base)
    importada.exemplos[0].vetor[0] = 7
    expect(base.exemplos[0].vetor[0]).toBe(0)
  })
  it('descarta campos extras de arquivos importados, inclusive imagens', () => {
    const base = { ...criarBase(), imagem: 'não guardar', exemplos: [{ ...amostra(), foto: 'não guardar' }] }
    expect(validarBase(base, config)).toEqual({ ...criarBase(), exemplos: [amostra()] })
  })
  it('recusa formato, versão, normalização e mão incompatíveis', () => {
    for (const dados of [null, {}, { ...criarBase(), versao: 2 }, { ...criarBase(), mao: 'Left' }, { ...criarBase(), normalizacao: 'outra' }]) {
      expect(() => validarBase(dados, config)).toThrow()
    }
  })
  it('recusa rótulos desconhecidos, tamanho errado e valores não finitos', () => {
    for (const e of [{ ...amostra(), gesto: 'outro' }, { ...amostra(), vetor: [1] }, { ...amostra(), vetor: Array(63).fill(Infinity) }]) {
      expect(() => validarBase({ ...criarBase(), exemplos: [e] }, config)).toThrow()
    }
  })
  it('recusa configurações ambíguas e permite adicionar um gesto sem alterar código', () => {
    expect(() => validarConfig({ ...config, gestos: [config.gestos[0], config.gestos[0]] })).toThrow()
    expect(() => validarConfig({ ...config, mao: 'qualquer' })).toThrow()
    const nova = validarConfig({ ...config, gestos: [...config.gestos, { id: 'novo', nome: 'Novo', palavra: 'nova', instrucao: 'Uma forma nova.' }] })
    expect(validarBase({ ...criarBase(), exemplos: [{ ...amostra(), gesto: 'novo' }] }, nova).exemplos[0].gesto).toBe('novo')
  })
})
