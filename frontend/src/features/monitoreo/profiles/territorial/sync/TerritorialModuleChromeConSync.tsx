import { MonitoreoModuleChrome, type MonitoreoModuleChromeProps } from "../../../shell/MonitoreoModuleChrome";
import type { MonitoreoSeccionPublica } from "../../../core/monitoreoRegistry";
import { useTerritorialSyncStore } from "./syncStore";

// Chrome del modo suscrito al progreso del «Actualizar ▾» territorial: el tick
// por segundo re-renderiza este envoltorio y la barra, nunca la raíz del perfil.
export function TerritorialModuleChromeConSync<K extends MonitoreoSeccionPublica>(
  props: Omit<MonitoreoModuleChromeProps<K>, "syncProgress">,
) {
  const progress = useTerritorialSyncStore((state) => state.progress);
  return (
    <MonitoreoModuleChrome<K>
      {...props}
      syncProgress={progress ? { ...progress, active: progress.mode } : null}
    />
  );
}
