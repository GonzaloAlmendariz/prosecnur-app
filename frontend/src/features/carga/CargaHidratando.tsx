import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { ContextTabRail, type ContextTabRailItem } from "../../components/ContextTabRail";
import { PulsoButton } from "../../components/PulsoButton";
import { Skeleton, SkeletonVista, type SkeletonVistaVariante } from "../../components/Skeleton";
import { ErrorBlock } from "../../components/States";
import { ClipboardList, Loader2, RefreshCw } from "../../vendor/lucide-react";
import {
  formatoTranscurrido,
  textoHidratacionCarga,
  type HidratacionCarga,
} from "./cargaHidratacion";
import { CARGA_WORKSPACE_TABS, type CargaWorkspaceTab } from "./CargaWorkspaceModel";
import { CARGA_WORKSPACE_PANEL_ID, cargaWorkspaceTabId } from "./CargaWorkspaceNavigation";
import { useSegundosTranscurridos } from "./useEstudioCarga";
import "./CargaWorkspaceNavigation.css";
import "./carga-hidratacion.css";

/**
 * Carga mientras se hidrata (remasterización L4, maqueta L04).
 *
 * Lo que se sabe sin datos se pinta de verdad: el rail de pestañas (sus
 * nombres y destinos vienen del catálogo de navegación) y el nombre de la
 * pestaña activa. Lo que depende del estudio —estado de la pestaña, plan,
 * carriles de bases— reserva su silueta con piezas `Skeleton`. Nada dice
 * «Pendiente» ni «0/1»: durante la lectura no hay cifra que dar.
 *
 * Contrato de readiness: este componente NUNCA escribe `data-audit-ready`. La
 * marca la publica `PageFrame` cuando la hidratación termina.
 */

/** Pestañas que se ofrecen siempre; Equivalencias depende del estudio. */
const PESTANAS_SIEMPRE = CARGA_WORKSPACE_TABS.filter(
  (pestana) => pestana.disponibilidad !== "condicional",
);

const SILUETA_POR_PESTANA: Partial<Record<CargaWorkspaceTab, SkeletonVistaVariante>> = {
  plan: "documento",
  revision: "workbench",
  estructura: "tabla",
  datos: "tabla",
  equivalencias: "tabla",
};

export type CargaHidratandoProps = {
  pestana: CargaWorkspaceTab;
  hidratacion: Exclude<HidratacionCarga, { fase: "lista" }>;
  onCambiarPestana: (pestana: CargaWorkspaceTab) => void;
  onReintentar: () => void;
};

export function CargaHidratando({
  pestana,
  hidratacion,
  onCambiarPestana,
  onReintentar,
}: CargaHidratandoProps) {
  const leyendo = hidratacion.fase === "leyendo";
  const segundos = useSegundosTranscurridos(leyendo);
  const metadata = CARGA_WORKSPACE_TABS.find((candidata) => candidata.key === pestana)
    ?? CARGA_WORKSPACE_TABS[0];
  const items: readonly ContextTabRailItem<CargaWorkspaceTab>[] = PESTANAS_SIEMPRE.map((tab) => ({
    key: tab.key,
    label: tab.label,
    description: tab.summary,
    icon: tab.icon,
    estado: "no-evaluado",
    estadoLabel: leyendo ? "Leyendo" : "Sin leer",
  }));
  const texto = leyendo ? textoHidratacionCarga(hidratacion.motivo) : "";

  return (
    <AdaptiveSplitView
      ariaLabel="Mesa de trabajo de carga"
      railLabel="Pestañas de carga"
      className="pulso-upload-section pulso-carga-workbench pulso-carga-workbench--multibase pulso-context-tab-layout pulso-carga-hidratando"
      rail={(
        <div className="pulso-carga-workspace-navigation" data-workspace-state="neutral">
          <ContextTabRail
            ariaLabel="Pestañas de carga"
            activeKey={pestana}
            items={items}
            panelId={CARGA_WORKSPACE_PANEL_ID}
            tabId={cargaWorkspaceTabId}
            onChange={onCambiarPestana}
            className="pulso-carga-workspace-tab-rail"
          />
        </div>
      )}
    >
      <div
        id={CARGA_WORKSPACE_PANEL_ID}
        role="tabpanel"
        aria-labelledby={cargaWorkspaceTabId(metadata.key)}
        aria-busy={leyendo ? "true" : undefined}
        tabIndex={0}
        className="pulso-carga-content pulso-content-area pulso-carga-content--multi pulso-carga-content--framed"
        data-carga-hidratacion={hidratacion.fase}
      >
        <header className="pulso-carga-workspace-header" data-workspace-state="neutral">
          <span className="pulso-carga-workspace-header-icon" aria-hidden="true">
            <ClipboardList size={17} />
          </span>
          <div className="pulso-carga-workspace-header-copy">
            <span className="pulso-carga-workspace-header-kicker">Carga</span>
            <div className="pulso-carga-workspace-header-title">
              <h2>{metadata.label}</h2>
              {leyendo && <Skeleton forma="texto" ancho={58} alto={16} className="pulso-skeleton--pastilla" />}
            </div>
            <p>{metadata.summary}</p>
          </div>
        </header>
        <div className="pulso-carga-scrollarea">
          {leyendo ? (
            <div className="pulso-carga-hidratando-cuerpo">
              <div className="pulso-carga-hidratando-estado" role="status" aria-live="polite">
                <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
                <span className="pulso-sr-only">{`${texto}…`}</span>
                <span aria-hidden="true">
                  {texto} · <strong>{formatoTranscurrido(segundos)}</strong>
                </span>
              </div>
              {pestana === "fuentes" ? (
                <SiluetaFuentes />
              ) : (
                <SkeletonVista
                  variante={SILUETA_POR_PESTANA[pestana] ?? "workbench"}
                  cabecera={false}
                  decorativo
                  className="pulso-carga-hidratando-vista"
                />
              )}
            </div>
          ) : (
            <div className="pulso-carga-hidratando-error">
              <ErrorBlock
                label={hidratacion.motivo === "sesion" ? "No se pudo abrir el estudio" : "No se pudieron leer las bases del estudio"}
                detail="Tus archivos no cambiaron. Vuelve a intentarlo; si persiste, reabre el proyecto."
              />
              <PulsoButton variant="secondary" size="sm" onClick={onReintentar}>
                <RefreshCw size={14} aria-hidden="true" />
                {hidratacion.motivo === "sesion" ? "Volver a abrir el estudio" : "Volver a leer las bases"}
              </PulsoButton>
            </div>
          )}
        </div>
      </div>
    </AdaptiveSplitView>
  );
}

