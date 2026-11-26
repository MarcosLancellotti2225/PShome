// Reporte visual de Reportes (HTML autocontenido; el PDF sale de imprimirlo).
// Caso principal: «Reporte de contactos por cuenta» de los CSM — cifras generales,
// gráfico de cobertura por CSM, tabla resumen y, por CSM, sus cuentas (primero las
// que faltan contactar, de mayor a menor MRR).
import { pctTone } from './export.js';

// Colores de marca Namirial (el reporte sale de la app, no puede leer los tokens CSS).
const C = {
  primary: '#047c76', strong: '#00a69d', deep: '#012825', light: '#defffb',
  text: '#0a1111', secondary: '#4f5b5b', muted: '#778383', border: '#cddbdb', bg: '#f0f3f8',
  good: '#198446', goodBg: '#e3f5ea', warn: '#8c6410', warnBg: '#fcefd2', bad: '#ad4546', badBg: '#f9e3e3',
};
const TONE = { good: [C.good, C.goodBg], warn: [C.warn, C.warnBg], bad: [C.bad, C.badBg] };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtNum = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const fmtMoney = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

function pill(pct) {
  const [fg, bg] = TONE[pctTone(pct)];
  return `<span class="pill" style="color:${fg};background:${bg}">${esc(fmtNum(pct))}%</span>`;
}

