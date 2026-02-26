import { Send } from 'lucide-react';
import ToolEmbed from '../components/common/ToolEmbed';

export default function BulkSendPage() {
  return (
    <ToolEmbed
      title="Multi Send Signaturit"
      description="Envío masivo de firmas electrónicas, emails certificados y SMS certificados"
      src={`${import.meta.env.BASE_URL}tools/bulksend/index.html`}
      icon={Send}
      product="signaturit"
    />
  );
}
