import { DrawingUtils, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

/** Carrega o modelo local; uma instância por sessão, liberada ao parar. */
export async function criarRastreador(video, canvas, { aoMedir = () => {}, aoErro = () => {}, aoResultado = () => {} } = {}) {
  const base = `${import.meta.env.BASE_URL}mediapipe/`
  const arquivos = await FilesetResolver.forVisionTasks(`${base}wasm`)
  const opcoes = {
    baseOptions: { modelAssetPath: `${base}hand_landmarker.task`, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  }
  let detector
  try {
    detector = await HandLandmarker.createFromOptions(arquivos, opcoes)
  } catch {
    // Alguns aparelhos não oferecem um contexto WebGL compatível.
    detector = await HandLandmarker.createFromOptions(arquivos, {
      ...opcoes, baseOptions: { ...opcoes.baseOptions, delegate: 'CPU' },
    })
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) { detector.close(); throw new Error('Canvas indisponível neste navegador.') }
  const desenho = new DrawingUtils(ctx)
  let quadro = null
  let fechado = false
  let ultimoTempoVideo = -1
  let inicioMedicao = performance.now()
  let quadros = 0
  let totalMaos = 0

  function parar() {
    if (fechado) return
    fechado = true
    cancelAnimationFrame(quadro)
    detector.close()
    desenho.close()
    // Uma carga cancelada antes de iniciar não deve limpar uma sessão mais nova.
    if (quadro !== null) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      aoMedir({ fps: 0, maos: 0 })
    }
  }

  function processar() {
    if (fechado) return
    try {
      const agora = performance.now()
      if (video.readyState >= 2 && video.videoWidth && video.currentTime !== ultimoTempoVideo) {
        ultimoTempoVideo = video.currentTime
        // O canvas mantém a proporção real da câmera; CSS espelha ambos uma vez.
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        const resultado = detector.detectForVideo(video, agora)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        for (const pontos of resultado.landmarks) {
          desenho.drawConnectors(pontos, HandLandmarker.HAND_CONNECTIONS, { color: '#00ffb3', lineWidth: 3 })
          desenho.drawLandmarks(pontos, { color: '#ffffff', fillColor: '#c02635', radius: 4, lineWidth: 1 })
        }
        totalMaos = resultado.landmarks.length
        // Compartilha apenas pontos; câmera, inferência e desenho continuam aqui.
        aoResultado(resultado)
        quadros += 1
      }
      // FPS de inferência, não a frequência de atualização da tela.
      if (agora - inicioMedicao >= 1000) {
        aoMedir({ fps: Math.round(quadros * 1000 / (agora - inicioMedicao)), maos: totalMaos })
        inicioMedicao = agora
        quadros = 0
      }
      quadro = requestAnimationFrame(processar)
    } catch (erro) {
      parar()
      aoErro(erro)
    }
  }

  return { iniciar() { if (!fechado && quadro === null) quadro = requestAnimationFrame(processar) }, parar }
}
