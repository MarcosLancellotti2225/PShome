// Utilidades de PDF del Editor: fuentes, datos de prueba y PDF con etiquetas.
// Portadas sin cambios de lógica desde FormConverterExcel/src/browser.js
// (capPdfFieldFontSize, readPdfFieldFontSizes, fillPdfWithDummy, generateLabeledPdf).
import {
  PDFDocument, StandardFonts, PDFTextField, PDFName, PDFNumber, PDFCheckBox,
  PDFDropdown, PDFOptionList, PDFRadioGroup, rgb,
} from 'pdf-lib';
import { detectFields as detect } from '../pdf-detect/index.js';

async function capPdfFieldFontSize(input, maxSize) {
    const max = Number(maxSize) || 10;
    const COMB = 1 << 23; // bit 24 (/Ff): "comb" — reparte el texto en celdas y
                          // lo auto-agranda a la altura de la caja, ignorando el DA.
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = doc.getForm();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fields = form.getFields();
    let total = 0, changed = 0, combCleared = 0;
    for (const f of fields) {
        // instanceof (no constructor.name): al bundlear, esbuild renombra la
        // clase a "PDFTextField2" y el chequeo por nombre fallaba en el navegador.
        if (!(f instanceof PDFTextField)) continue;
        total++;
        let touched = false;

        // 1) Limpiar el bit Comb — la causa principal de que el texto "crezca"
        //    aunque el DA diga 9pt.
        const dict = f.acroField.dict;
        const ffObj = dict.get(PDFName.of('Ff'));
        let ff = ffObj ? ffObj.asNumber() : 0;
        if (ff & COMB) {
            dict.set(PDFName.of('Ff'), PDFNumber.of(ff & ~COMB));
            combCleared++;
            touched = true;
        }

        // 2) Capar el tamaño: auto (0) o mayor al tope → se fija al tope.
        let da = '';
        try { da = f.acroField.getDefaultAppearance() || ''; } catch (e) { /* sin DA */ }
        const m = da.match(/(-?\d+(\.\d+)?)\s+Tf/);
        const cur = m ? parseFloat(m[1]) : 0;
        if (cur === 0 || cur > max) { try { f.setFontSize(max); touched = true; } catch (e) { /* skip */ } }

        // 3) Regenerar la apariencia con fuente estándar (Helvetica, presente en
        //    los recursos) para que el visor respete el tamaño fijo.
        if (touched) {
            try { f.defaultUpdateAppearances(font); } catch (e) { /* campo problemático */ }
            changed++;
        }
    }
    const saved = await doc.save({ updateFieldAppearances: false });
    return { pdfBytes: new Uint8Array(saved), changed, totalTextFields: total, combCleared };
}

async function readPdfFieldFontSizes(input) {
    const COMB = 1 << 23;
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = doc.getForm();
    const bySourceName = {};
    let autoCount = 0, combCount = 0, total = 0;
    for (const f of form.getFields()) {
        if (!(f instanceof PDFTextField)) continue;
        total++;
        let da = '';
        try { da = f.acroField.getDefaultAppearance() || ''; } catch (e) { /* sin DA */ }
        const m = da.match(/(-?\d+(\.\d+)?)\s+Tf/);
        const size = m ? parseFloat(m[1]) : null;
        const ffObj = f.acroField.dict.get(PDFName.of('Ff'));
        const comb = !!((ffObj ? ffObj.asNumber() : 0) & COMB);
        if (size === 0) autoCount++;
        if (comb) combCount++;
        bySourceName[f.getName()] = { size: size, comb: comb };
    }
    return { bySourceName, autoCount, combCount, totalTextFields: total };
}

