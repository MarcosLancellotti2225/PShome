
/**
 * Reporte comercial en Word (.docx real, no HTML renombrado): la cotización
 * según contrato, con el mismo modelo que el HTML (reportModel en contract.js).
 *
 * Arma el OOXML mínimo a mano con JSZip: un docx válido necesita
 * [Content_Types].xml, _rels/.rels, word/document.xml y las relaciones del
 * documento. Se genera así — en vez de un .doc con HTML adentro — para que
 * Word lo abra sin el aviso de "formato distinto" y quede editable.
 *
 * Unidades OOXML: las medidas van en twips (1/20 de punto, 1440 = 1 pulgada)
 * y los tamaños de fuente en medios puntos (28 = 14pt).
 */

import JSZip from 'jszip';
import { money } from './contract.js';

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Colores de marca Namirial (hex sin #, como pide OOXML).
var COLORS = {
    baja:  { text: '198446', bg: 'E3F5EA' },
    media: { text: '8C6410', bg: 'FCEFD2' },
    alta:  { text: 'AD4546', bg: 'F9E3E3' },
    primary: '047C76',
    deep:  '012825',
    muted: '778383',
    secondary: '4F5B5B',
    dark:  '0A1111',
    line:  'CDDBDB',
};
var FONT = 'Open Sans';

/** Un run de texto con formato. */
function run(text, o) {
    o = o || {};
    var props = '<w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '"/>';
    if (o.bold) props += '<w:b/>';
    if (o.color) props += '<w:color w:val="' + o.color + '"/>';
    if (o.size) props += '<w:sz w:val="' + o.size + '"/>';
    return '<w:r><w:rPr>' + props + '</w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
}

/** Un párrafo con uno o varios runs. */
function para(runs, o) {
    o = o || {};
    var props = '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 120 : o.after) + '"/>';
    if (o.align) props += '<w:jc w:val="' + o.align + '"/>';
    if (o.bullet) props += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (o.border) props += '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="2" w:color="' + COLORS.line + '"/></w:pBdr>';
    if (o.shade) props += '<w:shd w:val="clear" w:fill="' + o.shade + '"/>';
    if (o.indent) props += '<w:ind w:left="' + o.indent + '"/>';
    return '<w:p><w:pPr>' + props + '</w:pPr>' + (Array.isArray(runs) ? runs.join('') : runs) + '</w:p>';
}

/** Celda de tabla. */
function cell(content, o) {
    o = o || {};
    var props = '<w:tcW w:w="' + (o.width || 0) + '" w:type="dxa"/>';
    if (o.shade) props += '<w:shd w:val="clear" w:fill="' + o.shade + '"/>';
    props += '<w:vAlign w:val="center"/>';
    props += '<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/>' +
             '<w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>';
    return '<w:tc><w:tcPr>' + props + '</w:tcPr>' + content + '</w:tc>';
}

function table(rows, o) {
    o = o || {};
    var borders = o.noBorders
        ? '<w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/>' +
          '<w:right w:val="none"/><w:insideH w:val="single" w:sz="4" w:color="' + COLORS.line + '"/>' +
          '<w:insideV w:val="none"/></w:tblBorders>'
        : '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) {
              return '<w:' + s + ' w:val="single" w:sz="4" w:color="' + COLORS.line + '"/>';
          }).join('') + '</w:tblBorders>';
    return '<w:tbl><w:tblPr><w:tblW w:w="' + (o.width || 9638) + '" w:type="dxa"/>' + borders + '</w:tblPr>' + rows.join('') + '</w:tbl>';
}

function h2(text) {
    return para(run(text, { bold: true, size: 24, color: COLORS.dark }), { before: 240, after: 100, border: true });
}

/**
 * @param {Object} model - reportModel(result.contract, pricing, hours)
 * @param {Object} [opts] - { proyecto, archivo, fecha }
 */
