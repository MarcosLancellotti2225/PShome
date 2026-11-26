// Revisar form-def: las reglas del Revisor y los problemas del contrato del JSON, en un solo lugar.
import { useState } from 'react';
import { Alert, Badge, DataTable, Panel, Tabs } from '../../components/ui';
import { more } from './util.js';

const SEV = { error: ['bad', 'Error'], aviso: ['warn', 'Aviso'], nota: ['neutral', 'Nota'] };
const FILTERS = [['all', 'Todo'], ['error', 'Errores'], ['aviso', 'Avisos'], ['nota', 'Notas']];
export default function Revisor({ items }) {
  const [filter, setFilter] = useState('all');
  if (!items) return <Alert tone="info">Cargá el JSON del formulario para revisarlo.</Alert>;
  const errores = items.filter((i) => i.severidad === 'error').length;
  const rows = items.filter((i) => filter === 'all' || i.severidad === filter).map((i, n) => ({ ...i, key: n }));
  return (
    <Panel
      title="Revisar el JSON del formulario"
      hint="Las reglas de la plataforma que Signaframe no valida al guardar, y las rutas del JSON que se pisan o no llegan."
      actions={<Tabs value={filter} onChange={setFilter} options={FILTERS.map(([value, label]) => ({ value, label }))} />}
    >
      {errores === 0
        ? <Alert tone="success">Sin errores{items.length ? `: ${items.length} aviso${items.length === 1 ? '' : 's'} o nota${items.length === 1 ? '' : 's'} para mirar.` : '.'}</Alert>
        : <Alert tone="warning">{errores} error{errores === 1 ? '' : 'es'} para corregir antes de subirlo.</Alert>}
      <DataTable
        maxHeight={620}
        empty="Nada en esta categoría."
        rows={rows}
        columns={[
          { key: 'sev', label: '', render: (h) => <Badge tone={SEV[h.severidad]?.[0] || 'neutral'}>{SEV[h.severidad]?.[1] || h.severidad}</Badge> },
          { key: 'titulo', label: 'Qué pasa', render: (h) => (
            <>
              <b>{h.regla}</b> {h.titulo}
              <div className="ss-sub ss-wrap">{h.detalle}</div>
              {h.campos.length > 0 && <div className="ss-sub ui-mono">{h.campos.slice(0, 5).join(', ')}{more(h.campos, 5)}</div>}
            </>
          ) },
        ]}
      />
    </Panel>
  );
}
