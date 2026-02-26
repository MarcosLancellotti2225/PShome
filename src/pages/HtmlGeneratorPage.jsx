import { Code } from 'lucide-react';
import ToolEmbed from '../components/common/ToolEmbed';

export default function HtmlGeneratorPage() {
  return (
    <ToolEmbed
      title="Email Template Generator"
      description="Crear y gestionar templates de email para brandings de Signaturit"
      src="/tools/html-generator/index.html"
      icon={Code}
      product="signaturit"
    />
  );
}
