// La versión de la config de Analítica que ya está guardada en el backend.
//
// La vista previa de Frecuencias lee la config GUARDADA: pedirla mientras un
// cambio espera al autosave devolvería las tablas de antes. El autosave
// (useAnaliticaAutosave) marca `dirty` con cada cambio y llama a `markClean`
// cuando el guardado termina; la hidratación deja `hydrated` y `dirty` en
// falso. Así, con `hydrated && !dirty`, la config del store es la guardada, y
// cada vez que eso vuelve a ser cierto con otra config cuenta como una versión
// nueva. El autosave solo marca limpio si la config no cambió durante el
// guardado, así que la versión no se adelanta a un cambio sin guardar.

import { useState } from "react";

import { useAnaliticaStore, type AnaliticaConfig } from "../store";

export type ConfigGuardada = {
  /** Cambia con cada config guardada distinta; `null` mientras no hay ninguna. */
  version: number | null;
  /** Hay un cambio que todavía no se guarda, o la config no se hidrató. */
  pendiente: boolean;
  /** Hay un cambio hecho que todavía no está guardado (la config sí se hidrató). */
  sinGuardar: boolean;
  /** El último guardado falló: su causa, o `null`. */
  errorGuardado: string | null;
};

type Visto = { config: AnaliticaConfig | null; firma: string | null; version: number | null };

/**
 * Cuenta una versión nueva cuando la config guardada cambia de contenido. Una
 * config nueva con el mismo contenido (una rehidratación igual) no cuenta: si
 * contara, saldría otro pedido idéntico.
 */
export function siguienteVersionGuardada(visto: Visto, config: AnaliticaConfig, guardada: boolean): Visto {
  if (!guardada || visto.config === config) return visto;
  const firma = JSON.stringify(config);
  if (firma === visto.firma) return { ...visto, config };
  return { config, firma, version: visto.version === null ? 0 : visto.version + 1 };
}

export function useConfigGuardada(): ConfigGuardada {
  const config = useAnaliticaStore((s) => s.config);
  const guardada = useAnaliticaStore((s) => s.hydrated && !s.dirty);
  const sinGuardar = useAnaliticaStore((s) => s.hydrated && s.dirty);
  const errorGuardado = useAnaliticaStore((s) => s.errorGuardado);
  const [visto, setVisto] = useState<Visto>(() => siguienteVersionGuardada({ config: null, firma: null, version: null }, config, guardada));
  // Se ajusta durante el render, como `useBaseDelCalculo`: la versión cambia en
  // el mismo pintado en que el guardado termina.
  const siguiente = siguienteVersionGuardada(visto, config, guardada);
  if (siguiente !== visto) setVisto(siguiente);
  return { version: siguiente.version, pendiente: !guardada, sinGuardar, errorGuardado };
}
