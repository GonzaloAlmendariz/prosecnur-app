// Barra de la pestaña Láminas (F6.1, parte 2): sólo lo que cambia la salida o la sigue — informe y alcance, láminas y
// partes, guardado, deshacer, avisos, cobertura, plan sugerido y Exportar como primario único. Lo que era de la era
// ggplot (estilo global, guías como entregable) sale. El menú ⋯ lleva el estilo del cliente (su pestaña), el plan
// portátil (C11) y las secciones JSON (C12) en diálogos propios (decisión 10), y vaciar el plan (C14) con confirmación
// en línea; la lógica vive una sola vez en `../compartir/`. En el informe compartido lo que escribe la base activa queda
// deshabilitado con motivo (decisión 20); vaciar no, porque escribe en el borrador de ese informe.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Archive, FileJson, Layers3, MoreHorizontal, Palette, Redo2, RotateCcw, Undo2 } from "../../../vendor/lucide-react";
import { SaveStatusIndicator } from "../../../components/SaveStatusIndicator";
import { useSession } from "../../../lib/SessionContext";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { ExportarInformeMenu, type ExportarInformeMenuProps } from "../ExportarInformeMenu";
import { modoMultibaseDelPlan } from "../modoMultibase";
import { PANEL_AVISOS_INFORME, PANEL_PLAN_PORTATIL, PANEL_SECCIONES_JSON } from "../panelesGraficos";
import { DialogoCompartir } from "../compartir/DialogoCompartir";
import { itemsCompartirMenu, type ItemCompartirMenu } from "../compartir/menuCompartir";
import { PlanPortatilContenido } from "../compartir/PlanPortatilContenido";
import { SeccionesJsonContenido } from "../compartir/SeccionesJsonContenido";
import { useCompartirPlan } from "../compartir/useCompartirPlan";
import { ConfirmacionVaciar } from "../compartir/ConfirmacionVaciar";
import { itemVaciarMenu, type ItemVaciarMenu } from "../compartir/vaciarPlan";
import { useVaciarPlan } from "../compartir/useVaciarPlan";
import { PlanCoverageBadge } from "../PlanCoverageBadge";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { SuggestedPlanButton } from "../SuggestedPlanButton";
import { usePlanValidator } from "../usePlanValidator";
import { useLaminasUi } from "./laminasStore";
import { useAvisosPlanSesion } from "../avisosPlan";
import { ACCION_RECARGAR_BORRADOR, MENSAJE_CONFLICTO_BORRADOR, recargarBorradorCompartido, useConflictoBorrador } from "../conflictoBorrador";
import { agruparAvisos, rotuloLaminasYPartes, totalAvisos } from "./resumenInforme";
import "./movimiento.css";
import "./barraLaminas.css";

type Props = Omit<ExportarInformeMenuProps, "canExportFinal"> & {
  canExport: boolean;
  /** Sin uso en la barra desde C14: ningún ítem del menú ⋯ manda fuera de Láminas. Queda por compatibilidad del llamador. */
  onIrEditorAnterior?: () => void;
};

const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = esMac ? "⌘" : "Ctrl";

