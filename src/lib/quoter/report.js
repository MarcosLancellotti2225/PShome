/**
 * Reporte comercial de una cotización (HTML; el PDF sale de imprimirlo).
 *
 * Muestra la cotización según contrato: lo mismo que la pantalla del cotizador
 * (reportModel en contract.js), con las horas cargadas y los precios vigentes.
 * Devuelve un HTML autocontenido (sin assets externos).
 */

import { money } from './contract.js';

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Colores de marca Namirial (el reporte sale de la app, no puede leer los tokens CSS).
var BRAND = { primary: '#047c76', deep: '#012825', text: '#0a1111', secondary: '#4f5b5b', muted: '#778383', border: '#cddbdb', bg: '#f0f3f8', light: '#defffb' };
var LEVEL = {
    baja: { color: '#198446', bg: '#e3f5ea' },
    media: { color: '#8c6410', bg: '#fcefd2' },
    alta: { color: '#ad4546', bg: '#f9e3e3' },
};

function roleTag(role) {
    if (role === 'principal') return ' <span class="role">Principal del grupo</span>';
    if (role === 'agrupado') return ' <span class="role">Agrupado: se cobra lo nuevo</span>';
    return '';
}

function pill(levelKey, texto) {
    var c = LEVEL[levelKey] || LEVEL.media;
    return '<span class="pill" style="color:' + c.color + ';background:' + c.bg + '">' + esc(texto) + '</span>';
}

/**
 * @param {Object} model - reportModel(result.contract, pricing, hours)
 * @param {Object} [opts] - { proyecto, archivo, fecha }
 */
