// Cambiar el tipo de una lámina conservando lo configurado (F6.2; dirección F6 principio 3: «cambiar la lámina
// conserva los gráficos configurados» y §4.3: «si el tipo tiene menos ranuras que gráficos configurados, lo dice antes
// de aplicar»). Pura: decide adónde va cada gráfico, qué no cabe y qué textos el tipo nuevo no recibe, sin tocar el
// plan. El selector muestra el resultado antes de confirmar y el store lo aplica en un solo paso deshacible.
//
// Reglas:
// 1. Un gráfico conserva su slot si el tipo nuevo tiene uno con el mismo nombre (izquierda → izquierda).
// 2. Los demás llenan, en orden, las ranuras libres de su clase: los gráficos, las de gráfico; las cifras (`p_cifra`),
//    las de cifra. Un gráfico nunca va a una ranura de cifra; una cifra sí puede ir a una de gráfico (el motor la saca
//    por la ruta anterior, `.GRAFICOS_SALIDA_EDITOR$p_cifra`).
// 3. Lo que no encuentra ranura es sobrante: se avisa con su nombre antes de aplicar.
// 4. Los textos que el tipo nuevo acepta pasan tal cual; los que no acepta y tienen contenido se avisan.
// 5. De `meta` pasan el antetítulo, la ruta anterior y el nivel del Word; las claves propias de un tipo (variante,
//    composición, íconos, actores, nivel, número, rótulo, método) no tienen sentido en otro y se descartan.

import type { GraficadorRef, Slide, SlideType } from "../../../../api/graficos";
import { payloadPorDefecto, SLIDE_GRAF_SLOTS } from "../../store";
import { esSlotCifra } from "../../iconos/composicion";

export type GraficoEnSlot = { slot: string; grafico: GraficadorRef };

export type Reubicacion = { desde: string; hacia: string; grafico: GraficadorRef };

export type CambioTipoLamina = {
  tipo: SlideType;
  /** Payload final de la lámina con el tipo nuevo. */
  payload: Record<string, unknown>;
  /** Gráficos que pasan, en el orden de las ranuras del tipo nuevo. */
  conservados: Reubicacion[];
  /** Gráficos que no caben: se pierden al aplicar (deshacible). */
  sobrantes: GraficoEnSlot[];
  /** Claves de texto con contenido que el tipo nuevo no recibe. */
  textosSobrantes: string[];
  /** El tipo no cambia (sólo cambiaría la variante). */
  mismoTipo: boolean;
};

const META_QUE_VIAJA = new Set(["antetitulo", "motor_nativo", "word_heading_level"]);

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function esGraficadorRef(v: unknown): v is GraficadorRef {
  return esObjeto(v) && typeof v.graficador === "string" && v.graficador.trim() !== "";
}

const esCifra = (g: GraficadorRef): boolean => g.graficador === "p_cifra";

function tieneContenido(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (esObjeto(v)) return Object.keys(v).length > 0;
  return true;
}

/** Los gráficos configurados de la lámina, en el orden de sus ranuras. */
export function graficosDeLamina(slide: Pick<Slide, "tipo" | "payload">): GraficoEnSlot[] {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  return (SLIDE_GRAF_SLOTS[slide.tipo] ?? []).flatMap((slot) => {
    const v = payload[slot];
    return esGraficadorRef(v) ? [{ slot, grafico: v }] : [];
  });
}

export type OpcionesCambio = {
  /** Claves que el tipo nuevo acepta además de las de su payload por defecto (args del registro). */
  clavesDestino?: readonly string[];
};

export function planearCambioTipo(
  origen: Pick<Slide, "tipo" | "payload">,
  destino: SlideType,
  opciones: OpcionesCambio = {},
): CambioTipoLamina {
  const payloadOrigen = (origen.payload ?? {}) as Record<string, unknown>;
  if (origen.tipo === destino) {
    return {
      tipo: destino,
      payload: { ...payloadOrigen },
      conservados: graficosDeLamina(origen).map((g) => ({ desde: g.slot, hacia: g.slot, grafico: g.grafico })),
      sobrantes: [],
      textosSobrantes: [],
      mismoTipo: true,
    };
  }

  const slotsOrigen = SLIDE_GRAF_SLOTS[origen.tipo] ?? [];
  const slotsDestino = SLIDE_GRAF_SLOTS[destino] ?? [];
  const graficos = graficosDeLamina(origen);
  const libres = new Set(slotsDestino);
  const destinoDe = new Map<GraficoEnSlot, string>();
  const asignar = (g: GraficoEnSlot, slot: string) => { destinoDe.set(g, slot); libres.delete(slot); };
  const admite = (g: GraficoEnSlot, slot: string) => !esSlotCifra(slot) || esCifra(g.grafico);
  const prefiere = (g: GraficoEnSlot, slot: string) => esSlotCifra(slot) === esCifra(g.grafico);

  // 1. Mismo nombre.
  for (const g of graficos) if (libres.has(g.slot) && admite(g, g.slot)) asignar(g, g.slot);
  // 2. En orden, a la primera ranura libre de su clase.
  for (const g of graficos) {
    if (destinoDe.has(g)) continue;
    const slot = slotsDestino.find((s) => libres.has(s) && prefiere(g, s));
    if (slot) asignar(g, slot);
  }
  // 2b. Una cifra sin ranura de cifra libre va a una de gráfico.
  for (const g of graficos) {
    if (destinoDe.has(g) || !esCifra(g.grafico)) continue;
    const slot = slotsDestino.find((s) => libres.has(s) && admite(g, s));
    if (slot) asignar(g, slot);
  }

  const base = payloadPorDefecto(destino);
  const aceptadas = new Set([...Object.keys(base), ...(opciones.clavesDestino ?? [])]);
  const payload: Record<string, unknown> = { ...base };
  const textosSobrantes: string[] = [];
  for (const [clave, valor] of Object.entries(payloadOrigen)) {
    if (slotsOrigen.includes(clave) || clave === "meta") continue;
    if (aceptadas.has(clave) && !slotsDestino.includes(clave)) payload[clave] = valor;
    else if (tieneContenido(valor)) textosSobrantes.push(clave);
  }
  const meta = esObjeto(payloadOrigen.meta)
    ? Object.fromEntries(Object.entries(payloadOrigen.meta).filter(([k]) => META_QUE_VIAJA.has(k)))
    : {};
  if (Object.keys(meta).length) payload.meta = meta;

  const conservados: Reubicacion[] = [];
  for (const slot of slotsDestino) {
    const g = graficos.find((x) => destinoDe.get(x) === slot);
    if (!g) continue;
    payload[slot] = g.grafico;
    conservados.push({ desde: g.slot, hacia: slot, grafico: g.grafico });
  }

  return {
    tipo: destino,
    payload,
    conservados,
    sobrantes: graficos.filter((g) => !destinoDe.has(g)),
    textosSobrantes,
    mismoTipo: false,
  };
}

/** Graficador que llena cada slot del tipo destino, para dibujar «así quedaría» con `ComposicionLamina`. */
export function graficosPorSlot(cambio: Pick<CambioTipoLamina, "conservados">): Record<string, string> {
  return Object.fromEntries(cambio.conservados.map((r) => [r.hacia, r.grafico.graficador]));
}
