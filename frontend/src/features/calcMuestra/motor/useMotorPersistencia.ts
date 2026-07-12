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
 */
import { useEffect } from "react";
import { useCalcMuestraStore } from "../store/calcMuestraStore";
import { useMotorStore } from "./store";
import {
  motorRecorridoIgual,
  normalizarMotorRecorrido,
  serializarMotorRecorrido,
} from "./persistencia";

export function useMotorPersistencia() {
  const estudio = useCalcMuestraStore((s) => s.estudio);
  const hydrated = useCalcMuestraStore((s) => s.hydrated);
  const dirty = useCalcMuestraStore((s) => s.dirty);

  // Backend → motor. Corre en mount-hidratado y en cada re-hidratación
  // (pulso:session-changed pasa por hydrate(), que deja dirty en false).
  useEffect(() => {
    if (!hydrated || dirty) return;
    const normalizado = normalizarMotorRecorrido(estudio.workspace?.motor_recorrido);
    // Proyecto viejo o payload inutilizable: no tocar el motor.
    if (!normalizado) return;
    const motor = useMotorStore.getState();
    const actual = serializarMotorRecorrido(motor);
    const entrante = serializarMotorRecorrido(normalizado);
    if (motorRecorridoIgual(actual, entrante)) return;
    motor.hidratar(normalizado);
  }, [estudio, hydrated, dirty]);

  // Motor → workspace. El PUT lo hace el autosave existente (debounce 2 s).
  useEffect(() => {
    const sync = () => {
      const store = useCalcMuestraStore.getState();
      // Antes de hidratar no hay estudio real que patchear: escribir aquí
      // persistiría el default del motor sobre un estudio placeholder.
      if (!store.hydrated) return;
      const serializado = serializarMotorRecorrido(useMotorStore.getState());
      const persistido = store.estudio.workspace?.motor_recorrido ?? null;
      if (motorRecorridoIgual(persistido, serializado)) return;
      store.setWorkspaceMotorRecorrido(serializado);
    };
    return useMotorStore.subscribe(sync);
  }, []);
}
