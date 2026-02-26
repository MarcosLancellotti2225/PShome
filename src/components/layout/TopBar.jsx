import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import './TopBar.css';

const pageTitles = {
  '/': 'Dashboard',
  '/projects': 'Proyectos',
  '/clients': 'Clientes',
  '/calendar': 'Calendario',
  '/tools/csv-generator': 'Generador CSV',
  '/tools/bulksend': 'Multi Send',
  '/tools/html-generator': 'Email Templates',
  '/integrations': 'Integraciones',
  '/reports': 'Reportes',
  '/documentation': 'Documentación',
  '/knowledge-base': 'Knowledge Base',
  '/help': 'Ayuda',
  '/settings': 'Configuración',
};

export default function TopBar() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-right">
        <button className="topbar-search">
          <Search size={16} />
          <span>Buscar...</span>
          <kbd>⌘K</kbd>
        </button>

        <button className="topbar-icon-btn">
          <Bell size={20} />
          <span className="topbar-notification-dot" />
        </button>

        <div className="topbar-avatar">ML</div>
      </div>
    </header>
  );
}
