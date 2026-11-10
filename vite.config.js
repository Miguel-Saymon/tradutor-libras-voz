import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    rolldownOptions: {
      input: [
        fileURLToPath(new URL('./index.html', import.meta.url)),
        fileURLToPath(new URL('./src/voz-para-libras/index.html', import.meta.url)),
        fileURLToPath(new URL('./src/libras-para-voz/index.html', import.meta.url)),
      ],
    },
  },
})
