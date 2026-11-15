import { describe, expect, it } from 'vitest'
import { paraGlosa, glosaParaTela, glosaParaVLibras } from './glosa.js'

describe('glosa por regras didáticas', () => {
  it.each([
    ['bom dia', 'BOM-DIA', 'BOM DIA'],
    ['oi, tudo bem?', 'OI · TUDO-BEM', 'OI TUDO_BEM [INTERROGAÇÃO]'],
    ['boa tarde', 'BOA-TARDE', 'BOA TARDE'],
    ['boa noite, tchau', 'BOA-NOITE · TCHAU', 'BOA_NOITE TCHAU'],
    ['por favor, obrigado', 'POR-FAVOR · OBRIGADO', 'POR_FAVOR OBRIGADO'],
    ['sim ou não', 'SIM · O-U · NÃO', 'SIM O U NÃO'],
    ['eu gosto de café', 'EU · GOSTAR · CAFÉ', 'EU GOSTAR CAFÉ'],
    ['eu quero um café', 'EU · QUERER · CAFÉ', 'EU QUERER CAFÉ'],
    ['eu vou para a escola', 'EU · IR · ESCOLA', 'EU IR ESCOLA'],
    ['eu sou João', 'EU · J-O-Ã-O', 'EU J O A O'],
    ['você está na escola', 'VOCÊ · ESCOLA', 'VOCÊ ESCOLA'],
    ['Lui\u0301sa e Açaí', 'L-U-Í-S-A · E · A-Ç-A-Í', 'L U I S A E A Ç A I'],
    ['oi 42', 'OI · [sem sinal: 42]', ''],
    ['o a os as um uma', '', ''],
    ['', '', ''],
  ])('%j gera a glosa didática e os tokens do player', (texto, tela, player) => {
    const itens = paraGlosa(texto)
    expect(Array.isArray(itens)).toBe(true)
    expect(glosaParaTela(itens)).toBe(tela)
    expect(glosaParaVLibras(itens)).toBe(player)
  })
})
