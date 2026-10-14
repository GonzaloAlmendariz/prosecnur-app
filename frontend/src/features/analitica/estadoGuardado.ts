// Estado de guardado de una superficie de Analítica (P-M14).
//
// Había tres patrones: el botón que se rotula «Sin cambios», un chip con
// «Guardar …» al lado, y una frase («Los cambios se guardan solos»). El patrón
// único es el chip de `SaveStatusIndicator` —Sin cambios / Cambios sin
// guardar / Guardado— y, donde hay botón, un verbo fijo que no cambia de
// rótulo con el estado.
//
// La config de Analítica se autoguarda con `dirty` en el store: lo que falta
// saber es si ESTA superficie llegó a cambiar algo mientras estaba abierta,
// para distinguir «Sin cambios» de «Guardado».

import { useEffect, useState } from "react";

import type { SaveState } from "../../components/SaveStatusIndicator";
import { useAnaliticaStore } from "./store";

export function estadoGuardado({
  hidratada,
  sucia,
  tocada,
}: {
  hidratada: boolean;
  sucia: boolean;
  tocada: boolean;
}): SaveState {
  if (!hidratada) return "loading";
  if (sucia) return "dirty";
  return tocada ? "saved" : "idle";
}

/**
 * Estado de guardado de la config de Analítica visto desde una superficie que
 * se monta y desmonta (un panel). `tocada` se reinicia al montar.
 */
export function useEstadoGuardadoAnalitica(): SaveState {
  const hidratada = useAnaliticaStore((s) => s.hydrated);
  const sucia = useAnaliticaStore((s) => s.dirty);
  const [tocada, setTocada] = useState(false);
  useEffect(() => {
    if (sucia) setTocada(true);
  }, [sucia]);
  return estadoGuardado({ hidratada, sucia, tocada });
}
