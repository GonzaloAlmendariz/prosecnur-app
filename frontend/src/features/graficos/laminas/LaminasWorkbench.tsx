// Pestaña Láminas de Procesamiento › Gráficos (F6.1, parte 1): Estructura · Visor · Inspector.
// Dirección: `/graficos?pestana=laminas&foco=l-07[:g2]&panel=inspector`. `foco` es la fuente de verdad de la lámina
// seleccionada; se refleja en `usePlanStore.select` para que el Editor anterior abra en la misma lámina.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../../lib/SessionContext";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { searchConPanel, searchSinPanel, usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { PANEL_AVISOS_INFORME, PANEL_ESTRUCTURA_LAMINAS, PANEL_INSPECTOR_LAMINA } from "../panelesGraficos";
import { parseGraficosReportScope } from "../reportScope";
import { leerSlideMeta } from "../slideMeta";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { usePlanValidator } from "../usePlanValidator";
import { EstructuraInforme, type MarcaValidacion } from "./EstructuraInforme";
import { InspectorLamina } from "./InspectorLamina";
import { VisorLamina } from "./VisorLamina";
import { TiraMiniaturas } from "./TiraMiniaturas";
import { PanelAvisos } from "./PanelAvisos";
import { EditorAmplio } from "./EditorAmplio";
import { agruparAvisos } from "./resumenInforme";
import { construirEstructura, focoDeLamina, parsearFocoLamina } from "./modeloEstructura";
import { useLaminasUi } from "./laminasStore";
import { reconciliarSeleccion, vecinaAlEliminar } from "./seleccionLamina";
import { esLateral, resolverLateral, type Lateral } from "./lateralLaminas";
import { useAnchoCompacto, useSideoverModal } from "./useSideoverModal";
import { useReencajeLienzo } from "./useReencajeLienzo";
import { AccionesLamina } from "./AccionesLamina";
import { useGraficosLibraries } from "../GraficosLibrariesHost";
import { PANEL_BIBLIOTECA_SLIDES } from "../panelesGraficos";
import { toast } from "../../../components/toasterStore";
import { usePreviewLamina } from "./usePreviewLamina";
import { useRanurasLamina } from "./useRanurasLamina";
import { graficadorDisplayName } from "../graficadorDisplay";
import { firstVariableRefFromGraph } from "../slideAutoTitle";
import { useGraficosRegistry } from "../useGraficosRegistry";
import type { GraficadorRef } from "../../../api/graficos";
import "./movimiento.css";
import "./laminasWorkbench.css";

const panelDe = (l: Lateral) => (l === "estructura" ? PANEL_ESTRUCTURA_LAMINAS : PANEL_INSPECTOR_LAMINA);

type Props = {
  /** Lleva a la pestaña del editor anterior conservando la lámina. */
  onIrEditorAnterior: () => void;
};

