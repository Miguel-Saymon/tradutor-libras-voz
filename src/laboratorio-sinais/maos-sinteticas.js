/*
 * Mãos e sinais sintéticos, usados SÓ pelos testes (nenhuma página importa este arquivo).
 *
 * Imita o resultado do MediaPipe (landmarks, worldLandmarks e handedness) para os
 * quatro sinais do protótipo, com subida e descida da mão, ruído e variações de
 * velocidade, amplitude e posição. Não é uma descrição linguística dos sinais:
 * só gera movimentos com as mesmas diferenças grosseiras (formato e balanço).
 */

export const SEM_MAO = Object.freeze({ landmarks: [], worldLandmarks: [], handedness: [] })

// Curvatura de cada dedo: [polegar, indicador, médio, anelar, mínimo]; 0 = esticado, 1 = dobrado.
export const FORMATOS = Object.freeze({
  aberta: [0, 0, 0, 0, 0],
  punho: [1, 1, 1, 1, 1],
  indicador: [1, 0, 1, 1, 1],
  o: [0.55, 0.55, 0.55, 0.55, 0.55],
  i: [1, 1, 1, 1, 0],
})

const BASES = [[0.02, -0.025, 0], [0.022, -0.085, 0], [0, -0.09, 0], [-0.02, -0.085, 0], [-0.037, -0.075, 0]]
const SEGMENTOS = [[0.035, 0.03, 0.025], [0.04, 0.025, 0.02], [0.045, 0.027, 0.022], [0.042, 0.026, 0.02], [0.032, 0.02, 0.018]]

const SINAIS = {
  tchau: { duracao: 1200, centro: [0.65, 0.3], quadro: t => ({ curvas: FORMATOS.aberta, dx: 0.05 * Math.sin(2 * Math.PI * 2.5 * t), dy: 0 }) },
  sim: { duracao: 1000, centro: [0.6, 0.45], quadro: t => ({ curvas: FORMATOS.punho, dx: 0, dy: 0.04 * Math.sin(2 * Math.PI * 2 * t) }) },
  nao: { duracao: 1000, centro: [0.6, 0.42], quadro: t => ({ curvas: FORMATOS.indicador, dx: 0.04 * Math.sin(2 * Math.PI * 3 * t), dy: 0 }) },
  oi: {
    duracao: 1000, centro: [0.5, 0.35],
    quadro: (_, progresso) => ({ curvas: misturar(FORMATOS.o, FORMATOS.i, limitar((progresso - 0.3) / 0.4)), dx: 0, dy: 0 }),
  },
}

/** Números pseudoaleatórios repetíveis (mulberry32). */
export function geradorAleatorio(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 21 pontos 3D (metros) de uma mão com as curvaturas pedidas. */
export function maoSintetica(curvas, aleatorio = () => 0.5, ruido = 0.0015) {
  const tremer = () => (aleatorio() - 0.5) * 2 * ruido
  const pontos = [{ x: tremer(), y: tremer(), z: tremer() }]
  curvas.forEach((curva, dedo) => {
    let [x, y, z] = BASES[dedo]
    pontos.push({ x: x + tremer(), y: y + tremer(), z: z + tremer() })
    SEGMENTOS[dedo].forEach((tamanho, junta) => {
      let direcao
      if (dedo === 0) {
        direcao = normalizar(misturar([0.75, -0.65, 0], [-0.55, -0.35, 0.75], curva))
      } else {
        const angulo = curva * 1.5 * (junta + 1)
        direcao = [0, -Math.cos(angulo), Math.sin(angulo)]
      }
      x += direcao[0] * tamanho
      y += direcao[1] * tamanho
      z += direcao[2] * tamanho
      pontos.push({ x: x + tremer(), y: y + tremer(), z: z + tremer() })
    })
  })
  return pontos
}

/** Resultado no formato do MediaPipe para uma mão com o pulso em [x, y] da imagem. */
export function resultadoDaMao(curvas, [x, y], { escala = 0.12, mao = 'Right', aleatorio } = {}) {
  const mundo = maoSintetica(curvas, aleatorio)
  const fator = escala / 0.09
  const imagem = mundo.map(p => ({ x: x + p.x * fator, y: y + p.y * fator, z: p.z }))
  return { landmarks: [imagem], worldLandmarks: [mundo], handedness: [[{ categoryName: mao, score: 0.98 }]] }
}

/**
 * Resultados quadro a quadro de um sinal: a mão sobe, faz o sinal e desce.
 * velocidade > 1 faz o mesmo movimento mais rápido; amplitude multiplica o balanço.
 */
export function gerarSinal(nome, { semente = 1, velocidade = 1, amplitude = 1, deslocamento = [0, 0], escala = 0.12, fps = 30, subida = 250, mao = 'Right' } = {}) {
  const sinal = SINAIS[nome]
  if (!sinal) throw new Error(`Sinal sintético desconhecido: ${nome}`)
  const aleatorio = geradorAleatorio(semente)
  const duracao = sinal.duracao / velocidade
  const passo = 1000 / fps
  const [cx, cy] = [sinal.centro[0] + deslocamento[0], sinal.centro[1] + deslocamento[1]]
  const resultados = []
  for (let ms = 0; ms <= subida * 2 + duracao; ms += passo) {
    let y = cy, dx = 0, dy = 0, curvas
    if (ms < subida) {
      y = 0.95 + (cy - 0.95) * (ms / subida)
      curvas = sinal.quadro(0, 0).curvas
    } else if (ms <= subida + duracao) {
      const desdeInicio = ms - subida
      const quadro = sinal.quadro(desdeInicio * velocidade / 1000, desdeInicio / duracao)
      ;({ curvas } = quadro)
      dx = quadro.dx * amplitude
      dy = quadro.dy * amplitude
    } else {
      y = cy + (0.95 - cy) * ((ms - subida - duracao) / subida)
      curvas = sinal.quadro(sinal.duracao / 1000, 1).curvas
    }
    const tremor = () => (aleatorio() - 0.5) * 0.004
    resultados.push(resultadoDaMao(curvas, [cx + dx + tremor(), y + dy + tremor()], { escala, mao, aleatorio }))
  }
  return resultados
}

/**
 * Uma sessão de câmera: lista de { sinal, opcoes } ou { pausa: ms } (sem mão).
 * Devolve [{ resultado, agora }] com o instante de cada quadro.
 */
export function sessao(itens, fps = 30) {
  const passo = 1000 / fps
  const quadros = []
  let agora = 0
  for (const item of itens) {
    const resultados = item.pausa !== undefined
      ? Array.from({ length: Math.round(item.pausa / passo) }, () => SEM_MAO)
      : gerarSinal(item.sinal, { fps, ...item.opcoes })
    for (const resultado of resultados) {
      quadros.push({ resultado, agora })
      agora += passo
    }
  }
  return quadros
}

function misturar(a, b, t) { return a.map((valor, i) => valor * (1 - t) + b[i] * t) }
function limitar(valor) { return Math.min(1, Math.max(0, valor)) }
function normalizar(v) { const tamanho = Math.hypot(...v); return v.map(c => c / tamanho) }
