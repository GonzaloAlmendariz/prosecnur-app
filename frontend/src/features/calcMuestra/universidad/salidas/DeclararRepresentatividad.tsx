import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import {
  apiCalcMuestraDeclararRepresentatividad,
  apiCalcMuestraRepresentatividad,
  type VistaPreviaDeRepresentatividad,
} from "../../../../api/calcMuestraRepresentatividad";
import { construirDeclaracion } from "./declaracionRepresentatividadModelo";

/**
 * Panel «Representatividad del estudio» en Salida › Pase a Monitoreo (ADR 0121;
 * ADR 0123 Q1). Dice qué universo y qué variables de cuota usa el escenario y
 * las guarda en Cálculo; Monitoreo las recibe en la foto del plan al importarlo.
 * Las cuotas no viajan: se quedan en el escenario.
 *
 * `inicial` existe para los tests: con él no se pide nada a la API.
 */
export function DeclararRepresentatividad({ inicial }: {
  inicial?: { vista: VistaPreviaDeRepresentatividad | null };
}) {
  const [vista, setVista] = useState(inicial?.vista ?? null);
  const [cargando, setCargando] = useState(!inicial);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setVista(await apiCalcMuestraRepresentatividad());
    } catch (e) {
      setMensaje(`No se pudo leer la declaración: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!inicial) void cargar();
  }, [cargar, inicial]);

  const modelo = construirDeclaracion(vista);

  async function declarar() {
    setEnviando(true);
    setMensaje("");
    try {
      await apiCalcMuestraDeclararRepresentatividad();
      await cargar();
      setMensaje("Guardado. Monitoreo lo recibe al importar el plan.");
    } catch (e) {
      setMensaje(`No se pudo guardar: ${(e as Error).message}`);
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
      data-audit-ready={cargando ? "false" : modelo.estado === "sin-diseno" ? "vacio:sin-metas" : "calc-muestra-representatividad"}
    >
      <div className="cmv2-panel-head">
        <strong>Representatividad del estudio</strong>
        <span className="cmv2-pill-soft">viaja con el plan</span>
      </div>
      {cargando ? (
        <p className="cmv2-sal-nota">Leyendo el escenario…</p>
      ) : modelo.estado === "sin-diseno" ? (
        <p className="cmv2-sal-nota" data-qa-geometry-empty="legitimo">
          El escenario todavía no fija metas: cuando las tenga, aquí se guardan su universo y sus variables de cuota.
        </p>
      ) : (
        <>
          <dl className="cmv2-sal-rep-datos">
            <div><dt>Universo</dt><dd>{modelo.universo}</dd></div>
            <div><dt>Variables de cuota</dt><dd>{modelo.variables.join(" × ")}</dd></div>
          </dl>
          <p className="cmv2-sal-nota">
            {modelo.estado === "al-dia" && modelo.reimportar ? (
              "Guardado después de la última importación: Monitoreo lo recibe cuando vuelvas a importar el plan."
            ) : modelo.estado === "al-dia" ? (
              <span className="cmv2-sal-rep-ok"><CheckCircle2 size={14} aria-hidden="true" /> Guardado; viaja en el plan que mide Monitoreo.</span>
            ) : modelo.estado === "distinto" ? (
              modelo.diferencia
            ) : (
              "Todavía no se guardó. Las cuotas se quedan aquí; se guardan el universo y las variables."
            )}
          </p>
          {modelo.boton ? (
            <div className="cmv2-sal-rep-accion">
              <button type="button" className="pulso-button is-primary" onClick={() => { void declarar(); }} disabled={enviando}>
                {enviando ? "Guardando…" : modelo.boton}
              </button>
            </div>
          ) : null}
        </>
      )}
      {mensaje ? <p className="cmv2-sal-nota" role="status">{mensaje}</p> : null}
    </section>
  );
}
