// Propiedades del campo elegido (o de varios a la vez).
import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button, Field } from '../../components/ui';
import { FT_OPTIONS, isTextField, typeLabel } from '../../lib/pdf-editor/model.js';

const fontValue = (f) => (f.fontSize === null || f.fontSize === undefined ? '' : String(f.fontSize));

function FontSelect({ value, onChange, id }) {
  const sizes = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18];
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
      <option value="">Sin cambiar</option>
      <option value="0">Auto (se achica para entrar)</option>
      {sizes.map((s) => <option key={s} value={s}>{s} pt</option>)}
      {value !== '' && value !== '0' && !sizes.includes(Number(value)) && <option value={value}>{value} pt</option>}
    </select>
  );
}

export default function Inspector({ fields, selected, problems, onChange, onRename, onDelete, onRestore }) {
  const sel = fields.filter((f) => selected.has(f.key));
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');

  if (sel.length === 0) {
    return (
      <div className="ep-inspector ep-inspector-empty">
        <p>Elegí un campo en la lista o en el PDF para ver y editar sus propiedades.</p>
        <ul>
          <li><strong>Clic</strong>: elegir · <strong>Shift/Ctrl + clic</strong>: varios</li>
          <li><strong>Arrastrar</strong>: mover · esquina inferior derecha: cambiar tamaño</li>
          <li><strong>Flechas</strong>: mover 1 pt (con Shift, 10)</li>
          <li><strong>Supr</strong>: borrar · <strong>Ctrl+Z / Ctrl+Y</strong>: deshacer / rehacer</li>
        </ul>
      </div>
    );
  }

  if (sel.length > 1) {
    const keys = sel.map((f) => f.key);
    const allDeleted = sel.every((f) => f.deleted);
    return (
      <div className="ep-inspector">
        <h3 className="ep-insp-title">{sel.length} campos elegidos</h3>
        <Field label="Fuente de todos">
          <FontSelect id="ep-multi-font" value="" onChange={(v) => v !== null && onChange(keys, { fontSize: v })} />
        </Field>
        <Field label="Multilínea">
          <select id="ep-multi-ml" value="" onChange={(e) => e.target.value && onChange(keys, { multiline: e.target.value === 'si' })}>
            <option value="">Sin cambiar</option>
            <option value="si">Sí, en todos</option>
            <option value="no">No, en ninguno</option>
          </select>
        </Field>
        <div className="ep-insp-block">
          <span className="ui-field-label">Agregar al nombre</span>
          <div className="ep-insp-row">
            <input id="ep-prefix" className="ui-input" placeholder="prefijo_" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <input id="ep-suffix" className="ui-input" placeholder="_sufijo" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
          </div>
          <Button size="sm" disabled={!prefix && !suffix} onClick={() => { onRename(keys, (f) => `${prefix}${f.name}${suffix}`); setPrefix(''); setSuffix(''); }}>Aplicar a los {sel.length}</Button>
        </div>
        {allDeleted
          ? <Button icon={RotateCcw} onClick={() => onRestore(keys)}>Restaurar los {sel.length}</Button>
          : <Button variant="danger" icon={Trash2} onClick={() => onDelete(keys)}>Borrar los {sel.length}</Button>}
      </div>
    );
  }

  const f = sel[0];
  const k = [f.key];
  const prob = problems.get(f.key);
  const num = (prop) => (
    <input
      id={`ep-${prop}`}
      type="number"
      value={f[prop]}
      onChange={(e) => e.target.value !== '' && onChange(k, { [prop]: Number(e.target.value) }, `num-${prop}-${f.key}`)}
    />
  );

  return (
    <div className="ep-inspector">
      <h3 className="ep-insp-title">{f.isNew ? 'Campo nuevo' : 'Campo'}</h3>
      {f.deleted && <p className="ep-insp-deleted">Este campo se va a borrar del PDF.</p>}
      <Field label="Nombre">
        <input
          id="ep-name"
          className="ep-mono"
          value={f.name}
          disabled={f.deleted}
          spellCheck={false}
          onChange={(e) => onChange(k, { name: e.target.value }, `name-${f.key}`)}
        />
      </Field>
      {!f.isNew && f.name !== f.orig.name && (
        <p className="ep-insp-old">Antes: <span className="ep-mono">{f.orig.name}</span> <button type="button" className="ep-link" onClick={() => onChange(k, { name: f.orig.name })}>volver al original</button></p>
      )}
      {f.group > 1 && <p className="ep-insp-note">Es una de las {f.group} opciones de un mismo grupo (por ejemplo, radios): si cambiás el nombre, cambialo en todas.</p>}
      {prob && <ul className="ep-insp-problems">{prob.map((p) => <li key={p}>{p}</li>)}</ul>}

      <div className="ep-insp-grid">
        <Field label="Tipo"><span className="ep-insp-static">{typeLabel(f.type)}</span></Field>
        <Field label="Página"><span className="ep-insp-static">{f.page}</span></Field>
      </div>
      {!f.isNew && (
        <Field label="Cambiar tipo">
          <select id="ep-ft" value={f.ft || ''} disabled={f.deleted} onChange={(e) => onChange(k, { ft: e.target.value || null })}>
            <option value="">Sin cambiar</option>
            {FT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      )}

      <span className="ui-field-label">Posición y tamaño (pt)</span>
      <div className="ep-insp-grid ep-insp-grid-4">
        <Field label="X">{num('x')}</Field>
        <Field label="Y">{num('y')}</Field>
        <Field label="Ancho">{num('width')}</Field>
        <Field label="Alto">{num('height')}</Field>
      </div>

      {(isTextField(f) || f.isNew) && (
        <>
          <Field label="Fuente">
            <FontSelect id="ep-font" value={fontValue(f)} onChange={(v) => onChange(k, { fontSize: v })} />
          </Field>
          {f.comb && f.fontSize === f.orig.fontSize && <p className="ep-insp-note">Tiene «peine» (una letra por celda): al elegir una fuente se le quita.</p>}
          <label className="ep-check">
            <input id="ep-ml" type="checkbox" checked={!!f.multiline} onChange={(e) => onChange(k, { multiline: e.target.checked })} />
            Multilínea (el texto baja de renglón)
          </label>
        </>
      )}

      {f.deleted
        ? <Button icon={RotateCcw} onClick={() => onRestore(k)}>Restaurar campo</Button>
        : <Button variant="danger" icon={Trash2} onClick={() => onDelete(k)}>Borrar campo</Button>}
    </div>
  );
}
