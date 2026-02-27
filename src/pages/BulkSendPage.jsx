import { Send } from 'lucide-react';
import ToolEmbed from '../components/common/ToolEmbed';

export default function BulkSendPage() {
  return (
    <ToolEmbed
      title="Multi Send Signaturit"
      description="Envío masivo de firmas electrónicas, emails certificados y SMS certificados"
      src="https://marcoslancellotti2225.github.io/bulksend/"
      icon={Send}
      product="signaturit"
    />
  );
}
