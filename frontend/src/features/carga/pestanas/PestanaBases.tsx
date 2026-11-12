import type { ComponentProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { EstudioPayload } from "../../../api/estudio";
import type { VistaPreviaFuente } from "../../../api/xlsformEditor";
import { PulsoButton } from "../../../components/PulsoButton";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { Database, GitCompareArrows, Plus } from "../../../vendor/lucide-react";
import { Panel } from "../../../components/Panel";
import { InstrumentRevisionBindingNotice } from "../InstrumentRevisionBindingNotice";
import { AbrirPanelFuentes } from "../fuentes/AbrirPanelFuentes";
import { ArmonizacionBasePanel } from "../fuentes/ArmonizacionBasePanel";
import { CompararFuentesPanel } from "../fuentes/CompararFuentesPanel";
import { hayFuentesComparables, primerParComparable, searchConComparacion } from "../fuentes/compararFuentesModel";
import { useFormulariosPublicados } from "../fuentes/useFormulariosPublicados";
import { useOrdenDeSerie } from "../fuentes/useOrdenDeSerie";
import type { MultiBaseStrategy } from "../store";
import type { SessionState } from "../../../api/core";
import { ActualizarFuente } from "../actualizar/ActualizarFuente";
import { searchConActualizarFuente } from "../actualizar/actualizarFuenteModel";
import { AgregarBase } from "./bases/AgregarBase";
import { AgregarFuente } from "./bases/AgregarFuente";
import { BitacoraDeIntegracion } from "./bases/BitacoraDeIntegracion";
import {
  focoDelInspector,
  origenesDeAlta,
  searchConAgregarBase,
  searchConAgregarFuente,
  searchConInspector,
  searchConRelacion,
  type OrigenDeAlta,
} from "./bases/agregarBaseModel";
import { baseDelInspector, cifrasDeLaColeccion, coleccionDelEstudio, coleccionDeUnaBase } from "./bases/basesModel";
import { CabeceraDeBases } from "./bases/CabeceraDeBases";
import { OrigenesALaVista } from "./bases/OrigenesALaVista";
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
  /** El error de la última carga, para dibujarlo dentro de "Agregar base" cuando está abierto. */
  errorDeCarga?: string;
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
 * Bases (ADR 0142, R2; fidelidad al prototipo "carga-bases" en la oleada 15-B):
 * la cabecera con sus cifras y "Agregar base", la relación entre las bases en
 * una línea, las bases en filas a todo el ancho con los orígenes para agregar
 * otra debajo, y el inspector de la base elegida (`foco=<base>`, o la primera).
 * Igual para una base, bases separadas, integrada, independientes y grupo
 * repetido. "Agregar base" es un recorrido por pasos (`panel=agregar-base`).
 */
export function PestanaBases({
  varias,
  estudio,
  estrategia,
  tieneEstudio,
  ocupado,
  errorDeCarga,
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
  // El inspector está siempre a la vista (prototipo "carga-bases"): la base del `foco` o la primera.
  const objetivo = baseDelInspector(coleccion, foco);
  const enfocar = (nombre: string) => ir(searchConInspector(location.search, nombre));
  const unaBaseConArchivos = !varias && coleccion.bases.length > 0;
  const sinBases = coleccion.bases.length === 0;
  // Los orígenes que ofrece la relación; el catálogo de formularios publicados solo se pide con varias bases.
  const publicados = useFormulariosPublicados(varias);
  const origenes = origenesDeAlta({ varias, estrategia, hayPublicados: publicados.formularios.length > 0 });

  const panelPlataforma = <PlatformImportPanel {...plataforma} />;
  const panelMonitoreo = <PanelMonitoreoCarga {...monitoreo} />;
  const subidaDeUnaBase = <SubidaDeUnaBase {...unaBase} />;

  // "Agregar base" en la cabecera. Con una base que ya tiene archivos, otra base
  // exige antes elegir cómo se relacionan: abre la relación entre las bases.
  const accionDeCabecera = sinBases ? null : unaBaseConArchivos ? (
    <PulsoButton
      variant="secondary"
      size="md"
      aria-haspopup="dialog"
      data-plf-abrir="relacion"
      onClick={() => ir(searchConRelacion(location.search))}
    >
      <Plus size={14} aria-hidden="true" />Agregar base
    </PulsoButton>
  ) : (
    <PulsoButton
      variant="primary"
      size="md"
      aria-haspopup="dialog"
      data-plf-abrir="agregar-base"
      onClick={() => ir(searchConAgregarBase(location.search, null))}
    >
      <Plus size={14} aria-hidden="true" />Agregar base
    </PulsoButton>
  );

  // "Agregar una base desde": los orígenes a la vista; cada uno abre el recorrido
  // ya en ese origen. Con una base que ya tiene archivos, la segunda base exige
  // elegir antes cómo se relacionan (prototipo "carga-bases-una": "Al agregar
  // otra base se elige cómo se relacionan"): se muestran los orígenes de varias
  // bases y cada uno abre la relación entre las bases.
  const origenesALaVista = unaBaseConArchivos ? (
    <OrigenesALaVista
      titulo="Agregar otra base desde"
      opciones={origenesDeAlta({ varias: true, estrategia: "separate", hayPublicados: false })}
      grandes={false}
      onElegir={() => ir(searchConRelacion(location.search))}
    />
  ) : (
    <OrigenesALaVista
      titulo={sinBases ? null : "Agregar una base desde"}
      opciones={origenes}
      grandes={sinBases}
      onElegir={(o) => ir(searchConAgregarBase(location.search, o))}
    />
  );

  return (
    <div
      className="pulso-carga-surface pulso-bases"
      data-carga-surface="bases"
      data-qa-geometry-group="carga/bases-pestana"
      data-qa-geometry-contract="intrinsic"
    >
      <CabeceraDeBases cifras={cifrasDeLaColeccion(coleccion)} varias={varias} accion={accionDeCabecera} />

      <Panel noPadding className="pulso-bases-barra">
        <LineaDeRelacion relacion={relacion} />
      </Panel>

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
              <span>{sinBases ? "Agregar la primera base" : "Bases del estudio"}</span>
            </>
          )}
          actions={varias && hayFuentesComparables(madres) ? (
            // ADR 0102: dos bases de la misma revisión se comparan fuente contra fuente.
            <AbrirPanelFuentes variant="secondary" clave="comparar" destino={(search) => searchConComparacion(search, primerParComparable(madres))}>
              <GitCompareArrows size={14} aria-hidden="true" />Comparar fuentes
            </AbrirPanelFuentes>
          ) : null}
        >
          <div className="pulso-bases-cuerpo" role="region" aria-label="Bases del estudio" tabIndex={0} data-qa-geometry-capacity="owned">
            <ColeccionDeBases
              coleccion={coleccion}
              enfocada={objetivo ? (objetivo.hija?.nombre ?? objetivo.base.nombre) : null}
              onEnfocar={enfocar}
              origenes={origenesALaVista}
            />
          </div>
        </Panel>
        {objetivo ? (
          <InspectorDeBase
            key={objetivo.hija?.nombre ?? objetivo.base.nombre}
            base={objetivo.base}
            hija={objetivo.hija}
            basesDelEstudio={madres}
            formulariosPublicados={publicados.formularios}
            ocupado={ocupado}
            onCambio={variasBases.onEstudioCambiado}
            onRenombrada={(nuevo) => ir(searchConInspector(location.search, nuevo))}
            onQuitada={() => ir(searchConInspector(location.search, null))}
            onAgregarFuente={() => ir(searchConAgregarFuente(location.search, objetivo.base.nombre))}
            onCambiarFuente={varias ? null : () => ir(searchConAgregarBase(location.search, null))}
            onActualizar={() => ir(searchConActualizarFuente(location.search, objetivo.base.nombre))}
            avisoDelFormulario={varias ? null : (
              <InstrumentRevisionBindingNotice binding={unaBase.enlaceConRevision} base={registrada ?? undefined} />
            )}
            descargable={varias || (unaBase.tieneRespuestas && !unaBase.mapeoPendiente)}
          />
        ) : null}
      </div>

      <PanelDeRelacion relacion={relacion} />
      <ActualizarFuente coleccion={coleccion} ocupado={ocupado} onCambio={variasBases.onEstudioCambiado} />
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
        errorDeCarga={errorDeCarga}
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

