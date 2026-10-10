// Avisos del plan al abrirlo (la población antigua que el backend migró): el GET de la config los trae UNA sola vez,
// lo haga quien lo haga (el calentamiento de arranque, la hidratación, un reintento). Este store es su único destino:
// - los guarda en sessionStorage con su sesión, así sobreviven a recargar la ventana y se descartan al cambiar de sesión;
// - en Láminas van al canal de Avisos (contador de la barra y panel);
// - mientras Gráficos está montado y nadie los vio, un toast que no se cierra solo los anuncia (también en el Editor
//   anterior). Fuera de Gráficos no hay toast. Se dan por vistos al cerrar ese toast o al abrir el panel de Avisos.

import { useEffect } from "react";
import { create } from "zustand";
import { getSession } from "../../api/core";
import { fijarSumideroAvisosConfig } from "../../api/graficosAvisosConfig";
import { toast, useToasterStore } from "../../components/toasterStore";

export const CLAVE_AVISOS_PLAN = "pulso.graficos.avisosPlan.v1";

export type AvisosPlanGuardados = { sid: string; avisos: string[]; visto: boolean };

type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** La sesión del cliente; el módulo se importa también donde no hay `localStorage` usable (tests de Node). */
function sesionActual(): string {
  try {
    return getSession() ?? "";
  } catch {
    return "";
  }
}

function almacen(): Almacen | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Lee lo guardado sólo si es de la sesión `sid`; lo de otra sesión se borra. */
export function leerAvisosPlan(a: Almacen | null, sid: string): AvisosPlanGuardados {
  const vacio: AvisosPlanGuardados = { sid, avisos: [], visto: false };
  if (!a) return vacio;
  try {
    const raw: unknown = JSON.parse(a.getItem(CLAVE_AVISOS_PLAN) ?? "null");
    if (!raw || typeof raw !== "object") return vacio;
    const r = raw as Record<string, unknown>;
    if (r.sid !== sid) {
      a.removeItem(CLAVE_AVISOS_PLAN);
      return vacio;
    }
    const avisos = Array.isArray(r.avisos) ? r.avisos.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
    return { sid, avisos, visto: r.visto === true };
  } catch {
    return vacio;
  }
}

function guardar(a: Almacen | null, v: AvisosPlanGuardados) {
  try {
    a?.setItem(CLAVE_AVISOS_PLAN, JSON.stringify(v));
  } catch {
    // Sin sessionStorage (cuota, modo privado) el aviso sigue en memoria: no hay nada que hacer.
  }
}

type AvisosPlanStore = AvisosPlanGuardados & {
  recibir: (sid: string | null, avisos: readonly string[]) => void;
  marcarVisto: () => void;
};

export const useAvisosPlan = create<AvisosPlanStore>((set, get) => ({
  ...leerAvisosPlan(almacen(), sesionActual()),
  recibir: (sidRecibido, avisos) => {
    const sid = sidRecibido ?? "";
    const actual: AvisosPlanGuardados = get().sid === sid ? get() : { sid, avisos: [], visto: false };
    const nuevos = avisos.filter((x) => !actual.avisos.includes(x));
    if (!nuevos.length && actual === get()) return;
    const v = { sid, avisos: [...actual.avisos, ...nuevos], visto: nuevos.length ? false : actual.visto };
    guardar(almacen(), v);
    set(v);
  },
  marcarVisto: () => {
    const { sid, avisos, visto } = get();
    if (visto || !avisos.length) return;
    guardar(almacen(), { sid, avisos, visto: true });
    set({ visto: true });
  },
}));

/** Los avisos del plan de la sesión actual. */
export function useAvisosPlanSesion(): string[] {
  const sid = useAvisosPlan((s) => s.sid);
  const avisos = useAvisosPlan((s) => s.avisos);
  return sid === (sesionActual()) ? avisos : VACIO;
}
const VACIO: string[] = [];

/** Monta el toast persistente mientras Gráficos está abierto y los avisos no se vieron; se quita al salir. */
export function useAnuncioAvisosPlan(): void {
  const avisos = useAvisosPlanSesion();
  const visto = useAvisosPlan((s) => s.visto);
  const marcarVisto = useAvisosPlan((s) => s.marcarVisto);
  useEffect(() => {
    if (!avisos.length || visto) return;
    const id = toast.aviso(
      avisos.length === 1 ? "El plan de gráficos cambió al abrirlo" : `El plan de gráficos cambió al abrirlo (${avisos.length} avisos)`,
      { detalle: `${avisos[0]}${avisos.length > 1 ? " …" : ""} Detalle en Láminas › Avisos.`, duracion: 0 },
    );
    let propio = false;
    // Si el usuario lo cierra, queda visto; si lo quitamos al salir de Gráficos, no.
    const soltar = useToasterStore.subscribe((s) => {
      if (!propio && !s.toasts.some((t) => t.id === id)) marcarVisto();
    });
    return () => {
      propio = true;
      soltar();
      toast.cerrar(id);
    };
  }, [avisos, visto, marcarVisto]);
}

fijarSumideroAvisosConfig((sid, avisos) => useAvisosPlan.getState().recibir(sid, avisos));
