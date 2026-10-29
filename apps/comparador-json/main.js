// Comparador JSON — migrado desde FormConverterExcel (modo «Mapa JSON»).
// La lógica vive en apps/_lib/json-mapper; acá solo la interfaz.
import '../_lib/form-tools.css';
import { $, $$, escapeHtml, updateSfFileStatus, fileToText, downloadBlob } from '../_lib/ui.js';
import { analyzeFormDef, compareWithSample } from '../_lib/json-mapper/index.js';

// Mismas funciones que exponía InsPipelineBundle (src/browser.js del repo viejo).
const Bundle = {
  downloadBlob,
  async runJsonMap({ jsonFile }) {
    if (!jsonFile) throw new Error('Cargá el JSON del form-definition');
    const text = await fileToText(jsonFile);
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { throw new Error('El archivo no es un JSON válido: ' + e.message); }
    return analyzeFormDef(parsed);
  },
  async runJsonCompare({ analysis, sampleFile, direction }) {
    if (!analysis) throw new Error('Primero cargá el form-definition');
    if (!sampleFile) throw new Error('Cargá el JSON de ejemplo del cliente');
    const text = await fileToText(sampleFile);
    let sample;
    try { sample = JSON.parse(text); }
    catch (e) { throw new Error('El ejemplo no es un JSON válido: ' + e.message); }
    return compareWithSample(analysis, sample, direction || 'output');
  },
};

// ==================== MAPA JSON FLOW ====================

var jmState = { file: null, result: null, tab: 'output', sample: null, comparison: null };

function initJsonMapFlow() {
    $('#jmJsonInput').addEventListener('change', function(e) {
        jmState.file = e.target.files[0] || null;
        updateSfFileStatus('jmJsonStatus', jmState.file);
        if (jmState.file) runJsonMap();
    });
    $('#jmSampleInput').addEventListener('change', function(e) {
        jmState.sample = e.target.files[0] || null;
        updateSfFileStatus('jmSampleStatus', jmState.sample);
        $('#jmCompareOpts').hidden = !jmState.sample;
        if (jmState.sample) runJsonCompare();
    });
    $('#jmCompareDir').addEventListener('change', runJsonCompare);
    $('#jmCompareFilter').addEventListener('change', renderJmCompare);
    $('#btnJmCompareDownload').addEventListener('click', downloadJmCompare);
    $$('.jm-tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
            $$('.jm-tab').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            jmState.tab = btn.dataset.tab;
            renderJmTree();
        });
    });
    $('#btnJmDownload').addEventListener('click', downloadJmTree);
    $('#btnJmDownloadAll').addEventListener('click', downloadJmReport);
    $('#jmFilter').addEventListener('input', renderJmPaths);
}

async function runJsonMap() {
    var statusEl = $('#jmStatus');
    statusEl.className = 'status active';
    statusEl.textContent = '⟳ Recorriendo las rutas del form-definition...';
    try {
        var res = await Bundle.runJsonMap({ jsonFile: jmState.file });
        jmState.result = res;
        statusEl.className = 'status active success';
        statusEl.textContent = '✓ ' + res.meta.fields + ' campos · ' + res.stats.outputPaths +
            ' rutas de salida · ' + res.stats.inputPaths + ' de entrada' +
            (res.stats.critical ? ' · ⚠ ' + res.stats.critical + ' problema(s) crítico(s)' : '');
        renderJsonMap(res);
        // Si ya había un ejemplo cargado, se recompara con el form-def nuevo.
        if (jmState.sample) runJsonCompare();
    } catch (err) {
        console.error(err);
        statusEl.className = 'status active error';
        statusEl.textContent = '✗ ' + err.message;
    }
}

