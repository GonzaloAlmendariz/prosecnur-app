import { useLayoutEffect, useState, type RefObject } from "react";
import { DOCK_GEOMETRIA_POR_DEFECTO, type DockGeometria } from "./moduleDockModel";

export type MedidaDock = {
  /** Ancho disponible para el dock (px); `null` hasta la primera medida. */
  cupo: number | null;
  geometria: DockGeometria;
};

const SIN_MEDIDA: MedidaDock = { cupo: null, geometria: DOCK_GEOMETRIA_POR_DEFECTO };

function px(valor: string): number {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Cuánto ancho le deja el header al dock, sin depender de lo que el dock
 * muestra en ese momento (así recoger o soltar un módulo no vuelve a cambiar la
 * medida y no hay bucle).
 *
 * - Header en una fila (`flex-wrap: nowrap`, ancho > 1320): el contenido del
 *   header menos la marca y su marco, el mínimo del separador y el ancho
 *   NATURAL de las acciones (`scrollWidth`, porque las acciones encogen).
 * - Header que envuelve (≤ 1320): las acciones bajan de fila y el cluster
 *   puede ocupar la fila entera.
 */
export function medirCupoDelDock(nav: HTMLElement): MedidaDock | null {
  const header = nav.closest<HTMLElement>(".pulso-app-header");
  const dock = nav.querySelector<HTMLElement>(".pulso-module-dock");
  if (!header || !dock) return null;

  const estiloHeader = getComputedStyle(header);
  const contenido =
    header.clientWidth - px(estiloHeader.paddingLeft) - px(estiloHeader.paddingRight);
  const cluster = nav.closest<HTMLElement>(".pulso-nav-cluster") ?? nav;
  // Marca, separador, padding y gaps del cluster: todo lo que no es el dock.
  const extrasCluster = Math.max(0, cluster.offsetWidth - dock.offsetWidth);

  let resto = 0;
  if (estiloHeader.flexWrap === "nowrap") {
    const gap = px(estiloHeader.columnGap);
    const hermanos = Array.from(header.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== cluster,
    );
    for (const el of hermanos) {
      if (getComputedStyle(el).display === "none") continue;
      resto += gap;
      resto += el.classList.contains("pulso-app-header-spacer")
        ? px(getComputedStyle(el).minWidth)
        : el.scrollWidth;
    }
  }

  const estiloDock = getComputedStyle(dock);
  const gapDock = px(estiloDock.columnGap);
  const marco =
    px(estiloDock.paddingLeft) +
    px(estiloDock.paddingRight) +
    px(estiloDock.borderLeftWidth) +
    px(estiloDock.borderRightWidth);
  const tileCompacto = dock.querySelector<HTMLElement>(
    ".pulso-module-dock-item > .pulso-module-tile:not(.is-current)",
  );
  const tileActivo = dock.querySelector<HTMLElement>(".pulso-module-tile.is-current");
  const geometria: DockGeometria = {
    paso: tileCompacto ? tileCompacto.offsetWidth + gapDock : DOCK_GEOMETRIA_POR_DEFECTO.paso,
    anchoActivo: tileActivo
      ? tileActivo.offsetWidth + gapDock
      : DOCK_GEOMETRIA_POR_DEFECTO.anchoActivo,
    marco,
  };

  return { cupo: Math.floor(contenido - extrasCluster - resto), geometria };
}

function iguales(a: MedidaDock, b: MedidaDock): boolean {
  return (
    a.cupo === b.cupo &&
    a.geometria.paso === b.geometria.paso &&
    a.geometria.anchoActivo === b.geometria.anchoActivo &&
    a.geometria.marco === b.geometria.marco
  );
}

/** Mide el cupo del dock y lo vuelve a medir cuando el header cambia de ancho. */
export function useCupoDelDock(navRef: RefObject<HTMLElement | null>, clave: string): MedidaDock {
  const [medida, setMedida] = useState<MedidaDock>(SIN_MEDIDA);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const medir = () => {
      const nueva = medirCupoDelDock(nav);
      if (nueva) setMedida((previa) => (iguales(previa, nueva) ? previa : nueva));
    };
    medir();
    const header = nav.closest(".pulso-app-header");
    if (typeof ResizeObserver === "undefined" || !header) {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const observador = new ResizeObserver(medir);
    observador.observe(header);
    for (const hijo of Array.from(header.children)) observador.observe(hijo);
    return () => observador.disconnect();
  }, [navRef, clave]);

  return medida;
}
