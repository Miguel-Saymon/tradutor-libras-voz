import { NORMALIZACAO, vetorDaMao } from './normalizacao.js'
import { classificar, vetorValido } from './knn.js'

export const LIMITE_EXEMPLOS = 5000

export function validarConfig(config) {
  if (!config || !['Right', 'Left'].includes(config.mao) || !Array.isArray(config.gestos) || !config.gestos.length) {
    throw new Error('Configuração inválida: informe mao (Right ou Left) e a lista gestos.')
  }
  const ids = new Set()
  const gestos = config.gestos.map(g => {
    if (!g || typeof g.id !== 'string' || !/^[a-z0-9-]+$/.test(g.id) || ids.has(g.id) ||
        ![g.nome, g.palavra, g.instrucao].every(s => typeof s === 'string' && s.trim().length > 0 && s.length <= 200)) {
      throw new Error('Cada gesto precisa de id único, nome, palavra e instrucao válidos.')
    }
    ids.add(g.id)
    return { id: g.id, nome: g.nome, palavra: g.palavra, instrucao: g.instrucao }
  })
  return { mao: config.mao, gestos }
}

export function criarBase(mao = 'Right') {
  return { versao: 1, normalizacao: NORMALIZACAO, mao, exemplos: [] }
}

/** Valida antes de substituir a base e conserva só rótulos, vetores e metadados. */
export function validarBase(dados, config) {
  if (!dados || dados.versao !== 1 || dados.normalizacao !== NORMALIZACAO || dados.mao !== config.mao) {
    throw new Error('Base incompatível: confira versão, normalização e mão configurada.')
  }
  if (!Array.isArray(dados.exemplos) || dados.exemplos.length > LIMITE_EXEMPLOS) {
    throw new Error(`A base deve ter no máximo ${LIMITE_EXEMPLOS} exemplos.`)
  }
  const ids = new Set(config.gestos.map(g => g.id))
  const exemplos = dados.exemplos.map(e => {
    if (!e || !ids.has(e.gesto) || !vetorValido(e.vetor)) {
      throw new Error('Exemplo inválido: use um gesto da configuração e um vetor de 63 números finitos.')
    }
    return { gesto: e.gesto, vetor: [...e.vetor] }
  })
  return { ...criarBase(config.mao), exemplos }
}

