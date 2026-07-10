// Envoltura lazy del diálogo global de Configuración para el BootGate chooser.
// El chooser vive en el chunk de entrada (boot.css) y no carga theme.css; este
// módulo se importa de forma diferida (React.lazy) SOLO al abrir Configuración,
// así trae consigo theme.css y el diálogo sin inflar el arranque. Reusa el
// mismo GlobalSettingsDialog del Home para que la app-chrome sea idéntica antes
// y después de entrar a un proyecto.
import "../../app/theme.css";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import { PULSO_FULL_NAME } from "./HomePage";
import { RELEASE_NOTES } from "./releaseNotes";

export default function ChooserSettings({ onClose }: { onClose: () => void }) {
  return (
    <GlobalSettingsDialog
      open
      notes={RELEASE_NOTES}
      pulsoName={PULSO_FULL_NAME}
      onClose={onClose}
    />
  );
}
