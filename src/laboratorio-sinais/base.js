import { NORMALIZACAO } from '../libras-para-voz/normalizacao.js'
import { quadroValido, TAMANHO_QUADRO } from './quadro.js'

/*
 * Configuração e base de exemplos dos sinais com movimento.
 *
 * public/sinais-config.json  { mao, sinais: [{ id, nome, palavra, instrucao, video? }] }
 *   video é o nome de um MP4 de public/sinais/ mostrado como referência na coleta.
 *   A lista também serve para criarFrase({ gestos: config.sinais }) (frase.js).
 * public/sinais-exemplos.json  { versao, formato, mao, exemplos: [{ sinal, quadros }] }
 *   Cada quadro tem os 66 números de quadroDaMao(). Só números: nunca imagens.
 *
 * Funções
 *   validarConfigSinais(config) → cópia validada (erro se algo estiver errado).
 *   criarBaseSinais(mao?) → base vazia.
 *   validarBaseSinais(dados, config) → cópia validada só com os campos conhecidos.
 *   paraExportar(base) → cópia com números arredondados (arquivo menor).
 */

export const VERSAO_BASE = 1
export const FORMATO_QUADROS = `${NORMALIZACAO}+pulso-imagem-xy-escala-v1`
export const LIMITE_EXEMPLOS = 400
export const LIMITE_QUADROS = 300

export function validarConfigSinais(config) {
  if (!config || !['Right', 'Left'].includes(config.mao) || !Array.isArray(config.sinais) || !config.sinais.length) {
    throw new Error('Configuração inválida: informe mao (Right ou Left) e a lista sinais.')
  }
  const ids = new Set()
  const sinais = config.sinais.map(s => {
    const textosValidos = [s?.nome, s?.palavra, s?.instrucao].every(t => typeof t === 'string' && t.trim() && t.length <= 200)
    const videoValido = s?.video === undefined || (typeof s.video === 'string' && /^[^/\\]{1,100}\.mp4$/.test(s.video))
    if (!s || typeof s.id !== 'string' || !/^[a-z0-9-]+$/.test(s.id) || ids.has(s.id) || !textosValidos || !videoValido) {
      throw new Error('Cada sinal precisa de id único, nome, palavra e instrucao válidos (video é opcional).')
    }
    ids.add(s.id)
    const sinal = { id: s.id, nome: s.nome, palavra: s.palavra, instrucao: s.instrucao }
    if (s.video) sinal.video = s.video
    return sinal
  })
  return { mao: config.mao, sinais }
}

export function criarBaseSinais(mao = 'Right') {
  return { versao: VERSAO_BASE, formato: FORMATO_QUADROS, mao, exemplos: [] }
}

export function validarBaseSinais(dados, config) {
  if (!dados || dados.versao !== VERSAO_BASE || dados.formato !== FORMATO_QUADROS || dados.mao !== config.mao) {
    throw new Error('Base incompatível: confira versão, formato dos quadros e mão configurada.')
  }
  if (!Array.isArray(dados.exemplos) || dados.exemplos.length > LIMITE_EXEMPLOS) {
    throw new Error(`A base deve ter no máximo ${LIMITE_EXEMPLOS} exemplos.`)
  }
  const ids = new Set(config.sinais.map(s => s.id))
  const exemplos = dados.exemplos.map(e => {
    if (!e || !ids.has(e.sinal) || !Array.isArray(e.quadros) || e.quadros.length < 2 ||
        e.quadros.length > LIMITE_QUADROS || !e.quadros.every(quadroValido)) {
      throw new Error(`Exemplo inválido: use um sinal da configuração e de 2 a ${LIMITE_QUADROS} quadros de ${TAMANHO_QUADRO} números.`)
    }
    return { sinal: e.sinal, quadros: e.quadros.map(q => [...q]) }
  })
  return { ...criarBaseSinais(config.mao), exemplos }
}

export function paraExportar(base) {
  const arredondar = valor => Math.round(valor * 1e5) / 1e5
  return { ...base, exemplos: base.exemplos.map(e => ({ sinal: e.sinal, quadros: e.quadros.map(q => q.map(arredondar)) })) }
}