function renderJsonMap(res) {
    $('#jmResultPanel').hidden = false;
    $('#jmTreePanel').hidden = false;
    $('#jmPathsPanel').hidden = false;
    $('#jmIssuesPanel').hidden = !res.issues.length;

    var stats = [
        ['Campos', res.meta.fields],
        ['Secciones', res.meta.sections],
        ['Rutas de salida', res.stats.outputPaths],
        ['Rutas de entrada', res.stats.inputPaths],
        ['Repeaters', res.stats.repeaters],
        ['Excluidos del JSON', res.stats.excluded],
        ['Sin ruta', res.stats.withoutOutput],
        ['Críticos', res.stats.critical],
        ['Reglas de plataforma', res.stats.reglasPlataforma || 0],
    ];
    $('#jmStats').innerHTML = stats.map(function(s) {
        return '<div class="sf-stat"><span class="sf-stat-label">' + escapeHtml(s[0]) +
            '</span><span class="sf-stat-value">' + s[1] + '</span></div>';
    }).join('');

    renderJmTree();
    renderJmPaths();

    $('#jmIssuesBody').innerHTML = res.issues.map(function(i) {
        // Las reglas de plataforma vienen con código (R09) y a veces con la
        // referencia de la spec (§E2); se muestran para poder ir a buscarlas.
        var codigo = /^R\d+$/.test(i.type)
            ? '<span class="jm-regla">' + escapeHtml(i.type) + '</span> '
            : '';
        var ref = i.ref ? ' <span class="jm-ref">' + escapeHtml(i.ref) + '</span>' : '';
        return '<tr>' +
            '<td><span class="sev ' + i.severity + '">' + i.severity + '</span></td>' +
            '<td style="font-family:monospace;font-size:0.72rem;">' + codigo + escapeHtml(i.path || '—') + ref + '</td>' +
            '<td>' + escapeHtml(i.detail) + '</td>' +
            '<td style="font-family:monospace;font-size:0.7rem;color:var(--text-dim);">' +
                escapeHtml((i.fields || []).slice(0, 4).join(', ')) +
                ((i.fields || []).length > 4 ? ' +' + (i.fields.length - 4) : '') + '</td>' +
            '</tr>';
    }).join('');
}

// Colorea el JSON dibujado: claves, placeholders <tipo> y valores concretos.
function highlightJson(text) {
    return escapeHtml(text)
        .replace(/&quot;(&lt;[^&]*?&gt;)&quot;/g, '"<span class="jm-ph">$1</span>"')
        .replace(/^(\s*)&quot;([^&]+?)&quot;:/gm, '$1"<span class="jm-key">$2</span>":');
}

function renderJmTree() {
    if (!jmState.result) return;
    var isOut = jmState.tab === 'output';
    var tree = isOut ? jmState.result.output.tree : jmState.result.input.tree;
    var count = isOut ? jmState.result.stats.outputPaths : jmState.result.stats.inputPaths;
    $('#jmTreeHint').textContent = isOut
        ? 'Lo que el formulario ENVÍA al completarse — ' + count + ' rutas. Cada hoja muestra el tipo del campo o los valores posibles.'
        : 'Lo que el formulario CONSUME para prellenarse — ' + count + ' rutas (prefillKey + prefillMappings).';
    $('#jmTree').innerHTML = highlightJson(JSON.stringify(tree, null, 2));
}

function renderJmPaths() {
    if (!jmState.result) return;
    var q = ($('#jmFilter').value || '').toLowerCase().trim();
    var rows = [];
    jmState.result.output.paths.forEach(function(p) { rows.push({ dir: 'out', p: p }); });
    jmState.result.input.paths.forEach(function(p) { rows.push({ dir: 'in', p: p }); });
    if (q) {
        rows = rows.filter(function(r) {
            if (r.p.path.toLowerCase().indexOf(q) !== -1) return true;
            return r.p.fields.some(function(f) {
                return String(f.id || '').toLowerCase().indexOf(q) !== -1 ||
                       String(f.label || '').toLowerCase().indexOf(q) !== -1;
            });
        });
    }
    var shown = rows.slice(0, 400);
    $('#jmPathsBody').innerHTML = shown.map(function(r) {
        var ids = r.p.fields.map(function(f) { return f.id; });
        return '<tr>' +
            '<td><span class="jm-dir ' + r.dir + '">' + (r.dir === 'out' ? 'salida' : 'entrada') + '</span></td>' +
            '<td style="font-family:monospace;font-size:0.72rem;">' + escapeHtml(r.p.path) + '</td>' +
            '<td style="font-family:monospace;font-size:0.7rem;color:var(--text-muted);">' +
                escapeHtml(ids.slice(0, 3).join(', ')) + (ids.length > 3 ? ' +' + (ids.length - 3) : '') + '</td>' +
            '</tr>';
    }).join('') + (rows.length > shown.length
        ? '<tr><td colspan="3" style="color:var(--text-dim);">… ' + (rows.length - shown.length) + ' rutas más (filtrá para verlas)</td></tr>'
        : '');
}

function downloadJmTree() {
    if (!jmState.result) return;
    var isOut = jmState.tab === 'output';
    var tree = isOut ? jmState.result.output.tree : jmState.result.input.tree;
    var base = jmState.file ? jmState.file.name.replace(/\.json$/i, '') : 'formdef';
    var blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json;charset=utf-8' });
    Bundle.downloadBlob(blob, base + (isOut ? '_salida' : '_entrada') + '.json');
}

