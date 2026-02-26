import { FolderGit2, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import KpiCard from '../components/dashboard/KpiCard';
import ProjectsTable from '../components/dashboard/ProjectsTable';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import QuickActions from '../components/dashboard/QuickActions';
import './DashboardPage.css';

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <h2>Bienvenido, Marcos</h2>
          <p>Aquí tienes el resumen de Professional Services</p>
        </div>
        <div className="dashboard-date">{today}</div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={FolderGit2}
          label="Proyectos Activos"
          value="12"
          change={8.3}
          color="blue"
        />
        <KpiCard
          icon={Users}
          label="Clientes"
          value="28"
          change={12.5}
          color="green"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Entregados este mes"
          value="5"
          change={25}
          color="amber"
        />
        <KpiCard
          icon={AlertTriangle}
          label="En Riesgo"
          value="2"
          change={-50}
          color="red"
        />
      </div>

      <div className="dashboard-grid">
        <div>
          <ProjectsTable />
        </div>
        <div className="dashboard-sidebar-widgets">
          <QuickActions />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
