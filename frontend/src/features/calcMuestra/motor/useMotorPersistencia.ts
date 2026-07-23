/**
 * Cierra el ciclo de persistencia del Motor/Recorrido muestral:
 *
 *   backend → estudio.workspace.motor_recorrido → (normalizar) → useMotorStore
 *   useMotorStore → (serializar) → estudio.workspace.motor_recorrido → autosave
 *
 * No hace ningún fetch propio: la hidratación del estudio y el PUT con
 * debounce ya los maneja `useCalcMuestraAutosave`. Este hook solo sincroniza
 * los dos stores, con guardias anti-bucle en ambas direcciones:
 *
 *  - Hidratar SOLO cuando el estudio está hidratado y limpio (dirty === false):
 *    con dirty true habría write-back local en vuelo más nuevo que el backend.
 *  - Ambas direcciones comparan serializaciones estables IGNORANDO
 *    `actualizado_at` (motorRecorridoIgual); así el markClean() post-PUT
 *    (mismo estudio, dirty→false) es un no-op y no rebota.
 *
 * F3 (contaminación cross-proyecto): el store del motor es global y sobrevive
 * al cambio de proyecto. Si el estudio hidratado NO trae motor_recorrido
 * utilizable y venimos de OTRO estudio, el motor se resetea al canon antes de
 * aceptar interacciones; sin ese reset, la primera interacción escribía el
 * perfil/decisiones del proyecto A en el workspace del proyecto B. En
 * re-hidrataciones del MISMO estudio el motor no se toca.
 */
import { useEffect } from "react";
import type { CalcMuestraEstudio } from "../../../api/client";
import { useCalcMuestraStore, useMotorStore } from "../store";
import {
  motorRecorridoIgual,
  normalizarMotorRecorrido,
  serializarMotorRecorrido,
} from "./persistencia";

/**
 * Estado de sesión del sync. Vive a nivel de módulo (no en un ref del hook)
 * porque el motor store también es global: debe sobrevivir remounts de la
 * página dentro del mismo estudio para no resetear de más.
 *
 *  - `estudioId`: identidad del último estudio cuya hidratación procesó el
 *    motor (distingue cambio real de estudio vs re-hidratación del mismo).
 *  - `aplicandoBackend`: true mientras la dirección backend→motor está
 *    mutando el motor store; silencia el write-back del subscribe (si no, el
 *    reset de F3 escribiría el default del motor en el workspace recién
 *    hidratado, ensuciando un estudio que el usuario no tocó).
 */
export type MotorSyncSesion = {
  estudioId: string | null;
  aplicandoBackend: boolean;
};

export function crearMotorSyncSesion(): MotorSyncSesion {
  return { estudioId: null, aplicandoBackend: false };
}

const sesionGlobal = crearMotorSyncSesion();

/**
 * Identidad del estudio activo: proyecto abierto (sid de la sesión backend,
 * misma clave localStorage que usa SessionContext) + id del estudio. El id
 * solo no alcanza: los estudios nunca guardados llevan id "" en TODOS los
 * proyectos, y justo esos son los que no traen motor_recorrido.
 */
function identidadEstudioActivo(estudio: CalcMuestraEstudio): string {
  let sid = "";
  try {
    sid = window.localStorage.getItem("pulso.sessionId") ?? "";
  } catch {
    // Entorno sin window/localStorage (tests/node): la identidad cae al id puro.
  }
  return `${sid}::${estudio.id}`;
}

/**
 * Dirección backend → motor (exportada para test). Llamar SOLO con el estudio
 * hidratado y limpio; el hook aplica ese gate.
 */
export function hidratarMotorDesdeEstudio(
  estudio: CalcMuestraEstudio,
  sesion: MotorSyncSesion = sesionGlobal,
  identidad: string = identidadEstudioActivo(estudio),
): void {
  const normalizado = normalizarMotorRecorrido(estudio.workspace?.motor_recorrido);
  const cambioDeEstudio = sesion.estudioId !== identidad;
  sesion.estudioId = identidad;
  const motor = useMotorStore.getState();
  if (!normalizado) {
    // Estudio sin motor persistido (proyecto viejo o payload inutilizable).
    // Mismo estudio → no tocar el motor (puede haber estado en vuelo propio).
    // Estudio distinto → reset al canon (F3).
    if (!cambioDeEstudio) return;
    sesion.aplicandoBackend = true;
    try {
      motor.resetInicial();
    } finally {
      sesion.aplicandoBackend = false;
    }
    return;
  }
  const actual = serializarMotorRecorrido(motor);
  const entrante = serializarMotorRecorrido(normalizado);
  if (motorRecorridoIgual(actual, entrante)) return;
  sesion.aplicandoBackend = true;
  try {
    motor.hidratar(normalizado);
  } finally {
    sesion.aplicandoBackend = false;
  }
}

/**
 * Dirección motor → workspace (exportada para test). El PUT lo hace el
 * autosave existente (debounce 2 s).
 */
export function escribirMotorEnWorkspace(sesion: MotorSyncSesion = sesionGlobal): void {
  // Mutación iniciada por la propia hidratación (hidratar/reset): no es una
  // interacción del usuario, no debe volver al workspace.
  if (sesion.aplicandoBackend) return;
  const store = useCalcMuestraStore.getState();
  // Antes de hidratar no hay estudio real que patchear: escribir aquí
  // persistiría el default del motor sobre un estudio placeholder.
  if (!store.hydrated) return;
  const serializado = serializarMotorRecorrido(useMotorStore.getState());
  const persistido = store.estudio.workspace?.motor_recorrido ?? null;
  if (motorRecorridoIgual(persistido, serializado)) return;
  store.setWorkspaceMotorRecorrido(serializado);
}

export function useMotorPersistencia() {
  const estudio = useCalcMuestraStore((s) => s.estudio);
  const hydrated = useCalcMuestraStore((s) => s.hydrated);
  const dirty = useCalcMuestraStore((s) => s.dirty);

  // Backend → motor. Corre en mount-hidratado y en cada re-hidratación
  // (pulso:session-changed pasa por hydrate(), que deja dirty en false).
  useEffect(() => {
    if (!hydrated || dirty) return;
    hidratarMotorDesdeEstudio(estudio);
  }, [estudio, hydrated, dirty]);

  // Motor → workspace, ante cada mutación real del motor.
  useEffect(() => {
    const sync = () => escribirMotorEnWorkspace();
    return useMotorStore.subscribe(sync);
  }, []);
}
