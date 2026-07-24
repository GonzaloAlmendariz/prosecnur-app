import { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useProjectModules } from "../project/ProjectModulesContext";
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
export function ModulePickerHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addedSlugs, addModule, removeModule } = useProjectModules();

  const open = new URLSearchParams(location.search).get("agregar") === "1";

  const picker = useMemo(
    () => ({
      isAdded: (slug: string) => addedSlugs.includes(slug),
      onAdd: addModule,
      onRemove: removeModule,
    }),
    [addedSlugs, addModule, removeModule],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("agregar")) return;
    params.delete("agregar");
    const rest = params.toString();
    navigate(
      { pathname: location.pathname, search: rest ? `?${rest}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

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
    <ModulePickerDialog picker={picker} onClose={close} />,
    document.body,
  );
}
