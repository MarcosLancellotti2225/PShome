// Componentes comunes de SE Tools (marca Namirial). Usalos en todas las herramientas
// en vez de armar botones, cargas de archivo o tablas a mano.
import { useId, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { formatSize } from '../../lib/files';
import './ui.css';

export function Button({ variant = 'secondary', size, icon: Icon, children, className = '', ...props }) {
  return (
    <button type="button" className={`ui-btn ui-btn-${variant} ${size === 'sm' ? 'ui-btn-sm' : ''} ${className}`} {...props}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Panel({ title, hint, actions, children, className = '' }) {
  return (
    <section className={`ui-panel ${className}`}>
      {(title || actions) && (
        <div className="ui-panel-head">
          <div>
            {title && <h2 className="ui-panel-title">{title}</h2>}
            {hint && <p className="ui-hint">{hint}</p>}
          </div>
          {actions && <div className="ui-row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Casillero para subir un archivo: clic o arrastrar y soltar.
export function FileDrop({ label, description, accept, file, onFile, required }) {
  const id = useId();
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const pick = (f) => onFile(f || null);

  return (
    <label
      htmlFor={id}
      className={`ui-file ${file ? 'is-loaded' : ''} ${over ? 'is-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
    >
      <span className="ui-file-icon" aria-hidden="true">{file ? <CheckCircle2 size={20} /> : <Upload size={20} />}</span>
      <span className="ui-file-body">
        <span className="ui-file-label">{label}{required && <span className="ui-required"> *</span>}</span>
        <span className="ui-file-desc">
          {file ? `${file.name} · ${formatSize(file.size)}` : description || 'Hacé clic o arrastrá el archivo acá'}
        </span>
      </span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="ui-visually-hidden"
        onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }}
      />
    </label>
  );
}

const TONE_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

export function Alert({ tone = 'info', children }) {
  const Icon = TONE_ICON[tone];
  return (
    <div className={`ui-alert ui-alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

// Fila de cifras: [{ label, value, tone? }]
export function Stats({ items }) {
  return (
    <div className="ui-stats">
      {items.map((it) => (
        <div key={it.label} className={`ui-stat ${it.tone ? `ui-stat-${it.tone}` : ''}`}>
          <span className="ui-stat-value">{it.value}</span>
          <span className="ui-stat-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children, inline }) {
  return (
    <label className={`ui-field ${inline ? 'ui-field-inline' : ''}`}>
      <span className="ui-field-label">{label}</span>
      {children}
    </label>
  );
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="ui-tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`ui-tab ${value === o.value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

// Tabla con scroll propio para que nunca empuje la página.
export function DataTable({ columns, rows, empty = 'No hay datos.', maxHeight }) {
  return (
    <div className="ui-table-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className="ui-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.num ? 'is-num' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="ui-table-empty">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.key ?? i} className={r.className}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'is-num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Botón de dos pasos para acciones que borran cosas (reemplaza a confirm()).
export function ConfirmButton({ children, confirmLabel = '¿Seguro? Sí', onConfirm, ...props }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <Button {...props} onClick={() => setArmed(true)}>{children}</Button>;
  return (
    <span className="ui-row">
      <Button {...props} variant="danger" onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</Button>
      <Button size={props.size} variant="ghost" onClick={() => setArmed(false)}>Cancelar</Button>
    </span>
  );
}
