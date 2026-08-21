/**
 * ¿Hay de verdad una corrida previa guardada?
 *
 * Medido en el recorrido de un usuario nuevo: en un proyecto donde jamás se
 * comparó nada, la pestaña de titulares afirmaba «Existe una corrida previa,
 * pero su comparación no coincide con el objetivo o la firma vigente» y mandaba
 * a re-comparar algo inexistente.
 *
 * La causa es vieja conocida de esta casa: el estado trae `selection` y
 * `method_comparison` como objetos VACÍOS —cero filas, sin identificador— y la
 * señal se calculaba con `Boolean(raw)`, que en JavaScript es verdadero para
 * `{}`. Es la misma familia que `Number(null) === 0`: preguntar si el campo
 * existe cuando lo que importa es si trae algo.
 *
 * Estas funciones preguntan por CONTENIDO, para poder distinguir dos estados
 * que merecen mensajes distintos: «todavía no comparaste» y «comparaste, pero
 * esa evidencia ya no acredita».
 */
function filas(valor: unknown): number {
  return Array.isArray(valor) ? valor.length : 0;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Una comparación guardada cuenta si trae métodos, simulaciones o recomendación. */
export function tieneComparacionAlmacenada(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const c = raw as Record<string, unknown>;
  if (filas(c.methods) > 0) return true;
  if (filas(c.simulation_summary) > 0) return true;
  if (filas(c.risk_flags) > 0) return true;
  return Boolean(c.recommendation && typeof c.recommendation === "object");
}

/** Una selección guardada cuenta si trae corrida identificada o filas. */
export function tieneSeleccionAlmacenada(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Record<string, unknown>;
  if (texto(s.selection_run_id)) return true;
  if (filas(s.selection) > 0) return true;
  return filas(s.summary) > 0;
}

/** Una simulación de reemplazos cuenta si trae sugerencias o impacto. */
export function tieneSimulacionAlmacenada(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return filas(r.suggestions) > 0 || filas(r.impact) > 0;
}
