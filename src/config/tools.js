/*
 * ÚNICO lugar para sumar, quitar o reordenar herramientas.
 * El menú lateral, el inicio y las rutas se generan desde acá.
 *
 * SECTIONS: el orden del array es el orden en pantalla.
 *
 * TOOLS: el orden dentro de cada sección es el orden del array.
 *   id          → slug de la URL: /tools/<id>
 *   section     → id de una sección de SECTIONS
 *   name        → nombre visible
 *   description → una línea: qué hace
 *   icon        → nombre de un ícono de la lista en src/components/common/ToolIcon.jsx
 *   y UNA de estas dos:
 *   load        → () => import('../tools/<id>/index.jsx')   herramienta integrada a la app (se descarga al abrirla)
 *   href        → URL de una herramienta que todavía no está integrada: se abre en pestaña nueva
 *
 * Cápsulas (una herramienta que agrupa otras, como Signaframe Studio):
 *   tabs        → en la herramienta que agrupa: el orden de sus pestañas (ids de herramientas;
 *                 `self` es la pantalla propia de la cápsula)
 *   selfTab     → { id, name } de esa pantalla propia (ej. «Probar»)
 *   parent      → en cada herramienta de adentro: el id de la cápsula. No aparece sola en el menú
 *                 ni en el inicio; vive en /tools/<cápsula>/<id> (la URL vieja /tools/<id> redirige).
 *   tab         → nombre corto de su pestaña
 */

export const SECTIONS = [
  { id: 'firma', name: 'Firma y envíos', description: 'Mandar a firmar, envíos masivos y créditos.' },
  { id: 'alta', name: 'Alta de clientes', description: 'Importaciones, usuarios y configuración inicial.' },
  { id: 'signaframe', name: 'Signaframe', description: 'Herramientas para armar y configurar formularios en Signaframe.' },
  { id: 'comunicacion', name: 'Comunicación', description: 'Emails y material para clientes.' },
  { id: 'planificacion', name: 'Planificación y seguimiento', description: 'Planes de proyecto y feedback de producto.' },
];

export const TOOLS = [
  {
    id: 'bulksend',
    section: 'firma',
    name: 'Multi Send',
    description: 'Envío masivo de firmas electrónicas, emails y SMS certificados.',
    icon: 'Send',
    load: () => import('../tools/multi-send/index.jsx'),
  },
  {
    id: 'csv-generator',
    section: 'alta',
    name: 'Generador CSV',
    description: 'Convierte Excel, CSV, JSON o XML al formato de la CLI de IvSign e IvNeos.',
    icon: 'FileSpreadsheet',
    load: () => import('../tools/csv-generator/index.jsx'),
  },
  {
    id: 'signaframe-studio',
    section: 'signaframe',
    name: 'Signaframe Studio',
    description: 'Todo para armar un formulario de Signaframe: la ficha, la plantilla y su JSON, el PDF y la prueba con el motor real.',
    icon: 'FlaskConical',
    load: () => import('../tools/signaframe-studio/index.jsx'),
    tabs: ['ficha-formulario', 'matriz-interna', 'editor-pdf', 'self', 'comparador-json'],
    selfTab: {
      id: 'probar',
      name: 'Probar',
      description: 'Simula el formulario con el motor real de Signaframe: el JSON que sale, el PDF y lo que está mal. Abre los trabajos que arma Claude.',
    },
  },
  {
    id: 'ficha-formulario',
    section: 'signaframe',
    parent: 'signaframe-studio',
    tab: 'Crear formulario',
    name: 'Ficha de formulario',
    description: 'Arma el formulario desde el PDF y el JSON del cliente, cruza la matriz del INS y baja la ficha.',
    icon: 'FileCog',
    load: () => import('../tools/ficha-formulario/index.jsx'),
  },
  {
    id: 'matriz-interna',
    section: 'signaframe',
    parent: 'signaframe-studio',
    tab: 'Plantilla y JSON',
    name: 'Matriz interna',
    description: 'Junta la ficha cerrada con el main de Signaframe: baja la matriz y el JSON del formulario.',
    icon: 'Table2',
    load: () => import('../tools/matriz-interna/index.jsx'),
  },
  {
    id: 'comparador-json',
    section: 'signaframe',
    parent: 'signaframe-studio',
    tab: 'Comparador JSON',
    name: 'Comparador JSON',
    description: 'Dibuja el JSON de entrada y salida de un form-definition y lo compara con el JSON real del cliente.',
    icon: 'FileJson',
    load: () => import('../tools/comparador-json/index.jsx'),
  },
  {
    id: 'editor-pdf',
    section: 'signaframe',
    parent: 'signaframe-studio',
    tab: 'Editor PDF',
    name: 'Editor PDF',
    description: 'Detecta los campos de un PDF y permite renombrarlos, moverlos, cambiarles fuente o tamaño, borrarlos o dibujar nuevos.',
    icon: 'FilePen',
    load: () => import('../tools/editor-pdf/index.jsx'),
  },
  {
    id: 'html-generator',
    section: 'comunicacion',
    name: 'Email Templates',
    description: 'Crea y gestiona templates de email para los brandings de Signaturit.',
    icon: 'Mail',
    load: () => import('../tools/email-templates/index.jsx'),
  },
  {
    id: 'gantt-generator',
    section: 'planificacion',
    name: 'Gantt Generator',
    description: 'Arma el diagrama de Gantt de un plan de proyecto y lo exporta a PNG.',
    icon: 'GanttChart',
    load: () => import('../tools/gantt/index.jsx'),
  },
  {
    id: 'cotizador',
    section: 'planificacion',
    name: 'Cotizador',
    description: 'Lee el ZIP de un formulario y lo cotiza según el contrato: nivel, precio y extras.',
    icon: 'ClipboardList',
    load: () => import('../tools/cotizador/index.jsx'),
  },
];

// En el menú y el inicio: solo las herramientas sueltas y las cápsulas (no lo que vive adentro de una).
export const toolsInSection = (sectionId) => TOOLS.filter((t) => t.section === sectionId && !t.parent);
export const findTool = (id) => TOOLS.find((t) => t.id === id);
export const findSection = (id) => SECTIONS.find((s) => s.id === id);
export const isIntegrated = (tool) => typeof tool.load === 'function';
export const isCapsule = (tool) => Array.isArray(tool?.tabs);

/** Pestañas de una cápsula, en orden: [{ id, name, description, tool, self }]. */
export function capsuleTabs(capsule) {
  return capsule.tabs.map((id) => {
    if (id === 'self') return { ...capsule.selfTab, tool: capsule, self: true };
    const tool = findTool(id);
    return { id, name: tool.tab || tool.name, description: tool.description, tool, self: false };
  });
}
