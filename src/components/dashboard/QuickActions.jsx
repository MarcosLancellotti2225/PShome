import { Link } from 'react-router-dom';
import { Plus, FileUp, UserPlus, GitBranch } from 'lucide-react';
import './QuickActions.css';

const actions = [
  { icon: Plus, label: 'Nuevo Proyecto', to: '/projects' },
  { icon: FileUp, label: 'Subir Documento', to: '/documentation' },
  { icon: UserPlus, label: 'Agregar Cliente', to: '/clients' },
  { icon: GitBranch, label: 'Nueva Integración', to: '/integrations' },
];

export default function QuickActions() {
  return (
    <div className="quick-actions">
      <h3>Acciones Rápidas</h3>
      <div className="quick-actions-grid">
        {actions.map((action) => (
          <Link key={action.label} to={action.to} className="quick-action-btn">
            <action.icon size={18} />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
