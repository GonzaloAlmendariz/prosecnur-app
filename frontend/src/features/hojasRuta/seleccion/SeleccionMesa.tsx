import { useEffect, useState, type ReactNode } from "react";
import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import { ContextTabRail, type ContextTabRailItem } from "../../../components/ContextTabRail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Sideover } from "../../../components/Sideover";
import { TabHeading, type TabHeadingChip, type TabHeadingEstado } from "../../../components/TabHeading";
import { PANEL_SALIDAS_SELECCION } from "./panelesSeleccion";
import { Archive, BarChart3, MapPinned, ShieldAlert, Shuffle, type LucideIcon } from "../../../vendor/lucide-react";
import type { HojasRutaDeliveryTab } from "../store";
import type { HojasRutaNavigationTab } from "../hojasRutaNavigation";
import { BitacoraSeccion } from "../mapa/seleccion/BitacoraSeccion";
import "./seleccionMesa.css";

// Selección como mesa del kit: rail de pestañas a la izquierda, la cabecera
// única de pestaña (TabHeading) con las cifras de la selección y un solo dueño
// de scroll —la tabla de la pestaña—. Las salidas (ZIP, Excel, reemplazos,
// prueba) son una columna propia en escritorio y, bajo 1280 px, un sideover
// enlazable (`?panel=salidas`): antes se apilaban bajo la tabla y la dejaban en
// dos filas y media a 1024×600 (C4).

export const HOJAS_SELECCION_ANCHO_COMPACTO = "(max-width: 1279px)";

const ICONO_PESTANA: Record<HojasRutaDeliveryTab, LucideIcon> = {
  cuotas: BarChart3,
  titulares: MapPinned,
  reemplazos: Shuffle,
  revision: ShieldAlert,
};

const DETALLE_PESTANA: Record<HojasRutaDeliveryTab, string> = {
  cuotas: "Cuotas por perfil de la muestra",
  titulares: "UMP de campo con su manzana de referencia",
  reemplazos: "Reemplazos trazados a su UMP titular",
  revision: "Cada UMP cruzada con las viviendas censales de su manzana",
};

/** Las pestañas de Selección como ítems del rail, con su conteo y su motivo si están deshabilitadas. */
export function itemsDelRail(tabs: readonly HojasRutaNavigationTab[]): ContextTabRailItem<HojasRutaDeliveryTab>[] {
  return tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    description: tab.disabled && tab.disabledReason
      ? tab.disabledReason
      : tab.key === "revision"
        ? (tab.count ? `${tab.count.toLocaleString("es-PE")} UMP por revisar` : "Sin observaciones")
        : `${tab.count.toLocaleString("es-PE")} filas`,
    badge: tab.key === "revision" && tab.count ? String(tab.count) : undefined,
    icon: ICONO_PESTANA[tab.key],
    disabled: tab.disabled,
  }));
}

function useAnchoCompacto(): boolean {
  const consulta = () => typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(HOJAS_SELECCION_ANCHO_COMPACTO).matches
    : false;
  const [compacto, setCompacto] = useState(consulta);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(HOJAS_SELECCION_ANCHO_COMPACTO);
    const alCambiar = () => setCompacto(mq.matches);
    alCambiar();
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  return compacto;
}

export type SeleccionMesaProps = {
  pestana: HojasRutaDeliveryTab;
  pestanas: readonly HojasRutaNavigationTab[];
  onPestana: (tab: HojasRutaDeliveryTab) => void;
  panelId: string;
  tabId: (tab: HojasRutaDeliveryTab) => string;
  estado?: TabHeadingEstado;
  chips: readonly TabHeadingChip[];
  /** Avisos de la selección: van sobre la tabla, dentro de la pestaña. */
  avisos?: ReactNode;
  /** El contenido de la pestaña activa: la tabla y su paginador. */
  children: ReactNode;
  /** Paneles de salida (ZIP, Excel, reemplazos puntuales, PDF de prueba). */
  salidas: ReactNode;
  /** Trabajos en curso y descargas recientes, siempre visibles. */
  trabajos?: ReactNode;
};

export function SeleccionMesa({
  pestana,
  pestanas,
  onPestana,
  panelId,
  tabId,
  estado,
  chips,
  avisos,
  children,
  salidas,
  trabajos,
}: SeleccionMesaProps) {
  const compacto = useAnchoCompacto();
  const activa = pestanas.find((tab) => tab.key === pestana) ?? pestanas[0];
  const indice = Math.max(0, pestanas.findIndex((tab) => tab.key === pestana));

  return (
    <div className="hojas-ruta-stage-shell is-delivery-stage hr-seleccion" data-compacto={compacto ? "true" : "false"}>
      <AdaptiveSplitView
        ariaLabel="Selección de campo"
        railLabel="Pestañas de selección"
        className="pulso-context-tab-layout hr-seleccion-split"
        rail={(
          <ContextTabRail
            ariaLabel="Pestañas de selección"
            activeKey={pestana}
            items={itemsDelRail(pestanas)}
            panelId={panelId}
            tabId={tabId}
            onChange={onPestana}
            className="hr-seleccion-rail"
          />
        )}
      >
        <div className="hr-seleccion-mesa">
          <div className="hr-seleccion-trabajo">
            <TabHeading
              eyebrow="Selección"
              titulo={activa?.label ?? "Selección"}
              icono={ICONO_PESTANA[activa?.key ?? "titulares"]}
              estado={estado}
              detalle={activa ? DETALLE_PESTANA[activa.key] : undefined}
              pestanaN={indice + 1}
              pestanaDe={pestanas.length}
              chips={chips}
              control={compacto ? (
                <Sideover
                  panel={PANEL_SALIDAS_SELECCION}
                  title="Salidas de la selección"
                  subtitle="ZIP de fichas, Excel operativo, reemplazos puntuales y PDF de prueba"
                  icon={<Archive size={16} />}
                  trigger={(
                    <PulsoButton variant="secondary" size="sm">
                      <Archive size={14} aria-hidden="true" /> Salidas
                    </PulsoButton>
                  )}
                >
                  <div className="hr-seleccion-salidas is-sideover">{salidas}<BitacoraSeccion /></div>
                </Sideover>
              ) : undefined}
            />
            {avisos ? <div className="hr-seleccion-avisos">{avisos}</div> : null}
            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId(pestana)}
              tabIndex={0}
              className="hr-seleccion-cuerpo"
            >
              {children}
            </div>
            {trabajos}
          </div>
          {compacto ? null : (
            <aside className="hr-seleccion-salidas" aria-label="Salidas de la selección">{salidas}<BitacoraSeccion /></aside>
          )}
        </div>
      </AdaptiveSplitView>
    </div>
  );
}
