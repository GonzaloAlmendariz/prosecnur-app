import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { chipsDeReintentos, plataformaDeRespuestas } from "../control/contacto/Reintentos";
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
export function chipsDeCabecera(
  direccion: DireccionAcreditacion,
  state: MonitoreoState | null,
  reports: MonitoreoAcreditacionReports | null = null,
): string[] {
  const clave = `${direccion.seccion}/${direccion.pestana}`;
  if (clave === "control/reintentos") return chipsDeReintentos(reports, plataformaDeRespuestas(state?.sources ?? []));
  if (clave === "modelo/cuotas" && direccion.panel === "variables" && state) {
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
const CON_LIENZO: readonly string[] = ["avance/resumen", "avance/publicos", "avance/cuotas", "avance/ritmo", "avance/salidas", "control/correo", "control/resolver", "control/reintentos", "control/barrido", "control/equipo", "control/cruce", "control/personas", "control/respuestas", "control/calidad", "insumos/publicos", "insumos/fuentes", "insumos/reglas", "modelo/metas", "modelo/cuotas", "modelo/ventana"];
const SUBVISTAS: readonly string[] = ["ritmo", "recopiladores", "supervision", "detalle", "variables"];

/** Sub-vista que todavía monta la vista anterior dentro de la tarjeta de contenido. */
export function esSubvistaAnterior(direccion: DireccionAcreditacion): boolean {
  // Avance › Por cuota › Variables de control ya es vista del estándar (ronda 4):
  // lleva su propia primera tarjeta con el rótulo.
  if (direccion.seccion === "avance" && direccion.panel === "detalle") return false;
  return Boolean(direccion.panel && SUBVISTAS.includes(direccion.panel));
}

export function pestanaConLienzo(direccion: DireccionAcreditacion): boolean {
  // Una sub-vista que todavía monta la vista anterior pide el lienzo desnudo:
  // su tarjeta la pone `SubvistaConRotulo`, a su alto natural y con un solo marco.
  if (esSubvistaAnterior(direccion)) return true;
  return CON_LIENZO.includes(`${direccion.seccion}/${direccion.pestana}`);
}

/**
 * Pestañas que llevan el rótulo en su primera tarjeta en vez de una fila de
 * cabecera (§2a-bis). Reintentos ya no está: la tarjeta de filtros de la cola
 * común (`core/ColaDeInsistencia`) recibe el rótulo por `antesDeLosFiltros`.
 * Las sub-vistas anteriores lo llevan como cabecera de la tarjeta de contenido.
 */
const SIN_ROTULO_EN_TARJETA: readonly string[] = [];

export function rotuloEnTarjeta(direccion: DireccionAcreditacion): boolean {
  const clave = `${direccion.seccion}/${direccion.pestana}`;
  if (SIN_ROTULO_EN_TARJETA.includes(clave)) return false;
  // La sub-vista anterior lleva el rótulo como cabecera de su tarjeta (SubvistaConRotulo).
  if (esSubvistaAnterior(direccion)) return true;
  if (clave === "insumos/fuentes") return !direccion.panel;
  return pestanaConLienzo(direccion);
}
