import { Component, Suspense, lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import { TOOLS, findSection, findTool, isIntegrated } from '../config/tools';
import ToolIcon from '../components/common/ToolIcon';
import { Alert } from '../components/ui';
import './ToolPage.css';

// Un componente lazy por herramienta integrada, creado una sola vez al cargar la app.
const TOOL_COMPONENTS = Object.fromEntries(TOOLS.filter(isIntegrated).map((t) => [t.id, lazy(t.load)]));

// Si una herramienta falla, el resto de la app sigue andando.
class ToolErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <Alert tone="error">
          La herramienta tuvo un error y se detuvo: {String(this.state.error.message || this.state.error)}. Recargá la página para volver a empezar.
        </Alert>
      );
    }
    return this.props.children;
  }
}

export default function ToolPage() {
  const { id } = useParams();
  const tool = findTool(id);
  if (!tool) return <Navigate to="/" replace />;
  const section = findSection(tool.section);

  return (
    <div className="tool-page">
      <header className="tool-head">
        <div className="tool-head-icon"><ToolIcon name={tool.icon} size={22} /></div>
        <div className="tool-head-text">
          <div className="tool-head-section">{section?.name}</div>
          <h2>{tool.name}</h2>
          <p>{tool.description}</p>
        </div>
      </header>

      {isIntegrated(tool) ? (
        <ToolErrorBoundary key={tool.id}>
          <Suspense fallback={<div className="tool-loading"><Loader2 className="spin" size={18} /> Cargando…</div>}>
            <IntegratedTool id={tool.id} />
          </Suspense>
        </ToolErrorBoundary>
      ) : (
        <div className="tool-legacy">
          <p>Esta herramienta todavía no está integrada a la app. Se abre en una pestaña nueva, con su versión anterior.</p>
          <a className="ui-btn ui-btn-primary" href={tool.href} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Abrir {tool.name}
          </a>
        </div>
      )}
    </div>
  );
}

function IntegratedTool({ id }) {
  const Tool = TOOL_COMPONENTS[id];
  return <Tool />;
}
