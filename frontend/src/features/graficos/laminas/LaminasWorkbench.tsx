// Pestaña Láminas de Procesamiento › Gráficos (F6.1, parte 1): Estructura · Visor · Inspector.
// Dirección: `/graficos?pestana=laminas&foco=<slide.id>[:g2]&panel=inspector` (`../focoLamina.ts`; el heredado `l-07` se
// lee y se reescribe al id). `foco` es la fuente de verdad de la lámina
// seleccionada; se refleja en `usePlanStore.select` para que el Editor anterior abra en la misma lámina.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../../lib/SessionContext";
import { useAvisosPlanSesion } from "../avisosPlan";
import { useDeclaracionAplicada } from "../useDeclaracionAplicada";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { searchConPanel, searchSinPanel, usePanelDireccionable, type PanelDeclarado } from "../../../lib/navegacion/paneles";
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
import { useColoresPendientes } from "../estilo/ColoresPendientesAviso";
import { useFijarBase } from "../useFijarBase";
import { EditorAmplio } from "./EditorAmplio";
import { agruparAvisos } from "./resumenInforme";
import { construirEstructura } from "./modeloEstructura";
import { tituloQueSale } from "./tituloQueSale";
import { useVariables } from "../useVariables";
import { focoDeId, resolverFocoLamina } from "../focoLamina";
import { useLaminasUi } from "./laminasStore";
import { reconciliarSeleccion, vecinaAlEliminar } from "./seleccionLamina";
import { esLateral, resolverLateral, type Lateral } from "./lateralLaminas";
import { useAnchoCompacto, useSideoverModal } from "./useSideoverModal";
import { useReencajeLienzo } from "./useReencajeLienzo";
import { AccionesLamina } from "./AccionesLamina";
import { enfocarBusquedaEstructura, useAtajosLaminas } from "./useAtajosLaminas";
import { BotonArmarDesdeVacio } from "../armarDesde/BotonArmarDesdeVacio";
import { toast } from "../../../components/toasterStore";
import { SelectorTipoLamina } from "./selectores/SelectorTipoLamina";
import { SelectorTipoGrafico } from "./selectores/SelectorTipoGrafico";
import { esPanelSelector, PANEL_TIPO_GRAFICO, PANEL_TIPO_LAMINA } from "./selectores/panelesSelectores";
import { useSelectoresUi, type ModoSelectorLamina } from "./selectores/selectoresStore";
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
  /** Sin uso desde el retiro del Editor anterior; se acepta para no romper llamadores. */
  onIrEditorAnterior?: () => void;
};

