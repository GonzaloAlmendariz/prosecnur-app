// Pide el inventario del estudio (`apiGraficosInventario`) una vez por apertura del selector de láminas y lo deja en el
// store del selector. Al cerrar se aborta lo que esté en vuelo y el estado vuelve a «inactivo»: la próxima apertura lee
// el estudio de nuevo (pudo cambiar de base o declarar un padrón entretanto).

import { useEffect } from "react";
import { apiGraficosInventario } from "../../../../api/graficosInventario";
import type { GraficosReportScope } from "../../reportScope";
import { useSelectoresUi } from "./selectoresStore";

export function useInventarioSelector(abierto: boolean, scope: GraficosReportScope): void {
  useEffect(() => {
    const { setInventario } = useSelectoresUi.getState();
    if (!abierto) {
      setInventario({ estado: "inactivo" });
      return;
    }
    const control = new AbortController();
    setInventario({ estado: "cargando" });
    apiGraficosInventario(scope, { signal: control.signal })
      .then((publicos) => { if (!control.signal.aborted) setInventario({ estado: "listo", publicos }); })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setInventario({ estado: "error", mensaje: e instanceof Error ? e.message : String(e) });
      });
    return () => control.abort();
  }, [abierto, scope]);
}
