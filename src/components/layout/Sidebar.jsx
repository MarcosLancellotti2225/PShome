import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  FolderGit2,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Workflow,
  BookOpen,
  HelpCircle,
  FileSpreadsheet,
  Send,
  Code,
} from 'lucide-react';
import './Sidebar.css';

const navSections = [
  {
    title: 'General',
    links: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/projects', icon: FolderGit2, label: 'Proyectos' },
      { to: '/clients', icon: Users, label: 'Clientes' },
      { to: '/calendar', icon: CalendarDays, label: 'Calendario' },
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
    title: 'Operaciones',
    links: [
      { to: '/integrations', icon: Workflow, label: 'Integraciones' },
      { to: '/reports', icon: BarChart3, label: 'Reportes' },
      { to: '/documentation', icon: FileText, label: 'Documentación' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { to: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
      { to: '/help', icon: HelpCircle, label: 'Ayuda' },
      { to: '/settings', icon: Settings, label: 'Configuración' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

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
                {!collapsed && link.badge && (
                  <span className="sidebar-badge">{link.badge}</span>
                )}
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
