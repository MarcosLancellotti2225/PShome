import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Plugin that appends a build timestamp to local asset references
// in public/tools/ HTML files so browsers always fetch the latest version.
function toolsCacheBust() {
  return {
    name: 'tools-cache-bust',
    closeBundle() {
      const distTools = path.resolve(__dirname, 'dist/tools')
      if (!fs.existsSync(distTools)) return

      const timestamp = Date.now()
      const dirs = fs.readdirSync(distTools, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)

      for (const dir of dirs) {
        const htmlPath = path.join(distTools, dir, 'index.html')
        if (!fs.existsSync(htmlPath)) continue

        let html = fs.readFileSync(htmlPath, 'utf-8')
        // Replace local script src (not URLs starting with http)
        html = html.replace(
          /(<script\s+src=")(?!https?:\/\/)([^"?]+)(\?[^"]*)?(")/g,
          `$1$2?v=${timestamp}$4`
        )
        // Replace local stylesheet href
        html = html.replace(
          /(<link\s+rel="stylesheet"\s+href=")(?!https?:\/\/)([^"?]+)(\?[^"]*)?(")/g,
          `$1$2?v=${timestamp}$4`
        )
        fs.writeFileSync(htmlPath, html)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), toolsCacheBust()],
  base: '/PShome/',
})
