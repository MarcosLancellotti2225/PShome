import { useRef } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import ToolIcon from './ToolIcon';
import './ToolEmbed.css';

export default function ToolEmbed({ tool, section }) {
  const iframeRef = useRef(null);

  const handleRefresh = () => {
    if (iframeRef.current) iframeRef.current.src = tool.src;
  };

  return (
    <div className="tool-embed">
      <div className="tool-embed-header">
        <div className="tool-embed-info">
          <div className="tool-embed-icon">
            <ToolIcon name={tool.icon} size={20} />
          </div>
          <div>
            <div className="tool-embed-title">{tool.name}</div>
            <div className="tool-embed-description">{tool.description}</div>
          </div>
          {section && <span className="tool-embed-badge">{section.name}</span>}
        </div>
        <div className="tool-embed-actions">
          <button className="tool-embed-btn" onClick={handleRefresh}>
            <RefreshCw size={14} />
            Recargar
          </button>
          <a className="tool-embed-btn" href={tool.src} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            Abrir en pestaña nueva
          </a>
        </div>
      </div>
      <div className="tool-embed-frame-container">
        <iframe ref={iframeRef} className="tool-embed-frame" src={tool.src} title={tool.name} />
      </div>
    </div>
  );
}
