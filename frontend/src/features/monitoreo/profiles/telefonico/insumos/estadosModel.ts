/**
 * Insumos › Estados del telefónico: qué significa cada status que el cliente
 * escribió en su hoja de barrido.
 *
 * Conviven dos lecturas del mismo status y esta pestaña las muestra juntas sin
 * reconciliarlas (P18 en el plan):
 *
 * - la familia que guarda el definidor (`familiasDeLlamada.ts`: Efectivo, Sin
 *   contacto, Número inválido…), que es la que se edita hoy y gobierna colores
 *   y agrupación de los gráficos;
 * - la familia con la que el motor cuenta el caso, que sale de las reglas de
 *   estado del proyecto (`complete`, `pending`…; `familiasDelCliente.ts`). Si
 *   un status no tiene regla, se marca «sin regla».
 *
 * Sólo se dice que difieren cuando el status tiene regla del motor y su
 * familia no corresponde a la que guarda el definidor.
 */

import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../api/client";
import {
  acreditacionDeclaracionesDesdeReglas,
  acreditacionEstadosDetectados,
  type AcreditacionEstadoDetectado,
  type AcreditacionFamiliaLlamada,
} from "../../../estados/familiasDeLlamada";
import { filasDeBloque } from "../navegacion/bloques";
import type { CasoDeCola } from "../../../core/colaDeInsistenciaModel";
import { clasificadorDeStatus, type FamiliaDelCliente } from "../control/familiasDelCliente";

export type FilaDeEstado = AcreditacionEstadoDetectado & {
  motor: FamiliaDelCliente;
  conRegla: boolean;
  /** La familia del definidor no corresponde a la del motor. */
  difiere: boolean;
};

/** Familia del motor que corresponde a cada familia del definidor. */
const EQUIVALENTE: Record<AcreditacionFamiliaLlamada, FamiliaDelCliente | null> = {
  efectivo: "efectiva",
  rechazo: "rechazo",
  sin_contacto: "reintentable",
  numero_invalido: "terminal",
  sin_barrer: "sin-llamar",
  otro: null,
};

export function filasDeEstados(
  detectados: readonly AcreditacionEstadoDetectado[],
  reglas: readonly MonitoreoStateRule[],
): FilaDeEstado[] {
  const clasificar = clasificadorDeStatus(reglas);
  return detectados.map((estado) => {
    const motor = clasificar(estado.crudo);
    const equivalente = EQUIVALENTE[estado.familia];
    return {
      ...estado,
      motor: motor.familia,
      conRegla: motor.conRegla,
      difiere: motor.conRegla && equivalente !== null && equivalente !== motor.familia,
    };
  });
}

/** Status que el motor no sabe ubicar por regla («No barrido» no cuenta: es el vacío de la hoja). */
export function sinReglaDelMotor(filas: readonly FilaDeEstado[]) {
  const sinRegla = filas.filter((fila) => !fila.conRegla && fila.motor !== "sin-llamar");
  return {
    valores: sinRegla.length,
    casos: sinRegla.reduce((suma, fila) => suma + fila.value, 0),
    nombres: sinRegla.map((fila) => fila.crudo),
  };
}

export type TramoDeIntentos = { etiqueta: string; casos: number };

/**
 * Intentos que registra la hoja para los casos de la cola de insistencia. De
 * uno a cinco van uno por uno; más arriba sólo aparecen si hay casos (Medios de
 * Vida llega a 18).
 */
export function intentosDeLaCola(casos: readonly CasoDeCola[]): TramoDeIntentos[] {
  const contar = (filtro: (n: number | null) => boolean) => casos.filter((caso) => filtro(caso.intentos)).length;
  const tramos: TramoDeIntentos[] = [{ etiqueta: "Sin dato", casos: contar((n) => n == null || n <= 0) }];
  for (let i = 1; i <= 5; i += 1) {
    tramos.push({ etiqueta: i === 1 ? "1 intento" : `${i} intentos`, casos: contar((n) => n === i) });
  }
  const seisANueve = contar((n) => n != null && n >= 6 && n <= 9);
  const diezOMas = contar((n) => n != null && n >= 10);
  if (seisANueve) tramos.push({ etiqueta: "6 a 9 intentos", casos: seisANueve });
  if (diezOMas) tramos.push({ etiqueta: "10 o más", casos: diezOMas });
  return tramos;
}

/** Los status que trajo ESTE corte, con su volumen (`estatus_telefonico`). */
export function entradasDeEstatus(reports: MonitoreoAcreditacionReports | null | undefined) {
  return filasDeBloque(reports, ["estatus_telefonico"]).map((fila) => ({
    label: String(fila.Estatus ?? fila.Estado ?? fila.Categoria ?? fila["Categoría"] ?? "").trim(),
    value: Number(String(fila.Casos ?? fila.Valor ?? fila.Total ?? 0).replace(/,/g, "")) || 0,
  })).filter((entrada) => entrada.label);
}

/** «13 valores en la columna Status» y, si los hay, los que no tienen regla del motor. */
export function chipsDeEstados(
  reports: MonitoreoAcreditacionReports | null | undefined,
  reglas: readonly MonitoreoStateRule[],
): string[] {
  const detectados = acreditacionEstadosDetectados(entradasDeEstatus(reports), acreditacionDeclaracionesDesdeReglas(reglas));
  if (!detectados.length) return [];
  const fmt = (n: number) => n.toLocaleString("es-PE");
  const sinRegla = sinReglaDelMotor(filasDeEstados(detectados, reglas));
  return [
    `${fmt(detectados.length)} ${detectados.length === 1 ? "valor" : "valores"} en la columna Status`,
    ...(sinRegla.valores
      ? [`${fmt(sinRegla.valores)} ${sinRegla.valores === 1 ? "valor" : "valores"} sin regla, ${fmt(sinRegla.casos)} ${sinRegla.casos === 1 ? "caso" : "casos"}`]
      : []),
  ];
}