async function runJsonCompare() {
    if (!jmState.result || !jmState.sample) return;
    var statusEl = $('#jmStatus');
    statusEl.className = 'status active';
    statusEl.textContent = '⟳ Comparando con el ejemplo del cliente...';
    try {
        var cmp = await Bundle.runJsonCompare({
            analysis: jmState.result,
            sampleFile: jmState.sample,
            direction: $('#jmCompareDir').value,
        });
        jmState.comparison = cmp;
        statusEl.className = 'status active success';
        statusEl.textContent = '✓ Cobertura del contrato: ' + cmp.coverage + '% · ' +
            cmp.counts.falta + ' faltan · ' + cmp.counts.forma + ' con forma distinta · ' +
            cmp.counts.sobra + ' sobran';
        renderJmCompare();
    } catch (err) {
        console.error(err);
        statusEl.className = 'status active error';
        statusEl.textContent = '✗ ' + err.message;
    }
}

function renderJmCompare() {
    var cmp = jmState.comparison;
    if (!cmp) return;
    $('#jmComparePanel').hidden = false;

    var stats = [
        ['Cobertura', cmp.coverage + '%'],
        ['Coinciden', cmp.counts.ok],
        ['Faltan', cmp.counts.falta],
        ['Forma distinta', cmp.counts.forma],
        ['Sobran', cmp.counts.sobra],
        ['Rutas del cliente', cmp.clientPaths],
    ];
    $('#jmCompareStats').innerHTML = stats.map(function(s) {
        return '<div class="sf-stat"><span class="sf-stat-label">' + escapeHtml(s[0]) +
            '</span><span class="sf-stat-value">' + s[1] + '</span></div>';
    }).join('');

    var mode = $('#jmCompareFilter').value;
    var rows = cmp.rows.filter(function(r) {
        if (mode === 'all') return true;
        if (mode === 'problem') return r.status !== 'ok';
        return r.status === mode;
    });

    var label = { ok: 'coincide', falta: 'falta', forma: 'forma', sobra: 'sobra' };
    var sev = { ok: 'info', falta: 'critical', forma: 'critical', sobra: 'warning' };
    $('#jmCompareBody').innerHTML = rows.slice(0, 500).map(function(r) {
        var extra = r.suggestion
            ? '<div style="color:var(--accent-teal);font-family:monospace;font-size:0.7rem;margin-top:2px;">→ el form la escribe en: ' + escapeHtml(r.suggestion) + '</div>'
            : '';
        var ej = (r.sample !== null && r.sample !== undefined)
            ? '<div style="color:var(--text-dim);font-size:0.7rem;margin-top:2px;">ej: ' + escapeHtml(JSON.stringify(r.sample).slice(0, 60)) + '</div>'
            : '';
        return '<tr>' +
            '<td><span class="sev ' + sev[r.status] + '">' + label[r.status] + '</span></td>' +
            '<td style="font-family:monospace;font-size:0.72rem;">' + escapeHtml(r.path) + ej + '</td>' +
            '<td>' + escapeHtml(r.detail) + extra + '</td>' +
            '</tr>';
    }).join('') || '<tr><td colspan="3" style="color:var(--text-dim);">Nada en esta categoría</td></tr>';
}

function downloadJmCompare() {
    if (!jmState.comparison) return;
    var base = jmState.file ? jmState.file.name.replace(/\.json$/i, '') : 'formdef';
    var blob = new Blob([JSON.stringify({
        formDefinition: jmState.file ? jmState.file.name : null,
        ejemploCliente: jmState.sample ? jmState.sample.name : null,
        comparadoContra: jmState.comparison.direction,
        cobertura: jmState.comparison.coverage,
        resumen: jmState.comparison.counts,
        filas: jmState.comparison.rows,
    }, null, 2)], { type: 'application/json;charset=utf-8' });
    Bundle.downloadBlob(blob, base + '_comparacion.json');
}

function downloadJmReport() {
    if (!jmState.result) return;
    var r = jmState.result;
    var report = {
        archivo: jmState.file ? jmState.file.name : null,
        meta: r.meta,
        estadisticas: r.stats,
        jsonDeSalida: r.output.tree,
        jsonDeEntrada: r.input.tree,
        rutasDeSalida: r.output.paths.map(function(p) {
            return { ruta: p.path, campos: p.fields.map(function(f) { return f.id; }), valores: p.values };
        }),
        rutasDeEntrada: r.input.paths.map(function(p) {
            return { ruta: p.path, campos: p.fields.map(function(f) { return f.id; }), condiciones: p.conditions };
        }),
        repeaters: r.repeaters,
        problemas: r.issues,
    };
    var base = jmState.file ? jmState.file.name.replace(/\.json$/i, '') : 'formdef';
    var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    Bundle.downloadBlob(blob, base + '_mapa.json');
}

initJsonMapFlow();
