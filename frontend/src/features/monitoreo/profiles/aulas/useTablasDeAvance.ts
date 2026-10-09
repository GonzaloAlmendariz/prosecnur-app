import { useEffect, useState } from "react";

import {
  apiMonitoreoAulasAvanceTablas,
  type MonitoreoAulasAvanceTabla,
} from "../../../../api/monitoreo";

export type TablasDeAvance = {
  tablas: MonitoreoAulasAvanceTabla[] | null;
  titular: string;
  error: string;
};

/**
 * Las cinco tablas de avance, pedidas UNA vez para toda la pantalla.
 *
 * Dos superficies las usan a la vez: la pestaña «Metas», que las enseña
 * enteras, y el gráfico del día de «Rendimiento», que agrega la diaria. Sin
 * caché serían dos peticiones al mismo endpoint en el mismo render, y ese
 * endpoint cruza las respuestas con el plan aula por aula: es justo el cálculo
 * que su autor sacó de `/monitoreo/state` para no cobrárselo a quien no lo mira.
 *
 * La caché es una promesa por módulo, no un store: dura lo que la pestaña y se
 * suelta al cambiar de proyecto (el `sid` viaja en la cabecera, así que una
 * sesión nueva pide de nuevo). `invalidarTablasDeAvance()` la tira cuando algo
 * las deja viejas, como una sincronización.
 */
let enVuelo: Promise<{ tablas: MonitoreoAulasAvanceTabla[]; titular: string }> | null = null;

export function invalidarTablasDeAvance(): void {
  enVuelo = null;
}

function pedir() {
  if (!enVuelo) {
    enVuelo = apiMonitoreoAulasAvanceTablas()
      .then((res) => ({ tablas: res.tablas ?? [], titular: res.titular || res.corte || "" }))
      .catch((e) => {
        // Un fallo no se cachea: si se guardara, la pantalla se quedaría rota
        // hasta cambiar de proyecto aunque el backend se recupere al instante.
        enVuelo = null;
        throw e;
      });
  }
  return enVuelo;
}

export function useTablasDeAvance(): TablasDeAvance {
  const [estado, setEstado] = useState<TablasDeAvance>({ tablas: null, titular: "", error: "" });

  useEffect(() => {
    let vivo = true;
    pedir()
      .then((r) => { if (vivo) setEstado({ tablas: r.tablas, titular: r.titular, error: "" }); })
      .catch((e: Error) => { if (vivo) setEstado({ tablas: [], titular: "", error: e.message }); });
    return () => { vivo = false; };
  }, []);

  return estado;
}
