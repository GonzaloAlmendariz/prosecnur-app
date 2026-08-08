/**
 * Pestaña «Relato» (`aulas-relato`) de la sección Selección — ADR 0067.
 *
 * Superficie de reproducción: narra la corrida persistida escena por escena
 * (marco → estratos → probabilidades → sorteo → titulares → cierre) con lente
 * por facultad. Cada cuadro es un hecho del sorteo ejecutado; el modelo puro
 * (`relatoModel.ts`) no genera azar ni orden propio.
 *
 * Movimiento: autoplay acotado (6 escenas × 8 s = 48 s ≤ 60 s por facultad).
 * Con `prefers-reduced-motion` el relato degrada a su modo estático de primera
 * clase: las MISMAS escenas y datos, apiladas y legibles sin animación ni
 * autoplay (ADR 0067 §5).
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play, Square } from "lucide-react";
import { conNivel } from "../../../../../lib/navegacion/direccion";
import { AulasStageNotice, resolveAulasStageNotice, type AulasNavigate } from "../aulasSurfaceState";
import type { ClassroomLabModel } from "../classroomLabModel";
import {
  RELATO_BOLAS_MAX,
  construirRelato,
  focoDeFacultad,
  type RelatoEscena,
} from "./relatoModel";
import { EscenaCierre } from "./escenas/EscenaCierre";
import { EscenaEstratos } from "./escenas/EscenaEstratos";
import { EscenaMarco } from "./escenas/EscenaMarco";
import { EscenaProbabilidades } from "./escenas/EscenaProbabilidades";
import { EscenaSorteo } from "./escenas/EscenaSorteo";
import { EscenaTitulares } from "./escenas/EscenaTitulares";
import "./relato.css";

/**
 * Presupuesto de autoplay ≤ 60 s por facultad: 5 escenas × 5.5 s + el
 * ensamblaje bola por bola de E4 (~820 ms por bola, tope 30 s).
 */
const ESCENA_AUTOPLAY_MS = 5500;

/** E4 dura lo que su ensamblaje: el reloj espera a que aterrice cada bola. */
function duracionDeEscena(escena: RelatoEscena | undefined): number {
  if (escena?.id === "sorteo" && escena.modo === "pasos") {
    const bolas = Math.min(escena.pasos.length, RELATO_BOLAS_MAX);
    return Math.min(30000, 2500 + bolas * 850);
  }
  return ESCENA_AUTOPLAY_MS;
}

