// Prueba del motor de Signaframe: los tests originales del front + la simulación.
//   node test/signaframe-engine.test.mjs
import assert from 'node:assert/strict';
import { formDataFromCaptured, transformFormDataForApi } from '../src/lib/signaframe-engine/services/formDataTransform.js';
import { simulate } from '../src/lib/signaframe-engine/index.js';
import { leafPaths } from '../src/lib/signaframe-engine/simulate.js';

// Mini adaptador para correr los tests del front (escritos para vitest) tal cual.
let passed = 0;
const describe = (_name, fn) => fn();
const it = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}`); throw e; } };
const expect = (actual) => ({
  toBe: (v) => assert.equal(actual, v),
  toEqual: (v) => assert.deepEqual(actual, v),
  toMatch: (re) => assert.match(String(actual), re),
  toContain: (v) => assert.ok(actual.includes(v)),
  not: {
    toBe: (v) => assert.notEqual(actual, v),
    toContain: (v) => assert.ok(!actual.includes(v)),
    toHaveProperty: (k) => assert.ok(!(k in actual)),
  },
  toHaveProperty: (k) => assert.ok(k in actual),
});

// ── Tests originales del front (formDataTransform.test.ts) ──
describe('formDataFromCaptured', () => {
  it('keeps canonical field ids above PDF sourceName aliases', () => {
    const fields = [
      {
        id: 'field_asegurado_primer_apellido',
        type: 'text',
        jsonOutputPath: 'datosFormulario.personas[0].primerApellido',
        sourceMeta: { sourceName: 'asegurado_segundo_apellido' },
      },
      {
        id: 'field_asegurado_nombre_completo',
        type: 'text',
        sourceMeta: { sourceName: 'asegurado_primer_apellido' },
      },
    ];

    const data = formDataFromCaptured(
      {
        __pdf: { asegurado_primer_apellido: 'González' },
        __json: { datosFormulario: { personas: [{ primerApellido: 'Gonzalez' }] } },
      },
      fields,
    );

    expect(data.field_asegurado_primer_apellido).toBe('González');
  });

  it('hydrates fields from __json when the captured PDF value is absent', () => {
    const fields = [
      {
        id: 'field_asegurado_primer_apellido',
        type: 'text',
        jsonOutputPath: 'datosFormulario.personas[0].primerApellido',
      },
    ];

    const data = formDataFromCaptured(
      {
        __pdf: {},
        __json: { datosFormulario: { personas: [{ primerApellido: 'Gonzalez' }] } },
      },
      fields,
    );

    expect(data.field_asegurado_primer_apellido).toBe('Gonzalez');
  });

  it('hydrates index-less json paths from the first item when the captured value is an array', () => {
    const fields = [
      {
        id: 'field_asegurado_ocupacion',
        type: 'text',
        jsonOutputPath: 'datosFormulario.personas.ocupacion',
      },
    ];

    const data = formDataFromCaptured(
      {
        __pdf: {},
        __json: { datosFormulario: { personas: [{ ocupacion: '18001' }] } },
      },
      fields,
    );

    expect(data.field_asegurado_ocupacion).toBe('18001');
  });
});

describe('transformFormDataForApi', () => {
  it('resolves diffYears concat fields when source values are keyed without field_ prefix', () => {
    const fields = [
      { id: 'field_helper_fecha_nac', type: 'date' },
      {
        id: 'field_asegurado_edad',
        type: 'text',
        jsonOutputPath: 'datosFormulario.datosGenerales.personas[0].edad',
        autoFillConcat: {
          separator: ' ',
          sourceFieldIds: [],
          parts: [
            { kind: 'text', value: '2026-05-29' },
            { kind: 'field', fieldId: 'field_helper_fecha_nac', op: 'diffYears' },
          ],
        },
      },
    ];

    const payload = transformFormDataForApi(
      { helper_fecha_nac: '2000-05-30' },
      fields,
    );

    expect(payload.pdf.asegurado_edad).toBe('25');
    expect(payload.json).toEqual({
      datosFormulario: { datosGenerales: { personas: [{ edad: '25' }] } },
    });
  });

  it('resolves diffYears when the operation is saved on the dateRef token', () => {
    const fields = [
      { id: 'field_helper_fecha_nac', type: 'date' },
      {
        id: 'field_asegurado_edad',
        type: 'text',
        jsonOutputPath: 'datosFormulario.datosGenerales.personas[0].edad',
        autoFillConcat: {
          separator: '',
          sourceFieldIds: ['field_helper_fecha_nac'],
          parts: [
            { kind: 'dateRef', ref: 'today', offsetDays: 0, op: 'diffYears' },
            { kind: 'field', fieldId: 'field_helper_fecha_nac', op: 'diffYears' },
          ],
        },
      },
    ];

    const payload = transformFormDataForApi(
      { __pdf: { field_helper_fecha_nac: '01/01/1980' }, field_helper_fecha_nac: '1980-01-01' },
      fields,
    );

    expect(payload.pdf.asegurado_edad).toMatch(/^\d+$/);
    expect(payload.json).toEqual({
      datosFormulario: { datosGenerales: { personas: [{ edad: payload.pdf.asegurado_edad }] } },
    });
  });

  it('keeps an existing json array when a later field path omits the array index', () => {
    const fields = [
      {
        id: 'field_asegurado_primer_nombre',
        type: 'text',
        jsonOutputPath: 'datosFormulario.personas[0].primerNombre',
      },
      {
        id: 'field_asegurado_ocupacion',
        type: 'select',
        jsonOutputPath: 'datosFormulario.personas.ocupacion',
        options: [{ label: 'Actuario', pdfValue: 'Actuario', jsonValue: '18001' }],
      },
    ];

    const payload = transformFormDataForApi(
      {
        field_asegurado_primer_nombre: 'Juan',
        field_asegurado_ocupacion: 'Actuario',
      },
      fields,
    );

    expect(payload.json).toEqual({
      datosFormulario: { personas: [{ primerNombre: 'Juan', ocupacion: '18001' }] },
    });
  });

  it('upgrades an index-less json object to an array when an indexed path appears later', () => {
    const fields = [
      {
        id: 'field_asegurado_ocupacion',
        type: 'select',
        jsonOutputPath: 'datosFormulario.personas.ocupacion',
        options: [{ label: 'Actuario', pdfValue: 'Actuario', jsonValue: '18001' }],
      },
      {
        id: 'field_asegurado_primer_nombre',
        type: 'text',
        jsonOutputPath: 'datosFormulario.personas[0].primerNombre',
      },
    ];

    const payload = transformFormDataForApi(
      {
        field_asegurado_ocupacion: 'Actuario',
        field_asegurado_primer_nombre: 'Juan',
      },
      fields,
    );

    expect(payload.json).toEqual({
      datosFormulario: { personas: [{ ocupacion: '18001', primerNombre: 'Juan' }] },
    });
  });
});
// ── Simulación ──
// Form-def sintético (no hay datos de clientes en el repo).
const def = {
  "sections": [
    {
      "id": "sec_datos",
      "title": "Datos del Asegurado",
      "fields": [
        {
          "id": "field_asegurado_nombre",
          "type": "text",
          "label": "Nombre",
          "required": true,
          "prefillKey": "datosFormulario.personas[0].nombre",
          "prefillMode": "optional",
          "jsonOutputPath": "datosFormulario.personas[0].nombre",
          "sourceMeta": {
            "sourceName": "asegurado_nombre",
            "page": 1,
            "nativeType": "Text"
          }
        },
        {
          "id": "field_asegurado_tipo_id",
          "type": "select",
          "label": "Tipo de identificación",
          "options": [
            {
              "label": "Cédula Física",
              "pdfValue": "Cédula",
              "jsonValue": "0"
            },
            {
              "label": "DIMEX",
              "pdfValue": "DIMEX",
              "jsonValue": "6"
            }
          ],
          "prefillKey": "datosFormulario.personas[0].codigoTipoIdentificacion",
          "jsonOutputPath": "datosFormulario.personas[0].codigoTipoIdentificacion",
          "sourceMeta": {
            "sourceName": "asegurado_tipo_id",
            "page": 1,
            "nativeType": "Text"
          }
        },
        {
          "id": "field_asegurado_estado_civil",
          "type": "select",
          "label": "Estado civil",
          "options": [
            {
              "label": "Soltero",
              "pdfValue": "Soltero",
              "jsonValue": "1"
            },
            {
              "label": "Casado",
              "pdfValue": "Casado",
              "jsonValue": "2"
            }
          ],
          "prefillKey": "datosFormulario.personas[0].codigoEstadoCivil",
          "jsonOutputPath": "datosFormulario.personas[0].codigoEstadoCivil",
          "sourceMeta": {
            "sourceName": "asegurado_estado_civil",
            "page": 1,
            "nativeType": "Text"
          }
        }
      ]
    },
    {
      "id": "sec_conyuge",
      "title": "Cónyuge",
      "conditionalVisibility": "{\"logic\":\"and\",\"conditions\":[{\"fieldId\":\"field_asegurado_estado_civil\",\"operator\":\"equals\",\"value\":\"Casado\"}]}",
      "fields": [
        {
          "id": "field_conyuge_nombre",
          "type": "text",
          "label": "Nombre del cónyuge",
          "required": true,
          "prefillKey": "datosFormulario.personas[1].nombre",
          "jsonOutputPath": "datosFormulario.personas[1].nombre",
          "sourceMeta": {
            "sourceName": "conyuge_nombre",
            "page": 1,
            "nativeType": "Text"
          }
        }
      ]
    }
  ]
};
const payload = {
  encabezado: { codigoTipoFormulario: 'VCA01' },
  datosFormulario: {
    personas: [
      { nombre: 'Ana Mora', codigoTipoIdentificacion: '9', codigoEstadoCivil: '1', telefono: '8888-0000' },
      { nombre: 'Luis Mora' },
    ],
  },
};

describe('simulate', () => {
  const r = simulate({ formDefinition: def, payload });
  it('emite el JSON con el prefill', () => {
    expect(r.json.datosFormulario.personas[0].nombre).toBe('Ana Mora');
    expect(r.pdf['asegurado_nombre']).toBe('Ana Mora');
  });
  it('detecta prefill sin opción', () => {
    expect(r.issues.some((i) => i.code === 'PREFILL_SIN_OPCION' && i.fieldId === 'field_asegurado_tipo_id')).toBe(true);
  });
  it('detecta dato del payload sin uso', () => {
    expect(r.issues.some((i) => i.code === 'PAYLOAD_SIN_USO' && i.path === 'datosFormulario.personas.0.telefono')).toBe(true);
  });
  it('vacía lo oculto por regla', () => {
    expect(r.hiddenByRule).toContain('field_conyuge_nombre');
    expect(r.json.datosFormulario.personas[1]?.nombre ?? '').toBe('');
  });
  it('con edits: casado muestra cónyuge', () => {
    const r2 = simulate({ formDefinition: def, payload, edits: { field_asegurado_estado_civil: 'Casado' } });
    expect(r2.hiddenByRule).not.toContain('field_conyuge_nombre');
    expect(r2.json.datosFormulario.personas[1].nombre).toBe('Luis Mora');
    expect(r2.json.datosFormulario.personas[0].codigoEstadoCivil).toBe('2');
  });
  it('diff contra esperado', () => {
    const r3 = simulate({ formDefinition: def, payload, expectedJson: { datosFormulario: { personas: [{ nombre: 'Ana Mora', fechaNacimiento: '1990-01-01' }] } } });
    expect(r3.diff.some((d) => d.kind === 'faltante' && d.path === 'datosFormulario.personas.0.fechaNacimiento')).toBe(true);
  });
});

describe('leafPaths (SE Tools)', () => {
  it('soporta arreglos con huecos (personas[2] sin personas[1])', () => {
    const a = [];
    a[0] = { n: 'A' };
    a[2] = { n: 'C' };
    expect(leafPaths({ personas: a }).map((x) => x.path)).toEqual(['personas.0.n', 'personas.1', 'personas.2.n']);
  });
});

console.log(`signaframe-engine: ${passed} pruebas OK`);
