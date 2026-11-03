// Carga de un módulo o de una pestaña pesada mientras llega su código (3 nov 2026,
// pedido de Gonzalo: «las animaciones de carga cuando inicia un módulo … la barra
// profesional animada con el color del módulo»). Una sola primitiva para los fallbacks
// de Suspense que antes pintaban un LoadingBlock gris genérico: el rótulo y la barra
// indeterminada en el color del módulo activo, que se lee de la ruta si no se pasa.
//
// La pantalla completa de arranque es otra (ModuleWarmupScreen, con reloj y fases);
// ésta es la de los saltos cortos dentro de la app.

import { moduleChromeVars, PROSECNUR_MODULES, type ProsecnurModuleSlug } from "../lib/modules";
import { moduloDesdePathname } from "../lib/navegacion/direccion";
import { BarraDeAvance } from "./BarraDeAvance";
import "./carga-de-modulo.css";

function moduloActivo(slug?: ProsecnurModuleSlug) {
  const clave = slug ?? (typeof window === "undefined" ? null : moduloDesdePathname(window.location.pathname));
  return clave ? PROSECNUR_MODULES.find((m) => m.slug === clave) ?? null : null;
}

export function CargaDeModulo({ label, modulo }: { label: string; modulo?: ProsecnurModuleSlug }) {
  const meta = moduloActivo(modulo);
  return (
    <div className="pulso-carga-modulo" role="status" style={meta ? moduleChromeVars(meta) : undefined}>
      <span className="pulso-carga-modulo-rotulo">{label}</span>
      <BarraDeAvance indeterminada etiqueta={label} />
    </div>
  );
}