function buildCommercialReport(model, opts) {
    opts = opts || {};
    var c = model.currency;
    var nombre = opts.proyecto || (opts.archivo || 'Formulario').replace(/\.zip$/i, '').replace(/[_-]+/g, ' ');

    var formsHtml = model.items.map(function (it) {
        var lines = it.lines.map(function (l) {
            return '<tr><td>' + esc(l.label) + '</td><td class="amt">' + (l.amount == null ? '<span class="tbd">a estimar</span>' : esc(money(l.amount, c))) + '</td></tr>';
        }).join('');
        return '<div class="form">' +
            '<div class="form-head"><div><div class="fname">' + esc(it.name) + roleTag(it.role) + '</div>' +
            '<div class="fsub">' + it.fields + (it.role === 'agrupado' ? ' campos nuevos · ' : ' campos de captura · ') + it.rules + (it.role === 'agrupado' ? ' reglas nuevas' : ' reglas de negocio') + (it.pdf ? '<br>Documento: ' + esc(it.pdf) : '') + '</div></div>' +
            pill(it.levelKey, 'Complejidad ' + it.level.toLowerCase() + ' · línea ' + it.line) + '</div>' +
            '<p class="why">' + esc(it.why) + '</p>' +
            '<table class="lines">' + lines +
            '<tr class="sub"><td>Total del formulario</td><td class="amt">' + esc(money(it.total, c)) + (it.pending ? ' + horas' : '') + '</td></tr>' +
            '</table></div>';
    }).join('');

    var tiersHtml = model.tiers.map(function (t) {
        return '<tr><td>' + pill(t.key, t.label) + '</td><td>hasta ' + t.maxFields + ' campos</td><td>hasta ' + t.maxRules + ' reglas</td><td class="amt">' + esc(money(t.price, c)) + '</td></tr>';
    }).join('');

    var attachHtml = model.attachments.map(function (a) {
        return '<li><b>' + esc(a.file) + ':</b> ' + esc(a.reason) + '</li>';
    }).join('');

    var empty = !model.items.length
        ? '<div class="note warn">No se encontró la ficha de configuración en el ZIP (el Excel con la columna «Nombre del campo en formulario»), así que no se puede cotizar según el contrato.</div>'
        : '';

    return '<!doctype html>\n<html lang="es"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>' + esc(nombre) + ' — Cotización</title><style>' +
'*{box-sizing:border-box}' +
'body{margin:0;background:' + BRAND.bg + ';color:' + BRAND.text + ';font-family:"Open Sans","Segoe UI",system-ui,sans-serif;line-height:1.55}' +
'.sheet{max-width:820px;margin:32px auto;background:#fff;border-radius:14px;padding:44px 48px;box-shadow:0 4px 24px rgba(1,40,37,.08)}' +
'.brand{font-size:.72rem;letter-spacing:.2em;font-weight:700;text-transform:uppercase;color:' + BRAND.primary + '}' +
'h1{font-size:1.55rem;margin:6px 0 4px;letter-spacing:-.01em}' +
'.meta{color:' + BRAND.muted + ';font-size:.86rem;margin-bottom:26px}' +
'.total{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;background:' + BRAND.deep + ';color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:26px}' +
'.total .lbl{font-size:.85rem;color:#bfe9e5}.total .num{font-size:1.7rem;font-weight:800}.total small{display:block;font-size:.75rem;color:#bfe9e5;font-weight:400;text-align:right}' +
'h2{font-size:1rem;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid ' + BRAND.border + '}' +
'.form{border:1px solid ' + BRAND.border + ';border-radius:10px;padding:16px 18px;margin-bottom:14px}' +
'.form-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}' +
'.fname{font-weight:700}.fsub{font-size:.8rem;color:' + BRAND.secondary + '}' +
'.why{font-size:.86rem;color:' + BRAND.secondary + ';margin:8px 0}' +
'table{width:100%;border-collapse:collapse;font-size:.88rem}td{padding:6px 0;border-bottom:1px solid #eef2f2;vertical-align:middle}' +
'.amt{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}' +
'.lines tr.sub td{font-weight:700;border-bottom:0;padding-top:9px}' +
'.tbd{color:' + LEVEL.media.color + ';font-weight:600}' +
'.pill{display:inline-block;padding:2px 11px;border-radius:99px;font-size:.78rem;font-weight:700;white-space:nowrap}' +
'.tiers td{padding:7px 8px 7px 0}' +
'ul{margin:0;padding-left:20px;font-size:.9rem}li{margin-bottom:5px}' +
'.note{padding:12px 16px;border-radius:9px;font-size:.88rem;margin-top:14px}' +
'.role{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:6px;background:' + BRAND.light + ';color:' + BRAND.primary + ';font-size:.7rem;font-weight:700;vertical-align:middle}' +
'.note.ok{background:' + BRAND.light + ';border-left:4px solid ' + BRAND.primary + '}' +
'.expl li{font-size:.86rem;color:' + BRAND.secondary + '}' +
'.note.warn{background:' + LEVEL.media.bg + ';border-left:4px solid ' + LEVEL.media.color + '}' +
'.foot{margin-top:30px;padding-top:14px;border-top:1px solid ' + BRAND.border + ';font-size:.75rem;color:' + BRAND.muted + '}' +
'@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none;padding:0}.form{break-inside:avoid}' +
'.total{background:#fff;color:' + BRAND.text + ';border:2px solid ' + BRAND.primary + '}.total .lbl,.total small{color:' + BRAND.secondary + '}.total .num{color:' + BRAND.deep + '}}' +
'</style></head><body><div class="sheet">' +
'<div class="brand">Namirial · Cotización</div>' +
'<h1>' + esc(nombre) + '</h1>' +
'<div class="meta">Formularios digitales bajo demanda' + (opts.fecha ? ' · ' + esc(opts.fecha) : '') + '</div>' +
empty +
(model.items.length
    ? '<div class="total"><div><div class="lbl">' + (model.items.length === 1 ? '1 formulario' : model.items.length + ' formularios') + ' · total sin IVA</div>' +
      '<div class="num">' + esc(money(model.total, c)) + '</div></div>' +
      (model.pending ? '<small>+ horas de reglas adicionales,<br>a estimar a ' + esc(money(model.hourRate, c)) + ' la hora</small>' : '') + '</div>'
    : '') +
(formsHtml ? '<h2>Detalle por formulario</h2>' + formsHtml : '') +
(model.grouped ? '<div class="note ok">Cotizados en grupo: los formularios comparten campos y reglas, que se cobran una sola vez. Por separado sumarían ' + esc(money(model.separateTotal, c)) + '.</div>' : '') +
(attachHtml ? '<h2>Documentos que no se cotizan</h2><ul>' + attachHtml + '</ul>' : '') +
(model.explanation.length ? '<h2>Cómo se calculó</h2><ul class="expl">' + model.explanation.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
(model.includes.length ? '<h2>Qué incluye</h2><ul>' + model.includes.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '') +
'<h2>Niveles del contrato</h2><table class="tiers">' + tiersHtml + '</table>' +
'<div class="foot">Precios según ' + esc(model.source) + '. Sin IVA ni retenciones. ' +
'Campos de captura: los que completa el usuario. Las reglas que superan el máximo del nivel se estiman en horas y requieren aprobación previa.</div>' +
'</div></body></html>';
}

export { buildCommercialReport };