export function LaminasWorkbench({ onIrEditorAnterior }: Props) {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const slides = usePlanStore((s) => s.plan.slides);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const select = usePlanStore((s) => s.select);
  const { issues } = usePlanValidator();
  const inspector = usePanelDireccionable(PANEL_INSPECTOR_LAMINA);
  const avisos = usePanelDireccionable(PANEL_AVISOS_INFORME);
  const resumenes = useLaminasUi((s) => s.resumenes);
  const parte = useLaminasUi((s) => s.parte);
  const setParte = useLaminasUi((s) => s.setParte);
  const setSeccion = useLaminasUi((s) => s.setSeccionInspector);
  const lateralPreferido = useLaminasUi((s) => s.lateral);
  const setLateralPreferido = useLaminasUi((s) => s.setLateral);
  const insercion = useLaminasUi((s) => s.insercion);
  const setInsercion = useLaminasUi((s) => s.setInsercion);
  const duplicateSlide = usePlanStore((s) => s.duplicateSlide);
  const moveSlide = usePlanStore((s) => s.moveSlide);
  const moveSlideTo = usePlanStore((s) => s.moveSlideTo);
  const removeSlide = usePlanStore((s) => s.removeSlide);
  const undo = usePlanStore((s) => s.undo);
  const { openSlidesLibrary } = useGraficosLibraries();

  const estructura = useMemo(() => construirEstructura(slides), [slides]);
  const direccion = useSeccion("procesamiento");
  const foco = useMemo(() => parsearFocoLamina(direccion.foco), [direccion.foco]);
  const total = estructura.laminas.length;
  const ids = useMemo(() => slides.map((x) => x.id), [slides]);
  // `foco` (URL) contra `selectedSlideId` (plan): ver seleccionLamina.ts. El foco visto la vez anterior dice si lo que
  // cambió fue la URL (manda ella) o el plan (manda la lámina seleccionada y el foco la sigue).
  const focoVisto = useRef<string | null | undefined>(undefined);
  const reconciliacion = reconciliarSeleccion({
    ids,
    focoPos: foco?.posicion ?? null,
    focoCambio: focoVisto.current !== direccion.foco,
    selectedId: selectedSlideId,
  });
  const posicionSeleccionada = reconciliacion.posicion;
  const lamina = posicionSeleccionada ? estructura.laminas[posicionSeleccionada - 1] : null;
  const slide = lamina ? slides[lamina.posicion - 1] ?? null : null;
  const ranura = foco && foco.posicion === posicionSeleccionada ? foco.ranura : null;

  const escribirFoco = useCallback((valor: string | null) => {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", valor) }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    focoVisto.current = direccion.foco;
    if (reconciliacion.seleccionar) select(reconciliacion.seleccionar);
    if (reconciliacion.escribirFoco && reconciliacion.posicion) escribirFoco(focoDeLamina(reconciliacion.posicion));
  });

  // Lo que la biblioteca inserta (al final del plan) se acomoda detrás de la lámina desde la que se pidió.
  useEffect(() => {
    if (!insercion) return;
    const bibliotecaAbierta = direccion.panel === PANEL_BIBLIOTECA_SLIDES.id;
    const nuevos = ids.filter((id) => !insercion.previos.includes(id));
    if (nuevos.length) {
      let despues = insercion.despuesDe;
      for (const id of nuevos) {
        const destino = usePlanStore.getState().plan.slides.findIndex((x) => x.id === despues) + 1;
        if (destino > 0) moveSlideTo(id, destino);
        despues = id;
      }
      setInsercion({ despuesDe: despues, previos: usePlanStore.getState().plan.slides.map((x) => x.id), vioPanel: insercion.vioPanel || bibliotecaAbierta });
      return;
    }
    if (bibliotecaAbierta && !insercion.vioPanel) setInsercion({ ...insercion, vioPanel: true });
    else if (!bibliotecaAbierta && insercion.vioPanel) setInsercion(null);
  }, [insercion, ids, direccion.panel, moveSlideTo, setInsercion]);

  // Un enlace a una ranura (`foco=l-NN:gK`) abre la sección Gráficos con su tarjeta.
  useEffect(() => { if (ranura !== null) setSeccion("graficos"); }, [ranura, setSeccion]);

  // Cada lámina empieza en su primera parte.
  useEffect(() => { setParte(1); }, [slide?.id, setParte]);

  const irA = useCallback((posicion: number) => {
    if (posicion < 1 || posicion > total) return;
    escribirFoco(focoDeLamina(posicion));
  }, [escribirFoco, total]);

  const prepOk = !!state?.analitica_prep_ok || parseGraficosReportScope(location.search) === "consolidated";
  const vista = usePreviewLamina(slide, lamina?.antetituloHeredado ?? null, prepOk);
  const ranuras = useRanurasLamina(slide);
  const { graficadoresById } = useGraficosRegistry();
  const nombreRanura = useCallback((k: number) => {
    if (!slide) return "";
    const slot = (SLIDE_GRAF_SLOTS[slide.tipo] ?? [])[k - 1];
    const v = slot ? (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined : undefined;
    if (!v?.graficador) return "sin gráfico";
    const variable = firstVariableRefFromGraph(v);
    return `${graficadorDisplayName(v.graficador, graficadoresById[v.graficador])}${variable ? ` · ${variable}` : ""}`;
  }, [slide, graficadoresById]);
  // Estructura ⇄ Inspector (excluyentes): la URL dice cuál, la sesión lo recuerda. Ver lateralLaminas.ts.
  const resolucion = resolverLateral(direccion.panel, lateralPreferido);
  const lateral = resolucion.lateral;
  useEffect(() => {
    if (resolucion.actualizarPreferencia) setLateralPreferido(lateral);
    if (resolucion.escribirEnUrl && lateral) {
      navigate({ pathname: location.pathname, search: searchConPanel(location.search, panelDe(lateral)) }, { replace: true });
    }
  });
  const searchConLateral = useCallback((search: string, l: Lateral | null) => (
    l ? searchConPanel(search, panelDe(l)) : esLateral(direccion.panel) ? searchSinPanel(search, panelDe(direccion.panel)) : search
  ), [direccion.panel]);
  const ponerLateral = useCallback((l: Lateral | null) => {
    setLateralPreferido(l);
    navigate({ pathname: location.pathname, search: searchConLateral(location.search, l) }, { replace: true });
  }, [location.pathname, location.search, navigate, searchConLateral, setLateralPreferido]);
  const alternarLateral = useCallback((l: Lateral) => ponerLateral(lateral === l ? null : l), [lateral, ponerLateral]);

  // Una sola navegación: foco de la ranura y, si hace falta, el inspector abierto (dos `navigate` seguidos se pisan).
  const elegirRanura = useCallback((k: number | null) => {
    if (!lamina) return;
    let search = conNivel(location.search, "foco", focoDeLamina(lamina.posicion, k));
    if (k !== null) {
      setSeccion("graficos");
      setLateralPreferido("inspector");
      search = searchConLateral(search, "inspector");
    }
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [lamina, location.pathname, location.search, navigate, setSeccion, setLateralPreferido, searchConLateral]);

  const hostRef = useRef<HTMLDivElement>(null);
  const marcoInspectorRef = useRef<HTMLDivElement>(null);
  const ajustesRef = useRef<HTMLButtonElement>(null);
  // Bajo 1120 px de contenedor (mismo umbral que el CSS) el inspector se superpone a la lámina: es un diálogo modal.
  const compacto = useAnchoCompacto(hostRef, 1120);
  const inspectorModal = compacto && lateral === "inspector";
  const cerrarInspector = useCallback(() => ponerLateral(null), [ponerLateral]);
  useSideoverModal({ activo: inspectorModal, contenedor: marcoInspectorRef, retorno: ajustesRef, onCerrar: cerrarInspector });
  // El lienzo se re-encaja con FLIP cuando un lateral entra o sale (contrato de movimiento F6, M11).
  useReencajeLienzo(hostRef, lateral ?? "");

  // Cmd/Ctrl+1 alterna la Estructura; Cmd/Ctrl+. los Ajustes.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key === ".") { e.preventDefault(); alternarLateral("inspector"); }
      else if (e.key === "1") { e.preventDefault(); alternarLateral("estructura"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alternarLateral]);

  const validacion = useMemo(() => {
    const m: Record<string, MarcaValidacion> = {};
    for (const i of issues) {
      if (!i.slideId) continue;
      if (i.severity === "error") m[i.slideId] = "error";
      else if (!m[i.slideId]) m[i.slideId] = "warning";
    }
    return m;
  }, [issues]);

  const grupos = useMemo(() => agruparAvisos(issues, resumenes, slides.map((x) => x.id)), [issues, resumenes, slides]);

  if (!lamina || !slide) {
    return (
      <div className="pulso-f6-laminas-host">
      <div className="pulso-f6-laminas is-vacia" data-qa-surface="graficos/f6-laminas">
        <EstructuraInforme onCerrar={() => undefined} estructura={estructura} posicionActiva={null} onSeleccionar={irA} validacion={validacion} />
        <div className="pulso-f6-vacio-informe" role="status">
          <strong>El informe todavía no tiene láminas</strong>
          <p>Arma el plan desde el Editor anterior o con un plan sugerido; aquí verás cada lámina tal como sale.</p>
          <button type="button" className="pulso-f6-boton" onClick={onIrEditorAnterior}>Ir al Editor anterior</button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="pulso-f6-laminas-host" ref={hostRef}>
    <div
      className={`pulso-f6-laminas${lateral === "inspector" ? " is-inspector-abierto" : ""}${lateral === "estructura" ? "" : " is-sin-estructura"}${lateral === "inspector" ? "" : " is-sin-inspector"}`}
      data-qa-surface="graficos/f6-laminas"
    >
      <EstructuraInforme
        onCerrar={() => ponerLateral(null)}
        acciones={(
          <AccionesLamina
            posicion={lamina.posicion}
            total={total}
            onInsertar={() => {
              setInsercion({ despuesDe: slide.id, previos: ids, vioPanel: false });
              openSlidesLibrary();
            }}
            onDuplicar={() => duplicateSlide(slide.id)}
            onMover={(dir) => moveSlide(slide.id, dir)}
            onEliminar={() => {
              const vecina = vecinaAlEliminar(ids, slide.id);
              removeSlide(slide.id);
              if (vecina) select(vecina);
              toast.aviso(`Lámina ${lamina.posicion} eliminada`, {
                detalle: lamina.titulo,
                accion: { label: "Deshacer", onSelect: undo },
              });
            }}
          />
        )}
        estructura={estructura}
        posicionActiva={posicionSeleccionada}
        onSeleccionar={irA}
        validacion={validacion}
      />
      <VisorLamina
        lamina={lamina}
        total={total}
        vista={vista}
        prepOk={prepOk}
        parte={parte}
        onParte={setParte}
        onIr={irA}
        motorNativoApagado={leerSlideMeta(slide).motor_nativo === false}
        onAbrirAjustes={() => alternarLateral("inspector")}
        ajustesAbiertos={lateral === "inspector"}
        ajustesRef={ajustesRef}
        estructuraAbierta={lateral === "estructura"}
        onAlternarEstructura={() => alternarLateral("estructura")}
        onVerAvisos={() => { setSeccion("estado"); ponerLateral("inspector"); }}
        ranuras={ranuras}
        ranuraActiva={ranura}
        nombreRanura={nombreRanura}
        onRanura={elegirRanura}
        tira={<TiraMiniaturas estructura={estructura} posicionActiva={lamina.posicion} onIr={irA} />}
      />
      <div
        ref={marcoInspectorRef}
        className="pulso-f6-inspector-marco"
        {...inspector.props}
        {...(inspectorModal ? { role: "dialog", "aria-modal": true, "aria-labelledby": "pulso-f6-inspector-titulo" } : {})}
        tabIndex={-1}
      >
        <InspectorLamina
          slide={slide}
          lamina={lamina}
          ranura={ranura}
          onRanura={(r) => escribirFoco(focoDeLamina(lamina.posicion, r))}
          visor={vista.lamina}
          onCerrar={cerrarInspector}
          onIrEditorAnterior={onIrEditorAnterior}
        />
      </div>
      <EditorAmplio />
      {avisos.abierto && <PanelAvisos panel={avisos} grupos={grupos} estructura={estructura} onIr={irA} />}
      {inspectorModal && (
        <button type="button" className="pulso-f6-velo pulso-f6-solo-compacto" aria-label="Cerrar ajustes" tabIndex={-1} onClick={cerrarInspector} />
      )}
    </div>
    </div>
  );
}
