// Cotización según el contrato (Rubro 2): precio por formulario a partir de la ficha.
import { useMemo, useState } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { CONTRACT_PRICING, money, quoteForm, quoteSummary } from '../../lib/quoter/contract.js';
import { Alert, Badge, Button, DataTable, Field, Panel, Stats } from '../../components/ui';

const PRICING_KEY = 'pstools.quoter.contract';
const LEVEL_TONE = { baja: 'good', media: 'warn', alta: 'bad' };
const KIND_LABEL = { editable: 'Editable', auto: 'Automático / bloqueado', info: 'Informativo' };
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const short = (t, n = 110) => (t.length > n ? `${t.slice(0, n)}…` : t);
const RULE_LABEL = { validacion: 'Validación', condicional: 'Condicional', calculo: 'Cálculo', otra: 'Otra' };

function loadPricing() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRICING_KEY) || 'null');
    if (saved?.tiers?.length === 3) return { ...CONTRACT_PRICING, ...saved, extraFields: { ...CONTRACT_PRICING.extraFields, ...saved.extraFields } };
  } catch { /* sin guardado local */ }
  return CONTRACT_PRICING;
}
function savePricing(p) {
  try { localStorage.setItem(PRICING_KEY, JSON.stringify(p)); } catch { /* sin guardado local */ }
}

