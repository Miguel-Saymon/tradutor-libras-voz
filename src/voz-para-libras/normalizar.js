export function normalizar(texto) {
  return texto
    .normalize('NFC')
    .toLocaleLowerCase('pt-BR')
    .replace(/\p{P}+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}
