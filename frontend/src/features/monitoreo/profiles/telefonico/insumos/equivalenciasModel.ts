/**
 * Equivalencia de nombres entre el enumerador de Kobo y el responsable de la
 * hoja de barrido (P4: son la misma persona, escrita de dos formas). Se
 * confirma en Insumos › Llave y filtros y se guarda en
 * `monitoreo_profile.enumerator_equivalences`; Discrepancias la usa para no
 * marcar como «otra persona» lo que es el mismo nombre.
 */
import type { MonitoreoAcreditacionReports, MonitoreoProfile } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";
import { sugerenciasDeEquivalencia } from "../control/discrepanciasModel";

export type Par = { kobo: string; hoja: string };

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

const SIN_NOMBRE = /^(sin (responsable|asignar|enumerador)|)$/i;

export function nombresDelCorte(reports: MonitoreoAcreditacionReports | null | undefined) {
  const enumeradores = [...new Set(filasDeBloque(reports, ["control_tiempo_kobo"])
    .map((fila) => texto(fila["Responsable plataforma"]))
    .filter((nombre) => !SIN_NOMBRE.test(nombre)))];
  const responsables = [...new Set(filasDeBloque(reports, ["comparacion_codpulso", "operacion_responsable"])
    .map((fila) => texto(fila.Responsable))
    .filter((nombre) => !SIN_NOMBRE.test(nombre)))]
    .sort((a, b) => a.localeCompare(b, "es"));
  return { enumeradores, responsables };
}

export type FilaDeEquivalencia = Par & {
  estado: "confirmada" | "sugerida" | "sin_pareja";
  /** Por qué se sugiere (lo dice el motor), o vacío. */
  criterio: string;
  /** Envíos de Kobo del enumerador, si el motor los publica. */
  envios: number | null;
};

/**
 * Las filas de la tabla. Con el bloque `equivalencias_nombres` del motor
 * (sin par, sugerida, confirmada e igual, en ese orden) se muestra todo lo
 * que no es igual; con un corte anterior al bloque, se sugiere aquí.
 */
export function filasDeEquivalencia(
  reports: MonitoreoAcreditacionReports | null | undefined,
  perfil: MonitoreoProfile | null | undefined,
): { filas: FilaDeEquivalencia[]; responsables: string[]; mismoNombre: number } {
  const { enumeradores, responsables } = nombresDelCorte(reports);
  const bloque = filasDeBloque(reports, ["equivalencias_nombres"]);
  if (bloque.length) {
    const estado = (valor: string): FilaDeEquivalencia["estado"] | null => (
      valor === "confirmada" ? "confirmada" : valor === "sugerida" ? "sugerida" : valor === "sin_par" ? "sin_pareja" : null
    );
    const filas = bloque.flatMap((fila) => {
      const cual = estado(texto(fila.Estado));
      if (!cual) return [];
      const envios = Number(texto(fila["Envíos Kobo"]));
      return [{
        kobo: texto(fila["Enumerador Kobo"]),
        hoja: texto(fila["Responsable hoja"]),
        estado: cual,
        criterio: texto(fila.Criterio),
        envios: Number.isFinite(envios) && texto(fila["Envíos Kobo"]) ? envios : null,
      }];
    });
    const deLaHoja = [...new Set([...responsables, ...bloque.map((fila) => texto(fila["Responsable hoja"])).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b, "es"));
    return { filas, responsables: deLaHoja, mismoNombre: bloque.filter((fila) => texto(fila.Estado) === "igual").length };
  }
  const confirmadas = perfil?.enumerator_equivalences ?? [];
  const pendientes = sugerenciasDeEquivalencia(enumeradores, responsables, confirmadas);
  const filas: FilaDeEquivalencia[] = [
    ...confirmadas.map((par) => ({ ...par, estado: "confirmada" as const, criterio: "", envios: null })),
    ...pendientes.map((par) => ({ ...par, estado: par.hoja ? "sugerida" as const : "sin_pareja" as const, criterio: "", envios: null })),
  ];
  return { filas, responsables, mismoNombre: enumeradores.length - pendientes.length - confirmadas.filter((par) => enumeradores.includes(par.kobo)).length };
}

/** Lo que se guarda: los pares con nombre de la hoja elegido, sin repetir enumerador. */
export function paresParaGuardar(borrador: readonly Par[]): Par[] {
  const vistos = new Set<string>();
  return borrador.filter((par) => {
    if (!par.kobo.trim() || !par.hoja.trim() || vistos.has(par.kobo)) return false;
    vistos.add(par.kobo);
    return true;
  }).map((par) => ({ kobo: par.kobo.trim(), hoja: par.hoja.trim() }));
}
