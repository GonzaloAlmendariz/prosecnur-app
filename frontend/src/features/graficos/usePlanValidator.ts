import { useMemo } from "react";
import { GraficadorRef, Slide } from "../../api/client";
import { usePlanStore, PaletaPorLista } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useVariables } from "./useVariables";

// Validador del plan 100% client-side: deriva warnings/errores de lo
// que ya vive en el store + registry + variables del instrumento. Sin
// roundtrip al backend, el analista ve el estado del plan en tiempo real
// a medida que edita.
//
// Tipos de warning que detecta:
//   - "slot-empty": slide con slot sin graficador.
//   - "var-unknown": un graficador referencia una variable que no está
//     en el instrumento (probablemente borraste/renombraste la pregunta).
//   - "icon-unknown": un slide de población referencia un ícono que ya
//     no está en el catálogo (alguien lo borró).
//   - "paleta-monocromatica": una paleta tiene muchos colores con hue
//     muy parecido — dificulta distinguir categorías en un apilado.
//   - "plan-vacio": el plan no tiene slides.
//
// Severidad: "error" bloquea export; "warning" solo avisa.

export type ValidationIssue = {
  severity: "error" | "warning";
  code:
    | "plan-vacio"
    | "slot-empty"
    | "var-unknown"
    | "icon-unknown"
    | "paleta-monocromatica";
  message: string;
  slideId?: string;       // para poder saltar al slide afectado
  slotName?: string;
  listName?: string;      // para paletas
};

export type ValidationSummary = {
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  canExport: boolean;
};

export function usePlanValidator(): ValidationSummary {
  const slides = usePlanStore((s) => s.plan.slides);
  const paletas = usePlanStore((s) => s.paletas);
  const iconos = usePlanStore((s) => s.iconos);
  const { slidesById, graficadoresById } = useGraficosRegistry();
  const { variables, multi } = useVariables();

  return useMemo(() => {
    const issues: ValidationIssue[] = [];

    // 1) Plan vacío ---------------------------------------------------------
    if (slides.length === 0) {
      issues.push({
        severity: "error",
        code: "plan-vacio",
        message: "El plan no tiene slides. Añade al menos uno para poder exportar.",
      });
    }

    // 2) Slots vacíos + variables desconocidas ------------------------------
    // `varNames` es un set de refs canónicas: si hay multi-base, incluye
    // el prefijo "docentes$sexo"; si es single-base, solo "sexo". El check
    // en `checkVarRefs` normaliza la ref del graficador contra este set.
    const varNames = new Set(
      variables.map((v) => (multi ? `${v.source}$${v.name}` : v.name)),
    );
    const iconIds = new Set(iconos.map((i) => i.id));

    for (const slide of slides) {
      const slideMeta = slidesById[slide.tipo];
      if (!slideMeta) continue;

      // Slots de graficador vacíos
      for (const slot of slideMeta.slots) {
        if (slot === "icono") continue; // los íconos se validan aparte
        const value = (slide.payload as Record<string, unknown>)[slot];
        const graf = value as GraficadorRef | null | undefined;
        if (!graf || !graf.graficador) {
          issues.push({
            severity: "warning",
            code: "slot-empty",
            message: `"${slideMeta.titulo_humano}" (slide ${shortId(slide.id)}): el slot "${humanizeSlot(slot)}" está sin gráfico.`,
            slideId: slide.id,
            slotName: slot,
          });
        } else {
          // Variable desconocida dentro del graficador
          checkVarRefs(graf, varNames).forEach((varName) => {
            issues.push({
              severity: "warning",
              code: "var-unknown",
              message: `"${slideMeta.titulo_humano}" (${humanizeSlot(slot)}): la variable "${varName}" no está en el instrumento. ¿La renombraste o borraste?`,
              slideId: slide.id,
              slotName: slot,
            });
          });
        }
      }

      // Slot `icono` si el slide lo acepta
      if (slideMeta.slots.includes("icono")) {
        const iconRef = (slide.payload as Record<string, unknown>).icono as string | null | undefined;
        if (iconRef && !iconIds.has(iconRef)) {
          issues.push({
            severity: "warning",
            code: "icon-unknown",
            message: `"${slideMeta.titulo_humano}" (slide ${shortId(slide.id)}): el ícono referenciado ya no existe en el catálogo. Subí uno nuevo o elige otro.`,
            slideId: slide.id,
          });
        }
      }
    }
    void graficadoresById; // silencia unused (lo mantenemos por si se amplía)

    // 3) Paletas monocromáticas ---------------------------------------------
    for (const [listName, paleta] of Object.entries(paletas)) {
      if (isMonochromaticPalette(paleta)) {
        issues.push({
          severity: "warning",
          code: "paleta-monocromatica",
          message: `Paleta de "${listName}": los colores son muy parecidos entre sí. En barras apiladas dificulta distinguir categorías.`,
          listName,
        });
      }
    }

    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    return {
      issues,
      errors,
      warnings,
      canExport: errors.length === 0,
    };
  }, [slides, paletas, iconos, slidesById, graficadoresById, variables, multi]);
}

