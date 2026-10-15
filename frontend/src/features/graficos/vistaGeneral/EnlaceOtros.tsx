// R7 del rediseño (2026-10-15; D4): «Otros» se decide en Reglas. La barra del Informe sólo dice cómo está y lleva a su
// regla (`?pestana=reglas&foco=otros`), sin un segundo control que la duplique.

import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import { usePlanStore } from "../store";

export function EnlaceOtros() {
  const encendido = usePlanStore((s) => s.autoOtrosSlides);
  const navigate = useNavigate();
  const loc = useLocation();
  const ir = () => navigate({ pathname: loc.pathname, search: conNivel(searchConNivel(loc.search, "pestana", "reglas"), "foco", "otros") });
  return <EnlaceOtrosVista encendido={encendido} onIr={ir} />;
}

/** Presentación pura (se prueba sin router ni store). */
export function EnlaceOtrosVista({ encendido, onIr }: { encendido: boolean; onIr: () => void }) {
  return (
    <button type="button" className={`pulso-f6-vg-otros-enlace${encendido ? " is-activo" : ""}`} onClick={onIr}
      data-qa-geometry-member title="Se decide en Reglas › Respuestas «Otros»">
      {encendido ? "+ «Otros» al exportar" : "Sin «Otros»"}
    </button>
  );
}
