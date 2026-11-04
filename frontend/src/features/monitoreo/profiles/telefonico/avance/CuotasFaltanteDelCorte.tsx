import { useMemo } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import type { CuotaDeEntrada } from "./cuotasFaltanteModel";
import { CuotasFaltante } from "./CuotasFaltante";
import { entradaDeCuotasFaltante } from "./entradaDeCuotas";
import { useVariableDeCuotasElegida } from "./variableElegida";

/**
 * Avance › Cuotas con su variable elegible (R5 paso 2): lee la elección de la dirección
 * (`panel=variable&foco=…`) y arma las tarjetas y el modelo con ella. `tarjetas` es la lectura de la
 * página (`phoneQuotaCardsForDashboard`), que se pasa en vez de importarse para no crear un ciclo.
 */
export function CuotasFaltanteDelCorte({
  reports,
  state,
  tarjetas,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  tarjetas: (reports: MonitoreoAcreditacionReports, elegida?: string | null) => readonly CuotaDeEntrada[];
}) {
  const { elegida, elegir } = useVariableDeCuotasElegida();
  const { modelo, cadena } = useMemo(
    () => entradaDeCuotasFaltante(reports, state, tarjetas(reports, elegida), elegida),
    [reports, state, tarjetas, elegida],
  );
  return <CuotasFaltante modelo={modelo} cadena={cadena} onElegirVariable={elegir} />;
}
