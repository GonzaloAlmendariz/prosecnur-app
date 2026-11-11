import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { ContextTabRail, type ContextTabRailItem } from "../../components/ContextTabRail";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { TabHeading } from "../../components/TabHeading";
import { Skeleton, SkeletonVista, type SkeletonVistaVariante } from "../../components/Skeleton";
import { ErrorBlock } from "../../components/States";
import type { ReactNode } from "react";
import { ClipboardList, Loader2, RefreshCw, type LucideIcon } from "../../vendor/lucide-react";
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
 * "Pendiente" ni "0/1": durante la lectura no hay cifra que dar.
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
        {/* Bases dibuja su cabecera dentro de la pestaña (con sus cifras), y su
            silueta la anticipa ahí mismo. */}
        {pestana === "bases" ? null : (
          <TabHeading
            eyebrow="Carga"
            titulo={metadata.label}
            icono={ClipboardList}
            detalle={metadata.summary}
          />
        )}
        <div className="pulso-carga-scrollarea">
          {leyendo ? (
            <div className="pulso-carga-hidratando-cuerpo">
              {pestana === "bases" ? null : (
                <EstadoDeLectura texto={texto} segundos={segundos} />
              )}
              {pestana === "bases" ? (
                <SiluetaFuentes titulo={metadata.label} icono={metadata.icon} estado={<EstadoDeLectura texto={texto} segundos={segundos} />} />
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

/** El renglón de lectura: qué se está leyendo y cuánto lleva. */
function EstadoDeLectura({ texto, segundos }: { texto: string; segundos: number }) {
  return (
    <div className="pulso-carga-hidratando-estado" role="status" aria-live="polite">
      <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
      <span className="pulso-sr-only">{texto}</span>
      <span aria-hidden="true">
        {texto}, <strong>{formatoTranscurrido(segundos)}</strong>
      </span>
    </div>
  );
}

/**
 * Silueta de Bases con la forma de la pestaña hidratada: la cabecera en su
 * panel con el lugar de las cifras y de "Agregar base", la franja de la
 * relación (que dice qué se está leyendo) y las dos columnas, la colección con
 * tres filas del alto de las reales y el inspector. Al llegar los datos el
 * marco no cambia (C2). Sin cifras: durante la lectura no hay dato que dar.
 */
export function SiluetaFuentes({ titulo, icono, estado }: { titulo: string; icono: LucideIcon; estado: ReactNode }) {
  return (
    <div className="pulso-bases pulso-bases--silueta" data-carga-silueta="bases">
      <Panel noPadding className="pulso-bases-cabecera" aria-hidden="true">
        <TabHeading
          eyebrow="Carga"
          titulo={titulo}
          icono={icono}
          control={(
            <div className="pulso-bases-cabecera-control">
              <Skeleton forma="texto" ancho={64} alto={30} />
              <Skeleton forma="texto" ancho={84} alto={30} />
              <div className="pulso-bases-cabecera-accion">
                <Skeleton forma="texto" ancho={118} alto={28} />
              </div>
            </div>
          )}
        />
      </Panel>
      <Panel noPadding className="pulso-bases-barra">
        <div className="pulso-bases-relacion">{estado}</div>
      </Panel>
      <div className="pulso-bases-mesa" data-con-inspector="" aria-hidden="true">
        <Panel noPadding className="pulso-bases-panel" title={<Skeleton forma="titulo" ancho={150} />}>
          <div className="pulso-bases-cuerpo">
            <div className="pulso-bases-coleccion">
              {[0, 1, 2].map((i) => (
                <div className="pulso-bases-celda" key={i}>
                  <Skeleton forma="card" alto={74} />
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel noPadding className="pulso-bases-inspector" title={<Skeleton forma="titulo" ancho={140} />}>
          <div className="pulso-bases-inspector-cuerpo">
            <Skeleton forma="texto" ancho="40%" alto={10} />
            <Skeleton forma="card" alto={56} />
            <Skeleton forma="texto" ancho="30%" alto={10} />
            <Skeleton forma="card" alto={72} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
