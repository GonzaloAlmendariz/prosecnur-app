import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { ContextTabRail, type ContextTabRailItem } from "../../components/ContextTabRail";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { TabHeading } from "../../components/TabHeading";
import { Skeleton, SkeletonVista, type SkeletonVistaVariante } from "../../components/Skeleton";
import { ErrorBlock } from "../../components/States";
import { ClipboardList, Loader2, RefreshCw } from "../../vendor/lucide-react";
import {
  formatoTranscurrido,
  textoHidratacionCarga,
  type HidratacionCarga,
} from "./cargaHidratacion";
import { ETIQUETAS_GRUPO_PESTANA } from "../../lib/navegacion/catalogos/procesamiento";
import { CARGA_WORKSPACE_TABS, type CargaWorkspaceTab } from "./CargaWorkspaceModel";
import { CARGA_WORKSPACE_PANEL_ID, cargaWorkspaceTabId } from "./CargaWorkspaceNavigation";
import { useSegundosTranscurridos } from "./useEstudioCarga";
import "./CargaWorkspaceNavigation.css";
import "./carga-hidratacion.css";
import "./pestanas/bases/bases.css";

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
  revision: "workbench",
  variables: "documento",
  formulario: "tabla",
  respuestas: "tabla",
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
    ...(tab.grupo ? { grupo: ETIQUETAS_GRUPO_PESTANA[tab.grupo] } : {}),
  }));
  const texto = leyendo ? textoHidratacionCarga(hidratacion.motivo) : "";

  return (
    <AdaptiveSplitView
      ariaLabel="Mesa de trabajo de carga"
      railLabel="Pestañas de carga"
      className={`pulso-upload-section pulso-carga-workbench pulso-carga-workbench--multibase pulso-context-tab-layout pulso-carga-hidratando${pestana === "bases" ? " pulso-carga-workbench--bases" : ""}`}
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
        {/* La misma cabecera que pinta CargaWorkspaceHeader al terminar (L14):
            mientras hidrata no hay estado que declarar, y la espera la dice el
            renglón de lectura de abajo. La cabecera no numera las pestañas. */}
        <TabHeading
          eyebrow="Carga"
          titulo={metadata.label}
          icono={ClipboardList}
          detalle={metadata.summary}
        />
        <div className="pulso-carga-scrollarea">
          {leyendo ? (
            <div className="pulso-carga-hidratando-cuerpo">
              <div className="pulso-carga-hidratando-estado" role="status" aria-live="polite">
                <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
                <span className="pulso-sr-only">{texto}</span>
                <span aria-hidden="true">
                  {texto}, <strong>{formatoTranscurrido(segundos)}</strong>
                </span>
              </div>
              {pestana === "bases" ? (
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
 * Silueta de Bases con la forma de la pestaña hidratada (R2): la línea de la
 * relación entre las bases y el marco "Bases del estudio" a todo el alto, con
 * tres tarjetas del tamaño de las reales. Al llegar los datos el marco no
 * cambia (C2). Sin cifras ni conteo: durante la lectura no hay dato que dar.
 */
export function SiluetaFuentes() {
  return (
    <div className="pulso-bases pulso-bases--silueta" aria-hidden="true" data-carga-silueta="bases">
      <div className="pulso-bases-barra">
        <Skeleton forma="texto" ancho={280} alto={12} />
      </div>
      <div className="pulso-bases-mesa">
        <Panel noPadding className="pulso-bases-panel" title={<Skeleton forma="titulo" ancho={150} />}>
          <div className="pulso-bases-cuerpo">
            <div className="pulso-bases-coleccion">
              {[0, 1, 2].map((i) => (
                <div className="pulso-bases-celda" key={i}>
                  <Skeleton forma="card" alto={113} />
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