function prefiereMovimientoReducido(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(prefiereMovimientoReducido);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducido(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  return reducido;
}

function EscenaCuerpo({
  escena,
  onNavigate,
}: {
  escena: RelatoEscena;
  onNavigate?: AulasNavigate;
}) {
  switch (escena.id) {
    case "marco":
      return <EscenaMarco escena={escena} onNavigate={onNavigate} />;
    case "estratos":
      return <EscenaEstratos escena={escena} />;
    case "probabilidades":
      return <EscenaProbabilidades escena={escena} />;
    case "sorteo":
      return <EscenaSorteo escena={escena} />;
    case "titulares":
      return <EscenaTitulares escena={escena} />;
    case "cierre":
      return <EscenaCierre escena={escena} />;
  }
}

export function RelatoTab({
  model,
  foco,
  onNavigate,
}: {
  model: ClassroomLabModel;
  /** Param canónico `foco` ya leído de la dirección (nunca de un alias). */
  foco: string | null;
  onNavigate?: AulasNavigate;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const movimientoReducido = useMovimientoReducido();
  const relato = useMemo(
    () =>
      construirRelato({
        selection: model.selection,
        selectionRows: model.selectionRows,
        frame: model.frame,
        frameRows: model.frameRows,
        estratosCalculo: model.facultades,
        selectorFields: model.selectorFields,
        foco,
      }),
    [model.selection, model.selectionRows, model.frame, model.frameRows, model.facultades, model.selectorFields, foco],
  );
  const [escenaIndex, setEscenaIndex] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const totalEscenas = relato?.escenas.length ?? 0;
  const focoVigente = relato?.foco ?? null;

  // Cambiar de lente reinicia la película: la escena 1 de la nueva facultad.
  useEffect(() => {
    setEscenaIndex(0);
    setReproduciendo(false);
  }, [focoVigente]);

  useEffect(() => {
    if (!reproduciendo || movimientoReducido || totalEscenas === 0) return;
    const timer = window.setTimeout(() => {
      setEscenaIndex((actual) => {
        if (actual >= totalEscenas - 1) {
          setReproduciendo(false);
          return actual;
        }
        return actual + 1;
      });
    }, duracionDeEscena(relato?.escenas[escenaIndex]));
    return () => window.clearTimeout(timer);
  }, [reproduciendo, movimientoReducido, escenaIndex, totalEscenas, relato]);

  /** Escribe el lente en la dirección con el param canónico `foco` (ADR 0044). */
  function publicarFoco(slug: string | null) {
    const siguiente = conNivel(location.search, "foco", slug);
    if (siguiente === location.search) return;
    navigate({ pathname: location.pathname, search: siguiente }, { replace: true });
  }

  const stageNotice = resolveAulasStageNotice(model, "relato");
  if (stageNotice || !relato) {
    return (
      <div className="cmv2-aulas-stack cmv2-relato" data-audit-ready="false">
        {stageNotice ? (
          <AulasStageNotice notice={stageNotice} onNavigate={onNavigate} />
        ) : (
          <section className="cmv2-panel cmv2-aulas-panel" aria-live="polite">
            <div className="cmv2-subhead">
              <strong>Relato de la selección</strong>
              <small>la corrida vigente no publica filas narrables</small>
            </div>
          </section>
        )}
      </div>
    );
  }

  const indexVigente = Math.min(escenaIndex, totalEscenas - 1);
  const escenaActiva = relato.escenas[indexVigente];

  return (
    <div
      className="cmv2-relato"
      data-audit-ready="true"
      data-relato-motion={movimientoReducido ? "reducida" : "plena"}
      data-qa-geometry-group="aulas-relato"
      data-qa-geometry-contract="intrinsic"
    >
      <section
        className="cmv2-panel cmv2-relato-escenario-panel"
        aria-label={`Relato de la corrida ${relato.runId || "sin identificador"}`}
      >
        <header className="cmv2-relato-cabecera">
          <div className="cmv2-subhead">
            <strong>Relato de la selección</strong>
            <small>
              corrida {relato.runId || "sin identificador"}
              {relato.semilla ? ` · semilla ${relato.semilla}` : " · sin semilla publicada"}
            </small>
          </div>
          <label className="cmv2-compact-field cmv2-relato-foco">
            <span>Lente</span>
            <select
              value={focoVigente ? focoDeFacultad(focoVigente) : ""}
              onChange={(event) => publicarFoco(event.currentTarget.value || null)}
            >
              <option value="">Estudio completo · {relato.facultades.length} facultades</option>
              {relato.facultades.map((facultad) => (
                <option key={facultad} value={focoDeFacultad(facultad)}>
                  {facultad}
                </option>
              ))}
            </select>
          </label>
        </header>

        {movimientoReducido ? (
          /* Modo estático de primera clase: mismas escenas, mismos datos, sin
             movimiento; el relato completo se LEE de corrido (ADR 0067 §5). */
          <ol className="cmv2-relato-estatico" aria-label="Relato completo, escena por escena">
            {relato.escenas.map((escena, index) => (
              <li key={escena.id} className="cmv2-relato-estatico-escena">
                <h3 className="cmv2-relato-escena-titulo">
                  <span className="cmv2-relato-escena-num">Escena {index + 1} de {totalEscenas}</span>
                  {escena.titulo}
                </h3>
                <EscenaCuerpo escena={escena} onNavigate={onNavigate} />
              </li>
            ))}
          </ol>
        ) : (
          <>
            <div
              className="cmv2-relato-escenario"
              key={`${focoVigente ?? "estudio"}-${escenaActiva.id}`}
              role="group"
              aria-roledescription="escena del relato"
              aria-label={`Escena ${indexVigente + 1} de ${totalEscenas}: ${escenaActiva.titulo}`}
            >
              <h3 className="cmv2-relato-escena-titulo">
                <span className="cmv2-relato-escena-num">
                  Escena {indexVigente + 1} de {totalEscenas}
                </span>
                {escenaActiva.titulo}
              </h3>
              <EscenaCuerpo escena={escenaActiva} onNavigate={onNavigate} />
            </div>

            <div className="cmv2-relato-timeline" role="group" aria-label="Línea de tiempo del relato">
              <div className="cmv2-relato-controles">
                <button
                  type="button"
                  className="cmv2-ghost"
                  disabled={indexVigente === 0}
                  aria-label="Escena anterior"
                  onClick={() => {
                    setReproduciendo(false);
                    setEscenaIndex((actual) => Math.max(0, actual - 1));
                  }}
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                {reproduciendo ? (
                  <button
                    type="button"
                    className="cmv2-ghost"
                    onClick={() => setReproduciendo(false)}
                  >
                    <Square size={12} aria-hidden="true" />
                    Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cmv2-ghost"
                    onClick={() => {
                      if (indexVigente >= totalEscenas - 1) setEscenaIndex(0);
                      setReproduciendo(true);
                    }}
                  >
                    <Play size={12} aria-hidden="true" />
                    Reproducir
                  </button>
                )}
                <button
                  type="button"
                  className="cmv2-ghost"
                  disabled={indexVigente === totalEscenas - 1}
                  aria-label="Escena siguiente"
                  onClick={() => {
                    setReproduciendo(false);
                    setEscenaIndex((actual) => Math.min(totalEscenas - 1, actual + 1));
                  }}
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              <input
                className="cmv2-relato-scrub"
                type="range"
                min={1}
                max={totalEscenas}
                step={1}
                value={indexVigente + 1}
                aria-label="Escena del relato"
                aria-valuetext={`Escena ${indexVigente + 1} de ${totalEscenas}: ${escenaActiva.titulo}`}
                style={{ "--relato-progreso": `${(indexVigente / Math.max(1, totalEscenas - 1)) * 100}%` } as CSSProperties}
                onChange={(event) => {
                  setReproduciendo(false);
                  setEscenaIndex(Number(event.currentTarget.value) - 1);
                }}
              />
              <p className="cmv2-relato-indicador" aria-live="polite">
                Escena {indexVigente + 1} de {totalEscenas} · {escenaActiva.titulo}
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
