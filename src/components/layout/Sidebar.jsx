import { NavLink } from 'react-router-dom';
import {
  Home,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Send,
  Code,
  FileText,
} from 'lucide-react';
import './Sidebar.css';

const navSections = [
  {
    title: 'General',
    links: [
      { to: '/', icon: Home, label: 'Home' },
    ],
  },
  {
    title: 'Herramientas',
    links: [
      { to: '/tools/csv-generator', icon: FileSpreadsheet, label: 'Generador CSV' },
      { to: '/tools/bulksend', icon: Send, label: 'Multi Send' },
      { to: '/tools/html-generator', icon: Code, label: 'Email Templates' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { to: '/documentation', icon: FileText, label: 'Documentación' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">S</div>
        {!collapsed && (
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">Signaturit</span>
            <span className="sidebar-brand-sub">Professional Services</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="sidebar-section-title">{section.title}</div>
            )}
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <link.icon />
                {!collapsed && <span>{link.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-toggle" onClick={onToggle}>
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  );
}