const DUMMY_REGLAS = [
    // Las partes sueltas de una fecha van PRIMERO: `solicitud_fecha_mes`
    // contiene "fecha" y si no, se llevaba la fecha entera.
    [/_dia$|_dia_/, '28'],
    [/_mes$|_mes_/, '09'],
    [/_ano$|_anio$|_year$/, '2026'],
    [/fecha|nacimiento|constitucion|vigencia|desde|hasta/, '28/09/2026'],
    [/hora/, '14:30'],
    [/correo|email|mail/, 'correo.prueba@ejemplo.cr'],
    [/telefono|celular|movil|fax/, '8888-8888'],
    [/cedula_juridica|juridica/, '3-101-123456'],
    [/identificacion|cedula|documento|_id$/, '1-2345-6789'],
    [/porcentaje|_pct/, '50'],
    [/monto|salario|sueldo|ingreso|prima|suma|valor|comision|precio/, '1.250.000,00'],
    [/edad/, '35'],
    [/peso/, '72'],
    [/estatura|altura/, '1,75'],
    [/cantidad|numero_de|cant_/, '3'],
    [/poliza|solicitud_numero|_numero$/, '0123456789'],
    [/primer_apellido/, 'RODRÍGUEZ'],
    [/segundo_apellido/, 'JIMÉNEZ'],
    [/primer_nombre|^.*_nombre$/, 'MARÍA FERNANDA'],
    [/nombre_completo|razon_social|nombre/, 'MARÍA FERNANDA RODRÍGUEZ JIMÉNEZ'],
    [/provincia/, 'San José'],
    [/canton/, 'Escazú'],
    [/distrito/, 'San Rafael'],
    [/pais|nacionalidad/, 'Costa Rica'],
    [/direccion|domicilio|senas/, 'Del parque central 200 metros norte, casa esquinera color blanco'],
    [/ocupacion|profesion|puesto|actividad|negocio/, 'Ingeniera industrial'],
    [/patrono|empleador|empresa|agencia/, 'Industrias del Valle S.A.'],
    [/parentesco|relacion/, 'Cónyuge'],
    [/observacion|detalle|motivo|causa|descripcion/, 'Detalle de prueba para verificar cómo entra el texto en la caja.'],
    [/lugar/, 'San José, Costa Rica'],
    [/firma/, 'María F. Rodríguez J.'],
];

const DUMMY_LARGO = 'TEXTO LARGO DE PRUEBA PARA VERIFICAR HASTA DÓNDE ENTRA ANTES DE CORTARSE';

function dummyPara(nombre, textoLargo) {
    if (textoLargo) return DUMMY_LARGO;
    var n = String(nombre || '').toLowerCase();
    for (var i = 0; i < DUMMY_REGLAS.length; i++) {
        if (DUMMY_REGLAS[i][0].test(n)) return DUMMY_REGLAS[i][1];
    }
    return 'Dato de prueba';
}

/**
 * Llena todos los campos y devuelve el PDF resultante.
 *
 * No toca ninguna bandera: la idea es ver el PDF TAL COMO ESTÁ configurado. Si
 * quedan campos con Comb se avisa, porque pdf-lib no los dibuja repartiendo una
 * letra por celda como haría Acrobat — el preview de esos no es fiel.
 */
