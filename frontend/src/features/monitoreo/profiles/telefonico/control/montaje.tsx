import { useMemo } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";
import { nombreDelSegmento } from "../segmentoDeCuotas";
import { Barrido } from "./Barrido";
import { construirBarrido, type CuotaDeBarrido } from "./barridoModel";

/** Segmento de cuota del corte (Sede, Actor…), como en Avance › Cuotas. */
export function segmentoDelCorte(reports: MonitoreoAcreditacionReports | null | undefined) {
  return nombreDelSegmento(filasDeBloque(reports, ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"])
    .map((fila) => String(fila.Variable ?? "")));
}

/** Control › Barrido montado sobre el corte y el vocabulario del proyecto. */
export function BarridoDeLaHoja({
  reports,
  state,
  cuotas,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  cuotas: readonly CuotaDeBarrido[];
}) {
  const reglas = state?.config?.operational_model?.state_rules;
  const modelo = useMemo(
    () => construirBarrido({ reports, reglas: reglas ?? [], cuotas }),
    [reports, reglas, cuotas],
  );
  return <Barrido modelo={modelo} segmento={segmentoDelCorte(reports)} />;
}
