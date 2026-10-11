// Conflicto de revisión del borrador del informe compartido (contrato A7 H3, decisión D2 de Gonzalo: «recargar el
// borrador con aviso explícito»).
//
// El borrador compartido (`/graficos/consolidado/draft`, ADR 0040 §6.1) se guarda con concurrencia optimista: cada PUT
// lleva la `expected_revision` que leyó y el backend responde 409 `E_GRAFICOS_CONSOLIDADO_DRAFT_STALE` si otra pestaña o
// persona guardó antes. Antes de este módulo ese 409 no actualizaba la revisión y el autosave lo tragaba: la barra
// quedaba «Cambios sin guardar» para siempre, cada guardado repetía el PUT con la misma revisión vieja y exportar o
// guardar el proyecto fallaban con el mensaje crudo.
//
// Aquí vive la regla: un STALE pone el informe en «conflicto»; mientras dure, NINGÚN guardado sale con la revisión vieja
// (autosave, exportar ni guardar el proyecto) y todos fallan con el mismo mensaje accionable. La única salida es recargar
// el borrador guardado, que hidrata, limpia «dirty» y limpia el conflicto. No se fusiona ni se guarda copia: D2 eligió
// la semántica optimista del ADR 0040.

import { create } from "zustand";
import { toast } from "../../components/toasterStore";
import { usePlanStore } from "./store";

export const CODIGO_BORRADOR_STALE = "E_GRAFICOS_CONSOLIDADO_DRAFT_STALE";

const MENSAJE_QUE_PASO = "Otra pestaña o persona guardó el informe compartido.";
const MENSAJE_QUE_HACER = "Recarga para ver la versión guardada; tus cambios sin guardar de esta pestaña se perderán.";
export const MENSAJE_CONFLICTO_BORRADOR = `${MENSAJE_QUE_PASO} ${MENSAJE_QUE_HACER}`;
export const ACCION_RECARGAR_BORRADOR = "Recargar el informe compartido";
export const MENSAJE_RECARGA_FALLIDA = "No se pudo recargar el informe compartido. Vuelve a intentarlo.";

/** Error con el que fallan todos los guardados del compartido mientras hay conflicto. Su `message` ya es el de la casa. */
export class ConflictoBorradorError extends Error {
  readonly code = CODIGO_BORRADOR_STALE;
  constructor() {
    super(MENSAJE_CONFLICTO_BORRADOR);
    this.name = "ConflictoBorradorError";
  }
}

/** ¿Es el 409 de revisión vieja? Acepta `ApiError` (por `code`) y el texto canónico « · E_CODE» del cliente. */
export function esConflictoDeRevision(error: unknown): boolean {
  if (error instanceof ConflictoBorradorError) return true;
  if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === CODIGO_BORRADOR_STALE) {
    return true;
  }
  const mensaje = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return mensaje.includes(CODIGO_BORRADOR_STALE);
}

type ConflictoState = {
  /** `null` = sin conflicto. `sid` = sesión en la que se detectó. */
  conflicto: { sid: string | null } | null;
  recargando: boolean;
};

export const useConflictoBorrador = create<ConflictoState>(() => ({ conflicto: null, recargando: false }));

type Recarga = () => Promise<void>;
let recargaRegistrada: Recarga | null = null;
let toastConflicto: string | null = null;

export function hayConflictoBorrador(): boolean {
  return useConflictoBorrador.getState().conflicto != null;
}

/** Entra en conflicto y avisa una sola vez (toast de error persistente, `role="alert"`, con la acción de recargar). */
export function marcarConflictoBorrador(sid: string | null): void {
  if (hayConflictoBorrador()) return;
  useConflictoBorrador.setState({ conflicto: { sid } });
  toastConflicto = toast.error(MENSAJE_QUE_PASO, {
    detalle: MENSAJE_QUE_HACER,
    accion: { label: ACCION_RECARGAR_BORRADOR, onSelect: () => { void recargarBorradorCompartido(); } },
  });
}

export function limpiarConflictoBorrador(): void {
  if (toastConflicto) toast.cerrar(toastConflicto);
  toastConflicto = null;
  useConflictoBorrador.setState({ conflicto: null, recargando: false });
}

/**
 * Guarda el borrador con la revisión conocida. En conflicto no llama al PUT (nunca reintenta con la revisión vieja);
 * ante un STALE entra en conflicto. En ambos casos falla con `ConflictoBorradorError`. Otros errores pasan tal cual.
 */
export async function guardarBorradorConRevision<T>(args: {
  revision: number | null;
  sid: string | null;
  guardar: (revision: number) => Promise<T>;
}): Promise<T> {
  if (hayConflictoBorrador()) throw new ConflictoBorradorError();
  if (args.revision == null) throw new Error("El borrador compartido aún no terminó de cargar.");
  try {
    return await args.guardar(args.revision);
  } catch (error) {
    if (!esConflictoDeRevision(error)) throw error;
    marcarConflictoBorrador(args.sid);
    throw new ConflictoBorradorError();
  }
}

/**
 * Arma la recarga: pide el borrador guardado, lo hidrata (quien la arma registra el alcance y la revisión), marca el
 * store limpio y sale del conflicto. Si el GET falla, el conflicto sigue y se avisa.
 */
export function crearRecargaBorrador<R>(args: { leer: () => Promise<R>; hidratar: (borrador: R) => void }): Recarga {
  return async () => {
    useConflictoBorrador.setState({ recargando: true });
    try {
      const borrador = await args.leer();
      args.hidratar(borrador);
      usePlanStore.getState().markClean();
      limpiarConflictoBorrador();
    } catch {
      useConflictoBorrador.setState({ recargando: false });
      toast.error(MENSAJE_RECARGA_FALLIDA, {
        accion: { label: ACCION_RECARGAR_BORRADOR, onSelect: () => { void recargarBorradorCompartido(); } },
      });
    }
  };
}

/** La registra `useGraficosAutosave` mientras el informe compartido está montado; `null` la retira. */
export function registrarRecargaBorrador(recarga: Recarga | null): void {
  recargaRegistrada = recarga;
}

export async function recargarBorradorCompartido(): Promise<void> {
  if (!recargaRegistrada || useConflictoBorrador.getState().recargando) return;
  await recargaRegistrada();
}
