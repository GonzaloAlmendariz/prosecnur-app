import { MonitoreoModuleChrome, type MonitoreoModuleChromeProps } from "../../../shell/MonitoreoModuleChrome";
import type { MonitoreoSeccionPublica } from "../../../core/monitoreoRegistry";
import { useSourceSyncStore } from "./sourceSyncStore";

type Props = Omit<MonitoreoModuleChromeProps<MonitoreoSeccionPublica>, "syncProgress">;

// Chrome de módulo suscrito al progreso del sync (unidad 2.2 del plan de
// performance): el tick por segundo del job re-renderiza solo este wrapper
// (y el chrome que pinta la barra), nunca la raíz del perfil. Acreditación
// nombra las secciones del esqueleto común (Insumos, Modelo, Control, Avance).
export function AcreditacionModuleChromeConSync(props: Props) {
  const progress = useSourceSyncStore((state) => state.progress);
  return <MonitoreoModuleChrome<MonitoreoSeccionPublica> {...props} syncProgress={progress} />;
}
