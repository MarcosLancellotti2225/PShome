import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Una sola app: cada herramienta se carga a demanda desde src/tools/<id> (ver src/config/tools.js).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/PShome/',
  build: {
    // El cotizador trae las librerías de Excel, PDF y ZIP (~900 KB): solo se descarga al abrirlo.
    chunkSizeWarningLimit: 1000,
  },
})
