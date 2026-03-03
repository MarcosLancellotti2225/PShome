import { GanttChart } from 'lucide-react';
import ToolEmbed from '../components/common/ToolEmbed';

export default function GanttGeneratorPage() {
  return (
    <ToolEmbed
      title="Gantt Generator"
      description="Genera diagramas de Gantt para planificación de proyectos y exporta a PNG"
      src="https://marcoslancellotti2225.github.io/GranttGenerator/"
      icon={GanttChart}
      product="cross-product"
    />
  );
}
