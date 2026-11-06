# MCP de SE Tools

Le da a Claude las mismas herramientas que la app, usando el mismo código de `src/lib`.
Corre en tu máquina con Node: no hay servidor ni se sube nada.

## Tools

| Tool | Qué hace | Lógica |
| --- | --- | --- |
| `simular_formulario` | form-def + payload → JSON que se enviaría, valor de cada AcroForm, diagnósticos y Revisor. Guarda un trabajo. | `signaframe-engine`, `json-mapper/revisor` |
| `revisar_formdef` | Las 26 reglas del Revisor + cobertura contra un ejemplo | `json-mapper/revisor` |
| `comparar_json` | JSON del form-def vs. JSON real del cliente (faltan / sobran / forma) | `json-mapper` |
| `armar_json_formulario` | Matriz interna (.xlsx) + main → JSON del formulario (form-def) listo para subir, con el resumen y el Revisor. Lo guarda al lado de la matriz. | `signaframe-formdef` |
| `detectar_campos_pdf` | AcroForms del PDF en orden de lectura | `pdf-detect` |
| `listar_trabajos` | Trabajos guardados | — |

Los archivos se pasan por ruta (`~/Descargas/form-def.json`) o pegando el JSON.

## Instalar

```bash
git clone https://github.com/MarcosLancellotti2225/PShome.git
cd PShome && npm install
```

### Claude Desktop

En `claude_desktop_config.json` (Configuración → Desarrollador → Editar config):

```json
{
  "mcpServers": {
    "se-tools": {
      "command": "node",
      "args": ["/RUTA/A/PShome/mcp/server.mjs"],
      "env": { "SE_TOOLS_TRABAJOS": "/RUTA/A/se-tools-trabajos" }
    }
  }
}
```

Reiniciá Claude Desktop.

### Claude Code

```bash
claude mcp add se-tools -- node /RUTA/A/PShome/mcp/server.mjs
```

## Trabajos

`simular_formulario` guarda un `.json` en `SE_TOOLS_TRABAJOS` (por defecto `~/se-tools-trabajos`).
Se abre en **SE Tools → Signaframe → Signaframe Studio → Abrir trabajo**: formulario editable,
JSON que sale, PDF y diagnóstico. El trabajo tiene los datos del payload: queda solo en tu máquina.

## Probar sin Claude

```bash
npx @modelcontextprotocol/inspector node mcp/server.mjs
```
