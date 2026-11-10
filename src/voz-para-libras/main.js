import { EVENTOS, emitir } from '../comum/contrato.js'
import { normalizar } from './normalizar.js'
import { criarReconhecimento } from './reconhecimento.js'

const botaoFalar = document.querySelector('#falar')
const parcial = document.querySelector('#parcial')
const final = document.querySelector('#final')
const status = document.querySelector('#status')
const campo = document.querySelector('#frase')
let estado = 'parado'

const mensagensErro = {
  'contexto-inseguro': 'Abra o site por HTTPS. No computador também é permitido usar localhost. No celular, HTTP pelo IP da rede não habilita o microfone.',
  'not-allowed': 'O navegador bloqueou a fala. Confira a permissão de microfone deste site e a permissão do navegador nas configurações do sistema.',
  NotAllowedError: 'O acesso foi bloqueado. Confira as permissões de microfone do site e do navegador no sistema.',
  SecurityError: 'O navegador bloqueou o reconhecimento por segurança. Abra a página diretamente em HTTPS ou localhost.',
  'service-not-allowed': 'O serviço de reconhecimento está indisponível ou bloqueado neste navegador. Teste a mesma página em outro navegador com suporte a reconhecimento de fala.',
  'audio-capture': 'Falha ao acessar o microfone. Confira o dispositivo de entrada do sistema e feche aplicativos que possam estar usando o microfone.',
  'network': 'Falha de conexão com o serviço de reconhecimento. Confira a internet e possíveis bloqueios de rede ou VPN.',
  'no-speech': 'Nenhuma fala foi detectada. Confira o microfone selecionado e tente dizer uma frase perto dele.',
  'language-not-supported': 'O serviço deste navegador não oferece reconhecimento em pt-BR.',
  aborted: 'A captura foi interrompida. Toque em Falar para tentar novamente.',
  'inicio-expirado': 'O navegador não iniciou a captura em 20 segundos. Confira se há uma solicitação de permissão pendente e tente novamente.',
  'fim-expirado': 'O navegador não concluiu a captura. Ela foi cancelada e você pode tentar novamente.',
}

// Microfone, formulário e atalhos passam por este mesmo ponto.
function apresentarFinal(texto) {
  const normalizado = normalizar(texto)
  if (!normalizado) return
  parcial.textContent = ''
  final.textContent = normalizado
  emitir(EVENTOS.TEXTO_RECONHECIDO, { texto: normalizado })
}

const reconhecimento = criarReconhecimento({
  aoParcial: (texto) => { parcial.textContent = texto },
  aoFinal: apresentarFinal,
  aoEstado: (novoEstado) => {
    estado = novoEstado
    const rotulos = { parado: 'Falar', iniciando: 'Cancelar', ouvindo: 'Parar', parando: 'Cancelar' }
    botaoFalar.textContent = rotulos[estado]
    botaoFalar.disabled = false
    botaoFalar.setAttribute('aria-pressed', String(estado !== 'parado'))
    if (estado === 'ouvindo') status.textContent = 'Ouvindo. Diga uma frase curta.'
    if (estado === 'parando') status.textContent = 'Finalizando a captura…'
    if (estado === 'parado') {
      status.textContent = 'Captura encerrada. Você pode falar novamente.'
    }
  },
  aoErro: (codigo) => {
    const mensagem = mensagensErro[codigo] || 'Não foi possível iniciar ou concluir o reconhecimento. Tente novamente ou digite a frase.'
    status.textContent = mensagem + ' Código: ' + codigo + '.'
  },
})

const avisoMicrofone = globalThis.isSecureContext === false
  ? mensagensErro['contexto-inseguro']
  : !reconhecimento && 'Reconhecimento de voz indisponível. Abra a página diretamente no Chrome ou use o campo de texto.'
if (avisoMicrofone) {
  botaoFalar.disabled = true
  status.textContent = avisoMicrofone
}

botaoFalar.addEventListener('click', () => {
  if (avisoMicrofone) return
  if (estado === 'iniciando' || estado === 'parando') {
    reconhecimento.cancelar()
    return
  }
  if (estado !== 'parado') {
    reconhecimento.parar()
    return
  }
  parcial.textContent = ''
  status.textContent = 'Iniciando o microfone…'
  reconhecimento.iniciar()
})

function enviarManual(texto) {
  if (!normalizar(texto)) {
    status.textContent = 'Digite uma frase antes de enviar.'
    return
  }
  reconhecimento?.cancelar()
  apresentarFinal(texto)
  status.textContent = avisoMicrofone || 'Frase recebida.'
}

document.querySelector('#formulario').addEventListener('submit', (evento) => {
  evento.preventDefault()
  enviarManual(campo.value)
})

document.querySelectorAll('[data-frase]').forEach((botao) => {
  botao.addEventListener('click', () => enviarManual(botao.dataset.frase))
})

window.addEventListener('pagehide', () => reconhecimento?.cancelar())
