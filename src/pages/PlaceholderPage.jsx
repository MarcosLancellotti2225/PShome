import { Construction } from 'lucide-react';
import './PlaceholderPage.css';

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon">
        <Construction size={36} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="placeholder-badge">
        <Construction size={14} />
        Próximamente - En desarrollo
      </div>
    </div>
  );
}
