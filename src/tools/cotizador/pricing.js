// Precios del contrato editados en la pantalla: se guardan en este navegador.
import { CONTRACT_PRICING } from '../../lib/quoter/contract.js';

export const PRICING_KEY = 'pstools.quoter.contract';

export function loadPricing() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRICING_KEY) || 'null');
    if (saved?.tiers?.length === 3) return { ...CONTRACT_PRICING, ...saved, extraFields: { ...CONTRACT_PRICING.extraFields, ...saved.extraFields } };
  } catch { /* sin guardado local */ }
  return CONTRACT_PRICING;
}

export function savePricing(p) {
  try { localStorage.setItem(PRICING_KEY, JSON.stringify(p)); } catch { /* sin guardado local */ }
}
