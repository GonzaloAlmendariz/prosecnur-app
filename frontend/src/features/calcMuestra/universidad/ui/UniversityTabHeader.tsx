import { TabHeading, type TabHeadingEstado } from "../../../../components/TabHeading";
import type { GuideStatus } from "../../sharedCore";
import type { CalcMuestraSidebarTab } from "../universidadTabs";

// La cabecera de pestaña de Cálculo de muestra es el TabHeading del kit (L14),
// la misma de Carga, Validación y Analítica. «Pendiente» no se declara: una
// pestaña sin empezar no tiene estado que decir todavía.
const ESTADO: Record<GuideStatus, TabHeadingEstado | undefined> = {
  ready: "listo",
  working: "parcial",
  pending: undefined,
};

/**
 * El antetítulo dice dónde estás —la sección y la posición de la pestaña—, como
 * en Carga y Validación. Decía «Cálculo de muestra» en todas: repetía el
 * módulo que ya nombra el chip de arriba (P9, cada cosa en un solo sitio).
 */
export function UniversityTabHeader({
  tab,
  seccion,
  pestanaN,
  pestanaDe,
}: {
  tab: CalcMuestraSidebarTab;
  seccion?: string;
  pestanaN?: number;
  pestanaDe?: number;
}) {
  return (
    <TabHeading
      eyebrow={seccion ?? "Cálculo de muestra"}
      pestanaN={pestanaN}
      pestanaDe={pestanaDe}
      titulo={tab.label}
      icono={tab.icon}
      estado={ESTADO[tab.status]}
      detalle={tab.detail}
    />
  );
}
