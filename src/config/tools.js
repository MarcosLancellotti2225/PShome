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
 */

const legacy = (path) => `${import.meta.env.BASE_URL}${path}`;

export const SECTIONS = [
  { id: 'firma', name: 'Firma y envíos', description: 'Mandar a firmar, envíos masivos y créditos.' },
  { id: 'alta', name: 'Alta de clientes', description: 'Importaciones, usuarios y configuración inicial.' },
  { id: 'signaframe', name: 'Signaframe', description: 'Herramientas para armar y configurar formularios en Signaframe.' },
  { id: 'formularios', name: 'Formularios', description: 'Convertir y armar formularios digitales.' },
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
    href: 'https://marcoslancellotti2225.github.io/bulksend/', // pendiente de integrar
  },
  {
    id: 'csv-generator',
    section: 'alta',
    name: 'Generador CSV',
    description: 'Convierte Excel, CSV, JSON o XML al formato de la CLI de IvSign e IvNeos.',
    icon: 'FileSpreadsheet',
    href: 'https://marcoslancellotti2225.github.io/toolsImport/', // pendiente de integrar
  },
  {
    id: 'ficha-formulario',
    section: 'signaframe',
    name: 'Ficha de formulario',
    description: 'Arma el formulario desde el PDF y el JSON del cliente, cruza la matriz del INS y baja la ficha.',
    icon: 'FileCog',
    href: legacy('apps/ficha-formulario/'), // pendiente de integrar (código en public/apps/ficha-formulario)
  },
  {
    id: 'matriz-interna',
    section: 'signaframe',
    name: 'Matriz interna',
    description: 'Junta la ficha cerrada con los campos de Signaframe y baja la matriz para el form-def.',
    icon: 'Table2',
    href: legacy('apps/ficha-formulario/interno.html'), // pendiente de integrar
  },
  {
    id: 'comparador-json',
    section: 'signaframe',
    name: 'Comparador JSON',
    description: 'Dibuja el JSON de entrada y salida de un form-definition y lo compara con el JSON real del cliente.',
    icon: 'FileJson',
    load: () => import('../tools/comparador-json/index.jsx'),
  },
  {
    id: 'html-generator',
    section: 'comunicacion',
    name: 'Email Templates',
    description: 'Crea y gestiona templates de email para los brandings de Signaturit.',
    icon: 'Mail',
    href: 'https://marcoslancellotti2225.github.io/HTMLgenerator/', // pendiente de integrar
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
    description: 'Lee un ZIP con los insumos de un formulario y calcula su complejidad: Baja, Media o Alta.',
    icon: 'ClipboardList',
    load: () => import('../tools/cotizador/index.jsx'),
  },
];

export const toolsInSection = (sectionId) => TOOLS.filter((t) => t.section === sectionId);
export const findTool = (id) => TOOLS.find((t) => t.id === id);
export const findSection = (id) => SECTIONS.find((s) => s.id === id);
export const isIntegrated = (tool) => typeof tool.load === 'function';
