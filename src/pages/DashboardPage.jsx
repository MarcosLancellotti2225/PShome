import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Send,
  Code,
  GanttChart,
  ExternalLink,
  Shield,
  PenTool,
  Mail,
  MessageSquare,
  KeyRound,
  FileCheck,
  Building2,
} from 'lucide-react';
import './DashboardPage.css';

const productFamilies = [
  {
    name: 'Ivnosys',
    color: '#3b82f6',
    icon: Building2,
    products: [
      { name: 'IvSign', description: 'Firma electr\u00f3nica avanzada y cualificada', icon: PenTool },
      { name: 'IvNeos', description: 'Comunicaciones electr\u00f3nicas certificadas', icon: Mail },
      { name: 'IvCert', description: 'Certificados digitales y gesti\u00f3n de identidad', icon: KeyRound },
    ],
  },
  {
    name: 'Signaturit',
    color: '#00b4b6',
    icon: FileCheck,
    products: [
      { name: 'Firma electr\u00f3nica', description: 'Firma electr\u00f3nica simple y avanzada', icon: PenTool },
      { name: 'Email certificado', description: 'Env\u00edo de emails con evidencia legal', icon: Mail },
      { name: 'SMS certificado', description: 'Env\u00edo de SMS con evidencia legal', icon: MessageSquare },
    ],
  },
  {
    name: 'Namirial',
    color: '#8b5cf6',
    icon: Shield,
    products: [
      { name: 'eIDAS Services', description: 'Servicios de confianza europeos', icon: Shield },
    ],
  },
];

const tools = [
  {
    to: '/tools/csv-generator',
    icon: FileSpreadsheet,
    name: 'Generador CSV',
    description: 'Convierte Excel/CSV/JSON/XML al formato correcto para CLI de IvSign e IvNeos',
    product: 'cross-product',
  },
  {
    to: '/tools/bulksend',
    icon: Send,
    name: 'Multi Send',
    description: 'Env\u00edo masivo de firmas electr\u00f3nicas, emails y SMS certificados',
    product: 'signaturit',
  },
  {
    to: '/tools/html-generator',
    icon: Code,
    name: 'Email Templates',
    description: 'Crear y gestionar templates de email para brandings de Signaturit',
    product: 'signaturit',
  },
  {
    to: '/tools/gantt-generator',
    icon: GanttChart,
    name: 'Gantt Generator',
    description: 'Genera diagramas de Gantt para planificación de proyectos y exporta a PNG',
    product: 'cross-product',
  },
];

export default function DashboardPage() {
  return (
    <div className="home-page">
      <div className="home-header">
        <h2>Professional Services</h2>
        <p>Home page del equipo \u2014 productos, herramientas y recursos internos</p>
      </div>

      {/* Productos */}
      <section className="home-section">
        <h3 className="home-section-title">Productos</h3>
        <div className="products-grid">
          {productFamilies.map((family) => (
            <div key={family.name} className="product-family-card">
              <div className="product-family-header" style={{ borderColor: family.color }}>
                <div className="product-family-icon" style={{ background: family.color + '18', color: family.color }}>
                  <family.icon size={22} />
                </div>
                <span className="product-family-name">{family.name}</span>
              </div>
              <ul className="product-list">
                {family.products.map((prod) => (
                  <li key={prod.name} className="product-item">
                    <prod.icon size={16} style={{ color: family.color, flexShrink: 0 }} />
                    <div>
                      <div className="product-item-name">{prod.name}</div>
                      <div className="product-item-desc">{prod.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Herramientas */}
      <section className="home-section">
        <h3 className="home-section-title">Herramientas</h3>
        <div className="tools-catalog-grid">
          {tools.map((tool) => (
            <Link key={tool.to} to={tool.to} className="catalog-card">
              <div className={`catalog-card-icon ${tool.product}`}>
                <tool.icon size={24} />
              </div>
              <div className="catalog-card-body">
                <div className="catalog-card-name">{tool.name}</div>
                <div className="catalog-card-desc">{tool.description}</div>
              </div>
              <div className="catalog-card-footer">
                <span className={`catalog-tag ${tool.product}`}>
                  {tool.product === 'signaturit' ? 'Signaturit' : 'Cross-product'}
                </span>
                <ExternalLink size={14} className="catalog-card-arrow" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Documentaci\u00f3n */}
      <section className="home-section">
        <h3 className="home-section-title">Documentaci\u00f3n</h3>
        <div className="docs-placeholder">
          <p>Pr\u00f3ximamente: instructivos, links de wiki y recursos del equipo.</p>
        </div>
      </section>
    </div>
  );
}
