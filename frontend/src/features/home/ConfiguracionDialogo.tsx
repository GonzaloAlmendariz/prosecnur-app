import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import type { SettingsTab } from "./seccionesConfiguracion";
import { PULSO_FULL_NAME } from "./HomePage";
import { RELEASE_NOTES } from "./releaseNotes";

// La configuración global con lo que sólo sabe el Home (notas y atribución).
// Archivo propio para que <ConfiguracionHost/> la cargue diferida: el Layout
// está en el bundle principal y el diálogo pesa.
export default function ConfiguracionDialogo({
  onClose,
  seccion,
}: {
  onClose: () => void;
  seccion: SettingsTab | null;
}) {
  return (
    <GlobalSettingsDialog
      open
      notes={RELEASE_NOTES}
      pulsoName={PULSO_FULL_NAME}
      onClose={onClose}
      seccionInicial={seccion}
    />
  );
}
