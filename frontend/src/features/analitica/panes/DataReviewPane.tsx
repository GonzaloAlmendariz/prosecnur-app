import { useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { MesaDePestana } from "../../../components/procesamiento/MesaDePestana";
import { ErrorBlock } from "../../../components/States";
import { PulsoButton } from "../../../components/PulsoButton";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { padresConDummies } from "../coberturaVariable";
import { seccionesVisibles } from "../estructuraDeSecciones";
import { PANEL_VARIABLES_EXCLUIDAS } from "../panelesAnalitica";
import { useAnaliticaStore } from "../store";
import { UniversoAnalisis } from "../UniversoAnalisis";
import { conteoExclusion } from "../variablesExcluidasModel";
import {
  buildDataReviewSectionGroups,
  opcionesConDetalles,
  variablePorConfirmar,
  variableTieneCambios,
  dataReviewHasEditableOptions,
  type DataReviewSectionGroup,
} from "../datos/borradorDeEtiquetas";
import { CabeceraDeDatos, cifrasDeDatos, estadoDeDatos } from "../datos/CabeceraDeDatos";
import { InspectorDeVariable } from "../datos/InspectorDeVariable";
import { baseComunDeCasos, moverVariableDeSeccion, type FiltroDeVariables } from "../datos/modeloDeVariables";
import { PanelDeVariables } from "../datos/PanelDeVariables";
import { useBorradorDeEtiquetas } from "../datos/useBorradorDeEtiquetas";
import { useRevisionDeDatos } from "../datos/useRevisionDeDatos";
import "../variablesExcluidas.css";
import "../datos/datos.css";

// Los helpers puros viven en `datos/borradorDeEtiquetas.ts`; se reexportan con
// sus nombres para quien los importa desde aquí.
export {
  buildDataReviewDraft,
  buildDataReviewSectionGroups,
  dataReviewDraftStatus,
  dataReviewEffectiveOptionLabel,
  dataReviewEffectiveVariableLabel,
  dataReviewHasEditableOptions,
  type DataReviewDraft,
  type DataReviewSectionGroup,
} from "../datos/borradorDeEtiquetas";

// Analítica › Datos con la forma del prototipo ("Analítica, Variables"): la
// cabecera de la pestaña con el estado de las etiquetas, sus cifras y "Detectar
// secciones"; debajo, una mesa de dos columnas que llegan al pie: "Variables de
// la base" (filtros, buscador y la lista por sección) y el inspector de la
// variable elegida (`?foco=`), con "Confirmar etiquetas" en su pie.

export function DataReviewPane({ fuente }: {
  /** De qué versión de la base sale y la plantilla de Analítica, que la página pone al pie de la lista. */
  fuente?: ReactNode;
} = {}) {
  const revision = useRevisionDeDatos();
  const { variables } = revision;
  const borrador = useBorradorDeEtiquetas(variables);
  const config = useAnaliticaStore((s) => s.config);
  const setSecciones = useAnaliticaStore((s) => s.setSecciones);
  const renameSeccion = useAnaliticaStore((s) => s.renameSeccion);
  const toggleSeccionOculto = useAnaliticaStore((s) => s.toggleSeccionOculto);
  const setVariablesExcluidas = useAnaliticaStore((s) => s.setVariablesExcluidas);
  const toggleVariableExcluida = useAnaliticaStore((s) => s.toggleVariableExcluida);
  const [filtro, setFiltro] = useState<FiltroDeVariables>("todas");
  const [consulta, setConsulta] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  // La variable del inspector vive en la dirección (`?foco=`), no en un
  // useState: un enlace abre la misma variable y "atrás" no la pierde.
  const foco = new URLSearchParams(location.search).get("foco");
  function abrirVariable(name: string | null) {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", name) }, { replace: true });
  }

  const excluidas = useMemo(() => new Set(config.variables_excluidas), [config.variables_excluidas]);
  const seccionesDePantalla = useMemo(
    () => seccionesVisibles(config.secciones, revision.seccionesDetectadas),
    [config.secciones, revision.seccionesDetectadas],
  );
  const grupos = useMemo(() => buildDataReviewSectionGroups(variables, seccionesDePantalla), [variables, seccionesDePantalla]);
  // Sobre el payload completo y no sobre el grupo: si un dummy cayera en otra
  // sección, su padre se leería como ausente y avisaría en falso.
  const repartidas = useMemo(() => padresConDummies(variables), [variables]);
  const baseComun = useMemo(() => baseComunDeCasos(variables), [variables]);
  const variableEnFoco = foco ? variables.find((v) => v.name === foco) ?? null : null;
  const grupoEnFoco = variableEnFoco ? grupos.find((g) => g.variables.includes(variableEnFoco)) ?? null : null;
  const bloqueadaEnFoco = grupoEnFoco ? grupoEnFoco.hidden && !grupoEnFoco.synthetic : false;

  const estadoDe = (variable: (typeof variables)[number], grupo: DataReviewSectionGroup) => ({
    incluida: !excluidas.has(variable.name) && !(grupo.hidden && !grupo.synthetic),
    porConfirmar: variablePorConfirmar(variable, borrador.borrador, borrador.guardado),
  });

  // Excluidas sobre la lista de la config, no sobre las columnas presentes: una
  // variable retirada de la base sigue excluida aunque aquí no tenga fila (U5).
  const conteo = conteoExclusion(variables, config.variables_excluidas);
  const presentes = new Set(variables.map((v) => v.name));
  const editadas = Object.keys(config.datos.variable_labels ?? {}).length
    + Object.values(config.datos.value_labels ?? {}).reduce((suma, etiquetas) => suma + Object.keys(etiquetas ?? {}).length, 0);
  const cifras = cifrasDeDatos(
    {
      total: variables.length,
      incluidas: grupos.reduce((suma, g) => suma + g.variables.filter((v) => estadoDe(v, g).incluida).length, 0),
      excluidas: conteo.excluidas,
      excluidasAusentes: config.variables_excluidas.filter((n) => !presentes.has(n)).length,
      secciones: grupos.length,
      editadas,
    },
    { pathname: location.pathname, search: searchConPanel(location.search, PANEL_VARIABLES_EXCLUIDAS) },
  );

  function incluirVariables(names: string[], incluir: boolean) {
    const siguiente = new Set(config.variables_excluidas);
    for (const name of names) {
      if (incluir) siguiente.delete(name);
      else siguiente.add(name);
    }
    setVariablesExcluidas(Array.from(siguiente));
  }

  function cambiarSeccion(name: string, destinoId: string) {
    revision.materializarSecciones();
    setSecciones(moverVariableDeSeccion(useAnaliticaStore.getState().config.secciones, name, destinoId));
  }

  const listo = !revision.cargando && !revision.error;

  return (
    // La pestaña Datos no tiene readiness propia: la del tabpanel se publica al
    // hidratar la config, antes de que llegue la revisión. Este `false` anidado
    // retiene la vista mientras carga (E15/AD6); el error es terminal y publica `true`.
    <div className="datos-superficie" data-audit-ready={revision.cargando ? "false" : "true"}>
      <MesaDePestana
        grupo="analitica/datos"
        columnas={2}
        cabecera={(
          <CabeceraDeDatos
            cifras={cifras}
            estado={estadoDeDatos(borrador.pendientes, borrador.vacias)}
            deteccion={revision.deteccion}
            listo={listo}
            onDetectar={revision.detectarSecciones}
          />
        )}
        avisos={(revision.error || borrador.error || (revision.deteccion.estado === "error" && !revision.deteccion.silenciosa)) ? (
          <div className="datos-avisos">
            {revision.error ? (
              <ErrorBlock
                label="No se pudieron leer las variables de la base"
                detail={revision.error}
                queda="Lo que ya confirmaste sigue guardado."
                variante="enmarcado"
                acciones={<PulsoButton variant="secondary" onClick={revision.recargar}>Volver a leer</PulsoButton>}
              />
            ) : null}
            {revision.deteccion.estado === "error" && !revision.deteccion.silenciosa ? (
              <ErrorBlock label="No se pudieron leer las secciones del formulario" detail={revision.deteccion.mensaje} />
            ) : null}
            {borrador.error ? <ErrorBlock label="No se pueden confirmar las etiquetas" detail={borrador.error} /> : null}
          </div>
        ) : undefined}
      >
        {revision.cargando && variables.length === 0 ? (
          <CargaDeBloque label="Leyendo las variables de la base" />
        ) : (
          <PanelDeVariables
            grupos={grupos}
            total={variables.length}
            filtro={filtro}
            consulta={consulta}
            estadoDe={estadoDe}
            etiquetaDe={borrador.etiquetaDe}
            detallesDe={(v) => opcionesConDetalles(v, borrador.borrador.valueLabels)}
            repartidas={repartidas}
            baseComun={baseComun}
            elegida={foco}
            cargando={revision.cargando}
            pie={(
              // Los casos que cuentan, la versión de la base y la plantilla van
              // en la banda del módulo según el plan 5.4; mientras la banda no
              // los lleve, quedan al pie de la lista.
              <div className="datos-pie">
                <UniversoAnalisis />
                {fuente ? <div className="datos-pie-fuente">{fuente}</div> : null}
              </div>
            )}
            onFiltro={setFiltro}
            onBuscar={setConsulta}
            onIncluir={toggleVariableExcluida}
            onIncluirSeccion={incluirVariables}
            onRenombrarSeccion={(id, nombre) => {
              revision.materializarSecciones();
              renameSeccion(id, nombre);
            }}
            onOcultarSeccion={(id, names, ocultar) => {
              revision.materializarSecciones();
              toggleSeccionOculto(id);
              if (ocultar) incluirVariables(names, false);
            }}
            onElegir={abrirVariable}
            onRecargar={revision.recargar}
          />
        )}
        <InspectorDeVariable
          variable={variableEnFoco}
          etiqueta={variableEnFoco ? borrador.etiquetaDe(variableEnFoco) : ""}
          etiquetaDeOpcion={(code) => (variableEnFoco ? borrador.etiquetaDeOpcion(variableEnFoco, code) : "")}
          editables={variableEnFoco ? dataReviewHasEditableOptions(variableEnFoco) : false}
          incluida={variableEnFoco ? !excluidas.has(variableEnFoco.name) : false}
          bloqueada={bloqueadaEnFoco}
          repartida={variableEnFoco ? repartidas.has(variableEnFoco.name) : false}
          seccion={grupoEnFoco ? { id: grupoEnFoco.id, nombre: grupoEnFoco.name } : null}
          secciones={seccionesDePantalla.map((s) => ({ id: s.id, nombre: s.nombre || s.id }))}
          hayCambios={variableEnFoco ? variableTieneCambios(variableEnFoco, borrador.borrador.variableLabels, borrador.borrador.valueLabels, borrador.guardado) : false}
          pendientes={borrador.pendientes}
          onEtiqueta={borrador.setEtiqueta}
          onEtiquetaDeOpcion={borrador.setEtiquetaDeOpcion}
          onSeccion={cambiarSeccion}
          onRestaurar={borrador.restaurar}
          onConfirmar={borrador.confirmar}
          onCerrar={() => abrirVariable(null)}
        />
      </MesaDePestana>
    </div>
  );
}
