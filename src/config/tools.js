/*
 * ÚNICO lugar para sumar, quitar o reordenar herramientas.
 * El menú lateral, el home y las rutas se generan desde acá.
 *
 * SECTIONS: el orden del array es el orden en pantalla.
 *
 * TOOLS: el orden dentro de cada sección es el orden del array.
 *   id          → slug de la URL: /tools/<id>
 *   section     → id de una sección de SECTIONS
 *   name        → nombre visible
 *   description → una línea: qué hace
 *   icon        → nombre de un ícono de la lista en src/components/common/ToolIcon.jsx
 *   src         → de dónde se carga la herramienta:
 *                   - migrada al repo:  local('<id>')  → apps/<id>/ (con build) o public/apps/<id>/ (estática)
 *                   - todavía afuera:   'https://…'    → repo viejo (pendiente de migrar)
 */

const local = (id) => `${import.meta.env.BASE_URL}apps/${id}/`;

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
    src: 'https://marcoslancellotti2225.github.io/bulksend/', // pendiente de migrar
  },
  {
    id: 'csv-generator',
    section: 'alta',
    name: 'Generador CSV',
    description: 'Convierte Excel, CSV, JSON o XML al formato de la CLI de IvSign e IvNeos.',
    icon: 'FileSpreadsheet',
    src: 'https://marcoslancellotti2225.github.io/toolsImport/', // pendiente de migrar
  },
  {
    id: 'ficha-formulario',
    section: 'signaframe',
    name: 'Ficha de formulario',
    description: 'Arma el formulario desde el PDF y el JSON del cliente, cruza la matriz del INS y baja la ficha.',
    icon: 'FileCog',
    src: local('ficha-formulario'),
  },
  {
    id: 'matriz-interna',
    section: 'signaframe',
    name: 'Matriz interna',
    description: 'Junta la ficha cerrada con los campos de Signaframe y baja la matriz para el form-def.',
    icon: 'Table2',
    src: `${local('ficha-formulario')}interno.html`,
  },
  {
    id: 'comparador-json',
    section: 'signaframe',
    name: 'Comparador JSON',
    description: 'Dibuja el JSON de entrada y salida de un form-definition y lo compara con el JSON real del cliente.',
    icon: 'FileJson',
    src: local('comparador-json'),
  },
  {
    id: 'html-generator',
    section: 'comunicacion',
    name: 'Email Templates',
    description: 'Crea y gestiona templates de email para los brandings de Signaturit.',
    icon: 'Mail',
    src: 'https://marcoslancellotti2225.github.io/HTMLgenerator/', // pendiente de migrar
  },
  {
    id: 'gantt-generator',
    section: 'planificacion',
    name: 'Gantt Generator',
    description: 'Genera diagramas de Gantt para planes de proyecto y los exporta a PNG.',
    icon: 'GanttChart',
    src: 'https://marcoslancellotti2225.github.io/GranttGenerator/', // pendiente de migrar
  },
  {
    id: 'cotizador',
    section: 'planificacion',
    name: 'Cotizador',
    description: 'Lee un ZIP con los insumos de un formulario y calcula su complejidad: Baja, Media o Alta.',
    icon: 'ClipboardList',
    src: local('cotizador'),
  },
];

export const toolsInSection = (sectionId) => TOOLS.filter((t) => t.section === sectionId);
export const findTool = (id) => TOOLS.find((t) => t.id === id);
export const findSection = (id) => SECTIONS.find((s) => s.id === id);
export { local };
