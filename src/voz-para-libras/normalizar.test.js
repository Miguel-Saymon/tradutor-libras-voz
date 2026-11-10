import { describe, expect, it } from 'vitest'
import { normalizar } from './normalizar.js'

describe('normalizar', () => {
  it.each([
    ['Bom dia!', 'bom dia'],
    ['  TUDO   BEM?  ', 'tudo bem'],
    ['NÃO, obrigado.', 'não obrigado'],
    ['Olá! Você está bem?', 'olá você está bem'],
    ['bom\ndia\tpara\tvocê', 'bom dia para você'],
    ['“Bom dia”—disse ela…', 'bom dia disse ela'],
    ['oi,tchau', 'oi tchau'],
    ['guarda-chuva', 'guarda chuva'],
    ['NA\u0303O', 'não'],
    ['', ''],
    [' ...!? ', ''],
  ])('normaliza %j para %j', (entrada, esperado) => {
    expect(normalizar(entrada)).toBe(esperado)
  })
})
