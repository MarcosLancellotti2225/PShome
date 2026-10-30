// Gantt Generator — integrado desde el repo GranttGenerator.
// Misma lógica de armado del diagrama; ahora con estado de React, guardado automático
// en el navegador, guardar/abrir el plan en JSON y colores por defecto de Namirial.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, X, FileDown, FileUp, RotateCcw } from 'lucide-react';
import { Button, ConfirmButton, Field, Panel, Alert } from '../../components/ui';
import { downloadBlob, downloadDataUrl, jsonBlob, readJson } from '../../lib/files';
import './gantt.css';

const STORAGE_KEY = 'pstools.gantt.v1';

const DEFAULT_PLAN = {
  title: 'Plan de implementación',
  subtitle: 'Proyecto — 2026',
  unit: 'weeks',
  footerLogo: 'Namirial',
  footerVersion: 'v1.0 — 2026',
  colors: {
    text: { on: true, value: '#0a1111' },
    accent: { on: true, value: '#047c76' },
    footer: { on: true, value: '#047c76' },
    grid: { on: true, value: '#a1aeae' },
  },
  bg: { mode: 'solid', color: '#ffffff', grad1: '#012825', grad2: '#047c76', dir: 'to right' },
  phases: [
    { name: '1. Relevamiento', color: '#012825', start: 1, duration: 1, tasks: ['Entrevistas con el cliente', 'Relevamiento de requisitos', 'Alcance del proyecto'] },
    { name: '2. Configuración del entorno', color: '#006660', start: 2, duration: 2, tasks: ['Alta de cuentas y usuarios', 'Configuración de brandings', 'Accesos a sandbox'] },
    { name: '3. Desarrollo', color: '#047c76', start: 4, duration: 3, tasks: ['Formularios y plantillas', 'Integración por API', 'Pruebas internas'] },
    { name: '4. Integración y QA', color: '#03948c', start: 7, duration: 2, tasks: ['Pruebas de punta a punta', 'Ajustes con el cliente'] },
    { name: '5. UAT', color: '#00a69d', start: 9, duration: 1, tasks: ['Pruebas del cliente', 'Correcciones', 'Documentación'] },
    { name: '6. Puesta en producción', color: '#006660', start: 10, duration: 1, tasks: ['Pase a producción', 'Seguimiento', 'Traspaso y capacitación'] },
  ],
};

const EMPTY_PLAN = { ...DEFAULT_PLAN, title: 'Plan de implementación', subtitle: 'Proyecto — 2026', phases: [] };

const GRADIENT_DIRS = [
  ['to right', '→ Horizontal'], ['to left', '← Horizontal inv.'], ['to bottom', '↓ Vertical'], ['to top', '↑ Vertical inv.'],
  ['to bottom right', '↘ Diagonal'], ['to top right', '↗ Diagonal inv.'], ['to bottom left', '↙ Diagonal izq.'],
  ['135deg', '◇ 135°'], ['circle', '◉ Radial'],
];

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PLAN, ...JSON.parse(raw) } : DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

const unitShort = (u) => (u === 'days' ? 'D' : 'S');
const unitLabel = (u) => (u === 'days' ? 'Día' : 'Sem');
const unitWord = (u, n) => (u === 'days' ? (n === 1 ? 'día' : 'días') : (n === 1 ? 'sem' : 'sems'));
const totalUnits = (phases) => Math.max(1, ...phases.map((p) => p.start + p.duration - 1));
const barLabel = (u, start, duration) =>
  duration === 1 ? `${unitShort(u)}${start}` : `${unitShort(u)}${start} – ${unitShort(u)}${start + duration - 1}`;

function bgStyle(bg) {
  if (bg.mode === 'none') return 'transparent';
  if (bg.mode === 'solid') return bg.color;
  if (bg.dir === 'circle') return `radial-gradient(circle, ${bg.grad1}, ${bg.grad2})`;
  return `linear-gradient(${bg.dir}, ${bg.grad1}, ${bg.grad2})`;
}

