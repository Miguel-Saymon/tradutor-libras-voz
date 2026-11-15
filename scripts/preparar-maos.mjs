// Execute uma vez com internet. O site usa apenas os arquivos locais gerados.
import { cp, mkdir, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const raiz = new URL('../', import.meta.url)
const destino = new URL('public/mediapipe/', raiz)
const modelo = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
await mkdir(destino, { recursive: true })
await cp(new URL('node_modules/@mediapipe/tasks-vision/wasm/', raiz), new URL('wasm/', destino), { recursive: true })
const resposta = await fetch(modelo)
if (!resposta.ok) throw new Error(`Falha ao baixar modelo: HTTP ${resposta.status}`)
const dados = new Uint8Array(await resposta.arrayBuffer())
const hash = createHash('sha256').update(dados).digest('hex')
if (hash !== 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1') {
  throw new Error('O modelo baixado difere da versão validada. Confira a origem antes de substituir o arquivo local.')
}
await writeFile(new URL('hand_landmarker.task.tmp', destino), dados)
await rename(new URL('hand_landmarker.task.tmp', destino), new URL('hand_landmarker.task', destino))
console.log(`Modelo (${dados.byteLength} bytes) e WASM disponíveis em ${fileURLToPath(destino)}`)
