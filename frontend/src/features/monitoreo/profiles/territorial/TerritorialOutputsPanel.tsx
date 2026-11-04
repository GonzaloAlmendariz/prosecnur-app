import type { MonitoreoConfig, MonitoreoLastSheetsPublication, MonitoreoTerritorialDashboard } from "../../../../api/client";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { MonitoreoCorte } from "../../corte/corteContract";
import { HojaDelCliente, type TablaDelCliente } from "../../salidas/estandar/HojaDelCliente";
import { SalidasDeMonitoreo } from "../../salidas/estandar/SalidasDeMonitoreo";
import { construirResumen } from "./avance/resumenModel";
import { RotuloDePestana } from "./navegacion/RotuloDePestana";
import { fechaYHoraDeLima, pctEntero } from "./rotulos";

export type TerritorialOutputsPanelProps = {
  config?: Partial<MonitoreoConfig>;
  clientSheets?: MonitoreoLastSheetsPublication | null;
  internalSheets?: MonitoreoLastSheetsPublication | null;
  corte: MonitoreoCorte;
  syncedAt?: string;
  /** El corte, para la hoja del cliente (avance por distrito). */
  reports?: MonitoreoTerritorialDashboard | null;
  onPublished?: () => void;
};

/**
 * La tabla de la hoja del cliente: lo que cuenta contra la meta en cada distrito. «Faltan» del total suma lo que
 * falta en cada distrito: lo que sobra en uno no cubre lo que falta en otro. El avance del total es lo cubierto (cada
 * distrito aporta a lo sumo su meta) sobre la meta, igual que el PDF (`monitoreo_avance_sin_compensar.R`): así el
 * total nunca dice 100 % con algo por recoger (revisión metodológica del 4 nov 2026).
 */
export function tablaTerritorialDelCliente(reports: MonitoreoTerritorialDashboard | null | undefined): TablaDelCliente | null {
  const resumen = construirResumen(reports);
  if (!resumen.distritos.length) return null;
  const faltan = (fila: { meta: number; cuentan: number }) => Math.max(0, fila.meta - fila.cuentan);
  const suma = (clave: "cuentan" | "meta") => resumen.distritos.reduce((t, fila) => t + fila[clave], 0);
  return {
    cabecera: ["Distrito", "Meta encuestas", "Encuestas válidas", "Faltan", "Avance"],
    numericas: [false, true, true, true, true],
    filas: resumen.distritos.map((fila) => ({
      clave: fila.distrito,
      celdas: [fila.distrito, formatoConteo(fila.meta), <b key="c">{formatoConteo(fila.cuentan)}</b>, formatoConteo(faltan(fila)), fila.avance],
    })),
    total: ["Total", formatoConteo(suma("meta")), formatoConteo(suma("cuentan")), formatoConteo(resumen.distritos.reduce((t, fila) => t + faltan(fila), 0)), pctEntero(resumen.distritos.reduce((t, fila) => t + Math.min(fila.cuentan, fila.meta), 0), suma("meta"))],
  };
}

/**
 * Avance › Salidas del territorial sobre el estándar de Salidas (4 nov 2026): la lista de salidas y la hoja del
 * cliente (avance por distrito). El motor completo, en «PDF y cliente».
 */
export function TerritorialOutputsPanel({
  config,
  clientSheets,
  internalSheets,
  corte,
  syncedAt,
  reports,
  onPublished,
}: TerritorialOutputsPanelProps) {
  return (
    <SalidasDeMonitoreo
      family="territorial"
      routeLabel="Territorial"
      defaultTitle="reporte-territorial"
      config={config}
      clientSheets={clientSheets}
      internalSheets={internalSheets}
      corte={corte}
      syncedAt={syncedAt}
      onPublished={onPublished}
      rotulo={<RotuloDePestana />}
      vistaPrevia={(
        <HojaDelCliente
          encabezado="Monitoreo territorial"
          corte={fechaYHoraDeLima(syncedAt)}
          titulo="Avance por distrito"
          tabla={tablaTerritorialDelCliente(reports)}
          vacio="El corte no trae el avance por distrito."
        />
      )}
    />
  );
}
