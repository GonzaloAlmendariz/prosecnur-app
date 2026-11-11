// Reglas puras de la pestaña Plantillas (checklist-pestana-plantillas-2026-11-11). La pestaña muestra la estructura que
// devuelve el backend y la selección del analista vive en `scope_rules`:
//   - `coverage_exclusions`: preguntas fuera del informe (las mismas que respeta el plan sugerido);
//   - `grafico_por_pregunta`: gráfico elegido por pregunta;
//   - `plantilla_elegida`: id de la plantilla del menú;
//   - `plantillas_guardadas`: selecciones guardadas para reusar en la siguiente medición.
// Aquí se cruzan las dos cosas y se calculan los conteos, sin tocar el store.

import type { EstructuraDelInforme, GraficoPorPregunta, PreguntaDelInforme, SeccionDelInforme } from "../../../api/graficosEstructura";

export type ScopeRules = Record<string, unknown>;

export type PlantillaGuardada = {
  id: string;
  nombre: string;
  /** Plantilla del menú sobre la que se armó. */
  base: string;
  exclusiones: string[];
  graficos: Record<string, GraficoPorPregunta>;
};

export type FiltroPreguntas = "todas" | "dentro" | "fuera";

export const ROTULO_GRAFICO: Record<GraficoPorPregunta, string> = {
  barras: "Barras",
  barras_ordenadas: "Barras de mayor a menor",
};

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const mapa = (v: unknown): Record<string, GraficoPorPregunta> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, GraficoPorPregunta> = {};
  for (const [k, g] of Object.entries(v as Record<string, unknown>)) {
    if (g === "barras" || g === "barras_ordenadas") out[k] = g;
  }
  return out;
};

export function exclusionesDe(reglas: ScopeRules): Set<string> {
  return new Set(lista(reglas.coverage_exclusions));
}

export function graficosDe(reglas: ScopeRules): Record<string, GraficoPorPregunta> {
  return mapa(reglas.grafico_por_pregunta);
}

export function plantillasGuardadasDe(reglas: ScopeRules): PlantillaGuardada[] {
  const v = reglas.plantillas_guardadas;
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): PlantillaGuardada[] => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    const id = String(r.id ?? "");
    const nombre = String(r.nombre ?? "").trim();
    if (!id || !nombre) return [];
    return [{ id, nombre, base: String(r.base ?? ""), exclusiones: lista(r.exclusiones), graficos: mapa(r.graficos) }];
  });
}

/** La estructura del backend con la selección vigente del analista encima. */
export function conSeleccion(
  estructura: EstructuraDelInforme,
  exclusiones: Set<string>,
  graficos: Record<string, GraficoPorPregunta>,
): SeccionDelInforme[] {
  return estructura.secciones.map((s) => ({
    ...s,
    preguntas: s.preguntas.map((q): PreguntaDelInforme => {
      const elegido = graficos[q.ref];
      return {
        ...q,
        dentro: !exclusiones.has(q.ref),
        grafico: elegido && q.graficosPosibles.includes(elegido) ? elegido : q.graficosPosibles[0] ?? q.grafico,
      };
    }),
  }));
}

export type EstadoSeccion = "todas" | "algunas" | "ninguna";

export function estadoSeccion(s: SeccionDelInforme): EstadoSeccion {
  const dentro = s.preguntas.filter((q) => q.dentro).length;
  return dentro === 0 ? "ninguna" : dentro === s.preguntas.length ? "todas" : "algunas";
}

/** Láminas que suma una sección: las de sus preguntas dentro y su separador. Fuera del todo, cero. */
export function laminasDeSeccion(s: SeccionDelInforme): number {
  const preguntas = s.preguntas.filter((q) => q.dentro).reduce((a, q) => a + q.laminas, 0);
  return preguntas > 0 ? preguntas + 1 : 0;
}

export type ResumenInforme = { laminas: number; secciones: number; preguntas: number; fuera: number };

export function resumenInforme(secciones: SeccionDelInforme[], laminasFijas: number): ResumenInforme {
  let laminas = laminasFijas;
  let nSecciones = 0;
  let preguntas = 0;
  let fuera = 0;
  for (const s of secciones) {
    const l = laminasDeSeccion(s);
    if (l > 0) { nSecciones += 1; laminas += l; }
    for (const q of s.preguntas) (q.dentro ? (preguntas += 1) : (fuera += 1));
  }
  return { laminas, secciones: nSecciones, preguntas, fuera };
}

/** Normaliza para buscar sin tildes ni mayúsculas. */
const plano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function preguntasVisibles(s: SeccionDelInforme, filtro: FiltroPreguntas, busqueda: string): PreguntaDelInforme[] {
  const b = plano(busqueda.trim());
  return s.preguntas.filter((q) =>
    (filtro === "todas" || (filtro === "dentro") === q.dentro) && (!b || plano(q.etiqueta).includes(b)));
}

/** `scope_rules` con un conjunto de preguntas dentro o fuera (una pregunta o una sección entera). */
export function conExclusion(reglas: ScopeRules, refs: string[], fuera: boolean): ScopeRules {
  const actual = exclusionesDe(reglas);
  for (const r of refs) (fuera ? actual.add(r) : actual.delete(r));
  return { ...reglas, coverage_exclusions: Array.from(actual) };
}

export function conGrafico(reglas: ScopeRules, ref: string, grafico: GraficoPorPregunta, porDefecto: GraficoPorPregunta): ScopeRules {
  const actual = { ...graficosDe(reglas) };
  if (grafico === porDefecto) delete actual[ref];
  else actual[ref] = grafico;
  return { ...reglas, grafico_por_pregunta: actual };
}

export function conPlantillaElegida(reglas: ScopeRules, id: string): ScopeRules {
  return { ...reglas, plantilla_elegida: id };
}

export function conPlantillaGuardada(reglas: ScopeRules, nombre: string, base: string, id: string): ScopeRules {
  const limpio = nombre.trim();
  const previas = plantillasGuardadasDe(reglas).filter((p) => p.nombre.toLowerCase() !== limpio.toLowerCase());
  const nueva: PlantillaGuardada = {
    id, nombre: limpio, base, exclusiones: Array.from(exclusionesDe(reglas)), graficos: graficosDe(reglas),
  };
  return { ...reglas, plantillas_guardadas: [...previas, nueva] };
}

export function sinPlantillaGuardada(reglas: ScopeRules, id: string): ScopeRules {
  return { ...reglas, plantillas_guardadas: plantillasGuardadasDe(reglas).filter((p) => p.id !== id) };
}

/** Reusar una plantilla guardada: su base, sus exclusiones y sus gráficos pasan a ser la selección vigente. */
export function conPlantillaReusada(reglas: ScopeRules, guardada: PlantillaGuardada): ScopeRules {
  return {
    ...reglas,
    plantilla_elegida: guardada.base,
    coverage_exclusions: [...guardada.exclusiones],
    grafico_por_pregunta: { ...guardada.graficos },
  };
}

export const conteo = (n: number, uno: string, varios: string) => `${n.toLocaleString("en-US")} ${n === 1 ? uno : varios}`;