export function BarraLaminas({ canExport, onIrEditorAnterior: _sinUso, ...exportar }: Props) {
  const { state } = useSession();
  const reportScope = useGraficosReportScope(useLocation().search);
  const slides = usePlanStore((s) => s.plan.slides);
  const dirty = usePlanStore((s) => s.dirty);
  const hydrated = usePlanStore((s) => s.hydrated);
  const past = usePlanStore((s) => s.past.length);
  const future = usePlanStore((s) => s.future.length);
  const undo = usePlanStore((s) => s.undo);
  const redo = usePlanStore((s) => s.redo);
  const resumenes = useLaminasUi((s) => s.resumenes);
  const validator = usePlanValidator();
  const avisosPanel = usePanelDireccionable(PANEL_AVISOS_INFORME);
  const planPortatilPanel = usePanelDireccionable(PANEL_PLAN_PORTATIL);
  const seccionesJsonPanel = usePanelDireccionable(PANEL_SECCIONES_JSON);
  const compartir = useCompartirPlan(reportScope);
  const vaciar = useVaciarPlan(reportScope);
  const { irA } = useSeccion("procesamiento");
  const hostRef = useRef<HTMLDivElement>(null);
  const masRef = useRef<HTMLButtonElement>(null);
  // Los diálogos se montan dentro del marco de Gráficos: su cuerpo reusa los estilos del Editor anterior.
  const [marco, setMarco] = useState<HTMLElement | null>(null);
  useEffect(() => { setMarco(hostRef.current?.closest<HTMLElement>(".pulso-graficos-frame") ?? null); }, []);
  // Conflicto de revisión del compartido (A7 H3). El aviso que se anuncia es el toast (`role="alert"`, persistente); la
  // barra lo deja a mano aunque se cierre, sin volver a anunciarlo.
  const enConflicto = useConflictoBorrador((s) => s.conflicto != null);
  const recargando = useConflictoBorrador((s) => s.recargando);

  const ids = useMemo(() => slides.map((s) => s.id), [slides]);
  const titulo = useMemo(() => {
    const portada = slides.find((s) => s.tipo === "p_slide_portada");
    const t = portada?.payload?.titulo;
    return typeof t === "string" && t.trim() ? t.trim() : "Informe";
  }, [slides]);
  const modo = modoMultibaseDelPlan(state?.estudio_processing_mode, state?.n_bases, state?.active_base, reportScope);
  const avisosPlan = useAvisosPlanSesion();
  const grupos = useMemo(() => agruparAvisos(validator.issues, resumenes, ids, avisosPlan), [validator.issues, resumenes, ids, avisosPlan]);
  const nAvisos = totalAvisos(grupos);

  return (
    <div className="pulso-f6-barra-host" ref={hostRef}>
    <div className="pulso-f6-barra" role="toolbar" aria-label="Informe">
      <div className="pulso-f6-barra-id">
        <strong className="pulso-f6-barra-titulo" title={titulo}>{titulo}</strong>
        {modo.visible && (
          <span className={`pulso-f6-barra-alcance is-${modo.clave}`} title={modo.explicacion}>
            <Layers3 size={13} aria-hidden="true" />
            {modo.etiqueta}
            <span className="pulso-sr-only">: {modo.explicacion}</span>
          </span>
        )}
        <span className="pulso-f6-barra-meta pulso-f6-barra-ancho">{rotuloLaminasYPartes(ids, resumenes)}</span>
        {enConflicto ? (
          <span role="group" aria-label="Conflicto del informe compartido" className="pulso-f6-barra-grupo">
            <SaveStatusIndicator state="error" />
            <span className="pulso-sr-only">{MENSAJE_CONFLICTO_BORRADOR}</span>
            <button type="button" className="pulso-f6-boton" title={MENSAJE_CONFLICTO_BORRADOR}
              disabled={recargando} onClick={() => { void recargarBorradorCompartido(); }}>
              {ACCION_RECARGAR_BORRADOR}
            </button>
          </span>
        ) : (
          <span className="pulso-f6-barra-ancho">
            <SaveStatusIndicator state={!hydrated ? "loading" : dirty ? "dirty" : "saved"} savedLabel="Guardado" />
          </span>
        )}
      </div>

      <div className="pulso-f6-barra-acciones">
        <span className="pulso-f6-barra-ancho pulso-f6-barra-grupo">
          <button type="button" className="pulso-f6-icono-boton" onClick={undo} disabled={past === 0}
            aria-label="Deshacer" title={past === 0 ? "Nada que deshacer" : `Deshacer (${MOD}+Z)`}>
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button type="button" className="pulso-f6-icono-boton" onClick={redo} disabled={future === 0}
            aria-label="Rehacer" title={future === 0 ? "Nada que rehacer" : `Rehacer (${MOD}+Shift+Z)`}>
            <Redo2 size={16} aria-hidden="true" />
          </button>
        </span>
        <button
          type="button"
          className={`pulso-f6-boton pulso-f6-barra-avisos${grupos.bloquean.length ? " is-bloquea" : ""}`}
          aria-expanded={avisosPanel.abierto}
          onClick={avisosPanel.alternar}
          title={grupos.bloquean.length ? `${grupos.bloquean.length} bloquean la exportación` : "Avisos del informe"}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          {nAvisos === 1 ? "1 aviso" : `${nAvisos} avisos`}
        </button>
        <span className="pulso-f6-barra-cobertura"><PlanCoverageBadge conNombre /></span>
        <SuggestedPlanButton />
        <ExportarInformeMenu {...exportar} canExportFinal={canExport && validator.canExport} />
        <MenuMas
          undo={{ disabled: past === 0, run: undo }}
          redo={{ disabled: future === 0, run: redo }}
          compartir={itemsCompartirMenu(compartir.disponibilidad).map((it) => ({
            ...it,
            abrir: it.clave === "plan-portatil" ? planPortatilPanel.abrir : seccionesJsonPanel.abrir,
          }))}
          vaciar={{ ...itemVaciarMenu(vaciar.disponibilidad), abrir: vaciar.pedir }}
          onIrEstilo={() => irA("pestana", "estilo")}
          disparadorRef={masRef}
        />
      </div>
    </div>
    {vaciar.pendiente && <ConfirmacionVaciar control={vaciar} retornoRef={masRef} />}
    <span role="status" className="pulso-sr-only">{vaciar.mensaje}</span>
    <DialogoCompartir
      abierto={planPortatilPanel.abierto}
      onCerrar={planPortatilPanel.cerrar}
      panelProps={planPortatilPanel.props}
      clave="f6-plan-portatil"
      titulo="Plan portátil"
      descripcion="Lleva este plan editable a otro proyecto sin mover formulario ni respuestas."
      contenedor={marco}
      retornoRef={masRef}
      mensaje={compartir.estado.mensaje}
      error={compartir.estado.error}
    >
      <PlanPortatilContenido control={compartir} />
    </DialogoCompartir>
    <DialogoCompartir
      abierto={seccionesJsonPanel.abierto}
      onCerrar={seccionesJsonPanel.cerrar}
      panelProps={seccionesJsonPanel.props}
      clave="f6-secciones-json"
      titulo="Exportar o importar secciones"
      descripcion={`Archivo JSON con las partes del plan que elijas · ${compartir.nSecciones} de ${compartir.totalSecciones} incluidas.`}
      contenedor={marco}
      retornoRef={masRef}
      mensaje={compartir.estado.mensaje}
      error={compartir.estado.error}
    >
      <SeccionesJsonContenido control={compartir} />
    </DialogoCompartir>
    </div>
  );
}

