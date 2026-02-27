import { FileSpreadsheet } from 'lucide-react';
import ToolEmbed from '../components/common/ToolEmbed';

export default function CsvGeneratorPage() {
  return (
    <ToolEmbed
      title="Generador CSV para CLI"
      description="Convierte Excel/CSV/JSON/XML al formato correcto para comandos IvSign e IvNeos"
      src={`${import.meta.env.BASE_URL}tool-apps/csv-generator/index.html`}
      icon={FileSpreadsheet}
      product="cross-product"
    />
  );
}
