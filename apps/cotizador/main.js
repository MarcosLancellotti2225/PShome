// Cotizador — migrado desde FormConverterExcel (modo «Cotizador»).
// La lógica vive en apps/_lib/quoter; acá solo la interfaz.
import '../_lib/form-tools.css';
import { $, escapeHtml, updateSfFileStatus, fileToUint8Array, downloadBlob } from '../_lib/ui.js';
import { analyzeZip, scoreProject, calibrateThresholds, DEFAULT_CONFIG } from '../_lib/quoter/index.js';
import { buildCommercialReport } from '../_lib/quoter/report.js';
import { buildDocxReport } from '../_lib/quoter/docx.js';

function mergedConfig(config) {
  return {
    weights: Object.assign({}, DEFAULT_CONFIG.weights, (config && config.weights) || {}),
    thresholds: Object.assign({}, DEFAULT_CONFIG.thresholds, (config && config.thresholds) || {}),
    hoursPerPoint: (config && config.hoursPerPoint) || DEFAULT_CONFIG.hoursPerPoint,
    // != null: 0 es un valor válido (lo repetido no cuesta nada).
    reuseFactor: (config && config.reuseFactor != null) ? config.reuseFactor : DEFAULT_CONFIG.reuseFactor,
  };
}

// Mismas funciones que exponía InsPipelineBundle (src/browser.js del repo viejo).
const Bundle = {
  downloadBlob,
  async runQuoteZip({ zipFile, config }) {
    if (!zipFile) throw new Error('Cargá un archivo ZIP');
    return analyzeZip(await fileToUint8Array(zipFile), config || null);
  },
  // Calibra los umbrales a partir de un caso real: "este proyecto es Medio".
  calibrateQuote(totals, targetLevel, config) {
    const base = mergedConfig(config);
    const current = scoreProject(totals, base);
    base.thresholds = calibrateThresholds(current.points, targetLevel, base.thresholds);
    return { thresholds: base.thresholds, score: scoreProject(totals, base) };
  },
  // Recalcula el nivel con otros umbrales/pesos, sin volver a leer el ZIP.
  requote(totals, config) {
    return scoreProject(totals, mergedConfig(config));
  },
  buildQuoteReport(result, opts) { return buildCommercialReport(result, opts || {}); },
  buildQuoteDocx(result, opts) { return buildDocxReport(result, opts || {}); },
};

// ==================== COTIZADOR FLOW ====================

var quoterState = { zip: null, result: null };

function initQuoterFlow() {
    $('#quoterZipInput').addEventListener('change', function(e) {
        quoterState.zip = e.target.files[0] || null;
        updateSfFileStatus('quoterZipStatus', quoterState.zip);
        $('#btnQuote').disabled = !quoterState.zip;
    });
    $('#btnQuote').addEventListener('click', runQuote);
    $('#btnQuoteJson').addEventListener('click', downloadQuoteJson);
    $('#btnQuoteReport').addEventListener('click', function() { commercialReport('download'); });
    $('#btnQuoteReportView').addEventListener('click', function() { commercialReport('view'); });
    $('#btnQuoteReportPdf').addEventListener('click', function() { commercialReport('pdf'); });
    $('#btnQuoteReportDocx').addEventListener('click', exportQuoteDocx);
    $('#btnRequote').addEventListener('click', requoteWithThresholds);
    $('#btnCalibrate').addEventListener('click', calibrateFromCase);
    restoreQuoteConfig();
}

var QUOTE_CFG_KEY = 'formtools.quoter.config';

function currentQuoteConfig() {
    var rf = parseFloat($('#quoteReuse').value);
    return {
        thresholds: {
            baja: parseFloat($('#quoteThFacil').value) || 900,
            media: parseFloat($('#quoteThMedio').value) || 1800,
        },
        hoursPerPoint: parseFloat($('#quoteHpp').value) || 0.035,
        reuseFactor: isNaN(rf) ? 0.15 : rf,
    };
}

