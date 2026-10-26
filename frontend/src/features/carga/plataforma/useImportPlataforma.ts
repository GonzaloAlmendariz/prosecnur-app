import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import {
  claveImport,
  type EstrategiaImport,
  type PeticionImport,
  type ProveedorPlataforma,
} from "./modeloPlataforma";
import {
  hayJobEnCurso,
  usePlataformaStore,
  type ImportEnLanzamiento,
  type ImportTerminado,
  type ImportVivo,
  type PlataformaState,
} from "./usePlataformaStore";

export type EstadoImportPlataforma = "inactivo" | "lanzando" | "en-curso" | "terminado";

export type UseImportPlataformaOpciones = {
  proveedor: ProveedorPlataforma;
  estrategia: EstrategiaImport;
  /**
   * Se llama UNA vez por desenlace (importado, cancelado, error…), aunque el
   * job haya terminado con el componente desmontado: se dispara al volver.
   * Es el lugar para refrescar el estudio (`estudio`/`n_bases` del payload).
   */
  onTerminado?: (terminado: ImportTerminado) => void;
  /** Inyectable para tests; por defecto, la instancia de la app. */
  store?: typeof usePlataformaStore;
};

export type UseImportPlataforma = {
  estado: EstadoImportPlataforma;
  lanzando: ImportEnLanzamiento | null;
  vivo: ImportVivo | null;
  terminado: ImportTerminado | null;
  /** Hay un import de plataforma corriendo en CUALQUIER proveedor/estrategia.
   *  L3 bloquea «agregar base» con esto: un apply async pisaría la base nueva. */
  jobEnCurso: boolean;
  /** Ms desde que arrancó el import en curso (avanza cada segundo). */
  transcurridoMs: number;
  importar: (peticion: Omit<PeticionImport, "proveedor" | "estrategia">) => Promise<string | null>;
  cancelar: () => Promise<void>;
  /** Limpia el desenlace mostrado (vuelve a `inactivo`). */
  descartar: () => void;
};

const TICK_MS = 1000;

function useAhora(activo: boolean): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [activo]);
  return ahora;
}

/**
 * Import de SurveyMonkey/Kobo como job en segundo plano (`async: true`),
 * seguido por el poller de la casa desde el store: el job sobrevive al
 * desmontaje y este hook lo retoma al volver.
 */
export function useImportPlataforma(opciones: UseImportPlataformaOpciones): UseImportPlataforma {
  const { proveedor, estrategia, onTerminado } = opciones;
  const store = opciones.store ?? usePlataformaStore;
  const clave = claveImport(proveedor, estrategia);

  const lanzando = useStore(store, (s: PlataformaState) => s.lanzando[clave] ?? null);
  const vivo = useStore(store, (s: PlataformaState) => s.vivos[clave] ?? null);
  const terminado = useStore(store, (s: PlataformaState) => s.terminados[clave] ?? null);
  const jobEnCurso = useStore(store, hayJobEnCurso);

  const activo = Boolean(lanzando || vivo);
  const ahora = useAhora(activo);
  const iniciadoEn = vivo?.iniciadoEn ?? lanzando?.iniciadoEn ?? null;
  const transcurridoMs = iniciadoEn == null ? 0 : Math.max(0, ahora - iniciadoEn);

  const onTerminadoRef = useRef(onTerminado);
  onTerminadoRef.current = onTerminado;

  useEffect(() => {
    if (!terminado || terminado.notificado) return;
    store.getState().marcarNotificado(clave);
    onTerminadoRef.current?.(terminado);
  }, [terminado, clave, store]);

  const importar = useCallback(
    (peticion: Omit<PeticionImport, "proveedor" | "estrategia">) =>
      store.getState().importar({ ...peticion, proveedor, estrategia }),
    [store, proveedor, estrategia],
  );
  const cancelar = useCallback(() => store.getState().cancelar(clave), [store, clave]);
  const descartar = useCallback(() => store.getState().descartar(clave), [store, clave]);

  const estado: EstadoImportPlataforma = vivo
    ? "en-curso"
    : lanzando
      ? "lanzando"
      : terminado
        ? "terminado"
        : "inactivo";

  return { estado, lanzando, vivo, terminado, jobEnCurso, transcurridoMs, importar, cancelar, descartar };
}