// --- Helpers internos --------------------------------------------------

function shortId(id: string): string {
  return id.length > 8 ? id.slice(-6) : id;
}

function humanizeSlot(slot: string): string {
  const map: Record<string, string> = {
    grafico: "Gráfico",
    izquierda: "Izquierda",
    derecha: "Derecha",
    grafico_1: "Gráfico 1",
    grafico_2: "Gráfico 2",
    superior_izquierda: "Superior izquierda",
    superior_derecha: "Superior derecha",
    inferior_izquierda: "Inferior izquierda",
    inferior_derecha: "Inferior derecha",
  };
  return map[slot] ?? slot;
}

// Inspecciona los args del graficador y devuelve nombres de variables
// que el graficador referencia pero no existen en el instrumento.
function checkVarRefs(graf: GraficadorRef, varNames: Set<string>): string[] {
  const refs: string[] = [];
  const args = graf.args ?? {};
  // Nombres de args que típicamente son variables (según el registry).
  const VAR_ARGS = ["var", "cruces", "cruce"];
  for (const argName of VAR_ARGS) {
    const v = args[argName];
    if (typeof v === "string" && v.length > 0 && !varNames.has(v)) {
      refs.push(v);
    }
  }
  // `vars` es un array de variables (multi).
  const vars = args["vars"];
  if (Array.isArray(vars)) {
    for (const v of vars) {
      if (typeof v === "string" && v.length > 0 && !varNames.has(v)) {
        refs.push(v);
      }
    }
  }
  return Array.from(new Set(refs));
}

// Heurística: una paleta es "monocromática" si tiene >= 3 colores y
// todos están dentro de un rango de hue estrecho (< 30°). Para escalas
// Likert de 5 puntos con azules, es aceptable (estilo institucional
// donde la posición en la escala importa más que la categoría), pero
// emitimos warning para que el analista lo revise a propósito.
function isMonochromaticPalette(paleta: PaletaPorLista): boolean {
  const hexes = Object.values(paleta).filter(
    (c) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c),
  );
  if (hexes.length < 3) return false;
  const hues = hexes.map(hexToHue).filter((h): h is number => h !== null);
  if (hues.length < 3) return false;
  // Span circular de hues: distancia en grados entre el min y max,
  // tomando en cuenta que el hue es circular (0 = 360).
  const sorted = [...hues].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    gaps.push(sorted[i + 1] - sorted[i]);
  }
  gaps.push(360 - sorted[sorted.length - 1] + sorted[0]);
  const maxGap = Math.max(...gaps);
  const span = 360 - maxGap;
  return span < 30;
}

function hexToHue(hex: string): number | null {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.01) return null; // gris, no aporta a la heurística
  let h = 0;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

export { checkVarRefs as _checkVarRefs, isMonochromaticPalette as _isMonochromaticPalette };
