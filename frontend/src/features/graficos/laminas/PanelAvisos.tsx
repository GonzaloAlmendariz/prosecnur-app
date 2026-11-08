// Panel «Avisos del informe» (`panel=avisos`, sideover) de la pestaña Láminas (F6.1, parte 2). Separa lo que bloquea
// la exportación (errores del validador del plan) de lo que conviene revisar y de lo que dijo el motor en las láminas
// ya vistas. Cada aviso con lámina lleva a ella.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { CornerDownLeft } from "../../../vendor/lucide-react";
import { CabeceraPanel } from "../../../components/CabeceraPanel";
import { PulsoButton } from "../../../components/PulsoButton";
import { BotonConTecla } from "./BotonConTecla";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import type { ValidationIssue } from "../usePlanValidator";
import type { EstructuraInforme } from "./modeloEstructura";
import { avisoConLaminaActual, type GrupoAvisos } from "./resumenInforme";
import { capaVisibleFuera, destinoDelFoco, escucharEscape } from "./cierreConEscape";
import { useAvisosPlan } from "../avisosPlan";
import { useAvisosExportacion } from "../avisosExportacion/avisosExportacionStore";
import { agruparAvisos as agruparPorLamina, type GrupoAvisos as GrupoPorLamina } from "../avisosExportacion/avisosExportacionModel";
import "../avisosExportacion/avisosExportacion.css";
import { enfocarSinDesplazar } from "./enfocarSinDesplazar";
import { laBase } from "../relacionBases";
import { MOTIVO_COLORES_PENDIENTES } from "../exportarInformeRegla";
import "./panelAvisos.css";
import { formatoConteo } from "../../../lib/formatoNumero";

type Props = {
  panel: ControlPanel;
  grupos: GrupoAvisos;
  estructura: EstructuraInforme;
  onIr: (posicion: number) => void;
  /** Se abrió desde una capa que se cierra al abrirlo (el Inspector modal): el foco entra al panel. */
  enfocarAlAbrir?: boolean;
  /** Láminas con respuestas sin color (bloquean «Exportar», P8) y cómo completarlas; ausente, no se muestra. */
  coloresPendientes?: { laminas: number; completar: () => void };
  /**
   * Preguntas que el motor lee de una base sin que el plan lo diga (`var-base-implicita`) y cómo dejarlo escrito en
   * todas (fijarBase.ts). Presente, sus avisos se juntan en una fila con la acción; ausente, se listan uno por uno.
   */
  baseImplicita?: { laminas: number; preguntas: number; base: string; fijar: () => void };
  /** Láminas con título editable y sin título escrito, y cómo ir a la siguiente con su campo abierto (hallazgo 12). */
  sinTitulo?: { cuantas: number; siguiente: () => void };
};