// Gráfico de barras horizontales: contactadas (teal) + sin contactar (gris), con el %.
function coverageChart(groups) {
  if (!groups.length) return '';
  const max = Math.max(...groups.map((g) => g.total), 1);
  const rowH = 30;
  const labelW = 190;
  const barW = 420;
  const h = groups.length * rowH + 10;
  const bars = groups.map((g, i) => {
    const y = i * rowH + 6;
    const wC = (g.contacted / max) * barW;
    const wP = (g.pending / max) * barW;
    const [fg] = TONE[pctTone(g.pct)];
    const name = g.key.length > 28 ? `${g.key.slice(0, 27)}…` : g.key;
    return `<g>
      <text x="${labelW - 10}" y="${y + 13}" text-anchor="end" class="ch-label">${esc(name)}</text>
      <rect x="${labelW}" y="${y}" width="${barW}" height="18" rx="4" fill="${C.bg}"/>
      ${wC > 0 ? `<rect x="${labelW}" y="${y}" width="${wC.toFixed(1)}" height="18" rx="4" fill="${C.primary}"/>` : ''}
      ${wP > 0 ? `<rect x="${(labelW + wC).toFixed(1)}" y="${y}" width="${wP.toFixed(1)}" height="18" rx="4" fill="${C.border}"/>` : ''}
      <text x="${labelW + barW + 10}" y="${y + 13}" class="ch-val" fill="${fg}">${esc(fmtNum(g.pct))}%</text>
      <text x="${labelW + barW + 62}" y="${y + 13}" class="ch-sub">${g.contacted}/${g.total}</text>
    </g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${labelW + barW + 120} ${h}" role="img" aria-label="Cobertura por grupo">${bars}</svg>
  <div class="legend"><span><i style="background:${C.primary}"></i>Contactadas</span><span><i style="background:${C.border}"></i>Sin contactar</span></div>`;
}

/**
 * @param {Object} summary - resultado de summarize()
 * @param {Array} detail   - resultado de accountDetail() (opcional)
 * @param {Object} opts    - { title, subtitle, period, source, fecha, groupLabel, countLabel, sumLabel, showDetail }
 */
export function buildReportHtml(summary, detail, opts = {}) {
  const contact = Boolean(summary.opts.contactCol);
  const hasSum = Boolean(summary.opts.sumCol);
  const groupLabel = opts.groupLabel || summary.cols.group;
  const countLabel = opts.countLabel || summary.opts.countCol;
  const sumLabel = opts.sumLabel || summary.opts.sumCol;
  const t = summary.totals;
  const groups = [...summary.groups].sort((a, b) => (contact ? b.pct - a.pct : b.total - a.total) || a.key.localeCompare(b.key));
  const title = opts.title || (contact ? 'Reporte de contactos por cuenta' : 'Reporte resumen');

  const pendingSum = detail
    ? detail.reduce((n, d) => n + d.accounts.filter((a) => !a.contacted).reduce((m, a) => m + a.sum, 0), 0)
    : 0;

  const kpis = [
    { v: fmtNum(t.total), l: `${countLabel} en total` },
    contact && { v: fmtNum(t.contacted), l: 'Contactadas', tone: 'good' },
    contact && { v: fmtNum(t.pending), l: 'Sin contactar', tone: t.pending ? 'bad' : 'good' },
    contact && { v: `${fmtNum(t.pct)}%`, l: 'Cobertura', tone: pctTone(t.pct) },
    hasSum && { v: fmtMoney(t.sum), l: `${sumLabel}` },
    hasSum && contact && detail && { v: fmtMoney(pendingSum), l: `${sumLabel} sin contactar`, tone: pendingSum ? 'warn' : 'good' },
    !contact && { v: fmtNum(groups.length), l: groupLabel },
  ].filter(Boolean);

  const kpiHtml = kpis.map((k) => {
    const color = k.tone ? TONE[k.tone][0] : C.deep;
    return `<div class="kpi"><div class="kpi-v" style="color:${color}">${esc(k.v)}</div><div class="kpi-l">${esc(k.l)}</div></div>`;
  }).join('');

  const head = [
    `<th>${esc(groupLabel)}</th>`, `<th class="n">${esc(countLabel)}</th>`,
    contact ? '<th class="n">Contactadas</th><th class="n">Sin contactar</th><th class="n">Cobertura</th>' : '',
    hasSum ? `<th class="n">${esc(sumLabel)}</th>` : '',
  ].join('');
  const rowHtml = (g, total) => `<tr${total ? ' class="total"' : ''}>
    <td>${esc(g.key)}</td><td class="n">${fmtNum(g.total)}</td>
    ${contact ? `<td class="n">${fmtNum(g.contacted)}</td><td class="n">${fmtNum(g.pending)}</td><td class="n">${pill(g.pct)}</td>` : ''}
    ${hasSum ? `<td class="n">${fmtMoney(g.sum)}</td>` : ''}</tr>`;
  const table = `<table><thead><tr>${head}</tr></thead><tbody>${groups.map((g) => rowHtml(g, false)).join('')}${rowHtml(t, true)}</tbody></table>`;

  let detailHtml = '';
  if (detail && opts.showDetail !== false) {
    const byKey = new Map(detail.map((d) => [d.key, d]));
    detailHtml = groups.map((g) => {
      const d = byKey.get(g.key);
      if (!d || !d.accounts.length) return '';
      const rows = d.accounts.map((a) => `<tr${contact && !a.contacted ? ' class="pending"' : ''}>
        <td>${esc(a.name)}</td>
        ${contact ? `<td class="n">${fmtNum(a.contacts)}</td><td class="n">${esc(a.last || '—')}</td><td>${a.contacted ? '<span class="st st-ok">Contactada</span>' : '<span class="st st-no">Sin contactar</span>'}</td>` : ''}
        ${hasSum ? `<td class="n">${fmtMoney(a.sum)}</td>` : ''}</tr>`).join('');
      const hasLast = d.accounts.some((a) => a.last);
      return `<section class="group">
        <div class="group-head"><h3>${esc(g.key)}</h3>
          <div class="group-meta">${fmtNum(g.total)} ${esc(countLabel.toLowerCase())}${contact ? ` · ${fmtNum(g.contacted)} contactadas · ${pill(g.pct)}` : ''}${hasSum ? ` · ${esc(sumLabel)} ${fmtMoney(g.sum)}` : ''}</div>
        </div>
        ${contact ? `<div class="bar"><span style="width:${Math.min(100, g.pct)}%"></span></div>` : ''}
        <table class="det"><thead><tr><th>${esc(countLabel)}</th>${contact ? `<th class="n">Contactos</th><th class="n">${hasLast ? 'Último contacto' : ''}</th><th>Estado</th>` : ''}${hasSum ? `<th class="n">${esc(sumLabel)}</th>` : ''}</tr></thead><tbody>${rows}</tbody></table>
      </section>`;
    }).join('');
  }

  const meta = [opts.period && `Período: ${esc(opts.period)}`, opts.source && `Fuente: ${esc(opts.source)}`, `Generado: ${esc(opts.fecha || new Date().toLocaleDateString('es-AR'))}`].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Open Sans', 'Segoe UI', Arial, sans-serif; color: ${C.text}; background: #fff; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 900px; margin: 0 auto; padding: 0 0 32px; }
  .hero { background: linear-gradient(120deg, ${C.deep} 0%, ${C.primary} 70%, ${C.strong} 100%); color: #fff; padding: 26px 30px 22px; border-radius: 0 0 14px 14px; }
  .brand { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: .8; font-weight: 700; }
  h1 { margin: 6px 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -.3px; }
  .sub { font-size: 13px; opacity: .92; }
  .meta { margin-top: 10px; font-size: 11px; opacity: .8; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 18px 24px 6px; }
  .kpi { background: #fff; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 14px; border-top: 3px solid ${C.primary}; }
  .kpi-v { font-size: 22px; font-weight: 800; line-height: 1.1; }
  .kpi-l { font-size: 10.5px; color: ${C.secondary}; margin-top: 3px; text-transform: uppercase; letter-spacing: .4px; font-weight: 600; }
  h2 { font-size: 15px; color: ${C.deep}; margin: 22px 24px 10px; padding-bottom: 6px; border-bottom: 2px solid ${C.light}; }
  .block { margin: 0 24px; }
  .chart { width: 100%; height: auto; }
  .ch-label { font-size: 11px; fill: ${C.text}; font-weight: 600; }
  .ch-val { font-size: 11px; font-weight: 800; }
  .ch-sub { font-size: 10px; fill: ${C.muted}; }
  .legend { display: flex; gap: 16px; font-size: 10.5px; color: ${C.secondary}; margin-top: 4px; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { background: ${C.primary}; color: #fff; text-align: left; padding: 7px 9px; font-weight: 700; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; }
  td { padding: 6px 9px; border-bottom: 1px solid ${C.bg}; }
  tbody tr:nth-child(even) td { background: #fafbfc; }
  .n { text-align: right; white-space: nowrap; }
  tr.total td { font-weight: 800; background: ${C.light} !important; border-top: 2px solid ${C.primary}; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-weight: 800; font-size: 10.5px; }
  .group { margin: 0 24px 16px; break-inside: avoid-page; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 14px; }
  .group-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .group h3 { margin: 0; font-size: 14px; color: ${C.deep}; }
  .group-meta { font-size: 11px; color: ${C.secondary}; }
  .bar { height: 6px; background: ${C.bg}; border-radius: 3px; margin: 8px 0 10px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: ${C.primary}; border-radius: 3px; }
  table.det th { background: ${C.bg}; color: ${C.secondary}; }
  tr.pending td:first-child { border-left: 3px solid ${C.bad}; }
  .st { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 9px; white-space: nowrap; }
  .st-ok { color: ${C.good}; background: ${C.goodBg}; }
  .st-no { color: ${C.bad}; background: ${C.badBg}; }
  .foot { margin: 24px 24px 0; font-size: 10px; color: ${C.muted}; border-top: 1px solid ${C.border}; padding-top: 8px; display: flex; justify-content: space-between; }
  @media print { .page { max-width: none; } .hero { border-radius: 0; } .newpage { break-before: page; } }
</style></head>
<body><div class="page">
  <header class="hero">
    <div class="brand">Namirial · Customer Success</div>
    <h1>${esc(title)}</h1>
    ${opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ''}
    <div class="meta">${meta}</div>
  </header>
  <div class="kpis">${kpiHtml}</div>
  ${contact ? `<h2>Cobertura por ${esc(groupLabel)}</h2><div class="block">${coverageChart(groups)}</div>` : ''}
  <h2>Resumen por ${esc(groupLabel)}</h2>
  <div class="block">${table}</div>
  ${detailHtml ? `<h2 class="newpage">Detalle por ${esc(groupLabel)}</h2>${detailHtml}` : ''}
  <div class="foot"><span>${esc(title)}</span><span>SE Tools · Namirial</span></div>
</div></body></html>`;
}
