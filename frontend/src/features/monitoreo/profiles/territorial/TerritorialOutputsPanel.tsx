import type { MonitoreoConfig, MonitoreoLastSheetsPublication } from "../../../../api/client";
import type { MonitoreoCorte } from "../../corte/corteContract";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";

export type TerritorialOutputsPanelProps = {
  config?: Partial<MonitoreoConfig>;
  clientSheets?: MonitoreoLastSheetsPublication | null;
  internalSheets?: MonitoreoLastSheetsPublication | null;
  corte: MonitoreoCorte;
  syncedAt?: string;
  onPublished?: () => void;
};

export function TerritorialOutputsPanel({
  config,
  clientSheets,
  internalSheets,
  corte,
  syncedAt,
  onPublished,
}: TerritorialOutputsPanelProps) {
  return (
    <MonitoreoOutputsWorkbench
      family="territorial"
      routeLabel="Territorial"
      defaultTitle="reporte-territorial"
      config={config}
      clientSheets={clientSheets}
      internalSheets={internalSheets}
      corte={corte}
      syncedAt={syncedAt}
      onPublished={onPublished}
    />
  );
}
