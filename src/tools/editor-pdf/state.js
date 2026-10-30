// Estado del Editor PDF con deshacer / rehacer.
// Cada cambio guarda una foto de los campos. Los cambios de una misma edición continua
// (escribir un nombre, arrastrar una caja) se agrupan con `coalesce` para que Deshacer los quite juntos.
const LIMIT = 200;

export const initialState = { fields: [], past: [], future: [], lastCoalesce: null };

export function reducer(state, action) {
  switch (action.type) {
    case 'load':
      return { fields: action.fields, past: [], future: [], lastCoalesce: null };
    case 'change': {
      const next = action.apply(state.fields);
      if (next === state.fields) return state;
      const same = action.coalesce && action.coalesce === state.lastCoalesce;
      return {
        fields: next,
        past: same ? state.past : [...state.past.slice(-LIMIT), state.fields],
        future: [],
        lastCoalesce: action.coalesce || null,
      };
    }
    case 'undo':
      if (!state.past.length) return state;
      return { fields: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.fields, ...state.future], lastCoalesce: null };
    case 'redo':
      if (!state.future.length) return state;
      return { fields: state.future[0], past: [...state.past, state.fields], future: state.future.slice(1), lastCoalesce: null };
    case 'endCoalesce':
      return state.lastCoalesce ? { ...state, lastCoalesce: null } : state;
    default:
      return state;
  }
}

// Helpers para armar cambios sobre una lista de claves.
export const patchKeys = (keys, patch) => (fields) => {
  const set = new Set(keys);
  let touched = false;
  const next = fields.map((f) => {
    if (!set.has(f.key)) return f;
    const p = typeof patch === 'function' ? patch(f) : patch;
    if (Object.keys(p).every((k) => f[k] === p[k])) return f;
    touched = true;
    return { ...f, ...p };
  });
  return touched ? next : fields;
};
