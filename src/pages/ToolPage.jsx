import { Component, Suspense, lazy, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { TOOLS, capsuleTabs, findSection, findTool, isCapsule, isIntegrated } from '../config/tools';
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
  const { id, sub } = useParams();
  const tool = findTool(id);
  if (!tool) return <Navigate to="/" replace />;
  // Lo que vive adentro de una cápsula se abre en ella (la URL vieja sigue andando).
  if (tool.parent) return <Navigate to={`/tools/${tool.parent}/${tool.id}`} replace />;
  if (isCapsule(tool)) return <CapsulePage key={tool.id} capsule={tool} sub={sub} />;
  if (sub) return <Navigate to={`/tools/${tool.id}`} replace />;
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
        <ToolBody id={tool.id} />
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

function ToolBody({ id }) {
  return (
    <ToolErrorBoundary key={id}>
      <Suspense fallback={<div className="tool-loading"><Loader2 className="spin" size={18} /> Cargando…</div>}>
        <IntegratedTool id={id} />
      </Suspense>
    </ToolErrorBoundary>
  );
}

// Una herramienta que agrupa otras (Signaframe Studio): inicio con las herramientas y una pestaña por cada una.
// Las pestañas ya abiertas quedan montadas (ocultas) para no perder lo cargado al ir y volver.
function CapsulePage({ capsule, sub }) {
  const tabs = capsuleTabs(capsule);
  const active = tabs.find((t) => t.id === sub) || null;
  const [opened, setOpened] = useState(() => (active ? [active.id] : []));
  if (sub && !active) return <Navigate to={`/tools/${capsule.id}`} replace />;
  if (active && !opened.includes(active.id)) setOpened((o) => [...o, active.id]);
  const base = `/tools/${capsule.id}`;
  const section = findSection(capsule.section);

  return (
    <div className="tool-page">
      <header className="tool-head">
        <div className="tool-head-icon"><ToolIcon name={capsule.icon} size={22} /></div>
        <div className="tool-head-text">
          <div className="tool-head-section">{section?.name}</div>
          <h2>{capsule.name}{active && <span className="cap-crumb"> · {active.name}</span>}</h2>
          <p>{active ? active.description : capsule.description}</p>
        </div>
      </header>

      <nav className="cap-tabs" aria-label={`Herramientas de ${capsule.name}`}>
        <NavLink to={base} end className={({ isActive }) => `cap-tab ${isActive ? 'active' : ''}`}>Inicio</NavLink>
        {tabs.map((t) => (
          <NavLink key={t.id} to={`${base}/${t.id}`} className={({ isActive }) => `cap-tab ${isActive ? 'active' : ''}`}>
            {t.name}
          </NavLink>
        ))}
      </nav>

      {!active && (
        <div className="cap-grid">
          {tabs.map((t, i) => (
            <Link key={t.id} to={`${base}/${t.id}`} className="cap-card">
              <div className="cap-card-top">
                <span className="cap-card-num">{i + 1}</span>
                <ToolIcon name={t.tool.icon} size={20} />
              </div>
              <div className="cap-card-name">{t.name}</div>
              <div className="cap-card-desc">{t.description}</div>
              <div className="cap-card-open">Abrir <ArrowRight size={14} /></div>
            </Link>
          ))}
        </div>
      )}

      {tabs.filter((t) => opened.includes(t.id)).map((t) => (
        <div key={t.id} className="cap-panel" hidden={t.id !== active?.id}>
          <ToolBody id={t.tool.id} />
        </div>
      ))}
    </div>
  );
}
