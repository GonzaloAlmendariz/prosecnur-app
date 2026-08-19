/**
 * Acciones REGISTRADAS desde la certificación por facultad.
 *
 * Gonzalo, textual: «estas decisiones más específicas, como por ejemplo la
 * psicología darle un aula más, tenemos que asegurarnos que estén disponibles
 * en la interfaz usuario, porque nada puede ser manual y todo tiene que estar
 * registrado en la aplicación».
 *
 * El mecanismo registrado ya existía de punta a punta —el engine respeta
 * `aulas_base_fijas` por estrato y la afijación lo hereda al recalcular—
 * pero no había NINGÚN editor en la UI: la decisión habría sido manual.
 * Este módulo la vuelve un clic donde aparece el hallazgo: fija el número
 * de titulares de la facultad en (actuales + 1) dentro del estrato del
 * componente por facultad, y el flujo existente (recalcular → seleccionar)
 * la aplica y la deja escrita en el estudio.
 */
import type { CalcMuestraEstrato } from "../../../../api/calcMuestra";

/** Espejo de `.cm_criterios_fac_key`: minúsculas, sin tildes, ñ→n, _ */
function claveFacultad(nombre: unknown): string {
  return String(nombre ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ñ]/g, "n")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[`'´’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Estratos con el override de UNA facultad fijado en `aulasActuales + 1`.
 * Devuelve `null` si la facultad no existe en los estratos: el caller no debe
 * parchear nada (una acción que no encuentra su blanco no se aplica a medias).
 */
export function estratosConAulaExtra(
  estratos: CalcMuestraEstrato[] | null | undefined,
  facultad: string,
  aulasActuales: number,
): CalcMuestraEstrato[] | null {
  if (!Array.isArray(estratos) || !estratos.length) return null;
  if (!Number.isFinite(aulasActuales) || aulasActuales < 0) return null;
  const objetivo = claveFacultad(facultad);
  if (!objetivo) return null;
  let tocado = false;
  const nuevos = estratos.map((e) => {
    if (claveFacultad(e.label) !== objetivo) return e;
    tocado = true;
    return { ...e, aulas_base_fijas: Math.round(aulasActuales) + 1 };
  });
  return tocado ? nuevos : null;
}

/**
 * Generalización del ajuste (pedido de Gonzalo 2026-08-19: «el usuario puede
 * hacer este tipo de ajustes» — subir Y bajar): fija el override de UNA
 * facultad en `aulasActuales + delta`, con piso 1 (bajar a 0 titulares es
 * excluir la facultad del sorteo, y eso es otra decisión con otra puerta).
 */
export function estratosConAjusteAula(
  estratos: CalcMuestraEstrato[] | null | undefined,
  facultad: string,
  aulasActuales: number,
  delta: 1 | -1,
): CalcMuestraEstrato[] | null {
  if (!Array.isArray(estratos) || !estratos.length) return null;
  if (!Number.isFinite(aulasActuales) || aulasActuales < 0) return null;
  const nuevo = Math.round(aulasActuales) + delta;
  if (nuevo < 1) return null;
  const objetivo = claveFacultad(facultad);
  if (!objetivo) return null;
  let tocado = false;
  const nuevos = estratos.map((e) => {
    if (claveFacultad(e.label) !== objetivo) return e;
    tocado = true;
    return { ...e, aulas_base_fijas: nuevo };
  });
  return tocado ? nuevos : null;
}
