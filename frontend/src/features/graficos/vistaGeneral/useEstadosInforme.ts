// Junta las fuentes del estado de cada lámina del Informe (I3): el validador del plan, los avisos del motor de la última
// vista previa de cada lámina y los colores que faltan. La decisión es pura (`estadosDeLaminas`).

import { useMemo } from "react";
import { useColoresPendientes } from "../estilo/ColoresPendientesAviso";
import { useLaminasUi } from "../laminas/laminasStore";
import type { EstructuraInforme } from "../laminas/modeloEstructura";
import { usePlanValidator } from "../usePlanValidator";
import { contarEstados, estadosDeLaminas } from "./estadoTarjetas";

export function useEstadosInforme(estructura: EstructuraInforme) {
  const { issues } = usePlanValidator();
  const resumenes = useLaminasUi((s) => s.resumenes);
  const { pendientes } = useColoresPendientes();
  const idsColores = useMemo(() => new Set(pendientes.map((p) => p.slideId)), [pendientes]);
  const avisosMotor = useMemo(
    () => Object.fromEntries(Object.entries(resumenes).map(([id, r]) => [id, r.avisosTexto?.length ?? 0])),
    [resumenes],
  );
  const estados = useMemo(
    () => estadosDeLaminas(estructura.laminas, issues, avisosMotor, idsColores),
    [estructura, issues, avisosMotor, idsColores],
  );
  const conteos = useMemo(() => contarEstados(estados), [estados]);
  return { estados, conteos };
}
