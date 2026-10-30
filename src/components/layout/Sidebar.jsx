import { NavLink } from 'react-router-dom';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { SECTIONS, toolsInSection } from '../../config/tools';
import ToolIcon from '../common/ToolIcon';
import './Sidebar.css';

export default function Sidebar({ collapsed, onToggle }) {
  // En el menú solo aparecen las secciones que ya tienen herramientas.
  const sections = SECTIONS.map((s) => ({ ...s, tools: toolsInSection(s.id) })).filter((s) => s.tools.length);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo" aria-hidden="true" />
        {!collapsed && (
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">Namirial</span>
            <span className="sidebar-brand-sub">SE Tools</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Inicio">
          <Home />
          {!collapsed && <span>Inicio</span>}
        </NavLink>

        {sections.map((section) => (
          <div key={section.id}>
            {!collapsed && <div className="sidebar-section-title">{section.name}</div>}
            {section.tools.map((tool) => (
              <NavLink
                key={tool.id}
                to={`/tools/${tool.id}`}
                title={tool.name}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <ToolIcon name={tool.icon} />
                {!collapsed && <span>{tool.name}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  );
}
