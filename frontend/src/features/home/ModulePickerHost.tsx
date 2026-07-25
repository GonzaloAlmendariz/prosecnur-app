import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useProjectModules } from "../project/ProjectModulesContext";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_MODULOS } from "./panelesHome";
import { ModulePickerDialog } from "./ModulePickerDialog";

// Overlay global del selector de módulos.
//
// Vive en el Layout (montado una sola vez, dentro del router y del
// ProjectModulesProvider) y se abre/cierra únicamente vía el query param
// `?agregar=1` — SIN acoplarse a la ruta `/`. Antes vivía embebido en
// HomePage, lo que obligaba a saltar al home para abrirlo y dejaba al usuario
// ahí al cerrar (bug de navegación: agregar un módulo desde dentro de
// `/monitoreo` te sacaba del módulo). Al montarse sobre la ruta actual, abrir
// y cerrar el picker preserva `pathname` y el resto de params.
//
// El overlay es `position:fixed; inset:0; z-index:1000`, así que cubre el
// módulo detrás sin CSS adicional.
//
// Como panel direccionable es `?panel=modulos` (quinto nivel de la gramática).
// `?agregar=1` sigue funcionando como alias de lectura.
export function ModulePickerHost() {
  const { addedSlugs, addModule, removeModule } = useProjectModules();
  const panel = usePanelDireccionable(PANEL_MODULOS);
  const { abierto: open, cerrar: close } = panel;

  const picker = useMemo(
    () => ({
      isAdded: (slug: string) => addedSlugs.includes(slug),
      onAdd: addModule,
      onRemove: removeModule,
    }),
    [addedSlugs, addModule, removeModule],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  return createPortal(
    <div {...panel.props}>
      <ModulePickerDialog picker={picker} onClose={close} />
    </div>,
    document.body,
  );
}
