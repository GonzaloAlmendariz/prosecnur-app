// Etiqueta corta por pregunta en las multiapiladas (U9 del checklist de mandos del mazo, 2026-11-05). En el modo «Una
// barra por pregunta» (`modo = "var"`) el motor rotula cada barra con `overrides.etiquetas_vars[v]`, donde `v` es la
// referencia tal como va en `vars` (api/R/reporte_plan_ppt.R, `.named_lookup`); sin ella, con `titulos_grupo[v]` (que el
// constructor traduce a `etiquetas_vars`, reporte_plan_slides.R) o con el enunciado del instrumento. Puro.

type Valores = Readonly<Record<string, unknown>>;

/** Las preguntas de una multiapilada que el motor rotula una por una; vacío en los demás modos o con temas por público. */
export function preguntasConEtiqueta(args: Valores): string[] {
  const modo = typeof args.modo === "string" && args.modo ? args.modo : "var";
  if (modo !== "var" || !Array.isArray(args.vars)) return [];
  const vistas = new Set<string>();
  for (const v of args.vars) {
    if (typeof v !== "string") continue;
    const ref = v.trim();
    if (ref) vistas.add(ref);
  }
  return [...vistas];
}

/** Lo que el motor escribe sin etiqueta corta: el título por grupo declarado en el plan, si lo hay. */
export function tituloDeGrupo(args: Valores, ref: string): string {
  const t = args.titulos_grupo;
  if (!t || typeof t !== "object" || Array.isArray(t)) return "";
  const v = (t as Record<string, unknown>)[ref];
  return typeof v === "string" ? v.trim() : "";
}