export function criarColeta(raiz = document) {
  const el = id => raiz.querySelector(`#${id}`)
  const seletor = el('gesto-coleta'), gravar = el('gravar-exemplo'), importar = el('importar-gestos')
  const exportar = el('exportar-gestos'), modo = el('modo-gestos'), k = el('k-vizinhos')
  const mensagem = el('estado-coleta'), previsto = el('gesto-previsto'), confianca = el('confianca')
  let config = null, base = null, vetor = null, ocupado = true, expiracao = null
  let instanteVetor = 0
  const contadores = new Map()

  function aviso(texto) { mensagem.textContent = texto }
  function atualizarControles() {
    seletor.disabled = ocupado
    importar.disabled = ocupado
    exportar.disabled = ocupado || !base
    gravar.disabled = ocupado || !vetor || modo.value !== 'coleta' || base.exemplos.length >= LIMITE_EXEMPLOS
  }
  function atualizarContadores() {
    for (const [id, contador] of contadores) contador.textContent = String(base.exemplos.filter(e => e.gesto === id).length)
  }
  function mostrarPrevisao(texto) {
    previsto.textContent = texto
    confianca.textContent = '—'
    el('palavra-prevista').textContent = '—'
  }
  function prever() {
    if (ocupado || !base) return
    if (modo.value !== 'teste') { mostrarPrevisao('Selecione Testar para classificar.'); return }
    if (!vetor) { mostrarPrevisao('Mostre a mão configurada para testar.'); return }
    if (!config.gestos.every(g => base.exemplos.some(e => e.gesto === g.id))) {
      mostrarPrevisao('Grave pelo menos um exemplo de cada gesto.'); return
    }
    const valorK = Number(k.value)
    if (!Number.isInteger(valorK) || valorK < 1 || valorK > 99) {
      mostrarPrevisao('Informe k inteiro entre 1 e 99.'); return
    }
    const resultado = classificar(vetor, base.exemplos, valorK)
    const gesto = config.gestos.find(g => g.id === resultado.gesto)
    previsto.textContent = gesto.nome
    confianca.textContent = `${Math.round(resultado.confianca * 100)}% (${resultado.kEfetivo} vizinhos)`
    el('palavra-prevista').textContent = gesto.palavra
  }
  function limpar() {
    clearTimeout(expiracao)
    vetor = null
    el('mao-coleta').textContent = 'Nenhuma mão selecionada.'
    atualizarControles()
    prever()
  }
  function atualizar(resultado) {
    if (!config) return
    clearTimeout(expiracao)
    vetor = vetorDaMao(resultado, config.mao)
    instanteVetor = performance.now()
    el('mao-coleta').textContent = vetor ? 'Mão configurada detectada; exemplo disponível.' : 'Mostre a mão configurada inteira no enquadramento.'
    atualizarControles()
    prever()
    // Não grava um quadro antigo se o vídeo ou a inferência deixarem de avançar.
    if (vetor) expiracao = setTimeout(limpar, 1500)
  }
  function instruir() {
    el('instrucao-gesto').textContent = config?.gestos.find(g => g.id === seletor.value)?.instrucao || ''
  }

  gravar.addEventListener('click', () => {
    if (gravar.disabled || !vetor || performance.now() - instanteVetor > 1500) { limpar(); return }
    base.exemplos.push({ gesto: seletor.value, vetor: [...vetor] })
    atualizarContadores()
    atualizarControles()
    aviso('Exemplo gravado em memória. Varie a posição antes do próximo; exporte para salvar.')
  })
  seletor.addEventListener('change', instruir)
  modo.addEventListener('change', () => {
    el('painel-coleta').hidden = modo.value !== 'coleta'
    el('painel-teste').hidden = modo.value !== 'teste'
    atualizarControles()
    prever()
  })
  k.addEventListener('input', prever)
  exportar.addEventListener('click', () => {
    if (exportar.disabled) return
    const blob = new Blob([JSON.stringify(base, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'gestos.json'
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    aviso('Exportação solicitada. Guarde gestos.json e copie para public/gestos.json para carregar ao abrir o site.')
  })
  importar.addEventListener('change', async () => {
    const arquivo = importar.files[0]
    if (!arquivo || ocupado) return
    ocupado = true
    atualizarControles()
    try {
      if (arquivo.size > 8 * 1024 * 1024) throw new Error('Arquivo muito grande: limite de 8 MB.')
      const nova = validarBase(JSON.parse(await arquivo.text()), config)
      base = nova
      atualizarContadores()
      aviso('Base importada: substituiu os exemplos em memória. O arquivo do site só muda após copiar e publicar.')
    } catch (erro) {
      aviso(`Importação recusada; exemplos anteriores preservados. ${erro.message}`)
    } finally {
      ocupado = false
      importar.value = ''
      atualizarControles()
      prever()
    }
  })

  async function iniciar() {
    atualizarControles()
    try {
      const resposta = await fetch(`${import.meta.env.BASE_URL}gestos-config.json`, { cache: 'no-store' })
      if (!resposta.ok) throw new Error(`gestos-config.json: HTTP ${resposta.status}`)
      config = validarConfig(await resposta.json())
      base = criarBase(config.mao)
      el('mao-configurada').textContent = config.mao === 'Right' ? 'direita' : 'esquerda'
      for (const gesto of config.gestos) {
        const opcao = document.createElement('option')
        opcao.value = gesto.id
        opcao.textContent = `${gesto.nome} → “${gesto.palavra}”`
        seletor.append(opcao)
        const linha = document.createElement('tr'), nome = document.createElement('th'), contador = document.createElement('td')
        nome.scope = 'row'
        nome.textContent = gesto.nome
        contador.textContent = '0'
        linha.append(nome, contador)
        el('contagens-gestos').append(linha)
        contadores.set(gesto.id, contador)
      }
      instruir()
      try {
        const respostaBase = await fetch(`${import.meta.env.BASE_URL}gestos.json`, { cache: 'no-store' })
        if (!respostaBase.ok) throw new Error(`HTTP ${respostaBase.status}`)
        base = validarBase(await respostaBase.json(), config)
        aviso(base.exemplos.length ? 'Base de public/gestos.json carregada. Você pode coletar ou testar.' : 'Base inicial vazia. Grave 30 a 50 exemplos por gesto e exporte antes de fechar.')
      } catch (erro) {
        aviso(`Não foi possível carregar gestos.json (${erro.message}). Iniciamos uma base vazia; você pode importar ou coletar.`)
      }
      ocupado = false
      atualizarContadores()
      atualizarControles()
      prever()
    } catch (erro) {
      aviso(`Não foi possível carregar a configuração. ${erro.message} Corrija public/gestos-config.json e recarregue.`)
    }
  }
  iniciar()
  return { atualizar, limpar }
}
