import { TrendingUp, TrendingDown } from 'lucide-react';
import './KpiCard.css';

export default function KpiCard({ icon: Icon, label, value, change, color = 'blue' }) {
  const isPositive = change >= 0;

  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${color}`}>
        <Icon size={22} />
      </div>
      <div className="kpi-content">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {change !== undefined && (
          <span className={`kpi-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isPositive ? '+' : ''}{change}% vs mes anterior
          </span>
        )}
      </div>
    </div>
  );
}