type AccionCompartirMenu = ItemCompartirMenu & { abrir: () => void };

/** Índice del próximo ítem enfocable al moverse con flechas, Inicio o Fin; `null` si la tecla no es de navegación. */
export function indiceMenuTrasTecla(tecla: string, actual: number, total: number): number | null {
  if (total === 0) return null;
  switch (tecla) {
    case "ArrowDown": return actual < 0 ? 0 : (actual + 1) % total;
    case "ArrowUp": return actual < 0 ? total - 1 : (actual - 1 + total) % total;
    case "Home": return 0;
    case "End": return total - 1;
    default: return null;
  }
}

function MenuMas({ undo, redo, compartir, vaciar, onIrEstilo, disparadorRef }: {
  undo: { disabled: boolean; run: () => void };
  redo: { disabled: boolean; run: () => void };
  /** Plan portátil (C11) y secciones JSON (C12), cada uno con su panel. */
  compartir: AccionCompartirMenu[];
  /** Vaciar el plan (C14): abre la confirmación en línea, no vacía. */
  vaciar: ItemVaciarMenu & { abrir: () => void };
  /** La pestaña «Estilo del cliente» de Procesamiento > Gráficos. */
  onIrEstilo: () => void;
  disparadorRef: RefObject<HTMLButtonElement>;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    .filter((el) => !el.disabled && getComputedStyle(el).display !== "none");
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      disparadorRef.current?.focus();
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    // Al abrir, el foco entra en el primer ítem disponible (patrón menú: flechas, Inicio, Fin, Escape).
    const marco = requestAnimationFrame(() => items()[0]?.focus());
    return () => {
      cancelAnimationFrame(marco);
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto, disparadorRef]);
  const item = (fn: () => void) => () => { setAbierto(false); fn(); };
  // Un ítem no disponible sigue enfocable (aria-disabled) para que su motivo se lea; activarlo no hace nada.
  const itemCompartir = (accion: { habilitado: boolean; abrir: () => void }) => accion.habilitado
    ? { onClick: item(accion.abrir) }
    : { "aria-disabled": true as const, onClick: () => undefined };
  const navegar = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const lista = items();
    const siguiente = indiceMenuTrasTecla(e.key, lista.indexOf(document.activeElement as HTMLButtonElement), lista.length);
    if (siguiente === null) return;
    e.preventDefault();
    lista[siguiente]?.focus();
  };
  return (
    <div className="pulso-f6-mas" ref={ref}>
      <button ref={disparadorRef} type="button" className="pulso-f6-icono-boton" aria-label="Más acciones" aria-haspopup="menu"
        aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="pulso-f6-mas-menu" role="menu" aria-label="Más acciones" ref={menuRef} onKeyDown={navegar}>
          <button type="button" role="menuitem" className="pulso-f6-solo-compacto-barra" disabled={undo.disabled} onClick={item(undo.run)}>
            <Undo2 size={14} aria-hidden="true" /> Deshacer
          </button>
          <button type="button" role="menuitem" className="pulso-f6-solo-compacto-barra" disabled={redo.disabled} onClick={item(redo.run)}>
            <Redo2 size={14} aria-hidden="true" /> Rehacer
          </button>
          <button type="button" role="menuitem" onClick={item(onIrEstilo)}>
            <Palette size={14} aria-hidden="true" />
            <span>Estilo del cliente<small>Su pestaña: logos y tamaño de letra del cliente</small></span>
          </button>
          {compartir.map((accion) => (
            <button key={accion.clave} type="button" role="menuitem" data-pulso-abre-panel={accion.panel.id} {...itemCompartir(accion)}>
              {accion.clave === "plan-portatil" ? <Archive size={14} aria-hidden="true" /> : <FileJson size={14} aria-hidden="true" />}
              <span>{accion.etiqueta}<small>{accion.detalle}</small></span>
            </button>
          ))}
          <button type="button" role="menuitem" className="pulso-f6-mas-peligro" {...itemCompartir(vaciar)}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>{vaciar.etiqueta}<small>{vaciar.detalle}</small></span>
          </button>
        </div>
      )}
    </div>
  );
}
