// Alcance de un ajuste de la tarjeta (O7b del rediseño, 2026-10-15): «sólo este gráfico» o todos los del tipo. Puro.
// Aplicar al tipo escribe el valor en el preset del tipo Y en cada gráfico de ese tipo: así surte efecto aunque el motor
// lea ese ajuste sólo desde el gráfico, y los gráficos que se agreguen después lo heredan donde el motor lee el preset.

import type { GraficadorRef, Slide } from "../../../api/graficos";
import { mismoValor } from "../estiloInforme/modeloEstiloInforme";
import { graficadorToPresetType } from "../graficadorPresetMap";
import { SLIDE_GRAF_SLOTS } from "../store";

type Presets = Record<string, Record<string, unknown>>;
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Ajustes sin alcance por tipo en la tarjeta: método y decimales de porcentaje los gobierna Reglas (y el Redondeo propio
 *  de R4). Los decimales de radar, numérico e histograma sí tienen alcance: O7c (383c1fe2b) los eximió del saneo. */
export const SIN_ALCANCE: ReadonlySet<string> = new Set(["decimales_pct", "metodo_redondeo"]);

/** El valor que tiene el tipo: el de su preset o, sin él, el por defecto del registro. */
export function valorDelTipo(presets: Presets, tipo: string | null, arg: string, porDefecto: unknown): unknown {
  const v = tipo ? presets[tipo]?.[arg] : undefined;
  return v === undefined || v === null ? porDefecto : v;
}

/** El gráfico tiene su propio valor, distinto del de su tipo. */
export function esPropio(args: Record<string, unknown>, arg: string, valorTipo: unknown): boolean {
  const v = args[arg];
  return v !== undefined && v !== null && !mismoValor(v, valorTipo);
}

/** Cada ranura con un gráfico de ese tipo. */
export function ranurasDelTipo(slides: readonly Slide[], tipo: string): { slideId: string; slot: string }[] {
  return slides.flatMap((s) => {
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    return (SLIDE_GRAF_SLOTS[s.tipo] ?? []).flatMap((slot) => {
      const ref = payload[slot];
      return esObjeto(ref) && typeof ref.graficador === "string" && graficadorToPresetType(ref.graficador) === tipo ? [{ slideId: s.id, slot }] : [];
    });
  });
}

/** Lleva los valores al preset del tipo y a cada gráfico de ese tipo (un solo cambio de estado). */
export function conAjusteEnElTipo(estado: { presets: Presets; slides: readonly Slide[] }, tipo: string, cambios: Record<string, unknown>) {
  const presets = { ...estado.presets, [tipo]: { ...(estado.presets[tipo] ?? {}), ...cambios } };
  const slides = estado.slides.map((s) => {
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    let cambio = false;
    const nuevo: Record<string, unknown> = { ...payload };
    for (const slot of SLIDE_GRAF_SLOTS[s.tipo] ?? []) {
      const ref = payload[slot];
      if (!esObjeto(ref) || typeof ref.graficador !== "string" || graficadorToPresetType(ref.graficador) !== tipo) continue;
      const r = ref as unknown as GraficadorRef;
      nuevo[slot] = { ...r, args: { ...((r.args ?? {}) as Record<string, unknown>), ...cambios } };
      cambio = true;
    }
    return cambio ? { ...s, payload: nuevo } : s;
  });
  return { presets, slides };
}