export function PanelAvisos({ panel, grupos, estructura, onIr, enfocarAlAbrir = false, coloresPendientes, baseImplicita, sinTitulo }: Props) {
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

  // Los colores que faltan bloquean «Exportar» (P8, exportarInformeRegla.ts): el panel lo dice con el mismo motivo y el
  // mismo arreglo en un clic que el menú, para no contradecirlo (U9).
  const laminasSinColor = coloresPendientes?.laminas ?? 0;
  const previos = useAvisosExportacion((st) => st.previos);
  const ultimos = useAvisosExportacion((st) => st.motor);
  const posicionDe = useMemo(() => new Map(estructura.laminas.map((l) => [l.id, l.posicion])), [estructura]);
  const ir = (slideId: string | undefined) => {
    const p = slideId ? posicionDe.get(slideId) : undefined;
    if (p) onIr(p);
  };
  // 117 avisos casi iguales en CCSS: con la acción masiva a mano, una sola fila los resume (el detalle sigue en cada lámina).
  const juntarBase = !!baseImplicita && baseImplicita.laminas > 0;
  const revisar = juntarBase ? grupos.revisar.filter((i) => i.code !== "var-base-implicita") : grupos.revisar;
  const totalRevisar = revisar.length + (juntarBase ? 1 : 0);
  const totalBloquean = grupos.bloquean.length + (laminasSinColor ? 1 : 0);
  const fila = (i: ValidationIssue, k: number) => (
    <li key={`${i.code}-${i.slideId ?? ""}-${i.slotName ?? ""}-${k}`}>
      {/* W1B-C8: el enlace va antes del texto para quedar en el primer renglón de la tarjeta (panelAvisos.css). */}
      {i.slideId && posicionDe.has(i.slideId) && (
        <PulsoButton variant="link" size="sm" className="pulso-f6-enlace-fila pulso-f6-avisos-ir" onClick={() => ir(i.slideId)}>
          Lámina {posicionDe.get(i.slideId)}
        </PulsoButton>
      )}
      <span>{i.message}</span>
    </li>
  );

  return (
    <aside
      ref={raizRef}
      className="pulso-f6-avisos-panel"
      aria-label="Avisos del informe"
      {...panel.props}
    >
      {/* Acabado W2-A: CabeceraPanel con una sola acción de texto y la X del kit; Escape y la X cierran por la misma vía
          y devuelven el foco a quien abrió el panel. */}
      <CabeceraPanel
        titulo="Avisos del informe"
        acciones={sinTitulo && sinTitulo.cuantas > 0 ? (
          // R9-5: un ícono con su nombre y tooltip; el botón de texto recortaba el título a «Avisos del infor…».
          <BotonConTecla accion="siguienteSinTitulo" ayuda={`Siguiente sin título: ${formatoConteo(sinTitulo.cuantas)} ${sinTitulo.cuantas === 1 ? "lámina" : "láminas"} sin título`}>
            <PulsoButton variant="icon" tone="quiet" className="pulso-f6-avisos-sin-titulo" aria-label="Siguiente lámina sin título" onClick={sinTitulo.siguiente}>
              <CornerDownLeft aria-hidden="true" />
            </PulsoButton>
          </BotonConTecla>
        ) : undefined}
        onCerrar={cerrar}
        etiquetaCerrar="Cerrar avisos"
        cerrarRef={cerrarRef}
      />
      <div className="pulso-f6-avisos-cuerpo" data-qa-geometry-group="graficos/f6-avisos-grupos" data-qa-geometry-contract="intrinsic">
        {grupos.plan.length > 0 && (
          <section className="pulso-f6-avisos-grupo" aria-label="Cambios al abrir el plan">
            <h3>Cambios al abrir el plan <span>{formatoConteo(grupos.plan.length)}</span></h3>
            <ul data-qa-geometry-group="graficos/f6-avisos-plan" data-qa-geometry-contract="intrinsic">
              {grupos.plan.map((a) => <li key={a}><span>{a}</span></li>)}
            </ul>
          </section>
        )}
        {grupos.equivalencias.length > 0 && (
          <section className="pulso-f6-avisos-grupo" aria-label="Equivalencias entre bases">
            <h3>Equivalencias entre bases <span>{formatoConteo(grupos.equivalencias.length)}</span></h3>
            <ul data-qa-geometry-group="graficos/f6-avisos-equivalencias" data-qa-geometry-contract="intrinsic">
              {grupos.equivalencias.map((a) => <li key={a}><span>{a}</span></li>)}
            </ul>
          </section>
        )}
        <section className={`pulso-f6-avisos-grupo${totalBloquean ? " is-bloquea" : ""}`} aria-label="Bloquean la exportación">
          <h3>Bloquean la exportación <span>{totalBloquean}</span></h3>
          {totalBloquean ? (
            <ul data-qa-geometry-group="graficos/f6-avisos-bloquean" data-qa-geometry-contract="intrinsic">
              {laminasSinColor ? (
                <li className="is-accion">
                  <span>Faltan colores en {laminasSinColor === 1 ? "1 lámina" : `${laminasSinColor} láminas`}: {MOTIVO_COLORES_PENDIENTES}.</span>
                  <PulsoButton variant="link" size="sm" className="pulso-f6-enlace-fila" onClick={coloresPendientes?.completar}>Completar todos los colores</PulsoButton>
                </li>
              ) : null}
              {grupos.bloquean.map(fila)}
            </ul>
          ) : <p>Nada bloquea la exportación.</p>}
        </section>
        <section className="pulso-f6-avisos-grupo" aria-label="Conviene revisar">
          <h3>Conviene revisar <span>{totalRevisar}</span></h3>
          {totalRevisar ? (
            <ul data-qa-geometry-group="graficos/f6-avisos-revisar" data-qa-geometry-contract="intrinsic">
              {juntarBase && baseImplicita ? (
                <li className="is-accion">
                  <span>
                    En {baseImplicita.laminas === 1 ? "1 lámina" : `${baseImplicita.laminas} láminas`}, {baseImplicita.preguntas === 1 ? "1 pregunta se lee" : `${baseImplicita.preguntas} preguntas se leen`} de {laBase(baseImplicita.base)} sin que el plan lo diga.
                  </span>
                  <PulsoButton variant="link" size="sm" className="pulso-f6-enlace-fila" onClick={baseImplicita.fijar}>Fijar {laBase(baseImplicita.base)} en todas las láminas</PulsoButton>
                </li>
              ) : null}
              {revisar.map(fila)}
            </ul>
          ) : <p>Sin advertencias del plan.</p>}
        </section>
        <ListaPorLamina titulo="Antes de exportar" grupos={agruparPorLamina(previos)} geometria="graficos/f6-avisos-previos" />
        <ListaPorLamina titulo="Última exportación" grupos={agruparPorLamina(ultimos)} geometria="graficos/f6-avisos-ultima" />
        <section className="pulso-f6-avisos-grupo" aria-label="Avisos del motor">
          <h3>Avisos del motor <span>{grupos.motor.reduce((t, m) => t + m.avisos.length, 0)}</span></h3>
          {grupos.motor.length ? (
            <ul data-qa-geometry-group="graficos/f6-avisos-motor" data-qa-geometry-contract="intrinsic">
              {grupos.motor.flatMap((m) => m.avisos.map((a, k) => (
                <li key={`${m.slideId}-${k}`}>
                  <PulsoButton variant="link" size="sm" className="pulso-f6-enlace-fila pulso-f6-avisos-ir" onClick={() => ir(m.slideId)}>
                    Lámina {posicionDe.get(m.slideId)}
                  </PulsoButton>
                  <span>{avisoConLaminaActual(a, posicionDe.get(m.slideId))}</span>
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
