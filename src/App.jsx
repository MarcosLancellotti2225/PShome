import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import PlaceholderPage from './pages/PlaceholderPage';

const placeholderPages = [
  {
    path: '/projects',
    title: 'Proyectos',
    description: 'Gestión completa de proyectos de Professional Services. Seguimiento, asignación de recursos y timeline.',
  },
  {
    path: '/clients',
    title: 'Clientes',
    description: 'Directorio de clientes, contratos activos y gestión de relaciones comerciales.',
  },
  {
    path: '/calendar',
    title: 'Calendario',
    description: 'Vista de calendario con hitos de proyectos, reuniones y deadlines importantes.',
  },
  {
    path: '/integrations',
    title: 'Integraciones',
    description: 'Hub de integraciones con sistemas externos. APIs, webhooks y conectores.',
  },
  {
    path: '/reports',
    title: 'Reportes',
    description: 'Reportes y analytics de rendimiento de proyectos, SLAs y métricas clave.',
  },
  {
    path: '/documentation',
    title: 'Documentación',
    description: 'Repositorio central de documentación técnica, guías y procedimientos.',
  },
  {
    path: '/knowledge-base',
    title: 'Knowledge Base',
    description: 'Base de conocimiento interna con soluciones, patrones y mejores prácticas.',
  },
  {
    path: '/help',
    title: 'Ayuda',
    description: 'Centro de ayuda y soporte para el equipo de Professional Services.',
  },
  {
    path: '/settings',
    title: 'Configuración',
    description: 'Configuración del dashboard, preferencias de usuario y administración.',
  },
];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          {placeholderPages.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={
                <PlaceholderPage
                  title={page.title}
                  description={page.description}
                />
              }
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
