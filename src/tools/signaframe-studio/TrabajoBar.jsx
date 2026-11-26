// Barra del trabajo, arriba de todas las pestañas de Signaframe Studio: qué archivos tiene cargados
// el formulario en curso y cómo abrir, guardar o empezar otro.
import { useRef, useState } from 'react';
import { Briefcase, Check, Download, FilePlus2, FolderOpen } from 'lucide-react';
import { downloadBlob, jsonBlob, readJson } from '../../lib/files';
import { Alert, Button, ConfirmButton } from '../../components/ui';
import {
  ARCHIVOS, abrirTrabajo, exportarTrabajo, nuevoTrabajo, renombrar, useTrabajo, useTrabajoListo,
} from './trabajo.js';
import './studio.css';

export default function TrabajoBar() {
  const t = useTrabajo();
  const listo = useTrabajoListo();
  const input = useRef(null);
  const [error, setError] = useState('');
  const cargados = Object.keys(ARCHIVOS).filter((k) => t.archivos[k]);

  async function abrir(file) {
    setError('');
    if (!file) return;
    try {
      abrirTrabajo(await readJson(file, 'El trabajo'));
    } catch (e) {
      setError(e.message);
    }
  }

  if (!listo) return null;
  return (
    <div className="ss-bar">
      <div className="ss-bar-main">
        <span className="ss-bar-icon" aria-hidden="true"><Briefcase size={18} /></span>
        <div className="ss-bar-text">
          <label className="ss-bar-label" htmlFor="ss-trabajo-nombre">Trabajo</label>
          <input
            id="ss-trabajo-nombre"
            className="ss-bar-name"
            value={t.nombre}
            placeholder="Sin nombre"
            onChange={(e) => renombrar(e.target.value)}
          />
        </div>
        <div className="ss-bar-files">
          {cargados.length === 0 && <span className="ss-sub">Todavía no hay archivos. Lo que cargues en cualquier pestaña queda acá para las demás.</span>}
          {cargados.map((k) => (
            <span key={k} className="ss-chip" title={t.archivos[k].name}><Check size={13} aria-hidden="true" /> {ARCHIVOS[k].label}</span>
          ))}
        </div>
        <div className="ss-bar-actions">
          <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => input.current?.click()} title="Abrir un trabajo guardado (.json), también los que arma Claude">Abrir</Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Download}
            disabled={!cargados.length}
            onClick={() => downloadBlob(jsonBlob(exportarTrabajo()), `${t.nombre || 'formulario'}_trabajo.json`)}
            title="Bajar el trabajo con todos sus archivos, para seguirlo en otra compu o pasárselo a Claude"
          >
            Guardar
          </Button>
          <ConfirmButton size="sm" variant="ghost" icon={FilePlus2} confirmLabel="¿Empezar de cero? Sí" disabled={!cargados.length} onConfirm={nuevoTrabajo}>
            Nuevo
          </ConfirmButton>
          <input ref={input} type="file" accept=".json" className="ui-visually-hidden" onChange={(e) => { abrir(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
