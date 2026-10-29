import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

// El hub (index.html) + cada app construida en apps/<id>/index.html.
// Las carpetas que empiezan con "_" (apps/_lib) son código compartido, no apps.
const appsDir = resolve(root, 'apps')
const apps = existsSync(appsDir)
  ? Object.fromEntries(
      readdirSync(appsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(resolve(appsDir, d.name, 'index.html')))
        .map((d) => [`apps/${d.name}`, resolve(appsDir, d.name, 'index.html')]),
    )
  : {}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/PShome/',
  build: {
    // El cotizador incluye las librerías de Excel, PDF y ZIP: solo se descarga al abrirlo.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: { main: resolve(root, 'index.html'), ...apps },
    },
  },
})
