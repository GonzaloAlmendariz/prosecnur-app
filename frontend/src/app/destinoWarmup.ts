import { PROSECNUR_ACTIVE_MODULES, type ActiveProsecnurModuleMeta } from "../lib/modules";

export type DestinoWarmup = {
  /** El módulo de la ruta: su color tiñe la barra y su silueta va detrás de la lámina. */
  modulo: ActiveProsecnurModuleMeta;
  /** Lo que se está abriendo, como se lee: «Validación», no «Procesamiento», en `/validacion`. */
  rotulo: string;
};

const sinBarra = (ruta: string) => ruta.split("?")[0].replace(/\/+$/, "") || "/";

/**
 * El destino del warm start según la ruta. Una sección con ruta propia (las de Procesamiento:
 * `/carga`, `/validacion`…) se reconoce por sí misma y se rotula con su nombre, con el color de su
 * módulo; antes sólo se reconocía `/procesamiento` y en `/validacion` la lámina decía «Abriendo el
 * proyecto» (4 nov 2026). Sin módulo, `null`: el Home queda en el azul de marca.
 */
export function destinoWarmup(pathname: string, modulos: readonly ActiveProsecnurModuleMeta[] = PROSECNUR_ACTIVE_MODULES): DestinoWarmup | null {
  const path = sinBarra(pathname);
  if (path === "/") return null;
  const coincide = (to: string) => {
    const destino = sinBarra(to);
    return destino !== "/" && (path === destino || path.endsWith(destino));
  };
  for (const modulo of modulos) {
    const secciones = [...modulo.sections, ...(modulo.modos ?? []).flatMap((modo) => modo.sections)];
    const seccion = secciones.find((s) => sinBarra(s.to) !== sinBarra(modulo.to) && coincide(s.to));
    if (seccion) return { modulo, rotulo: seccion.label };
  }
  const modulo = modulos.find((m) => coincide(m.to));
  return modulo ? { modulo, rotulo: modulo.cardTitle ?? modulo.shortLabel } : null;
}
