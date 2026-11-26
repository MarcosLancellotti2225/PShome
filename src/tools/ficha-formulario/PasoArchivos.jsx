// Paso 1 · Archivos: se sueltan todos juntos y se reconoce qué es cada uno.
import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { detectFile } from '../../lib/signaframe-trabajo/detect.js';
import { Alert, Button, FileDrop, Panel } from '../../components/ui';
import { ARCHIVOS, abrirTrabajo, guardarArchivo, quitarArchivo } from '../signaframe-studio/trabajo.js';

const SLOTS = [
  { tipo: 'pdfOriginal', need: 'Obligatorio', why: 'De acá salen los casilleros: los vas a renombrar en el paso 2.' },
  { tipo: 'clienteJson', need: 'Recomendado', why: 'Lo que el cliente quiere recibir. Sirve para unir cada pregunta con su dato.' },
  { tipo: 'matrizIns', need: 'Opcional', why: 'Si el INS mandó su matriz, las preguntas salen armadas desde ahí.' },
];
const OTROS = ['pdf', 'ficha', 'main', 'matriz', 'formDef', 'payload'];

export default function PasoArchivos({ archivos, onEjemplo }) {
  const [msgs, setMsgs] = useState([]);

  async function soltar(files) {
    const out = [];
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const r = detectFile(f.name, bytes);
      if (r.tipo === 'trabajo') {
        try { abrirTrabajo(r.data); out.push({ tone: 'success', text: `${f.name}: se abrió el trabajo.` }); } catch (e) { out.push({ tone: 'error', text: e.message }); }
      } else if (r.tipo) {
        guardarArchivo(r.tipo, f.name, r.data);
        out.push({ tone: 'success', text: `${f.name}: ${ARCHIVOS[r.tipo].label}.` });
      } else {
        out.push({ tone: 'error', text: `${f.name}: ${r.motivo}.` });
      }
    }
    setMsgs(out);
  }

  async function uno(tipo, f) {
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const r = detectFile(f.name, bytes);
    if (ARCHIVOS[tipo].kind === 'json' && r.tipo === null) { setMsgs([{ tone: 'error', text: `${f.name}: ${r.motivo}.` }]); return; }
    if (tipo === 'matrizIns' && r.tipo !== 'matrizIns') {
      setMsgs([{ tone: 'error', text: `${f.name}: no encontré la columna «Pasos Formulario». ¿Es la matriz del INS?` }]);
      return;
    }
    guardarArchivo(tipo, f.name, r.data);
    setMsgs([]);
  }

  const otros = OTROS.filter((k) => archivos[k]);
  const vacio = !Object.keys(archivos).length;

  return (
    <div className="ui-stack">
      <Panel
        title="¿Con qué arrancás?"
        hint="Soltá acá todos los archivos juntos: se reconoce qué es cada uno. También podés cargarlos de a uno abajo."
        actions={vacio && <Button size="sm" variant="ghost" icon={FlaskConical} onClick={onEjemplo}>Probar con un ejemplo</Button>}
      >
        <FileDrop
          label="Soltá los archivos"
          description="PDF del cliente, JSON del cliente, matriz del INS… o un trabajo guardado (.json)"
          accept=".pdf,.json,.xlsx,.xls"
          file={null}
          onFiles={soltar}
        />
        {msgs.map((m, i) => <Alert key={i} tone={m.tone}>{m.text}</Alert>)}
      </Panel>

      <div className="cf-slots">
        {SLOTS.map(({ tipo, need, why }) => {
          const a = archivos[tipo];
          return (
            <div key={tipo} className={`cf-slot ${a ? 'is-on' : ''}`}>
              <div className="cf-slot-head">
                <span className="cf-slot-name">{ARCHIVOS[tipo].label}</span>
                <span className={`cf-need is-${need.toLowerCase()}`}>{need}</span>
              </div>
              <p className="cf-slot-why">{why}</p>
              <FileDrop
                label={a ? 'Cargado' : 'Elegir archivo'}
                description={ARCHIVOS[tipo].desc}
                accept={ARCHIVOS[tipo].accept}
                file={a ? { name: a.name, size: a.size } : null}
                onFile={(f) => uno(tipo, f)}
                onClear={() => quitarArchivo(tipo)}
              />
            </div>
          );
        })}
      </div>

      {otros.length > 0 && (
        <p className="ui-hint">
          El trabajo también tiene: {otros.map((k) => ARCHIVOS[k].label).join(', ')}. Se usan en los pasos siguientes y en Probar.
        </p>
      )}
    </div>
  );
}
