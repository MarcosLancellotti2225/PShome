import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import CsvGeneratorPage from './pages/CsvGeneratorPage';
import BulkSendPage from './pages/BulkSendPage';
import HtmlGeneratorPage from './pages/HtmlGeneratorPage';
import GanttGeneratorPage from './pages/GanttGeneratorPage';

export default function App() {
  return (
    <BrowserRouter basename="/PShome">
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/tools/csv-generator" element={<CsvGeneratorPage />} />
          <Route path="/tools/bulksend" element={<BulkSendPage />} />
          <Route path="/tools/html-generator" element={<HtmlGeneratorPage />} />
          <Route path="/tools/gantt-generator" element={<GanttGeneratorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