export default function ContractQuote({ contract, onStatus }) {
  const [pricing, setPricing] = useState(loadPricing);
  const [hours, setHours] = useState({});
  const [open, setOpen] = useState(null);
  const forms = contract?.forms || [];
  const skipped = contract?.skipped || [];

  const items = useMemo(() => forms.map((form) => ({ form, quote: quoteForm(form, pricing, hours[form.id] ?? null) })), [forms, pricing, hours]);
  const total = items.reduce((s, i) => s + i.quote.total, 0);
  const pending = items.some((i) => i.quote.pendingHours);
  const c = pricing.currency;

  function setTier(i, k, v) {
    const tiers = pricing.tiers.map((t, j) => (j === i ? { ...t, [k]: Number(v) || 0 } : t));
    const next = { ...pricing, tiers };
    setPricing(next); savePricing(next);
  }
  function setTop(k, v) {
    const next = k === 'groupPrice'
      ? { ...pricing, extraFields: { ...pricing.extraFields, price: Number(v) || 0 } }
      : { ...pricing, [k]: Number(v) || 0 };
    setPricing(next); savePricing(next);
  }
  function resetPricing() {
    setPricing(CONTRACT_PRICING);
    try { localStorage.removeItem(PRICING_KEY); } catch { /* sin guardado local */ }
  }
  async function copySummary() {
    try {
      await navigator.clipboard.writeText(quoteSummary(items, pricing));
      onStatus({ tone: 'success', text: 'Resumen copiado. Pegalo en el mail o en la propuesta.' });
    } catch {
      onStatus({ tone: 'error', text: 'El navegador no dejó copiar.' });
    }
  }

  return (
    <Panel
      title="Cotización según contrato"
      hint={`Precio por formulario según ${pricing.source}. Campos: los que completa el usuario en la ficha (también los prellenados que puede cambiar). Reglas: todas las de la ficha, incluidas las validaciones de formato.`}
      actions={forms.length > 0 && <Button size="sm" icon={Copy} onClick={copySummary}>Copiar resumen</Button>}
    >
      {!forms.length && (
        <Alert tone="warning">
          No encontré una ficha de configuración en el ZIP (un Excel con la columna «Nombre del campo en formulario»). Sin ficha no se pueden contar los campos y reglas como pide el contrato.
        </Alert>
      )}

      {forms.length > 0 && (
        <>
          <Stats items={[
            { label: 'Formularios a cotizar', value: forms.length },
            { label: 'Total sin IVA', value: money(total, c), tone: 'good' },
            ...(pending ? [{ label: 'Horas a estimar', value: items.filter((i) => i.quote.pendingHours).length === 1 ? '1 formulario' : `${items.filter((i) => i.quote.pendingHours).length} formularios`, tone: 'warn' }] : []),
          ]} />
          <DataTable
            rows={items.map(({ form, quote: q }) => ({ key: form.id, form, q }))}
            columns={[
              { key: 'name', label: 'Formulario', render: ({ form }) => (
                <>
                  <strong>{form.pdf || form.code || 'Formulario'}</strong>
                  <div className="cz-dim cz-small">Ficha: {form.ficha}{form.code ? ` · ${form.code}` : ''}{form.pdfFields != null ? ` · ${form.pdfFields} espacios en el PDF` : ''}</div>
                </>
              ) },
              { key: 'fields', label: 'Campos', num: true, render: ({ form }) => <span title={`${form.auto} automáticos o bloqueados y ${form.info} informativos no cuentan`}><strong>{form.editable}</strong></span> },
              { key: 'rules', label: 'Reglas', num: true, render: ({ form }) => <strong>{form.rules.total}</strong> },
              { key: 'level', label: 'Nivel', render: ({ q }) => <Badge tone={LEVEL_TONE[q.tier.key]}>{q.tier.label} · línea {q.tier.line}</Badge> },
              { key: 'base', label: 'Base', num: true, render: ({ q }) => money(q.base, c) },
              { key: 'extra', label: 'Extras', num: true, render: ({ q }) => (
                <>
                  {q.extraFieldGroups > 0 && <div>{q.extraFieldGroups} × {pricing.extraFields.groupSize} campos: {money(q.fieldsCost, c)}</div>}
                  {q.extraRules > 0 && <div>{pl(q.extraRules, 'regla', 'reglas')}: {q.hours == null ? 'horas a estimar' : money(q.hoursCost, c)}</div>}
                  {!q.extraFieldGroups && !q.extraRules && <span className="cz-dim">—</span>}
                </>
              ) },
              { key: 'total', label: 'Total', num: true, render: ({ q }) => <strong>{money(q.total, c)}{q.pendingHours ? ' + horas' : ''}</strong> },
            ]}
          />

          {items.map(({ form, quote: q }) => (
            <div key={form.id} className="cz-form-note">
              <div><strong>{form.pdf || form.code}:</strong> {q.why}{q.extraFields > 0 ? ` Pasa los ${pricing.tiers[2].maxFields} campos por ${q.extraFields}: se cobran ${q.extraFieldGroups} grupos de ${pricing.extraFields.groupSize}.` : ''}</div>
              <div className="cz-rule-mix cz-dim cz-small">
                Reglas: {pl(form.rules.validacion, 'validación', 'validaciones')} · {pl(form.rules.condicional, 'condicional', 'condicionales')} · {pl(form.rules.calculo, 'cálculo', 'cálculos')} · {pl(form.rules.otra, 'otra', 'otras')}.
                {' '}Campos que no cuentan: {pl(form.auto, 'automático o bloqueado', 'automáticos o bloqueados')}, {pl(form.info, 'informativo', 'informativos')}.
              </div>
              {q.extraRules > 0 && (
                <div className="cz-config">
                  <span className="ui-hint">{q.extraRules === 1 ? '1 regla pasa' : `${q.extraRules} reglas pasan`} el máximo de {pricing.tiers[2].maxRules}. El contrato las cobra a {money(pricing.hourRate, c)} la hora, a estimar:</span>
                  <Field label="Horas" inline>
                    <input type="number" min="0" step="0.5" value={hours[form.id] ?? ''} placeholder="a estimar" onChange={(e) => setHours({ ...hours, [form.id]: e.target.value === '' ? null : e.target.value })} aria-label={`Horas para ${form.pdf || form.code}`} />
                  </Field>
                </div>
              )}
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === form.id ? null : form.id)}>
                {open === form.id ? 'Ocultar campos y reglas' : 'Ver campos y reglas'}
              </Button>
              {open === form.id && (
                <DataTable
                  maxHeight={360}
                  rows={form.fieldList.map((f, i) => ({ ...f, key: i, className: f.kind === 'editable' ? '' : 'is-muted' }))}
                  columns={[
                    { key: 'name', label: 'Campo', render: (f) => <><span title={f.name}>{short(f.name)}</span><div className="cz-dim cz-small">{f.sheet}</div></> },
                    { key: 'kind', label: 'Cuenta como', render: (f) => (f.kind === 'editable' ? <Badge tone="primary">Campo</Badge> : <span className="cz-dim">{KIND_LABEL[f.kind]}</span>) },
                    { key: 'rules', label: 'Reglas', render: (f) => (f.rules.length
                      ? f.rules.map((r) => <div key={r.text} className="cz-small"><Badge>{RULE_LABEL[r.type]}</Badge> {r.text}</div>)
                      : <span className="cz-dim">—</span>) },
                  ]}
                />
              )}
            </div>
          ))}
        </>
      )}

      {skipped.map((s) => <Alert key={s.file} tone="info"><strong>{s.file}:</strong> {s.reason}</Alert>)}

      <details className="cz-pricing">
        <summary>Precios y límites del contrato</summary>
        <p className="ui-hint">Se guardan en este navegador. Si el contrato se actualiza, cambialos acá.</p>
        <div className="cz-pricing-grid">
          {pricing.tiers.map((t, i) => (
            <div key={t.key} className="cz-config">
              <strong className="cz-tier-name">{t.label}</strong>
              <Field label="Campos hasta" inline><input type="number" min="1" value={t.maxFields} onChange={(e) => setTier(i, 'maxFields', e.target.value)} /></Field>
              <Field label="Reglas hasta" inline><input type="number" min="1" value={t.maxRules} onChange={(e) => setTier(i, 'maxRules', e.target.value)} /></Field>
              <Field label={`Precio (${c})`} inline><input type="number" min="0" step="100" value={t.price} onChange={(e) => setTier(i, 'price', e.target.value)} /></Field>
            </div>
          ))}
          <div className="cz-config">
            <Field label={`Grupo de ${pricing.extraFields.groupSize} campos extra (${c})`} inline><input type="number" min="0" value={pricing.extraFields.price} onChange={(e) => setTop('groupPrice', e.target.value)} /></Field>
            <Field label={`Hora (${c})`} inline><input type="number" min="0" value={pricing.hourRate} onChange={(e) => setTop('hourRate', e.target.value)} /></Field>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetPricing}>Volver a los del contrato</Button>
          </div>
        </div>
      </details>
    </Panel>
  );
}
