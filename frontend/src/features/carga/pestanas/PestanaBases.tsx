import type { ComponentProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { EstudioPayload } from "../../../api/estudio";
import type { VistaPreviaFuente } from "../../../api/xlsformEditor";
import { PulsoButton } from "../../../components/PulsoButton";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { Database, GitCompareArrows, Plus } from "../../../vendor/lucide-react";
import { Panel } from "../../../components/Panel";
import { formatoConteo } from "../../../lib/formatoNumero";
import { InstrumentRevisionBindingNotice } from "../InstrumentRevisionBindingNotice";
import { AbrirPanelFuentes } from "../fuentes/AbrirPanelFuentes";
import { ArmonizacionBasePanel } from "../fuentes/ArmonizacionBasePanel";
import { CompararFuentesPanel } from "../fuentes/CompararFuentesPanel";
import { hayFuentesComparables, primerParComparable, searchConComparacion } from "../fuentes/compararFuentesModel";
import { useOrdenDeSerie } from "../fuentes/useOrdenDeSerie";
import type { MultiBaseStrategy } from "../store";
import type { SessionState } from "../../../api/core";
import { AgregarBase } from "./bases/AgregarBase";
import { AgregarFuente } from "./bases/AgregarFuente";
import { BitacoraDeIntegracion } from "./bases/BitacoraDeIntegracion";
import {
  focoDelInspector,
  searchConAgregarBase,
  searchConAgregarFuente,
  searchConInspector,
  type OrigenDeAlta,
} from "./bases/agregarBaseModel";
import { baseEnfocada, coleccionDelEstudio, coleccionDeUnaBase } from "./bases/basesModel";
import { ColeccionDeBases } from "./bases/ColeccionDeBases";
import { InspectorDeBase } from "./bases/InspectorDeBase";
import { LineaDeRelacion, PanelDeRelacion, type RelacionDeBases } from "./bases/RelacionEntreBases";
import { SubidaDeUnaBase, type SubidaDeUnaBaseProps } from "./bases/SubidaDeUnaBase";
import { useBaseUnicaRegistrada } from "./bases/useBaseUnicaRegistrada";
import { PanelMonitoreoCarga, type PanelMonitoreoCargaProps } from "./PanelMonitoreoCarga";
import { PlatformImportPanel } from "./PanelPlataforma";
import "./bases/bases.css";

export type PestanaBasesProps = {
  varias: boolean;
  estudio: EstudioPayload | null;
  estrategia: MultiBaseStrategy;
  /** La sesión ya registró la base en el estudio (con una base, la `default`). */
  tieneEstudio: boolean;
  ocupado: boolean;
  relacion: RelacionDeBases;
  entradasPrevistas: number;
  entradasMinimas: number;
  onEntradasPrevistas: (valor: number) => void;
  plataforma: ComponentProps<typeof PlatformImportPanel>;
  monitoreo: PanelMonitoreoCargaProps;
  unaBase: SubidaDeUnaBaseProps & {
    enlaceConRevision: SessionState["instrument_revision_binding"];
  };
  variasBases: {
    onEstudioCambiado: (payload: EstudioPayload) => Promise<void>;
    onDestinoFuente: (destino: { base: string; canal: string } | null) => void;
    vistaPreviaFuente: VistaPreviaFuente | null;
    onConfirmarFuente: () => void;
    onDescartarVistaPrevia: () => void;
    onBaseSavRegistrada: () => void;
  };
  /** La página prepara lo suyo para el origen elegido en "Agregar base". */
  onOrigen: (origen: OrigenDeAlta) => void;
};

/**
 * Bases (ADR 0142, R2): la relación entre las bases en una línea, la colección
 * de bases y el inspector de la base enfocada (`foco=<base>`). Igual para una
 * base, bases separadas, integrada, independientes y grupo repetido. "Agregar
 * base" es un recorrido por pasos (`panel=agregar-base`).
 */
export function PestanaBases({
  varias,
  estudio,
  estrategia,
  tieneEstudio,
  ocupado,
  relacion,
  entradasPrevistas,
  entradasMinimas,
  onEntradasPrevistas,
  plataforma,
  monitoreo,
  unaBase,
  variasBases,
  onOrigen,
}: PestanaBasesProps) {
  const direccion = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const ir = (search: string) => navigate({ pathname: location.pathname, search }, { replace: true });

  const madres = estudio ? Object.values(estudio.bases ?? {}).filter((b) => !b.parent_base) : [];
  const periodos = useOrdenDeSerie(madres.map((b) => b.nombre).join("|"), varias && estrategia === "separate");
  const registrada = useBaseUnicaRegistrada(
    !varias && tieneEstudio,
    `${unaBase.tieneFormulario}|${unaBase.tieneRespuestas}|${unaBase.vistaPrevia?.n_filas ?? ""}`,
  );
  const coleccion = varias && estudio
    ? coleccionDelEstudio(estudio, periodos)
    : coleccionDeUnaBase({
        tieneFormulario: unaBase.tieneFormulario,
        tieneRespuestas: unaBase.tieneRespuestas,
        registrada,
        respuestasSubidas: unaBase.vistaPrevia?.n_filas ?? null,
        columnasSubidas: unaBase.vistaPrevia?.n_columnas ?? null,
      });
  const foco = focoDelInspector(direccion.panel, direccion.foco, location.state);
  const objetivo = baseEnfocada(coleccion, foco);
  const enfocar = (nombre: string) => ir(searchConInspector(location.search, foco === nombre ? null : nombre));
  // Al cerrar el inspector, el foco del teclado vuelve a la tarjeta (o a la fila de la hija) que lo abrió.
  const cerrarInspector = (nombre: string) => {
    ir(searchConInspector(location.search, null));
    window.setTimeout(() => {
      const destino = Array.from(document.querySelectorAll<HTMLElement>("[data-base-abre]")).find((e) => e.dataset.baseAbre === nombre);
      destino?.focus();
    }, 0);
  };
  const unaBaseConArchivos = !varias && coleccion.bases.length > 0;

  const panelPlataforma = <PlatformImportPanel {...plataforma} />;
  const panelMonitoreo = <PanelMonitoreoCarga {...monitoreo} />;
  const subidaDeUnaBase = <SubidaDeUnaBase {...unaBase} />;

  const botonAgregar = (
    <PulsoButton
      variant="primary"
      size="sm"
      aria-haspopup="dialog"
      data-plf-abrir="agregar-base"
      onClick={() => ir(searchConAgregarBase(location.search, null))}
    >
      <Plus size={14} aria-hidden="true" />Agregar base
    </PulsoButton>
  );

  return (
    <div
      className="pulso-carga-surface pulso-bases"
      data-carga-surface="bases"
      data-qa-geometry-group="carga/bases-pestana"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-bases-barra">
        <LineaDeRelacion relacion={relacion} />
      </div>

      {/* C1: la colección y el inspector son dos marcos que llegan al borde inferior;
          cada uno es dueño de su scroll y de su vacío. */}
      <div
        className="pulso-bases-mesa"
        data-con-inspector={objetivo ? "" : undefined}
        data-qa-geometry-group="carga/bases-mesa"
        data-qa-geometry-contract="intrinsic"
      >
        <Panel
          noPadding
          className="pulso-bases-panel"
          title={(
            <>
              <Database size={16} aria-hidden="true" />
              <span>Bases del estudio</span>
              {coleccion.nBases > 0 ? <span className="pulso-bases-conteo">{formatoConteo(coleccion.nBases)}</span> : null}
            </>
          )}
          actions={(
            <>
              {/* ADR 0102: dos bases de la misma revisión se comparan fuente contra fuente. */}
              {varias && hayFuentesComparables(madres) ? (
                <AbrirPanelFuentes variant="secondary" clave="comparar" destino={(search) => searchConComparacion(search, primerParComparable(madres))}>
                  <GitCompareArrows size={14} aria-hidden="true" />Comparar fuentes
                </AbrirPanelFuentes>
              ) : null}
              {/* Con una base que ya existe, otra base se agrega cambiando la relación. */}
              {coleccion.bases.length > 0 && !unaBaseConArchivos ? botonAgregar : null}
            </>
          )}
        >
          <div className="pulso-bases-cuerpo" role="region" aria-label="Bases del estudio" tabIndex={0} data-qa-geometry-capacity="owned">
            <ColeccionDeBases
              coleccion={coleccion}
              enfocada={objetivo ? (objetivo.hija?.nombre ?? objetivo.base.nombre) : null}
              onEnfocar={enfocar}
              accionVacia={botonAgregar}
            />
          </div>
        </Panel>
        {objetivo ? (
          <InspectorDeBase
            key={objetivo.hija?.nombre ?? objetivo.base.nombre}
            base={objetivo.base}
            hija={objetivo.hija}
            basesDelEstudio={madres}
            ocupado={ocupado}
            onCerrar={() => cerrarInspector(objetivo.hija?.nombre ?? objetivo.base.nombre)}
            onCambio={variasBases.onEstudioCambiado}
            onRenombrada={(nuevo) => ir(searchConInspector(location.search, nuevo))}
            onQuitada={() => ir(searchConInspector(location.search, null))}
            onAgregarFuente={() => ir(searchConAgregarFuente(location.search, objetivo.base.nombre))}
            onCambiarFuente={varias ? null : () => ir(searchConAgregarBase(location.search, null))}
            avisoDelFormulario={varias ? null : (
              <InstrumentRevisionBindingNotice binding={unaBase.enlaceConRevision} base={registrada ?? undefined} />
            )}
            descargable={varias || (unaBase.tieneRespuestas && !unaBase.mapeoPendiente)}
          />
        ) : null}
      </div>

      <PanelDeRelacion relacion={relacion} />
      <AgregarBase
        varias={varias}
        estrategia={estrategia}
        estudio={estudio}
        cambiaFuente={unaBaseConArchivos}
        ocupado={ocupado}
        onOrigen={onOrigen}
        panelPlataforma={panelPlataforma}
        panelMonitoreo={panelMonitoreo}
        subidaDeUnaBase={subidaDeUnaBase}
        onEstudioCambiado={variasBases.onEstudioCambiado}
        onBaseSavRegistrada={variasBases.onBaseSavRegistrada}
        entradasPrevistas={entradasPrevistas}
        entradasMinimas={entradasMinimas}
        onEntradasPrevistas={onEntradasPrevistas}
        hayFormularioDeSesion={unaBase.tieneFormulario}
      />
      {varias ? (
        <AgregarFuente
          coleccion={coleccion}
          ocupado={ocupado}
          panelPlataforma={panelPlataforma}
          onDestinoFuente={variasBases.onDestinoFuente}
          vistaPrevia={variasBases.vistaPreviaFuente}
          onConfirmar={variasBases.onConfirmarFuente}
          onDescartarVistaPrevia={variasBases.onDescartarVistaPrevia}
        />
      ) : null}
      {varias && estudio ? (
        <>
          <ArmonizacionBasePanel />
          <BitacoraDeIntegracion coleccion={coleccion} />
          <CompararFuentesPanel bases={madres} />
        </>
      ) : null}
    </div>
  );
}

