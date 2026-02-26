import './ActivityFeed.css';

const activities = [
  {
    id: 1,
    type: 'deploy',
    text: '<strong>API v3 Migración</strong> desplegada en staging para BBVA',
    time: 'Hace 2 horas',
  },
  {
    id: 2,
    type: 'update',
    text: 'Nuevo endpoint agregado en el proyecto de <strong>Telefónica</strong>',
    time: 'Hace 4 horas',
  },
  {
    id: 3,
    type: 'issue',
    text: 'Issue crítico reportado en <strong>Certificación eIDAS</strong> - Santander',
    time: 'Hace 6 horas',
  },
  {
    id: 4,
    type: 'meeting',
    text: 'Reunión de kickoff agendada con <strong>CaixaBank</strong>',
    time: 'Ayer',
  },
  {
    id: 5,
    type: 'deploy',
    text: 'Portal de Firma <strong>Mapfre</strong> entregado exitosamente',
    time: 'Hace 2 días',
  },
  {
    id: 6,
    type: 'update',
    text: 'Documentación técnica actualizada para <strong>Custom Workflow Engine</strong>',
    time: 'Hace 3 días',
  },
];

export default function ActivityFeed() {
  return (
    <div className="activity-section">
      <div className="activity-header">
        <h3>Actividad Reciente</h3>
      </div>
      <div className="activity-list">
        {activities.map((activity) => (
          <div key={activity.id} className="activity-item">
            <div className={`activity-dot ${activity.type}`} />
            <div>
              <div
                className="activity-text"
                dangerouslySetInnerHTML={{ __html: activity.text }}
              />
              <div className="activity-time">{activity.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
