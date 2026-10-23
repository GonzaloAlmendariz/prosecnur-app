import type { MonitoreoState } from "../../../../../api/client";
import { fmt, normalizeSourceMatch } from "../formato";
import type { DireccionAcreditacion } from "./direccionAcreditacion";

function contar(cantidad: number, uno: string, varios: string) {
  return `${fmt(cantidad)} ${cantidad === 1 ? uno : varios}`;
}

/**
 * Chips de contexto de la cabecera de pestaña. Recogen lo que decía la franja
 * de lectura retirada (G1) en las pestañas que todavía montan su vista de hoy,
 * para que no se pierda: en Modelo › Cuotas, cuántos públicos tienen padrón y
 * cuántos ya declararon su variable de control.
 */
export function chipsDeCabecera(direccion: DireccionAcreditacion, state: MonitoreoState | null): string[] {
  const clave = `${direccion.seccion}/${direccion.pestana}`;
  if (clave === "modelo/cuotas" && state) {
    const variables = state.config?.operational_model?.interest_variables ?? [];
    const conPadron = (state.sources ?? []).filter((source) => String(source.role ?? "") === "universo").length;
    const declarados = new Set(variables.map((item) => normalizeSourceMatch(item.actor))).size;
    const pendientes = Math.max(0, conPadron - declarados);
    return [
      contar(conPadron, "público con padrón", "públicos con padrón"),
      contar(variables.length, "variable declarada", "variables declaradas"),
      ...(pendientes ? [contar(pendientes, "público sin variable", "públicos sin variable")] : []),
    ];
  }
  return [];
}

/** Pestañas ya rediseñadas: traen sus propios paneles y piden el lienzo desnudo. */
const CON_LIENZO: readonly string[] = ["avance/resumen", "avance/publicos", "control/resolver"];

export function pestanaConLienzo(direccion: DireccionAcreditacion): boolean {
  return CON_LIENZO.includes(`${direccion.seccion}/${direccion.pestana}`);
}