export function LaminasWorkbench({ onIrEditorAnterior }: Props) {
  const { state } = useSession();
  // Lo que el backend cambió en el plan al abrirlo (población antigua migrada) va al canal de Avisos (ver avisosPlan.ts).
  const avisosPlan = useAvisosPlanSesion();
  // Desfase de la declaración aplicada y avisos de la siembra del compartido (ADR 0096 decisión 8): grupo propio en Avisos.
  const { avisos: avisosEquivalencias } = useDeclaracionAplicada();
  const location = useLocation();
  const navigate = useNavigate();
  const slides = usePlanStore((s) => s.plan.slides);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const select = usePlanStore((s) => s.select);
  const { issues } = usePlanValidator();
  const inspector = usePanelDireccionable(PANEL_INSPECTOR_LAMINA);
  const avisos = usePanelDireccionable(PANEL_AVISOS_INFORME);
  const colores = useColoresPendientes();
  const coloresPendientes = { laminas: new Set(colores.pendientes.map((p) => p.slideId)).size, completar: colores.completar };
  const baseImplicita = useFijarBase();
  const resumenes = useLaminasUi((s) => s.resumenes);
  const parte = useLaminasUi((s) => s.parte);
  const setParte = useLaminasUi((s) => s.setParte);
  const setSeccion = useLaminasUi((s) => s.setSeccionInspector);
  const lateralPreferido = useLaminasUi((s) => s.lateral);
  const setLateralPreferido = useLaminasUi((s) => s.setLateral);
  const duplicateSlide = usePlanStore((s) => s.duplicateSlide);
  const moveSlide = usePlanStore((s) => s.moveSlide);
  const removeSlide = usePlanStore((s) => s.removeSlide);
  const undo = usePlanStore((s) => s.undo);

  const { variables } = useVariables();
  // Un mismo título en la tira, el visor y la Estructura: el que va a salir (G15/U13).
  const estructura = useMemo(() => construirEstructura(slides, (sl, tipoLabel) => tituloQueSale(sl, variables, tipoLabel)), [slides, variables]);
  const direccion = useSeccion("procesamiento");
  const foco = useMemo(() => resolverFocoLamina(direccion.foco, slides), [direccion.foco, slides]);
  const total = estructura.laminas.length;
  const ids = useMemo(() => slides.map((x) => x.id), [slides]);
  // `foco` (URL) contra `selectedSlideId` (plan): ver seleccionLamina.ts. El foco visto la vez anterior dice si lo que
  // cambió fue la URL (manda ella) o el plan (manda la lámina seleccionada y el foco la sigue).
  const focoVisto = useRef<string | null | undefined>(undefined);
  const reconciliacion = reconciliarSeleccion({
    ids,
    focoId: foco?.id ?? null,
    focoHeredado: foco?.heredado ?? false,
    focoCambio: focoVisto.current !== direccion.foco,
    selectedId: selectedSlideId,
  });
  const posicionSeleccionada = reconciliacion.posicion;
  const lamina = posicionSeleccionada ? estructura.laminas[posicionSeleccionada - 1] : null;
  const slide = lamina ? slides[lamina.posicion - 1] ?? null : null;
  const ranura = foco && foco.id === lamina?.id ? foco.ranura : null;

  const escribirFoco = useCallback((valor: string | null) => {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", valor) }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // El `foco` cuenta como visto sólo con el plan cargado: un enlace (`l-13` o un id) que llega antes que las láminas
  // sigue mandando cuando éstas llegan, en vez de perder contra la primera que `loadPlan` deja seleccionada.
  useEffect(() => {
    if (ids.length) focoVisto.current = direccion.foco;
    if (reconciliacion.seleccionar) select(reconciliacion.seleccionar);
    const mostrada = reconciliacion.posicion ? ids[reconciliacion.posicion - 1] : undefined;
    if (reconciliacion.escribirFoco && mostrada) escribirFoco(focoDeId(mostrada, foco?.id === mostrada ? foco.ranura : null));
  });

  // Los hijos (estructura, tira, visor, avisos, selectores) hablan en posiciones del plan vigente; la URL, en ids. Se
  // traduce al navegar con el plan del store en ese instante (un selector que acaba de insertar ya lo ve).
  const focoDePosicion = useCallback((posicion: number, k?: number | null): string | null => {
    const id = usePlanStore.getState().plan.slides[posicion - 1]?.id;
    return id ? focoDeId(id, k ?? null) : null;
  }, []);

  // Un enlace a una ranura (`foco=l-NN:gK`) abre la sección Gráficos con su tarjeta.
  useEffect(() => { if (ranura !== null) setSeccion("graficos"); }, [ranura, setSeccion]);

  // Cada lámina empieza en su primera parte.
  useEffect(() => { setParte(1); }, [slide?.id, setParte]);

  const irA = useCallback((posicion: number) => {
    if (posicion < 1 || posicion > total) return;
    escribirFoco(focoDePosicion(posicion));
  }, [escribirFoco, focoDePosicion, total]);

  const prepOk = !!state?.analitica_prep_ok || parseGraficosReportScope(location.search) === "consolidated";
  // Por defecto el visor muestra la maqueta (cambiar un título o un gráfico se ve al instante, sin dibujar nada); la vista
  // previa del motor sólo corre con «Previsualizar» activo.
  const verComoQueda = useLaminasUi((s) => s.verComoQueda);
  const alternarComoQueda = useLaminasUi((s) => s.alternarComoQueda);
  const vista = usePreviewLamina(slide, lamina?.antetituloHeredado ?? null, prepOk && verComoQueda);
  const ranuras = useRanurasLamina(slide);
  const { graficadoresById } = useGraficosRegistry();
  const nombreRanura = useCallback((k: number) => {
    if (!slide) return "";
    const slot = (SLIDE_GRAF_SLOTS[slide.tipo] ?? [])[k - 1];
    const v = slot ? (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined : undefined;
    if (!v?.graficador) return "sin gráfico";
    const variable = firstVariableRefFromGraph(v);
    return `${graficadorDisplayName(v.graficador, graficadoresById[v.graficador])}${variable ? `, ${variable}` : ""}`;
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

  // Selectores de tipo (F6.2): abren sobre el lateral (que sigue en la sesión) y cierran en UNA navegación que quita el
  // panel, deja el foco en la lámina o ranura resultante y repone el lateral: dos `navigate` seguidos se pisan.
  const panelSelector = esPanelSelector(direccion.panel);
  const abrirSelectorLamina = useCallback((modo: ModoSelectorLamina) => {
    useSelectoresUi.getState().prepararLamina(modo);
    navigate({ pathname: location.pathname, search: searchConPanel(location.search, PANEL_TIPO_LAMINA) }, { replace: true });
  }, [location.pathname, location.search, navigate]);
  const abrirSelectorGrafico = useCallback((k: number) => {
    if (!lamina) return;
    useSelectoresUi.getState().prepararGrafico();
    setSeccion("graficos");
    const search = searchConPanel(conNivel(location.search, "foco", focoDeId(lamina.id, k)), PANEL_TIPO_GRAFICO);
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [lamina, location.pathname, location.search, navigate, setSeccion]);
  const cerrarSelector = useCallback((panel: PanelDeclarado, posicion?: number, k?: number | null) => {
    let search = searchSinPanel(location.search, panel);
    const valor = posicion !== undefined ? focoDePosicion(posicion, k) : null;
    if (valor) search = conNivel(search, "foco", valor);
    if (lateralPreferido) search = searchConPanel(search, panelDe(lateralPreferido));
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [focoDePosicion, lateralPreferido, location.pathname, location.search, navigate]);
  const cerrarSelectorLamina = useCallback((posicion?: number) => cerrarSelector(PANEL_TIPO_LAMINA, posicion), [cerrarSelector]);
  const cerrarSelectorGrafico = useCallback((posicion?: number, k?: number | null) => cerrarSelector(PANEL_TIPO_GRAFICO, posicion, k), [cerrarSelector]);

  // Una sola navegación: foco de la ranura y, si hace falta, el inspector abierto (dos `navigate` seguidos se pisan).
  const elegirRanura = useCallback((k: number | null) => {
    if (!lamina) return;
    let search = conNivel(location.search, "foco", focoDeId(lamina.id, k));
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
  // Con un selector abierto, su diálogo es el modal: el inspector suelta su trampa de foco y su Escape.
  const inspectorModal = compacto && lateral === "inspector" && !panelSelector;
  const cerrarInspector = useCallback(() => ponerLateral(null), [ponerLateral]);
  // La X y el velo cierran por la misma vía que Escape: el foco vuelve a «Ajustes» (D2).
  const cerrarInspectorConFoco = useSideoverModal({ activo: inspectorModal, contenedor: marcoInspectorRef, retorno: ajustesRef, onCerrar: cerrarInspector });
  // Avisos e Inspector comparten el slot `panel`: abrir Avisos con el Inspector modal encima lo cierra (si no, Avisos
  // quedaba sobre él con el foco atrapado abajo) y el foco pasa a Avisos.
  const avisosDesdeModal = avisos.abierto && inspectorModal;
  useEffect(() => {
    if (avisosDesdeModal) setLateralPreferido(null);
  }, [avisosDesdeModal, setLateralPreferido]);
  // El lienzo se re-encaja con FLIP cuando un lateral entra o sale (contrato de movimiento F6, M11).
  useReencajeLienzo(hostRef, lateral ?? "");

  // Cmd/Ctrl+1 alterna la Estructura; Cmd/Ctrl+. los Ajustes.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (panelSelector || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key === ".") { e.preventDefault(); alternarLateral("inspector"); }
      else if (e.key === "1") { e.preventDefault(); alternarLateral("estructura"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alternarLateral, panelSelector]);

  // J/K, Alt+↑/↓ y «/» (C21). Consumen la tecla antes de que la vea `useShortcutsV2`: ver useAtajosLaminas.ts.
  useAtajosLaminas({
    activo: !panelSelector,
    posicion: posicionSeleccionada,
    total,
    onIr: irA,
    onMover: (dir) => { if (slide) moveSlide(slide.id, dir); },
    onBuscar: () => {
      if (lateral !== "estructura" && lamina) ponerLateral("estructura");
      enfocarBusquedaEstructura();
    },
  });

  const validacion = useMemo(() => {
    const m: Record<string, MarcaValidacion> = {};
    for (const i of issues) {
      if (!i.slideId) continue;
      if (i.severity === "error") m[i.slideId] = "error";
      else if (!m[i.slideId]) m[i.slideId] = "warning";
    }
    return m;
  }, [issues]);

  const grupos = useMemo(() => agruparAvisos(issues, resumenes, slides.map((x) => x.id), avisosPlan, avisosEquivalencias), [issues, resumenes, slides, avisosPlan, avisosEquivalencias]);

  if (!lamina || !slide) {
    return (
      <div className="pulso-f6-laminas-host">
      <div className="pulso-f6-laminas is-vacia" data-qa-surface="graficos/f6-laminas">
        <EstructuraInforme onCerrar={() => undefined} estructura={estructura} posicionActiva={null} onSeleccionar={irA} validacion={validacion} />
        <div className="pulso-f6-vacio-informe" role="status">
          <strong>El informe todavía no tiene láminas</strong>
          <p>Inserta la primera lámina o arma el informe desde un plan sugerido; aquí verás cada lámina tal como sale.</p>
          <div className="pulso-f6-vacio-acciones">
            <button type="button" className="pulso-f6-boton" onClick={() => abrirSelectorLamina("insertar")}>Insertar la primera lámina</button>
            <BotonArmarDesdeVacio />
          </div>
        </div>
      </div>
      {avisos.abierto && <PanelAvisos panel={avisos} grupos={grupos} estructura={estructura} onIr={irA} coloresPendientes={coloresPendientes} baseImplicita={baseImplicita} />}
      <SelectorTipoLamina slide={null} posicion={null} cerrar={cerrarSelectorLamina} />
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
            onInsertar={() => abrirSelectorLamina("insertar")}
            onDuplicar={() => duplicateSlide(slide.id)}
            onMover={(dir) => moveSlide(slide.id, dir)}
            onEliminar={() => {
              const vecina = vecinaAlEliminar(ids, slide.id);
              removeSlide(slide.id);
              if (vecina) select(vecina);
              toast.aviso(`Lámina ${lamina.posicion} eliminada`, {
                detalle: lamina.titulo,
                // Deshacer devuelve la selección a la lámina restaurada, no a la vecina que la sustituyó.
                accion: { label: "Deshacer", onSelect: () => {
                  undo();
                  if (usePlanStore.getState().plan.slides.some((x) => x.id === slide.id)) select(slide.id);
                } },
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
        slide={slide}
        verComoQueda={verComoQueda}
        onAlternarComoQueda={alternarComoQueda}
        onTexto={(campo) => {
          // Como un clic en un gráfico abre su tarjeta: el texto abre su campo en Contenido, ya enfocado.
          setSeccion("contenido");
          ponerLateral("inspector");
          window.setTimeout(() => {
            const nombres = campo === "base" ? ["base", "nota", "pie"] : [campo];
            for (const n of nombres) {
              const el = document.querySelector<HTMLElement>(`#pulso-f6-inspector [data-campo="${n}"]`);
              if (el) { el.focus(); el.scrollIntoView({ block: "nearest" }); return; }
            }
          }, 60);
        }}
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
        onCambiarGrafico={abrirSelectorGrafico}
        onInsertarLamina={() => abrirSelectorLamina("insertar")}
        formas={vista.formas}
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
          onRanura={(r) => escribirFoco(focoDeId(lamina.id, r))}
          visor={vista.lamina}
          onCerrar={cerrarInspectorConFoco}
          onIrEditorAnterior={onIrEditorAnterior}
          onCambiarLamina={() => abrirSelectorLamina("cambiar")}
          onCambiarGrafico={abrirSelectorGrafico}
        />
      </div>
      <EditorAmplio />
      {avisos.abierto && <PanelAvisos panel={avisos} grupos={grupos} estructura={estructura} onIr={irA} enfocarAlAbrir={inspectorModal} coloresPendientes={coloresPendientes} baseImplicita={baseImplicita} />}
      {inspectorModal && (
        <button type="button" className="pulso-f6-velo pulso-f6-solo-compacto" aria-label="Cerrar ajustes" tabIndex={-1} onClick={cerrarInspectorConFoco} />
      )}
    </div>
    <SelectorTipoLamina slide={slide} posicion={lamina.posicion} cerrar={cerrarSelectorLamina} />
    <SelectorTipoGrafico slide={slide} posicion={lamina.posicion} ranura={ranura} cerrar={cerrarSelectorGrafico} />
    </div>
  );
}
