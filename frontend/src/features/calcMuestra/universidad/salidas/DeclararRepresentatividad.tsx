import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { ApiError } from "../../../../api/core";
import { apiPlannerEstado, type PlannerEstado } from "../../../../api/planner";
import {
  apiCalcMuestraDeclararRepresentatividad,
  apiCalcMuestraRepresentatividad,
  type VistaPreviaDeRepresentatividad,
} from "../../../../api/calcMuestraRepresentatividad";
import { construirDeclaracion } from "./declaracionRepresentatividadModelo";

/**
 * Panel «Representatividad del estudio» en Salida › Pase a Monitoreo (ADR 0121
 * F4). Dice qué universo y qué variables de cuota usa el escenario y las
 * declara en el Planner, de donde las lee Monitoreo. Las cuotas no viajan: se
 * quedan en el escenario.
 *
 * `inicial` existe para los tests: con él no se pide nada a la API.
 */
export function DeclararRepresentatividad({ inicial }: {
  inicial?: { vista: VistaPreviaDeRepresentatividad | null; planner: PlannerEstado | null };
}) {
  const [vista, setVista] = useState(inicial?.vista ?? null);
  const [planner, setPlanner] = useState(inicial?.planner ?? null);
  const [cargando, setCargando] = useState(!inicial);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [v, p] = await Promise.all([apiCalcMuestraRepresentatividad(), apiPlannerEstado()]);
      setVista(v);
      setPlanner(p);
    } catch (e) {
      setMensaje(`No se pudo leer la declaración: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!inicial) void cargar();
  }, [cargar, inicial]);

  const modelo = construirDeclaracion(vista, planner);

  async function declarar() {
    setEnviando(true);
    setMensaje("");
    try {
      await apiCalcMuestraDeclararRepresentatividad(modelo.revision);
      await cargar();
      setMensaje("Declarado en el Planner. Monitoreo lo lee al recalcular el tablero.");
    } catch (e) {
      // Alguien declaró otra sección del Planner en medio: se relee y se dice.
      if (e instanceof ApiError && e.code === "E_PLANNER_DESACTUALIZADO") {
        await cargar();
        setMensaje("El Planner cambió mientras tanto. Revisa lo declarado y vuelve a intentarlo.");
      } else {
        setMensaje(`No se pudo declarar: ${(e as Error).message}`);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section
      className="cmv2-panel cmv2-sal-panel cmv2-sal-rep"
      aria-label="Representatividad del estudio"
      aria-busy={cargando || undefined}
      data-qa-geometry-member="representatividad"
    >
      <div className="cmv2-panel-head">
        <strong>Representatividad del estudio</strong>
        <span className="cmv2-pill-soft">se declara en el Planner</span>
      </div>
      {cargando ? (
        <p className="cmv2-sal-nota">Leyendo el escenario y el Planner…</p>
      ) : modelo.estado === "sin-diseno" ? (
        <p className="cmv2-sal-nota" data-qa-geometry-empty="legitimo">
          El escenario todavía no fija metas: cuando las tenga, aquí se declaran su universo y sus variables de cuota.
        </p>
      ) : (
        <>
          <dl className="cmv2-sal-rep-datos">
            <div><dt>Universo</dt><dd>{modelo.universo}</dd></div>
            <div><dt>Variables de cuota</dt><dd>{modelo.variables.join(" × ")}</dd></div>
          </dl>
          <p className="cmv2-sal-nota">
            {modelo.estado === "al-dia" ? (
              <span className="cmv2-sal-rep-ok"><CheckCircle2 size={14} aria-hidden="true" /> Declarado en el Planner; Monitoreo lo lee de ahí.</span>
            ) : modelo.estado === "distinto" ? (
              modelo.diferencia
            ) : (
              "El Planner todavía no declara la representatividad de aulas. Las cuotas se quedan aquí; se declaran universo y variables."
            )}
          </p>
          {modelo.boton ? (
            <div className="cmv2-sal-rep-accion">
              <button type="button" className="pulso-button is-primary" onClick={() => { void declarar(); }} disabled={enviando}>
                {enviando ? "Declarando…" : modelo.boton}
              </button>
            </div>
          ) : null}
        </>
      )}
      {mensaje ? <p className="cmv2-sal-nota" role="status">{mensaje}</p> : null}
    </section>
  );
}
