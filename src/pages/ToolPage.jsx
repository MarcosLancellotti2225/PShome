import { Navigate, useParams } from 'react-router-dom';
import ToolEmbed from '../components/common/ToolEmbed';
import { findSection, findTool } from '../config/tools';

// Una sola página para todas las herramientas: lee /tools/:id de src/config/tools.js.
export default function ToolPage() {
  const { id } = useParams();
  const tool = findTool(id);
  if (!tool) return <Navigate to="/" replace />;

  return <ToolEmbed key={tool.id} tool={tool} section={findSection(tool.section)} />;
}
