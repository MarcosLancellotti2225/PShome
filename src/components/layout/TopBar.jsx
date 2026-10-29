import { useLocation } from 'react-router-dom';
import { findTool } from '../../config/tools';
import './TopBar.css';

export default function TopBar() {
  const { pathname } = useLocation();
  const toolId = pathname.startsWith('/tools/') ? pathname.split('/')[2] : null;
  const title = toolId ? findTool(toolId)?.name ?? 'Professional Services' : 'Inicio';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>
    </header>
  );
}