async function fillPdfWithDummy(input, opts) {
    const o = opts || {};
    const COMB = 1 << 23;
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = doc.getForm();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    let texto = 0, casillas = 0, listas = 0, radios = 0, saltados = 0, comb = 0;
    const fallos = [];

    form.getFields().forEach(function (f) {
        const nombre = f.getName();
        try {
            if (f instanceof PDFTextField) {
                const ffObj = f.acroField.dict.get(PDFName.of('Ff'));
                const ff = ffObj && ffObj.asNumber ? ffObj.asNumber() : 0;
                if (ff & COMB) comb++;
                let valor = dummyPara(nombre, o.textoLargo);
                // Un comb recorta por /MaxLen; pasarse tira error en pdf-lib.
                const maxLen = f.getMaxLength && f.getMaxLength();
                if (maxLen && valor.length > maxLen) valor = valor.slice(0, maxLen);
                f.setText(valor);
                texto++;
            } else if (f instanceof PDFCheckBox) {
                f.check();
                casillas++;
            } else if (f instanceof PDFRadioGroup) {
                const ops = f.getOptions();
                if (ops.length) { f.select(ops[0]); radios++; } else saltados++;
            } else if (f instanceof PDFDropdown || f instanceof PDFOptionList) {
                const ops = f.getOptions();
                if (ops.length) { f.select(ops[0]); listas++; } else saltados++;
            } else {
                saltados++;
            }
        } catch (e) {
            saltados++;
            fallos.push({ field: nombre, reason: e.message });
        }
    });

    try { form.updateFieldAppearances(font); }
    catch (e) { fallos.push({ field: '(apariencias)', reason: e.message }); }

    // Con las apariencias ya generadas, el /DA tiene el tamaño que el visor
    // resolvió de verdad (el 0 del auto ya está calculado). Comparando ese
    // ancho contra el de la caja se sabe qué campo sigue desbordando.
    //
    // Auto no es garantía: hay un piso de tamaño, así que una caja muy angosta
    // con mucho texto se pasa igual. Esos son los que hay que ensanchar.
    const noEntran = [];
    const FF_MULTILINE = 1 << 12;
    form.getFields().forEach(function (f) {
        if (!(f instanceof PDFTextField)) return;
        let widget;
        try { widget = f.acroField.getWidgets()[0]; } catch (e) { return; }
        if (!widget) return;
        const ffObj = f.acroField.dict.get(PDFName.of('Ff'));
        const ff = ffObj && ffObj.asNumber ? ffObj.asNumber() : 0;
        if (ff & FF_MULTILINE) return;      // envuelve, no se pasa de ancho

        const da = widget.dict.get(PDFName.of('DA')) || f.acroField.dict.get(PDFName.of('DA'));
        const txtDa = da ? (da.asString ? da.asString() : String(da)) : '';
        const m = /([\d.]+)\s+Tf/.exec(txtDa);
        const size = m ? parseFloat(m[1]) : 0;
        if (!size) return;
        const valor = f.getText() || '';
        if (!valor) return;
        let necesita;
        try { necesita = font.widthOfTextAtSize(valor, size); } catch (e) { return; }
        const rect = widget.getRectangle();
        const util = rect.width - 4;        // el borde se come un par de puntos
        if (necesita > util) {
            noEntran.push({
                field: f.getName(), size: Math.round(size * 10) / 10,
                necesita: Math.round(necesita), disponible: Math.round(util),
            });
        }
    });

    return {
        pdfBytes: await doc.save(),
        texto: texto, casillas: casillas, listas: listas, radios: radios,
        saltados: saltados, comb: comb, fallos: fallos,
        noEntran: noEntran,
        total: texto + casillas + listas + radios,
    };
}

async function generateLabeledPdf(pdfBytes) {

    const detected = await detect(pdfBytes);
    const fields = detected.fields;

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    const fieldsByPage = {};
    for (const f of fields) {
        if (!fieldsByPage[f.page]) fieldsByPage[f.page] = [];
        fieldsByPage[f.page].push(f);
    }

    for (let pi = 0; pi < pages.length; pi++) {
        const page = pages[pi];
        const pageFields = fieldsByPage[pi + 1] || [];

        for (const f of pageFields) {
            const x = f.x;
            const y = f.y;
            const w = f.width;
            const h = f.height;

            page.drawRectangle({
                x: x, y: y, width: w, height: h,
                borderColor: rgb(0.016, 0.486, 0.463),
                borderWidth: 1,
                opacity: 0,
            });

            const fontSize = Math.max(5, Math.min(8, h * 0.6));
            const labelY = y + h + 2;
            const textWidth = font.widthOfTextAtSize(f.name, fontSize);

            page.drawRectangle({
                x: x, y: labelY - 1, width: textWidth + 4, height: fontSize + 3,
                color: rgb(0.016, 0.486, 0.463),
                opacity: 0.85,
            });

            page.drawText(f.name, {
                x: x + 2, y: labelY + 1,
                size: fontSize,
                font: font,
                color: rgb(1, 1, 1),
            });
        }
    }

    const savedBytes = await pdfDoc.save();
    return new Uint8Array(savedBytes);
}


export { capPdfFieldFontSize, readPdfFieldFontSizes, fillPdfWithDummy, generateLabeledPdf };
