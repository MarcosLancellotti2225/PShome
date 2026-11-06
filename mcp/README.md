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
| `leer_matriz` | Pasos, subsecciones y campos de la matriz interna (filtra con «buscar») | `signaframe-formdef` |
| `editar_matriz` | Cambia campos de la matriz por id y guarda una versión nueva (…_v2.xlsx); no pisa el original | `signaframe-formdef/matrix-edit` |
| `detectar_campos_pdf` | AcroForms del PDF en orden de lectura | `pdf-detect` |
| `listar_trabajos` | Trabajos guardados | — |

### Signaframe (con token)

| Tool | Qué hace | ¿Cambia algo? |
| --- | --- | --- |
| `signaframe_conexion` | A qué Signaframe está conectado, versión y usuario | No |
| `signaframe_plantillas` | Busca plantillas (con su id) | No |
| `signaframe_traer_plantilla` | Baja el form-def de una plantilla a la carpeta de trabajos, con el Revisor | No |
| `signaframe_subir_formdef` | Reemplaza el form-def de una plantilla | **Sí** · con código |
| `signaframe_publicar` | Publica o despublica una plantilla | **Sí** · con código |
| `signaframe_rellenar_pdf` | El PDF de la plantilla relleno (desde un payload o por casillero) | No |
| `signaframe_procesos` / `signaframe_ver_proceso` | Busca procesos y muestra uno (estado, documentos, firmas, auditoría) | No |
| `signaframe_crear_proceso_prueba` | Crea un proceso con un payload y devuelve el link. **Nunca manda el mail** | **Sí** · con código |
| `signaframe_listas` | Listas predefinidas (catálogos) y sus valores | No |

Lo que cambia algo en Signaframe va en dos pasos: la primera llamada muestra qué va a cambiar y devuelve un código; solo con ese código (y el OK del usuario) se aplica. Además:
- antes de subir un form-def guarda una copia del que había (`<trabajos>/signaframe/…_antes_de_subir.json`);
- no sube si se rompe la regla de oro (ids o `sourceMeta` de los campos del PDF) o si el Revisor da errores, salvo `forzar`;
- no borra nada ni toca usuarios, settings ni el estado de procesos.

La lógica está en `src/lib/signaframe-api` (cliente) y `src/lib/signaframe-formdef/diff.js` (qué cambia y regla de oro).

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
      "env": {
        "SE_TOOLS_TRABAJOS": "/RUTA/A/se-tools-trabajos",
        "SIGNAFRAME_URL": "https://signaframe.namirial.com",
        "SIGNAFRAME_EMAIL": "tu.usuario@namirial.com",
        "SIGNAFRAME_PASSWORD": "tu contraseña"
      }
    }
  }
}
```

Reiniciá Claude Desktop.

Credenciales de Signaframe (solo para las tools `signaframe_*`): `SIGNAFRAME_EMAIL` + `SIGNAFRAME_PASSWORD` (hace login solo y renueva el token cuando vence) o `SIGNAFRAME_TOKEN` (un accessToken; vence y hay que cambiarlo). `SIGNAFRAME_URL` elige el entorno. Quedan solo en ese archivo de tu máquina.

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
