import { normalizar } from './normalizar.js'

// Regras didáticas do demo. Expressão facial e uso do espaço não são representados.
const omitir = new Set((
  'o a os as um uma ser estar sou és é somos sois são era eras éramos eram ' +
  'estou estás está estamos estais estão estava estavas estávamos estavam ' +
  'fui foste foi fomos foram será serão seria seriam seja sejam esteja estejam sendo estando ' +
  'estive esteve estivemos estiveram estará estarão estaria estariam ' +
  'de do da dos das em no na nos nas num numa ao aos à às para por pelo pela pelos pelas ' +
  'ante após até com contra desde entre perante sem sob sobre trás'
).split(' '))

const infinitivos = new Map([['gosto', 'gostar'], ['quero', 'querer'], ['vou', 'ir']])
const conhecidos = new Set('oi obrigado tchau sim não eu você gostar querer ir café escola'.split(' '))

// A chave didática conserva a expressão inteira. O valor usa os tokens do VLibras BR.
const expressoes = new Map([
  ['BOM-DIA', 'BOM DIA'],
  ['BOA-TARDE', 'BOA TARDE'],
  ['BOA-NOITE', 'BOA_NOITE'],
  ['TUDO-BEM', 'TUDO_BEM [INTERROGAÇÃO]'],
  ['POR-FAVOR', 'POR_FAVOR'],
])

function letraDoPlayer(letra) {
  return letra === 'Ç' ? letra : letra.normalize('NFD').replace(/\p{M}/gu, '')
}

export function paraGlosa(texto) {
  if (typeof texto !== 'string') return []
  const palavras = normalizar(texto).split(' ').filter(Boolean)
  const itens = []

  for (let i = 0; i < palavras.length; i++) {
    const palavra = palavras[i]
    // Verifica a expressão antes de remover palavras como "por".
    const expressao = palavras.slice(i, i + 2).join('-').toUpperCase()
    if (expressoes.has(expressao)) {
      itens.push({ tipo: 'sinal', valor: expressao })
      i++
      continue
    }
    if (omitir.has(palavra)) continue

    const lema = infinitivos.get(palavra) || palavra
    if (conhecidos.has(lema)) {
      itens.push({ tipo: 'sinal', valor: lema.toUpperCase() })
    } else {
      const letras = Array.from(palavra.toUpperCase())
      if (letras.every(letra => /^[A-ZÇ]$/u.test(letraDoPlayer(letra)))) {
        itens.push({ tipo: 'soletracao', letras })
      } else {
        itens.push({ tipo: 'sem-sinal', valor: palavra })
      }
    }
  }
  return itens
}

export function glosaParaTela(itens) {
  return itens.map(item => {
    if (item.tipo === 'soletracao') return item.letras.join('-')
    if (item.tipo === 'sem-sinal') return '[sem sinal: ' + item.valor + ']'
    return item.valor
  }).join(' · ')
}

export function glosaParaVLibras(itens) {
  // Evita apresentar como completa uma frase que contém um trecho irrepresentável.
  if (itens.some(item => item.tipo === 'sem-sinal')) return ''
  return itens.map(item => {
    if (item.tipo === 'soletracao') return item.letras.map(letraDoPlayer).join(' ')
    return expressoes.get(item.valor) || item.valor
  }).join(' ')
}
