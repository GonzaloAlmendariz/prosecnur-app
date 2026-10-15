// Panel «Avisos del informe» (`panel=avisos`, sideover) de la pestaña Láminas (F6.1, parte 2). Separa lo que bloquea
// la exportación (errores del validador del plan) de lo que conviene revisar y de lo que dijo el motor en las láminas
// ya vistas. Cada aviso con lámina lleva a ella.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { X } from "../../../vendor/lucide-react";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import type { ValidationIssue } from "../usePlanValidator";
import type { EstructuraInforme } from "./modeloEstructura";
import type { GrupoAvisos } from "./resumenInforme";
import { capaVisibleFuera, destinoDelFoco, escucharEscape } from "./cierreConEscape";
import { useAvisosPlan } from "../avisosPlan";
import { useAvisosExportacion } from "../avisosExportacion/avisosExportacionStore";
import { agruparAvisos as agruparPorLamina, type GrupoAvisos as GrupoPorLamina } from "../avisosExportacion/avisosExportacionModel";
import "../avisosExportacion/avisosExportacion.css";
import { enfocarSinDesplazar } from "./enfocarSinDesplazar";
import "./panelAvisos.css";

type Props = {
  panel: ControlPanel;
  grupos: GrupoAvisos;
  estructura: EstructuraInforme;
  onIr: (posicion: number) => void;
  /** Se abrió desde una capa que se cierra al abrirlo (el Inspector modal): el foco entra al panel. */
  enfocarAlAbrir?: boolean;
  /** Láminas con respuestas sin color (bloquean «Exportar») y cómo completarlas; ausente, no se muestra. */
  coloresPendientes?: { laminas: number; completar: () => void };
};