export default function GanttTool() {
  const [plan, setPlan] = useState(loadSaved);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef(null);
  const openRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch { /* sin guardado local: sigue funcionando */ }
  }, [plan]);

  const set = (patch) => setPlan((p) => ({ ...p, ...patch }));
  const setColor = (key, patch) => setPlan((p) => ({ ...p, colors: { ...p.colors, [key]: { ...p.colors[key], ...patch } } }));
  const setBg = (patch) => setPlan((p) => ({ ...p, bg: { ...p.bg, ...patch } }));
  const setPhase = (i, patch) => setPlan((p) => ({ ...p, phases: p.phases.map((ph, j) => (j === i ? { ...ph, ...patch } : ph)) }));
  const removePhase = (i) => setPlan((p) => ({ ...p, phases: p.phases.filter((_, j) => j !== i) }));
  const addPhase = () => setPlan((p) => ({
    ...p,
    phases: [...p.phases, { name: `${p.phases.length + 1}. Nueva fase`, color: '#047c76', start: p.phases.length ? totalUnits(p.phases) + 1 : 1, duration: 1, tasks: ['Tarea de ejemplo'] }],
  }));
  const setTask = (i, ti, value) => setPhase(i, { tasks: plan.phases[i].tasks.map((t, k) => (k === ti ? value : t)) });
  const removeTask = (i, ti) => setPhase(i, { tasks: plan.phases[i].tasks.filter((_, k) => k !== ti) });
  const addTask = (i) => setPhase(i, { tasks: [...plan.phases[i].tasks, 'Nueva tarea'] });

  const tu = totalUnits(plan.phases);
  const maxUnits = Math.max(tu + 5, 20);
  const unitOptions = useMemo(() => Array.from({ length: maxUnits }, (_, k) => k + 1), [maxUnits]);

  async function exportPng() {
    setExporting(true);
    setError('');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(chartRef.current, { backgroundColor: null, scale: 3, useCORS: true, logging: false });
      downloadDataUrl(canvas.toDataURL('image/png'), `${slug(plan.title) || 'gantt'}.png`);
    } catch (e) {
      setError(`No se pudo exportar la imagen: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  async function openPlan(file) {
    if (!file) return;
    setError('');
    try {
      const data = await readJson(file, 'El plan');
      if (!Array.isArray(data.phases)) throw new Error('El archivo no tiene fases (no es un plan de Gantt).');
      setPlan({ ...DEFAULT_PLAN, ...data });
    } catch (e) {
      setError(e.message);
    }
  }

  const { colors, bg } = plan;
  const textColor = colors.text.on ? colors.text.value : 'transparent';
  const accentColor = colors.accent.on ? colors.accent.value : 'transparent';
  const footerColor = colors.footer.on ? colors.footer.value : 'transparent';
  const gridBorder = colors.grid.on ? `${colors.grid.value}55` : 'transparent';
  const gridCols = `200px repeat(${tu}, 1fr)`;

  return (
    <div className="gantt-tool">
      <Panel>
        <div className="gantt-toolbar">
          <Field label="Título"><input value={plan.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Subtítulo"><input value={plan.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
          <Field label="Unidad">
            <select value={plan.unit} onChange={(e) => set({ unit: e.target.value })}>
              <option value="weeks">Semanas</option>
              <option value="days">Días</option>
            </select>
          </Field>
          <Field label="Pie (izquierda)"><input value={plan.footerLogo} onChange={(e) => set({ footerLogo: e.target.value })} /></Field>
          <Field label="Pie (derecha)"><input value={plan.footerVersion} onChange={(e) => set({ footerVersion: e.target.value })} /></Field>
        </div>
        <div className="ui-row">
          <Button variant="primary" icon={Download} onClick={exportPng} disabled={exporting}>{exporting ? 'Exportando…' : 'Descargar PNG'}</Button>
          <Button icon={FileDown} onClick={() => downloadBlob(jsonBlob(plan), `${slug(plan.title) || 'plan'}.gantt.json`)}>Guardar plan</Button>
          <Button icon={FileUp} onClick={() => openRef.current?.click()}>Abrir plan</Button>
          <input ref={openRef} type="file" accept=".json" className="ui-visually-hidden" onChange={(e) => { openPlan(e.target.files[0]); e.target.value = ''; }} />
          <span className="gantt-spacer" />
          <ConfirmButton icon={RotateCcw} variant="ghost" confirmLabel="Sí, empezar de cero" onConfirm={() => setPlan(EMPTY_PLAN)}>Empezar de cero</ConfirmButton>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <p className="ui-hint">Los cambios se guardan solos en este navegador. Para compartir el plan o seguirlo en otra compu, usá «Guardar plan».</p>
      </Panel>

      <div className="gantt-workspace">
        <aside className="gantt-editor">
          <Panel title="Colores">
            {[['text', 'Texto'], ['accent', 'Acento'], ['footer', 'Pie'], ['grid', 'Líneas']].map(([key, label]) => (
              <div key={key} className="gantt-color-row">
                <span className="gantt-color-label">{label}</span>
                <label className="gantt-switch">
                  <input type="checkbox" checked={colors[key].on} onChange={(e) => setColor(key, { on: e.target.checked })} />
                  <span aria-hidden="true" />
                  <span className="ui-visually-hidden">Mostrar {label.toLowerCase()}</span>
                </label>
                <input type="color" aria-label={`Color de ${label.toLowerCase()}`} value={colors[key].value} disabled={!colors[key].on} onChange={(e) => setColor(key, { value: e.target.value })} />
              </div>
            ))}
            <div className="gantt-subtitle-label">Fondo</div>
            <div className="ui-tabs gantt-bg-tabs">
              {[['none', 'Sin fondo'], ['solid', 'Sólido'], ['gradient', 'Degradé']].map(([mode, label]) => (
                <button key={mode} type="button" className={`ui-tab ${bg.mode === mode ? 'is-active' : ''}`} onClick={() => setBg({ mode })}>{label}</button>
              ))}
            </div>
            {bg.mode === 'solid' && (
              <div className="gantt-color-row">
                <span className="gantt-color-label">Color</span>
                <input type="color" aria-label="Color de fondo" value={bg.color} onChange={(e) => setBg({ color: e.target.value })} />
              </div>
            )}
            {bg.mode === 'gradient' && (
              <>
                <div className="gantt-color-row">
                  <span className="gantt-color-label">Colores</span>
                  <input type="color" aria-label="Color 1 del degradé" value={bg.grad1} onChange={(e) => setBg({ grad1: e.target.value })} />
                  <input type="color" aria-label="Color 2 del degradé" value={bg.grad2} onChange={(e) => setBg({ grad2: e.target.value })} />
                </div>
                <Field label="Dirección">
                  <select value={bg.dir} onChange={(e) => setBg({ dir: e.target.value })}>
                    {GRADIENT_DIRS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
              </>
            )}
          </Panel>

          <Panel title="Fases del proyecto">
            {plan.phases.length === 0 && <p className="ui-hint">Todavía no hay fases. Agregá la primera.</p>}
            {plan.phases.map((ph, i) => (
              <div key={i} className="gantt-phase">
                <div className="gantt-phase-head">
                  <input type="color" aria-label={`Color de la fase ${i + 1}`} value={ph.color} onChange={(e) => setPhase(i, { color: e.target.value })} />
                  <input className="gantt-phase-name" aria-label={`Nombre de la fase ${i + 1}`} value={ph.name} onChange={(e) => setPhase(i, { name: e.target.value })} />
                  <button type="button" className="gantt-icon-btn" aria-label={`Quitar la fase ${ph.name}`} onClick={() => removePhase(i)}><Trash2 size={15} /></button>
                </div>
                <div className="gantt-phase-row">
                  <Field label="Inicio" inline>
                    <select value={ph.start} onChange={(e) => setPhase(i, { start: Number(e.target.value) })}>
                      {unitOptions.map((n) => <option key={n} value={n}>{unitLabel(plan.unit)} {n}</option>)}
                    </select>
                  </Field>
                  <Field label="Duración" inline>
                    <select value={ph.duration} onChange={(e) => setPhase(i, { duration: Number(e.target.value) })}>
                      {unitOptions.map((n) => <option key={n} value={n}>{n} {unitWord(plan.unit, n)}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="gantt-tasks">
                  {ph.tasks.map((t, ti) => (
                    <div key={ti} className="gantt-task">
                      <input aria-label={`Tarea ${ti + 1} de ${ph.name}`} value={t} onChange={(e) => setTask(i, ti, e.target.value)} />
                      <button type="button" className="gantt-icon-btn" aria-label={`Quitar la tarea ${t}`} onClick={() => removeTask(i, ti)}><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="gantt-add-task" onClick={() => addTask(i)}><Plus size={12} /> tarea</button>
                </div>
              </div>
            ))}
            <Button icon={Plus} onClick={addPhase}>Agregar fase</Button>
          </Panel>
        </aside>

        <div className={`gantt-preview ${bg.mode === 'none' ? 'is-transparent' : ''}`}>
          <div ref={chartRef} className="gantt-chart" style={{ background: bgStyle(bg) }}>
            <div className="gantt-chart-title" style={{ color: colors.accent.on ? accentColor : textColor }}>{plan.title}</div>
            <div className="gantt-chart-subtitle" style={{ color: textColor }}>{plan.subtitle}</div>
            <div className="g-header" style={{ gridTemplateColumns: gridCols, borderBottom: `2px solid ${accentColor}` }}>
              <div className="g-header-label" style={{ color: textColor }}>Fase</div>
              {Array.from({ length: tu }, (_, k) => (
                <div key={k} className="g-header-unit" style={{ color: textColor, borderLeft: `1px solid ${gridBorder}` }}>{unitLabel(plan.unit)} {k + 1}</div>
              ))}
            </div>
            {plan.phases.map((ph, i) => (
              <div key={i} className="g-row" style={{ gridTemplateColumns: gridCols, borderBottom: `1px solid ${gridBorder}` }}>
                <div className="g-row-label" style={{ gridColumn: 1, gridRow: 1 }}>
                  <div className="g-phase-name" style={{ color: textColor }}>{ph.name}</div>
                  <ul className="g-tasks" style={{ color: textColor }}>{ph.tasks.map((t, ti) => <li key={ti}>{t}</li>)}</ul>
                </div>
                {Array.from({ length: tu }, (_, k) => (
                  <div key={k} style={{ gridColumn: k + 2, gridRow: 1, borderLeft: `1px solid ${gridBorder}` }} />
                ))}
                <div className="g-bar-wrap" style={{ gridColumn: `${ph.start + 1} / ${ph.start + ph.duration + 1}`, gridRow: 1 }}>
                  <div className="g-bar" style={{ background: ph.color }}>{barLabel(plan.unit, ph.start, ph.duration)}</div>
                </div>
              </div>
            ))}
            <div className="gantt-chart-footer" style={{ borderTop: `1px solid ${gridBorder}` }}>
              <div className="gantt-chart-footer-logo" style={{ color: footerColor }}>{plan.footerLogo}</div>
              <div className="gantt-chart-footer-text" style={{ color: colors.footer.on ? footerColor : textColor }}>{plan.footerVersion}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
