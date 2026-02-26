import { Link } from 'react-router-dom';
import './ProjectsTable.css';

const recentProjects = [
  {
    id: 1,
    name: 'Migración API v3',
    client: 'BBVA',
    status: 'active',
    progress: 72,
    dueDate: '15 Mar 2026',
  },
  {
    id: 2,
    name: 'Integración SAP',
    client: 'Telefónica',
    status: 'active',
    progress: 45,
    dueDate: '28 Mar 2026',
  },
  {
    id: 3,
    name: 'Custom Workflow Engine',
    client: 'CaixaBank',
    status: 'pending',
    progress: 10,
    dueDate: '10 Abr 2026',
  },
  {
    id: 4,
    name: 'Portal de Firma',
    client: 'Mapfre',
    status: 'completed',
    progress: 100,
    dueDate: '01 Feb 2026',
  },
  {
    id: 5,
    name: 'Certificación eIDAS',
    client: 'Santander',
    status: 'at-risk',
    progress: 58,
    dueDate: '05 Mar 2026',
  },
];

const statusLabels = {
  active: 'Activo',
  pending: 'Pendiente',
  completed: 'Completado',
  'at-risk': 'En riesgo',
};

export default function ProjectsTable() {
  return (
    <div className="projects-section">
      <div className="projects-header">
        <h3>Proyectos Recientes</h3>
        <Link to="/projects" className="projects-view-all">
          Ver todos
        </Link>
      </div>
      <table className="projects-table">
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Progreso</th>
            <th>Fecha límite</th>
          </tr>
        </thead>
        <tbody>
          {recentProjects.map((project) => (
            <tr key={project.id}>
              <td>
                <div className="project-name">{project.name}</div>
              </td>
              <td className="project-client">{project.client}</td>
              <td>
                <span className={`status-badge ${project.status}`}>
                  <span className="status-dot" />
                  {statusLabels[project.status]}
                </span>
              </td>
              <td>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </td>
              <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                {project.dueDate}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