function buildDocxReport(model, opts) {
    opts = opts || {};
    var c = model.currency;
    var nombre = opts.proyecto || (opts.archivo || 'Formulario').replace(/\.zip$/i, '').replace(/[_-]+/g, ' ');
    var body = '';

    body += para(run('NAMIRIAL · COTIZACIÓN', { bold: true, size: 16, color: COLORS.primary }), { after: 40 });
    body += para(run(nombre, { bold: true, size: 40, color: COLORS.dark }), { after: 40 });
    body += para(run('Formularios digitales bajo demanda' + (opts.fecha ? ' · ' + opts.fecha : ''), { color: COLORS.muted, size: 18 }), { after: 240 });

    if (!model.items.length) {
        body += para(run('No se encontró la ficha de configuración en el ZIP (el Excel con la columna «Nombre del campo en formulario»), así que no se puede cotizar según el contrato.',
            { size: 19, color: COLORS.media.text }), { shade: COLORS.media.bg, indent: 120 });
    } else {
        // ── Total ──
        body += table(['<w:tr>' +
            cell(para(run((model.items.length === 1 ? '1 formulario' : model.items.length + ' formularios') + ' · total sin IVA', { size: 18, color: 'BFE9E5' }), { after: 0 }) +
                 para(run(money(model.total, c), { bold: true, size: 40, color: 'FFFFFF' }), { after: 0 }), { width: 5600, shade: COLORS.deep }) +
            cell(model.pending
                ? para(run('+ horas de reglas adicionales, a estimar a ' + money(model.hourRate, c) + ' la hora', { size: 17, color: 'BFE9E5' }), { after: 0, align: 'right' })
                : para('', { after: 0 }), { width: 4038, shade: COLORS.deep }) +
            '</w:tr>'], { noBorders: true });

        // ── Detalle por formulario ──
        body += h2('Detalle por formulario');
        model.items.forEach(function (it) {
            var col = COLORS[it.levelKey] || COLORS.media;
            body += para([run(it.name, { bold: true, size: 21, color: COLORS.dark })], { before: 120, after: 20 });
            body += para([
                run('Complejidad ' + it.level.toLowerCase() + ' · línea ' + it.line, { bold: true, size: 18, color: col.text }),
                run('   ' + it.fields + ' campos de captura · ' + it.rules + ' reglas de negocio', { size: 18, color: COLORS.secondary }),
            ], { after: 40 });
            if (it.pdf) body += para(run('Documento: ' + it.pdf, { size: 16, color: COLORS.muted }), { after: 40 });
            body += para(run(it.why, { size: 18, color: COLORS.secondary }), { after: 80 });
            var rows = it.lines.map(function (l) {
                return '<w:tr>' +
                    cell(para(run(l.label, { size: 18, color: COLORS.dark }), { after: 0 }), { width: 7000 }) +
                    cell(para(run(l.amount == null ? 'a estimar' : money(l.amount, c), { size: 18, bold: l.amount == null, color: l.amount == null ? COLORS.media.text : COLORS.dark }), { after: 0, align: 'right' }), { width: 2638 }) +
                    '</w:tr>';
            });
            rows.push('<w:tr>' +
                cell(para(run('Total del formulario', { bold: true, size: 18, color: COLORS.dark }), { after: 0 }), { width: 7000 }) +
                cell(para(run(money(it.total, c) + (it.pending ? ' + horas' : ''), { bold: true, size: 18, color: COLORS.dark }), { after: 0, align: 'right' }), { width: 2638 }) +
                '</w:tr>');
            body += table(rows, { noBorders: true });
        });
    }

    if (model.attachments.length) {
        body += h2('Documentos que no se cotizan');
        model.attachments.forEach(function (a) {
            body += para([run(a.file + ': ', { bold: true, size: 18, color: COLORS.dark }), run(a.reason, { size: 18, color: COLORS.secondary })], { bullet: true, after: 60 });
        });
    }

    if (model.includes.length) {
        body += h2('Qué incluye');
        model.includes.forEach(function (it) { body += para(run(it, { size: 19, color: COLORS.dark }), { bullet: true, after: 60 }); });
    }

    body += h2('Niveles del contrato');
    body += table(model.tiers.map(function (t) {
        var col = COLORS[t.key] || COLORS.media;
        return '<w:tr>' +
            cell(para(run(t.label, { bold: true, size: 18, color: col.text }), { after: 0 }), { width: 1800, shade: col.bg }) +
            cell(para(run('hasta ' + t.maxFields + ' campos', { size: 18 }), { after: 0 }), { width: 2600 }) +
            cell(para(run('hasta ' + t.maxRules + ' reglas', { size: 18 }), { after: 0 }), { width: 2600 }) +
            cell(para(run(money(t.price, c), { bold: true, size: 18 }), { after: 0, align: 'right' }), { width: 2638 }) +
            '</w:tr>';
    }), { noBorders: true });

    body += para(run('Precios según ' + model.source + '. Sin IVA ni retenciones. Campos de captura: los que completa el usuario. ' +
        'Las reglas que superan el máximo del nivel se estiman en horas y requieren aprobación previa.', { size: 15, color: COLORS.muted }), { before: 320 });

    var documentXml =
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
'<w:body>' + body +
'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
'<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>' +
'</w:sectPr></w:body></w:document>';

    // Numeración para las viñetas.
    var numberingXml =
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
'<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/>' +
'<w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>' +
'<w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>' +
'<w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:hint="default"/></w:rPr>' +
'</w:lvl></w:abstractNum>' +
'<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
'</w:numbering>';

    var contentTypes =
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
'<Default Extension="xml" ContentType="application/xml"/>' +
'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
'<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
'</Types>';

    var rootRels =
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
'</Relationships>';

    var docRels =
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
'</Relationships>';

    var zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.folder('_rels').file('.rels', rootRels);
    var word = zip.folder('word');
    word.file('document.xml', documentXml);
    word.file('numbering.xml', numberingXml);
    word.folder('_rels').file('document.xml.rels', docRels);

    return zip.generateAsync({ type: 'uint8array', mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export { buildDocxReport };
