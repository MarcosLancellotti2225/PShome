import { useMemo, useRef } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import './ToolEmbed.css';

function cacheBustUrl(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
}

export default function ToolEmbed({ title, description, src, icon: Icon, product = 'signaturit' }) {
  const iframeRef = useRef(null);
  const initialSrc = useMemo(() => cacheBustUrl(src), [src]);

  const handleOpenExternal = () => {
    window.open(src, '_blank');
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = cacheBustUrl(src);
    }
  };

  return (
    <div className="tool-embed">
      <div className="tool-embed-header">
        <div className="tool-embed-info">
          <div className={`tool-embed-icon ${product}`}>
            <Icon size={20} />
          </div>
          <div>
            <div className="tool-embed-title">{title}</div>
            <div className="tool-embed-description">{description}</div>
          </div>
          <span className={`tool-embed-badge ${product}`}>
            {product === 'signaturit' ? 'Signaturit' : 'Cross-product'}
          </span>
        </div>
        <div className="tool-embed-actions">
          <button className="tool-embed-btn" onClick={handleRefresh}>
            <RefreshCw size={14} />
            Actualizar
          </button>
          <button className="tool-embed-btn" onClick={handleOpenExternal}>
            <ExternalLink size={14} />
            Abrir en nueva pestaña
          </button>
        </div>
      </div>
      <div className="tool-embed-frame-container">
        <iframe
          ref={iframeRef}
          className="tool-embed-frame"
          src={initialSrc}
          title={title}
        />
      </div>
    </div>
  );
}
