import type { MonitoreoConfig, MonitoreoLastSheetsPublication } from "../../../../api/client";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";

export type TerritorialOutputsPanelProps = {
  config?: Partial<MonitoreoConfig>;
  clientSheets?: MonitoreoLastSheetsPublication | null;
  internalSheets?: MonitoreoLastSheetsPublication | null;
  hasSnapshot: boolean;
  nRows: number;
  syncedAt?: string;
  onPublished?: () => void;
};

export function TerritorialOutputsPanel({
  config,
  clientSheets,
  internalSheets,
  hasSnapshot,
  nRows,
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
      hasSnapshot={hasSnapshot}
      nRows={nRows}
      syncedAt={syncedAt}
      onPublished={onPublished}
    />
  );
}
