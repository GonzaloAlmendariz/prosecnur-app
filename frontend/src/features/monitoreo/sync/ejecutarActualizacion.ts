import {
  apiMonitoreoSheetsSyncAsync,
  apiMonitoreoSync,
  normalizeMonitoreoSheetsSyncResult,
  type MonitoreoConfig,
} from "../../../api/monitoreo";
import { toast } from "../../../components/toasterStore";
import { esperarJobDeSync } from "./esperarJobDeSync";
import type { PeticionDeActualizar, PeticionDeTraer } from "./menuDeActualizar";
import { fusionarProgreso, type ProgresoDelSync } from "./pasosDelSync";
import { reciboDeFallo, reciboDeHojas, reciboDeRecalcular, reciboDeSync, type ReciboDelSync } from "./reciboDelSync";

/**
 * Corre una petición del control «Actualizar»: lanza el job, reporta su paso
 * al store del perfil, relee el estado y deja el recibo como aviso. Fuera de
 * React para poder probarla con un job simulado.
 */

export type ProgresoDelStore = ProgresoDelSync & { mode: "advance" | "full" };

export type AccionesDelStoreDeSync = {
  start: (progreso: ProgresoDelStore) => void;
  report: (progreso: ProgresoDelStore) => void;
  finish: () => void;
};

type Resultado = { ok: true } | { ok: false; mensaje: string };

/**
 * Lo que trajo un lanzamiento, en la forma que lee el recibo: el `result_data`
 * de `/api/monitoreo/sync` (`sync_summary`, `errors`) o el del job de hojas.
 */
export type ResultadoDelLanzamiento =
  | { tipo: "sync"; resultado: unknown }
  | { tipo: "hojas"; resultado: unknown; cuantas: number };

export type HerramientasDelLanzamiento = {
  config?: Partial<MonitoreoConfig>;
  /** Reporta el progreso al store del perfil; el paso no retrocede. */
  reportar: (progreso: ProgresoDelSync) => void;
  cancelado: () => boolean;
};

/**
 * Cómo se lanza lo que pide el control. Por defecto, las hojas van por
 * `/api/monitoreo/sheets/sync` y lo demás por `/api/monitoreo/sync`. Un perfil
 * con fuentes que no van por ahí —las ocurrencias de campo de Territorial—
 * inyecta el suyo y delega en `lanzarPorDefecto` lo que sí va.
 */
export type LanzadorDeActualizacion = (
  peticion: PeticionDeTraer,
  herramientas: HerramientasDelLanzamiento,
) => Promise<ResultadoDelLanzamiento>;

export const lanzarPorDefecto: LanzadorDeActualizacion = async (peticion, { config, reportar, cancelado }) => {
  if (peticion.tipo === "hojas") {
    const inicio = await apiMonitoreoSheetsSyncAsync(peticion.fuentes);
    reportar({ percent: 8, phase: "En cola", message: "Esperando al motor local..." });
    const snapshot = await esperarJobDeSync(inicio.job_id, reportar, cancelado);
    return {
      tipo: "hojas",
      resultado: normalizeMonitoreoSheetsSyncResult(snapshot.result_data),
      cuantas: peticion.fuentes.length,
    };
  }
  const inicio = await apiMonitoreoSync(config, peticion.fuentes, { syncMode: peticion.modo });
  reportar({ percent: 8, phase: "En cola", message: "Esperando al motor local..." });
  const snapshot = await esperarJobDeSync(inicio.job_id, reportar, cancelado);
  return { tipo: "sync", resultado: snapshot.result_data };
};

export function emitirRecibo(recibo: ReciboDelSync) {
  const extra = recibo.detalle ? { detalle: recibo.detalle } : undefined;
  if (recibo.tono === "error") toast.error(recibo.mensaje, extra);
  else if (recibo.tono === "aviso") toast.aviso(recibo.mensaje, extra);
  else toast.exito(recibo.mensaje, extra);
}

export async function ejecutarActualizacion(
  peticion: PeticionDeActualizar,
  {
    config,
    acciones,
    recargar,
    alEmpezar,
    alFallar,
    cancelado = () => false,
    lanzar = lanzarPorDefecto,
  }: {
    config?: Partial<MonitoreoConfig>;
    acciones: AccionesDelStoreDeSync;
    recargar: () => Promise<void>;
    alEmpezar?: () => void;
    alFallar?: (mensaje: string) => void;
    cancelado?: () => boolean;
    /** Lanzamiento propio del perfil; sin él, `lanzarPorDefecto`. */
    lanzar?: LanzadorDeActualizacion;
  },
): Promise<void> {
  const modo = peticion.tipo === "sync" ? peticion.modo : "full";
  let ultimo: ProgresoDelSync = { percent: 2, phase: "Preparando", message: "Preparando la actualización..." };
  const reportar = (siguiente: ProgresoDelSync) => {
    ultimo = fusionarProgreso(ultimo, siguiente);
    acciones.report({ mode: modo, ...ultimo });
  };
  const releer = async (): Promise<Resultado> => {
    try {
      await recargar();
      return { ok: true };
    } catch (e) {
      return { ok: false, mensaje: (e as Error).message };
    }
  };
  const cerrar = (recibo: ReciboDelSync, recalculo: Resultado) => {
    emitirRecibo(recibo);
    if (!recalculo.ok) alFallar?.(recalculo.mensaje);
  };

  acciones.start({ mode: modo, ...ultimo });
  alEmpezar?.();
  try {
    if (peticion.tipo === "recalcular") {
      reportar({ percent: 50, phase: "Recalculando", message: "Recalculando el tablero..." });
      const recalculo = await releer();
      cerrar(reciboDeRecalcular(recalculo), recalculo);
      return;
    }
    const traido = await lanzar(peticion, { config, reportar, cancelado });
    const recalculo = await releer();
    cerrar(
      traido.tipo === "hojas"
        ? reciboDeHojas(traido.resultado, traido.cuantas, recalculo)
        : reciboDeSync(traido.resultado, recalculo),
      recalculo,
    );
  } catch (e) {
    // Al salir del módulo el poll se corta, pero el job sigue: no es un fallo.
    if (!cancelado()) {
      const mensaje = (e as Error).message;
      emitirRecibo(reciboDeFallo(mensaje));
      alFallar?.(mensaje);
    }
  } finally {
    acciones.finish();
  }
}
