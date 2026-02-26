import { Link } from 'react-router-dom';
import { FileSpreadsheet, Send, Code } from 'lucide-react';
import './ToolsGrid.css';

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
    description: 'Envío masivo de firmas electrónicas, emails y SMS certificados',
    product: 'signaturit',
  },
  {
    to: '/tools/html-generator',
    icon: Code,
    name: 'Email Templates',
    description: 'Crear y gestionar templates de email para brandings de Signaturit',
    product: 'signaturit',
  },
];

export default function ToolsGrid() {
  return (
    <div className="tools-section">
      <h3>Herramientas</h3>
      <div className="tools-grid">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to} className="tool-card">
            <div className={`tool-card-icon ${tool.product}`}>
              <tool.icon size={22} />
            </div>
            <div className="tool-card-content">
              <div className="tool-card-name">{tool.name}</div>
              <div className="tool-card-desc">{tool.description}</div>
              <span className={`tool-card-tag ${tool.product}`}>
                {tool.product === 'signaturit' ? 'Signaturit' : 'Cross-product'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