export function PanelAvisos({ panel, grupos, estructura, onIr, enfocarAlAbrir = false, coloresPendientes }: Props) {
  // Quién lo abrió (la barra o el visor): al cerrar, el foco vuelve ahí; si ya no existe, a «N avisos» de la barra.
  const disparadorRef = useRef<HTMLElement | null>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const enfocarInicial = useRef(enfocarAlAbrir);
  useEffect(() => {
    const activo = document.activeElement;
    disparadorRef.current = activo instanceof HTMLElement && activo !== document.body ? activo : null;
    if (!enfocarInicial.current) return;
    // preventScroll: enfocar «Cerrar avisos» corría `.pulso-f6-laminas` 250 px a 1024×600 (C2/C4, verificador frontend-3).
    const marco = requestAnimationFrame(() => enfocarSinDesplazar(cerrarRef.current));
    return () => cancelAnimationFrame(marco);
  }, []);
  const cerrarPanel = panel.cerrar;
  const cerrar = useCallback(() => {
    cerrarPanel();
    requestAnimationFrame(() => {
      enfocarSinDesplazar(destinoDelFoco(disparadorRef.current, document.querySelector<HTMLElement>(".pulso-f6-barra-avisos")));
    });
  }, [cerrarPanel]);
  // Escape en el documento: abrir el panel no le pasa el foco, así que un onKeyDown en su raíz no lo oía (D5).
  const raizRef = useRef<HTMLElement>(null);
  useEffect(() => escucharEscape(document, cerrar, () => capaVisibleFuera(document, raizRef.current)), [cerrar]);

  // Abrir el panel con los cambios del plan a la vista los da por vistos: el toast de Gráficos ya no vuelve.
  const marcarVistos = useAvisosPlan((s) => s.marcarVisto);
  const hayPlan = grupos.plan.length > 0;
  useEffect(() => { if (hayPlan) marcarVistos(); }, [hayPlan, marcarVistos]);

  // Los colores que faltan bloquean el menú «Exportar»: el panel lo dice también, para no contradecirlo
  // («Nada bloquea la exportación» mientras el menú no dejaba exportar; catálogo del recetario, 2026-10-14).
  const laminasSinColor = coloresPendientes?.laminas ?? 0;
  const previos = useAvisosExportacion((st) => st.previos);
  const ultimos = useAvisosExportacion((st) => st.motor);
  const posicionDe = useMemo(() => new Map(estructura.laminas.map((l) => [l.id, l.posicion])), [estructura]);
  const ir = (slideId: string | undefined) => {
    const p = slideId ? posicionDe.get(slideId) : undefined;
    if (p) onIr(p);
  };
  const fila = (i: ValidationIssue, k: number) => (
    <li key={`${i.code}-${i.slideId ?? ""}-${i.slotName ?? ""}-${k}`}>
      <span>{i.message}</span>
      {i.slideId && posicionDe.has(i.slideId) && (
        <button type="button" className="pulso-f6-texto-boton" onClick={() => ir(i.slideId)}>
          Lámina {posicionDe.get(i.slideId)}
        </button>
      )}
    </li>
  );

  return (
    <aside
      ref={raizRef}
      className="pulso-f6-avisos-panel"
      aria-label="Avisos del informe"
      {...panel.props}
    >
      <header className="pulso-f6-col-head">
        <h2>Avisos del informe</h2>
        <span className="pulso-f6-col-sp" />
        <button type="button" ref={cerrarRef} className="pulso-f6-icono-boton" aria-label="Cerrar avisos" onClick={cerrar}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="pulso-f6-avisos-cuerpo" data-qa-geometry-group="graficos/f6-avisos-grupos" data-qa-geometry-contract="intrinsic">
        {grupos.plan.length > 0 && (
          <section className="pulso-f6-avisos-grupo" aria-label="Cambios al abrir el plan">
            <h3>Cambios al abrir el plan <span>{grupos.plan.length}</span></h3>
            <ul data-qa-geometry-group="graficos/f6-avisos-plan" data-qa-geometry-contract="intrinsic">
              {grupos.plan.map((a) => <li key={a}><span>{a}</span></li>)}
            </ul>
          </section>
        )}
        {grupos.equivalencias.length > 0 && (
          <section className="pulso-f6-avisos-grupo" aria-label="Equivalencias entre bases">
            <h3>Equivalencias entre bases <span>{grupos.equivalencias.length}</span></h3>
            <ul data-qa-geometry-group="graficos/f6-avisos-equivalencias" data-qa-geometry-contract="intrinsic">
              {grupos.equivalencias.map((a) => <li key={a}><span>{a}</span></li>)}
            </ul>
          </section>
        )}
        <section className="pulso-f6-avisos-grupo is-bloquea" aria-label="Bloquean la exportación">
          <h3>Bloquean la exportación <span>{grupos.bloquean.length + (laminasSinColor ? 1 : 0)}</span></h3>
          {grupos.bloquean.length || laminasSinColor ? (
            <ul data-qa-geometry-group="graficos/f6-avisos-bloquean" data-qa-geometry-contract="intrinsic">
              {laminasSinColor ? (
                <li>
                  <span>Faltan colores en {laminasSinColor === 1 ? "1 lámina" : `${laminasSinColor} láminas`}: esos gráficos pintan cada respuesta con su color.</span>
                  <button type="button" className="pulso-f6-texto-boton" onClick={coloresPendientes?.completar}>Completar todos los colores</button>
                </li>
              ) : null}
              {grupos.bloquean.map(fila)}
            </ul>
          ) : <p>Nada bloquea la exportación.</p>}
        </section>
        <section className="pulso-f6-avisos-grupo" aria-label="Conviene revisar">
          <h3>Conviene revisar <span>{grupos.revisar.length}</span></h3>
          {grupos.revisar.length ? <ul data-qa-geometry-group="graficos/f6-avisos-revisar" data-qa-geometry-contract="intrinsic">{grupos.revisar.map(fila)}</ul> : <p>Sin advertencias del plan.</p>}
        </section>
        <ListaPorLamina titulo="Antes de exportar" grupos={agruparPorLamina(previos)} geometria="graficos/f6-avisos-previos" />
        <ListaPorLamina titulo="Última exportación" grupos={agruparPorLamina(ultimos)} geometria="graficos/f6-avisos-ultima" />
        <section className="pulso-f6-avisos-grupo" aria-label="Avisos del motor">
          <h3>Avisos del motor <span>{grupos.motor.reduce((t, m) => t + m.avisos.length, 0)}</span></h3>
          {grupos.motor.length ? (
            <ul data-qa-geometry-group="graficos/f6-avisos-motor" data-qa-geometry-contract="intrinsic">
              {grupos.motor.flatMap((m) => m.avisos.map((a, k) => (
                <li key={`${m.slideId}-${k}`}>
                  <span>{a}</span>
                  <button type="button" className="pulso-f6-texto-boton" onClick={() => ir(m.slideId)}>
                    Lámina {posicionDe.get(m.slideId)}
                  </button>
                </li>
              )))}
            </ul>
          ) : (
            <p>El motor avisa al generar cada lámina; aparecen aquí las de las láminas ya vistas.</p>
          )}
        </section>
      </div>
    </aside>
  );
}

/** Avisos de la validación previa o de la última exportación, por lámina; sin avisos no ocupa lugar. */
function ListaPorLamina({ titulo, grupos, geometria }: { titulo: string; grupos: GrupoPorLamina[]; geometria: string }) {
  if (!grupos.length) return null;
  const total = grupos.reduce((t, g) => t + g.detalles.length, 0);
  return (
    <section className="pulso-f6-avisos-grupo" aria-label={titulo}>
      <h3>{titulo} <span>{total}</span></h3>
      <ul data-qa-geometry-group={geometria} data-qa-geometry-contract="intrinsic">
        {grupos.map((g) => (
          <li key={g.clave} className="pulso-avexp-panel-item">
            <span className="pulso-avexp-panel-lamina">{g.lamina ? `Lámina ${g.lamina}${g.titulo ? `, ${g.titulo}` : ""}` : "Informe"}</span>
            <ul className="pulso-avexp-panel-detalles">{g.detalles.map((d) => <li key={d}>{d}</li>)}</ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
