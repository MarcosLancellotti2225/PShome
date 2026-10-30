import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { SECTIONS, TOOLS, toolsInSection, isIntegrated } from '../config/tools';
import ToolIcon from '../components/common/ToolIcon';
import './DashboardPage.css';

export default function DashboardPage() {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const matches = (t) => !term || `${t.name} ${t.description}`.toLowerCase().includes(term);

  const sections = SECTIONS.map((s) => ({ ...s, all: toolsInSection(s.id), tools: toolsInSection(s.id).filter(matches) }))
    .filter((s) => !term || s.tools.length);

  return (
    <div className="home-page">
      <section className="home-hero">
        <h2>PS Tools</h2>
        <p>Todas las herramientas del equipo en un solo lugar. Buscá por lo que necesitás hacer o entrá por sección.</p>
        <label className="home-search">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">Buscar herramienta</span>
          <input
            id="home-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿Qué necesitás hacer? Ej: enviar a firmar, importar usuarios…"
            autoComplete="off"
          />
        </label>
      </section>

      {!term && (
        <nav className="home-jump" aria-label="Secciones">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.name}
              <span>{toolsInSection(s.id).length}</span>
            </a>
          ))}
        </nav>
      )}

      {sections.length === 0 && (
        <p className="home-noresults">Ninguna herramienta coincide con “{query}”.</p>
      )}

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="home-section">
          <div className="home-section-head">
            <div>
              <h3>{section.name}</h3>
              <p>{section.description}</p>
            </div>
            <span className="home-section-count">
              {section.all.length} {section.all.length === 1 ? 'herramienta' : 'herramientas'}
            </span>
          </div>

          {section.tools.length ? (
            <div className="home-grid">
              {section.tools.map((tool) => (
                <Link key={tool.id} to={`/tools/${tool.id}`} className="home-card">
                  <div className="home-card-icon">
                    <ToolIcon name={tool.icon} size={22} />
                  </div>
                  <div className="home-card-name">{tool.name}</div>
                  <div className="home-card-desc">{tool.description}</div>
                  <div className="home-card-open">
                    Abrir <ArrowRight size={14} />
                    {!isIntegrated(tool) && <span className="home-card-legacy">versión anterior</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-empty">Todavía no hay herramientas en esta sección.</div>
          )}
        </section>
      ))}

      <p className="home-footnote">
        {TOOLS.filter(isIntegrated).length} de {TOOLS.length} herramientas integradas a la app. Para sumar o reordenar, editá <code>src/config/tools.js</code>.
      </p>
    </div>
  );
}
