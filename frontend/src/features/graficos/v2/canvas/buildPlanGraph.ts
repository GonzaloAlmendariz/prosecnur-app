import { GraficadorRef, PlanJson, Slide } from "../../../../api/client";
import { IconoConfig, OverrideReusable, PaletaPorLista, SLIDE_GRAF_SLOTS } from "../../store";
import { categoryOf, SlideCategory } from "../timeline/categoryOf";

export type PlanGraphNode = {
  id: string;          // = slide.id
  index: number;       // posición global (#1, #2…)
  slide: Slide;
  category: SlideCategory;
  // Marcadores derivados (badges en la card)
  hasOverride: boolean;
  hasIcon: boolean;
  hasPalette: boolean;
};

export type PlanGraph = {
  nodes: PlanGraphNode[];
};

// Construye un grafo simple del plan: solo nodos. Las relaciones visuales
// del lienzo V2 son la **agrupación por sección** (slides tipo
// `p_slide_seccion` definen un nuevo grupo) y el **orden secuencial**
// (que se ve directamente en la grilla 6×N). Edges explícitos no aportan
// señal aquí — se descartaron tras el feedback del usuario.

export function buildPlanGraph(
  plan: PlanJson,
  paletas: Record<string, PaletaPorLista>,
  iconos: IconoConfig[],
  overrides: OverrideReusable[],
): PlanGraph {
  const validIconIds = new Set(iconos.map((i) => i.id));
  const validOverrideIds = new Set(overrides.map((o) => o.id));

  const nodes: PlanGraphNode[] = plan.slides.map((slide, index) => {
    const overrideIds = collectOverrideIds(slide);
    const iconRefs = collectIconRefs(slide);
    const listsUsed = collectListNames(slide);
    return {
      id: slide.id,
      index,
      slide,
      category: categoryOf(slide.tipo),
      hasOverride: overrideIds.some((id) => validOverrideIds.has(id)),
      hasIcon: iconRefs.some((id) => validIconIds.has(id)),
      hasPalette: listsUsed.some(
        (ln) => paletas[ln] && Object.keys(paletas[ln]).length > 0,
      ),
    };
  });

  return { nodes };
}

// --- Helpers de extracción --------------------------------------------------

function collectOverrideIds(slide: Slide): string[] {
  const out: string[] = [];
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  for (const slot of slots) {
    const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
    if (!v?.args) continue;
    const oid = v.args["__override_id"];
    if (typeof oid === "string" && oid.length > 0) out.push(oid);
    const ovrName = v.args["override"];
    if (typeof ovrName === "string" && ovrName.length > 0) out.push(ovrName);
  }
  return Array.from(new Set(out));
}

function collectIconRefs(slide: Slide): string[] {
  const out: string[] = [];
  const v = (slide.payload as Record<string, unknown>).icono;
  if (typeof v === "string" && v.length > 0) out.push(v);
  return out;
}

function collectListNames(slide: Slide): string[] {
  const out: string[] = [];
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  for (const slot of slots) {
    const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
    if (!v?.args) continue;
    const ln = v.args["lista"] ?? v.args["list_name"];
    if (typeof ln === "string" && ln.length > 0) out.push(ln);
  }
  return Array.from(new Set(out));
}
