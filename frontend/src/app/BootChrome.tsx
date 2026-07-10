import { Suspense, lazy, useCallback, useState } from "react";
import { Power, Settings2 } from "lucide-react";

// App-chrome del chooser: los mismos controles de Configuración y Cerrar
// aplicación que trae el footer del Home (HomePage.tsx), para que la barra
// inferior sea idéntica antes y después de entrar a un proyecto. El diálogo de
// Configuración se carga diferido (trae theme.css) para no inflar el arranque.
const ChooserSettings = lazy(() => import("../features/home/ChooserSettings"));

const PULSO_SHORT = "PULSO PUCP";

export function ChooserChrome({
  version,
  hasElectron,
  disabled,
}: {
  version?: string;
  hasElectron: boolean;
  disabled?: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const onQuit = useCallback(() => {
    void window.prosecnurApi?.confirmAppClose?.();
  }, []);

  return (
    <footer className="boot-footer">
      <span className="boot-footer-attr">
        Prosecnur{version ? ` · ${version}` : ""}
        <span className="boot-footer-dot" aria-hidden="true">·</span>
        Hecho para el {PULSO_SHORT}
      </span>
      <div className="boot-footer-actions">
        <button
          type="button"
          className="boot-footer-btn"
          onClick={() => setSettingsOpen(true)}
          disabled={disabled}
        >
          <Settings2 size={13} aria-hidden="true" />
          <span>Configuración</span>
        </button>
        {hasElectron && (
          <button
            type="button"
            className="boot-footer-btn boot-footer-quit"
            onClick={onQuit}
            disabled={disabled}
          >
            <Power size={13} aria-hidden="true" />
            <span>Cerrar aplicación</span>
          </button>
        )}
      </div>
      {settingsOpen && (
        <Suspense fallback={null}>
          <ChooserSettings onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </footer>
  );
}
