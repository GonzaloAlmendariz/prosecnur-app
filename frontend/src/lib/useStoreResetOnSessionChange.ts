import { useEffect } from "react";
import { useDashboardStore } from "../features/dashboard/store";
import { useValidacionStore } from "../features/validacion/store";
import { useAnaliticaStore } from "../features/analitica/store";
import { useDimensionesWizardStore } from "../features/analitica/dimensiones/store";
import { usePlanStore } from "../features/graficos/store";
import { clearHojasRutaWorkspaceSnapshot } from "../features/hojasRuta/configSnapshot";

// Listener global que se dispara cuando `client.ts` emite
// `pulso:session-changed` (ocurre al abrir un .pulso distinto, o cuando
// `apiCreateSession({ fresh: true })` regenera el sid). Resetea todos los
// stores Zustand globales a sus defaults para que la UI no muestre
// configuración del proyecto anterior mientras los autosaves
// (useDashboardAutosave, useAnaliticaAutosave, useGraficosAutosave) hacen
// su re-fetch contra el backend del nuevo sid.
//
// Sin este reset central, al cambiar de proyecto el dashboard mostraba el
// logo / paleta / filtros / vista FODA del proyecto anterior durante el
// (potencialmente largo) fetch de la nueva config, y los stores que
// guardan estado de exploración (filtros, tab activa, wizard de
// dimensiones, etc.) NO se invalidaban.
//
// Importante: usamos `getState()` para no suscribir el componente a los
// stores — solo dispatcheamos acciones, no leemos valores.
export function useStoreResetOnSessionChange() {
  useEffect(() => {
    function onSessionChanged() {
      useDashboardStore.getState().resetForSession();
      useValidacionStore.getState().resetForSession();
      useDimensionesWizardStore.getState().reset();
      // analitica y graficos: marcamos no-hidratado y limpiamos config
      // a defaults. Sus autosaves harán re-hydrate del backend nuevo.
      useAnaliticaStore.setState({ hydrated: false, dirty: false });
      usePlanStore.setState({ hydrated: false, dirty: false });
      clearHojasRutaWorkspaceSnapshot();
    }
    window.addEventListener("pulso:session-changed", onSessionChanged);
    return () => {
      window.removeEventListener("pulso:session-changed", onSessionChanged);
    };
  }, []);
}
