// Monta una herramienta clásica (convertida con scripts/legacy/convert.mjs) como pantalla nativa.
// La herramienta se monta UNA vez por sesión y queda viva: si vas a otra pantalla y volvés,
// encontrás todo como lo dejaste (archivos cargados, pasos, conexión).
import { useLayoutEffect, useRef } from 'react';

const alive = new Map(); // id → { container, reactivate }

export default function LegacyTool({ id, markup, mount, before }) {
  const hostRef = useRef(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    let entry = alive.get(id);
    if (!entry) {
      const container = document.createElement('div');
      container.className = `lg-root lg-${id}`;
      container.innerHTML = markup;
      host.appendChild(container);
      entry = { container, reactivate: null };
      alive.set(id, entry);
      before?.();
      entry.reactivate = mount() || null;
    } else {
      host.appendChild(entry.container);
      entry.reactivate?.();
    }
    const { container } = entry;
    return () => { container.remove(); };
  }, [id, markup, mount, before]);

  return <div ref={hostRef} className="lg-host" />;
}