/**
 * Silueta de Fuentes con la forma real de la vista hidratada: franja del plan,
 * selector de origen, tarjeta del estudio, un carril de base materializada
 * (nombre, chip, tres acciones, metadatos) y la fila de alta. Al llegar los
 * datos no hay salto de layout porque cada hueco ya tenía su alto.
 */
export function SiluetaFuentes() {
  return (
    <div className="pulso-carga-hidratando-fuentes" aria-hidden="true" data-carga-silueta="fuentes">
      <div className="pulso-carga-hidratando-plan">
        <Skeleton forma="card" ancho={30} alto={30} />
        <div className="pulso-carga-hidratando-lineas">
          <Skeleton forma="texto" ancho="14%" alto={9} />
          <Skeleton forma="titulo" ancho="22%" />
          <Skeleton forma="texto" ancho="34%" alto={9} />
        </div>
        <Skeleton forma="texto" ancho={180} alto={34} className="pulso-skeleton--pastilla" />
      </div>
      <div className="pulso-carga-hidratando-origen">
        <Skeleton forma="texto" ancho={86} alto={28} className="pulso-skeleton--pastilla" />
        <Skeleton forma="texto" ancho={104} alto={28} className="pulso-skeleton--pastilla" />
        <Skeleton forma="texto" ancho={104} alto={28} className="pulso-skeleton--pastilla" />
      </div>
      <div className="pulso-carga-hidratando-estudio">
        <Skeleton forma="card" ancho={30} alto={30} />
        <div className="pulso-carga-hidratando-lineas">
          <Skeleton forma="texto" ancho="10%" alto={9} />
          <Skeleton forma="titulo" ancho="18%" />
          <Skeleton forma="texto" ancho="40%" alto={9} />
        </div>
        <Skeleton forma="texto" ancho={64} alto={24} className="pulso-skeleton--pastilla" />
      </div>
      <div className="pulso-carga-hidratando-carril">
        <Skeleton forma="card" ancho={34} alto={34} />
        <div className="pulso-carga-hidratando-lineas">
          <div className="pulso-carga-hidratando-fila">
            <Skeleton forma="titulo" ancho="28%" />
            <Skeleton forma="texto" ancho={56} alto={20} className="pulso-skeleton--pastilla" />
          </div>
          <Skeleton forma="texto" ancho="52%" alto={10} />
        </div>
        <div className="pulso-carga-hidratando-acciones">
          <Skeleton forma="texto" ancho={118} alto={28} className="pulso-skeleton--pastilla" />
          <Skeleton forma="texto" ancho={130} alto={28} className="pulso-skeleton--pastilla" />
          <Skeleton forma="texto" ancho={70} alto={28} className="pulso-skeleton--pastilla" />
        </div>
      </div>
      <div className="pulso-carga-hidratando-alta">
        <Skeleton forma="fila" />
        <Skeleton forma="fila" />
        <Skeleton forma="fila" />
        <Skeleton forma="texto" ancho={130} alto={30} className="pulso-skeleton--pastilla" />
      </div>
    </div>
  );
}
