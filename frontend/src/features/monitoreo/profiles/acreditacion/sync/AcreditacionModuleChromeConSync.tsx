import type { ComponentProps } from "react";
import { MonitoreoModuleChrome } from "../../../shell/MonitoreoModuleChrome";
import { useSourceSyncStore } from "./sourceSyncStore";

type Props = Omit<ComponentProps<typeof MonitoreoModuleChrome>, "syncProgress">;

// Chrome de módulo suscrito al progreso del sync (unidad 2.2 del plan de
// performance): el tick por segundo del job re-renderiza solo este wrapper
// (y el chrome que pinta la barra), nunca la raíz del perfil.
export function AcreditacionModuleChromeConSync(props: Props) {
  const progress = useSourceSyncStore((state) => state.progress);
  return <MonitoreoModuleChrome {...props} syncProgress={progress} />;
}
