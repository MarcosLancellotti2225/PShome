import { useLocation } from 'react-router-dom';
import './TopBar.css';

const pageTitles = {
  '/': 'Home',
  '/tools/csv-generator': 'Generador CSV',
  '/tools/bulksend': 'Multi Send',
  '/tools/html-generator': 'Email Templates',
  '/documentation': 'Documentación',
};

export default function TopBar() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Professional Services';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>
    </header>
  );
}
