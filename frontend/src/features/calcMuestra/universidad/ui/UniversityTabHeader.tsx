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

export function UniversityTabHeader({
  tab,
}: {
  tab: CalcMuestraSidebarTab;
}) {
  return (
    <TabHeading
      eyebrow="Cálculo de muestra"
      titulo={tab.label}
      icono={tab.icon}
      estado={ESTADO[tab.status]}
      detalle={tab.detail}
    />
  );
}
