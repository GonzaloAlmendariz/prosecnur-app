// ADR 0096 decisión 8: el estado de la declaración aplicada (al día, desfasada, retirada, revisión anterior, sin mazo
// derivado) se calcula en UN solo lugar —este hook— y lo consumen el Editor anterior (GraficosPage) y «Avisos del
// informe» de Láminas. Junto a él viajan los avisos de la siembra del informe compartido
// (`preflight.equivalencias.avisos`: sin matriz, bases excluidas, cobertura reducida, escala incompatible), que
// GraficosPage recibe del preflight y deja aquí para que Láminas los muestre sin volver a pedirlo.
//
// Estado UI efímero (zustand): la declaración de ahora y los avisos de la siembra se derivan del backend y se vuelven a
// pedir al montar; nada de esto se persiste.

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { getEquivalencias } from "../../api/equivalencias";
import type { GraficosAvisoEquivalencias } from "../../api/graficos";
import {
  avisoDeclaracionAplicada,
  estadoDeclaracionAplicada,
  type EstadoDeclaracionAplicada,
} from "./declaracionAplicada";
import { usePlanStore } from "./store";

type DeclaracionActual = { revision: string; declarada: boolean };

type DeclaracionStore = {
  /** Revisión aplicada para la que se pidió `actual`; si no coincide con la del plan, `actual` no vale. */
  paraRevision: string;
  actual: DeclaracionActual | null;
  /** Avisos de la siembra del compartido que dejó el preflight; vacío fuera del compartido. */
  avisosSiembra: GraficosAvisoEquivalencias[];
  fijarActual: (paraRevision: string, actual: DeclaracionActual | null) => void;
  fijarAvisosSiembra: (avisos: readonly GraficosAvisoEquivalencias[]) => void;
};

const useDeclaracionStore = create<DeclaracionStore>((set) => ({
  paraRevision: "",
  actual: null,
  avisosSiembra: [],
  fijarActual: (paraRevision, actual) => set({ paraRevision, actual }),
  fijarAvisosSiembra: (avisos) => set({ avisosSiembra: [...avisos] }),
}));

/** Lo fija GraficosPage con lo que trae el preflight del compartido (y lo vacía fuera de él). */
export function fijarAvisosSiembraCompartido(avisos: readonly GraficosAvisoEquivalencias[]): void {
  const previos = useDeclaracionStore.getState().avisosSiembra;
  const iguales = previos.length === avisos.length
    && previos.every((a, i) => a.code === avisos[i]?.code && a.message === avisos[i]?.message);
  if (!iguales) useDeclaracionStore.getState().fijarAvisosSiembra(avisos);
}

// Las dos superficies montan a la vez: una sola consulta en vuelo por revisión.
const enVuelo = new Map<string, Promise<DeclaracionActual | null>>();

function pedirDeclaracion(revision: string): Promise<DeclaracionActual | null> {
  const previa = enVuelo.get(revision);
  if (previa) return previa;
  const pedido = getEquivalencias()
    .then((est): DeclaracionActual => ({ revision: est.revision ?? "", declarada: Boolean(est.declarada) }))
    // Sin respuesta no se afirma nada: callar es preferible a avisar de un desfase que no se pudo comprobar.
    .catch(() => null)
    .finally(() => { enVuelo.delete(revision); });
  enVuelo.set(revision, pedido);
  return pedido;
}

export type DeclaracionAplicada = {
  /** `null` mientras no se sabe (sin mazo derivado no se consulta nada). */
  estado: EstadoDeclaracionAplicada | null;
  /** Texto del aviso del estado; vacío si no hay nada que avisar. */
  aviso: string;
  /** Todo lo que va al grupo «Equivalencias entre bases» de Avisos: el aviso del estado y los de la siembra. */
  avisos: string[];
};

export function useDeclaracionAplicada(): DeclaracionAplicada {
  const revisionAplicada = usePlanStore((s) => s.equivalenciasRevision);
  const paraRevision = useDeclaracionStore((s) => s.paraRevision);
  const actual = useDeclaracionStore((s) => s.actual);
  const avisosSiembra = useDeclaracionStore((s) => s.avisosSiembra);
  const fijarActual = useDeclaracionStore((s) => s.fijarActual);

  // Sólo se pide cuando el plan salió de la declaración: un proyecto que armó sus diapositivas a mano no tiene por qué
  // pagar la consulta ni ver el aviso.
  useEffect(() => {
    if (!revisionAplicada) { fijarActual("", null); return; }
    let cancelado = false;
    void pedirDeclaracion(revisionAplicada).then((r) => { if (!cancelado) fijarActual(revisionAplicada, r); });
    return () => { cancelado = true; };
  }, [revisionAplicada, fijarActual]);

  return useMemo(() => {
    const vigente = revisionAplicada && paraRevision === revisionAplicada ? actual : null;
    const estado = vigente
      ? estadoDeclaracionAplicada({ revisionAplicada, revisionActual: vigente.revision, declarada: vigente.declarada })
      : null;
    const aviso = estado ? avisoDeclaracionAplicada(estado) : "";
    const avisos = [...(aviso ? [aviso] : []), ...avisosSiembra.map((a) => a.message)];
    return { estado, aviso, avisos: [...new Set(avisos)] };
  }, [actual, avisosSiembra, paraRevision, revisionAplicada]);
}