function saveQuoteConfig(cfg) {
    try { localStorage.setItem(QUOTE_CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* sin storage */ }
}

function restoreQuoteConfig() {
    try {
        var raw = localStorage.getItem(QUOTE_CFG_KEY);
        if (!raw) return;
        var cfg = JSON.parse(raw);
        if (cfg.thresholds) {
            // Se acepta el nombrado viejo (facil/medio) de configs guardadas.
            var tb = cfg.thresholds.baja != null ? cfg.thresholds.baja : cfg.thresholds.facil;
            var tm = cfg.thresholds.media != null ? cfg.thresholds.media : cfg.thresholds.medio;
            if (tb != null) $('#quoteThFacil').value = tb;
            if (tm != null) $('#quoteThMedio').value = tm;
        }
        if (cfg.hoursPerPoint) $('#quoteHpp').value = cfg.hoursPerPoint;
        if (cfg.reuseFactor != null) $('#quoteReuse').value = cfg.reuseFactor;
    } catch (e) { /* config inválida: se ignora */ }
}

// Calibra los umbrales a partir de un caso real ("este es Medio") y los deja
// guardados para las próximas cotizaciones.
function calibrateFromCase() {
    if (!quoterState.result) return;
    var target = $('#quoteTargetLevel').value;
    var cfg = currentQuoteConfig();
    var res = Bundle.calibrateQuote(quoterState.result.totals, target, cfg);
    $('#quoteThFacil').value = res.thresholds.baja;
    $('#quoteThMedio').value = res.thresholds.media;
    cfg.thresholds = res.thresholds;
    saveQuoteConfig(cfg);
    quoterState.result.score = res.score;
    renderQuoteScore(res.score);
    renderQuoteReuse(quoterState.result);
    $('#calibrateMsg').textContent = '✓ Calibrado con este caso: Baja ≤ ' +
        res.thresholds.baja + ', Media ≤ ' + res.thresholds.media + ' (guardado)';
}

async function runQuote() {
    var statusEl = $('#quoterStatus');
    statusEl.className = 'status active';
    statusEl.textContent = '⟳ Abriendo el ZIP y analizando su contenido...';
    $('#btnQuote').disabled = true;
    try {
        var t0 = performance.now();
        var res = await Bundle.runQuoteZip({
            zipFile: quoterState.zip,
            config: currentQuoteConfig(),   // umbrales calibrados por el usuario
        });
        var t1 = performance.now();
        quoterState.result = res;
        statusEl.className = 'status active success';
        statusEl.textContent = '✓ ' + res.totals.files + ' archivos analizados en ' + Math.round(t1 - t0) + 'ms' +
            (res.errors.length ? ' · ⚠ ' + res.errors.length + ' con error' : '');
        $('#btnQuoteJson').hidden = false;
        $('#btnQuoteReport').hidden = false;
        $('#btnQuoteReportView').hidden = false;
        $('#btnQuoteReportPdf').hidden = false;
        $('#btnQuoteReportDocx').hidden = false;
        renderQuote(res);
    } catch (err) {
        console.error(err);
        statusEl.className = 'status active error';
        statusEl.textContent = '✗ ' + err.message;
    }
    $('#btnQuote').disabled = !quoterState.zip;
}

function renderQuote(res) {
    $('#quoterResultPanel').hidden = false;
    $('#quoterDetailPanel').hidden = false;
    renderQuoteScore(res.score);

    var t = res.totals;
    var stats = [
        ['Campos del PDF', t.pdfFields],
        ['Reglas de negocio', t.businessRules],
        ['Condicionales', t.conditionalRules],
        ['Bloques repetidos', t.repeaters],
        ['Catálogos', t.catalogs],
        ['Páginas', t.pages],
        ['Reutilización', (t.reuse ? t.reuse.percent : 0) + '%'],
        ['Pestañas Excel', t.excelSheets],
    ];
    $('#quoterStats').innerHTML = stats.map(function(s) {
        return '<div class="sf-stat"><span class="sf-stat-label">' + escapeHtml(s[0]) +
            '</span><span class="sf-stat-value">' + s[1] + '</span></div>';
    }).join('');

    renderQuoteReuse(res);

    // Inventario
    $('#quoteInventoryBody').innerHTML = res.inventory.map(function(f) {
        return '<tr><td>' + escapeHtml(f.path) + '</td>' +
            '<td><span class="q-tag ' + escapeHtml(f.kind) + '">' + escapeHtml(f.kind) + '</span></td>' +
            '<td style="text-align:right;color:var(--text-dim);">' + escapeHtml(f.sizeLabel || '') + '</td>' +
            '<td>' + escapeHtml(f.detail || f.error || '') + '</td></tr>';
    }).join('');

    // ── Complejidad por formulario (PDF + sus reglas) ─────────────────────
    var docs = res.documents || [];
    $('#quoterDocsPanel').hidden = !docs.length;
    var sevOf = function(k) { return k === 'baja' ? 'info' : k === 'media' ? 'warning' : 'critical'; };
    $('#quoteDocsLevelBody').innerHTML = docs.map(function(d) {
        return '<tr>' +
            '<td>' + escapeHtml(d.file) + '</td>' +
            '<td style="text-align:right;">' + d.fields + '</td>' +
            '<td style="text-align:right;">' + d.pages + '</td>' +
            '<td style="text-align:right;">' + d.businessRules + '</td>' +
            '<td style="text-align:right;color:var(--text-dim);">' + d.points + '</td>' +
            '<td><span class="sev ' + sevOf(d.levelKey) + '">' + escapeHtml(d.level) + '</span></td>' +
            '<td style="text-align:right;font-weight:600;">' + (d.weeks === 1 ? '1 semana' : d.weeks + ' semanas') + '</td>' +
            '</tr>';
    }).join('');
    if (docs.length > 1) {
        var suma = docs.reduce(function(a, d) { return a + d.weeks; }, 0);
        $('#quoteDocsNote').textContent = 'Por separado suman ' + suma + ' semanas. Como entrega única el conjunto se cotiza ' +
            res.score.level + ' (' + (res.score.weeks === 1 ? '1 semana' : res.score.weeks + ' semanas') + ').';
        $('#quoteDocsNote').hidden = false;
    } else { $('#quoteDocsNote').hidden = true; }

    // ── Clasificación por archivo ─────────────────────────────────────────
    var byFile = res.byFile || [];
    $('#quoterByFilePanel').hidden = !byFile.length;
    $('#quoteByFileBody').innerHTML = byFile.map(function(f) {
        // Barra proporcional para ver de un vistazo quién pesa más.
        var bar = f.share
            ? '<div style="height:4px;border-radius:2px;background:var(--accent);width:' +
              Math.max(4, Math.min(100, f.share)) + '%;margin-top:3px;opacity:0.7;"></div>'
            : '';
        var lvl = f.levelKey === 'info'
            ? '<span style="color:var(--text-dim);">—</span>'
            : '<span class="sev ' + (f.levelKey === 'baja' ? 'info' : f.levelKey === 'media' ? 'warning' : 'critical') + '">' +
              escapeHtml(f.level) + '</span>';
        return '<tr>' +
            '<td><span class="q-tag ' + escapeHtml(f.kind) + '">' + escapeHtml(f.kind) + '</span> ' + escapeHtml(f.file) + '</td>' +
            '<td style="color:var(--text-muted);">' + escapeHtml(f.role) + '</td>' +
            '<td style="color:var(--text-muted);font-size:0.78rem;">' + escapeHtml(f.detail) + '</td>' +
            '<td style="text-align:right;font-weight:700;">' + f.points + '</td>' +
            '<td style="text-align:right;">' + f.share + '%' + bar + '</td>' +
            '<td>' + lvl + '</td>' +
            '</tr>';
    }).join('');

    // ── Espacios por PDF ──────────────────────────────────────────────────
    $('#quoterPdfPanel').hidden = !res.pdfs.length;
    var tot = { pages: 0, fields: 0, text: 0, check: 0, other: 0, groups: 0 };
    var pdfRows = res.pdfs.map(function(p) {
        // Los tipos que reporta el detector se agrupan en 3 columnas legibles.
        var text = 0, check = 0, other = 0;
        Object.keys(p.byType).forEach(function(k) {
            var n = p.byType[k];
            if (/text/i.test(k)) text += n;
            else if (/check|radio|button/i.test(k)) check += n;
            else other += n;
        });
        tot.pages += p.pages; tot.fields += p.fieldCount;
        tot.text += text; tot.check += check; tot.other += other;
        tot.groups += p.repeaterGroups || 0;
        return '<tr>' +
            '<td>' + escapeHtml(p.file) + '</td>' +
            '<td style="text-align:right;">' + p.pages + '</td>' +
            '<td style="text-align:right;font-weight:700;color:var(--accent);">' + p.fieldCount + '</td>' +
            '<td style="text-align:right;">' + text + '</td>' +
            '<td style="text-align:right;">' + check + '</td>' +
            '<td style="text-align:right;color:var(--text-dim);">' + other + '</td>' +
            '<td style="text-align:right;">' + (p.repeaterGroups || 0) + '</td>' +
            '</tr>';
    }).join('');
    $('#quotePdfBody').innerHTML = pdfRows ||
        '<tr><td colspan="7" style="color:var(--text-dim);">Sin PDFs en el ZIP</td></tr>';
    $('#quotePdfFoot').innerHTML = res.pdfs.length > 1
        ? '<tr style="border-top:2px solid var(--border);font-weight:700;">' +
          '<td>TOTAL (' + res.pdfs.length + ' PDFs)</td>' +
          '<td style="text-align:right;">' + tot.pages + '</td>' +
          '<td style="text-align:right;color:var(--accent);">' + tot.fields + '</td>' +
          '<td style="text-align:right;">' + tot.text + '</td>' +
          '<td style="text-align:right;">' + tot.check + '</td>' +
          '<td style="text-align:right;">' + tot.other + '</td>' +
          '<td style="text-align:right;">' + tot.groups + '</td></tr>'
        : '';

    // ── Reglas de negocio por matriz ──────────────────────────────────────
    $('#quoterExcelPanel').hidden = !res.excels.length;
    var sheetRows = '';
    res.excels.forEach(function(x) {
        // Fila cabecera por archivo, con el total de reglas de esa matriz.
        sheetRows += '<tr style="background:var(--bg-elevated);font-weight:700;">' +
            '<td>' + escapeHtml(x.file) + ' <span style="font-weight:400;color:var(--text-dim);">(' + x.sheetCount + ' pestañas)</span></td>' +
            '<td></td>' +
            '<td style="text-align:right;">' + (x.fieldRows || 0) + '</td>' +
            '<td style="text-align:right;color:var(--accent);">' + (x.businessRules || 0) + '</td>' +
            '<td style="text-align:right;">' + (x.conditionalRules || 0) + '</td>' +
            '<td style="text-align:right;">' + ((x.catalogs || 0) + (x.catalogRefs || 0)) + '</td>' +
            '<td></td></tr>';
        x.sheets.forEach(function(s) {
            var tipo = s.ignored ? '<span style="color:var(--text-dim);">ignorada (output/índice)</span>'
                : s.isCatalog ? '<span class="q-tag catalogo">catálogo ' + s.catalogItems + '</span>'
                : s.empty ? '<span style="color:var(--text-dim);">vacía</span>'
                : 'reglas';
            sheetRows += '<tr>' +
                '<td style="padding-left:1.5rem;color:var(--text-muted);">' + escapeHtml(s.name) + '</td>' +
                '<td style="text-align:right;">' + (s.rows || 0) + '</td>' +
                '<td style="text-align:right;">' + (s.fieldRows || 0) + '</td>' +
                '<td style="text-align:right;font-weight:600;">' + (s.businessRules || 0) + '</td>' +
                '<td style="text-align:right;">' + (s.conditionalRules || 0) + '</td>' +
                '<td style="text-align:right;color:var(--text-dim);">' + (s.catalogRefs || 0) + '</td>' +
                '<td>' + tipo + '</td></tr>';
        });
    });
    $('#quoteSheetsBody').innerHTML = sheetRows ||
        '<tr><td colspan="7" style="color:var(--text-dim);">Sin Excels en el ZIP</td></tr>';

    // ── JSONs ─────────────────────────────────────────────────────────────
    var docRows = '';
    res.jsons.forEach(function(j) {
        var det = j.kind === 'form-def'
            ? (j.fields + ' campos · ' + j.sections + ' secciones · ' + j.repeaters + ' repeaters · ' +
               j.lookups + ' lookups · ' + j.conditionals + ' condicionales')
            : ('JSON de datos · ' + (j.topLevelKeys || 0) + ' claves');
        docRows += '<tr><td>' + escapeHtml(j.file) + '</td><td><span class="q-tag json">JSON</span></td>' +
            '<td>' + escapeHtml(det) + '</td></tr>';
    });
    $('#quoteDocsBody').innerHTML = docRows ||
        '<tr><td colspan="3" style="color:var(--text-dim);">Sin JSONs en el ZIP</td></tr>';
}

function renderQuoteReuse(res) {
    var ru = res.reuse;
    var pairs = (ru.pdf.pairs || []).concat(ru.excel.pairs || []);
    var hasReuse = pairs.length || ru.pdf.internalSaved;
    $('#quoterReusePanel').hidden = !hasReuse;
    if (!hasReuse) return;

    var stats = [
        ['% ya resuelto', ru.percent + '%'],
        ['Campos repetidos', res.score.repeatedFields],
        ['Reglas repetidas', res.score.repeatedRules],
        ['Puntos ahorrados', res.score.savedPoints],
        ['Grupos [n] (interno)', ru.pdf.internalSaved],
        ['Campos nuevos', ru.pdf.unique],
    ];
    $('#quoteReuseStats').innerHTML = stats.map(function(s) {
        return '<div class="sf-stat"><span class="sf-stat-label">' + escapeHtml(s[0]) +
            '</span><span class="sf-stat-value">' + s[1] + '</span></div>';
    }).join('');

    $('#quoteReuseBody').innerHTML = pairs.length ? pairs.map(function(p) {
        return '<tr><td>' + escapeHtml(p.file) + '</td>' +
            '<td style="color:var(--text-dim);">' + escapeHtml(p.against) + '</td>' +
            '<td style="text-align:right;font-weight:600;color:var(--accent-green);">' + p.shared + '</td>' +
            '<td style="text-align:right;">' + p.own + '</td>' +
            '<td style="text-align:right;">' + p.percentShared + '%</td></tr>';
    }).join('') : '<tr><td colspan="5" style="color:var(--text-dim);">Un solo formulario: el ahorro viene de los bloques repetidos internos</td></tr>';
}

function renderQuoteScore(score) {
    var el = $('#quoteLevel');
    el.textContent = score.level;
    el.className = 'quote-level ' + score.levelKey;
    $('#quotePoints').textContent = score.points;
    var sem = score.weeks === 1 ? '1 semana' : score.weeks + ' semanas';
    $('#quoteHours').textContent = 'Plazo estimado: ' + sem +
        ' · Baja ≤ ' + score.thresholds.baja + ' · Media ≤ ' + score.thresholds.media;
    $('#quoteBreakdownBody').innerHTML = score.breakdown.map(function(b) {
        var dim = b.count ? '' : ' style="color:var(--text-dim);"';
        return '<tr' + dim + '><td>' + escapeHtml(b.label) + '</td>' +
            '<td style="text-align:right;">' + b.count + '</td>' +
            '<td style="text-align:right;color:var(--text-dim);">×' + b.weight + '</td>' +
            '<td style="text-align:right;font-weight:600;">' + b.points + '</td></tr>';
    }).join('');
}

function requoteWithThresholds() {
    if (!quoterState.result) return;
    var cfg = currentQuoteConfig();
    saveQuoteConfig(cfg);
    $('#calibrateMsg').textContent = '';
    var score = Bundle.requote(quoterState.result.totals, cfg);
    quoterState.result.score = score;
    renderQuoteScore(score);
    renderQuoteReuse(quoterState.result);
}

// Reporte de una página para mandar a comercial: sin puntajes ni pesos.
function commercialReport(mode) {
    if (!quoterState.result) return;
    var nombre = (quoterState.zip ? quoterState.zip.name : 'formulario')
        .replace(/\.zip$/i, '');
    var html = Bundle.buildQuoteReport(quoterState.result, {
        archivo: quoterState.zip ? quoterState.zip.name : null,
        fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
    });
    if (mode === 'view' || mode === 'pdf') {
        var w = window.open('', '_blank');
        if (!w) {
            $('#quoterStatus').className = 'status active error';
            $('#quoterStatus').textContent = '✗ El navegador bloqueó la pestaña. Usá "Reporte para comercial" para descargarlo.';
            return;
        }
        w.document.write(html);
        w.document.close();
        if (mode === 'pdf') {
            // El diálogo de impresión del navegador: "Guardar como PDF".
            // Se espera al render para que no salga la hoja en blanco.
            w.onload = function() { w.focus(); w.print(); };
            setTimeout(function() { try { w.focus(); w.print(); } catch (e) { /* ya impreso */ } }, 400);
        }
        return;
    }
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    Bundle.downloadBlob(blob, nombre + '_estimacion.html');
}

async function exportQuoteDocx() {
    if (!quoterState.result) return;
    var statusEl = $('#quoterStatus');
    statusEl.className = 'status active';
    statusEl.textContent = '⟳ Generando el documento de Word...';
    try {
        var nombre = (quoterState.zip ? quoterState.zip.name : 'formulario').replace(/\.zip$/i, '');
        var bytes = await Bundle.buildQuoteDocx(quoterState.result, {
            archivo: quoterState.zip ? quoterState.zip.name : null,
            fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
        });
        var blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        Bundle.downloadBlob(blob, nombre + '_estimacion.docx');
        statusEl.className = 'status active success';
        statusEl.textContent = '✓ Word descargado.';
    } catch (err) {
        console.error(err);
        statusEl.className = 'status active error';
        statusEl.textContent = '✗ ' + err.message;
    }
}

function downloadQuoteJson() {
    if (!quoterState.result) return;
    var r = quoterState.result;
    var report = {
        archivo: quoterState.zip ? quoterState.zip.name : null,
        veredicto: {
            complejidad: r.score.level,
            puntos: r.score.points,
            horasEstimadas: r.score.estimatedHours,
            umbrales: r.score.thresholds,
        },
        reutilizacion: {
            porcentajeYaResuelto: r.reuse.percent,
            camposRepetidos: r.score.repeatedFields,
            reglasRepetidas: r.score.repeatedRules,
            puntosAhorrados: r.score.savedPoints,
            costoDeLoRepetido: r.score.reuseFactor,
            gruposRepetidosInternos: r.reuse.pdf.internalSaved,
            comparaciones: (r.reuse.pdf.pairs || []).concat(r.reuse.excel.pairs || []),
        },
        totales: r.totals,
        clasificacionPorArchivo: r.byFile,
        desglosePuntos: r.score.breakdown,
        inventario: r.inventory,
        pdfs: r.pdfs,
        excels: r.excels,
        jsons: r.jsons,
        errores: r.errors,
    };
    var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    var name = (quoterState.zip ? quoterState.zip.name.replace(/\.zip$/i, '') : 'cotizacion') + '_cotizacion.json';
    Bundle.downloadBlob(blob, name);
}

initQuoterFlow();
