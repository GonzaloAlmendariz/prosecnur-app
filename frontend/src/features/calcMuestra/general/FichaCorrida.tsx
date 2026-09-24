import { useReducer } from "react";
import { Download, Loader2, Shuffle } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { apiCalcMuestraGeneralExportar, type CalcMuestraGeneralCorrida } from "../../../api/calcMuestraGeneral";
import { downloadUrl } from "../../../api/core";
import { Alert } from "../../../components/Alert";
import { EmptyState } from "../../../components/States";
import { ErrorDelMotor } from "./ErrorDelMotor";
import {
  EXPORT_INICIAL,
  MOTIVO_SIN_CORRIDA_EXPORT,
  TEXTO_COBERTURA_CENSAL,
  errorGeneralDesde,
  etiquetaMetodo,
  exportReducer,
  formatearEntero,
  formatearFechaUtc,
  formatearPi,
  hashCorto,
  nDesfasado,
} from "./modelo";
import { guardarEstudioPendiente } from "./useMuestraGeneral";

/**
 * La corrida vigente: qué se sorteó, con qué y cómo repetirlo, más el libro de
 * entrega. Sin corrida conserva su caja, dice qué falta y deja la descarga
 * deshabilitada con su motivo a la vista.
 */
export function FichaCorrida({
  corrida,
  componente,
}: {
  corrida: CalcMuestraGeneralCorrida | null;
  componente: CalcMuestraComponente | null;
}) {
  const [exp, dispatch] = useReducer(exportReducer, EXPORT_INICIAL);
  const componenteId = componente?.id ?? null;
  const c = corrida?.corrida ?? null;
  const esCenso = c?.modalidad === "censo";
  // En un censo no hay n a campo que comparar: se listó el marco entero.
  const desfase = esCenso ? null : nDesfasado(corrida, componente);

  async function exportar() {
    if (!componenteId || !corrida) return;
    dispatch({ tipo: "exportando" });
    try {
      await guardarEstudioPendiente();
      const res = await apiCalcMuestraGeneralExportar(componenteId);
      window.open(downloadUrl(res.file_id), "_blank", "noreferrer");
      dispatch({ tipo: "exportado", filename: res.filename });
    } catch (e) {
      dispatch({ tipo: "fallo", error: errorGeneralDesde(e) });
    }
  }

  return (
    <section className="cmv2-panel cmg-ficha" aria-labelledby="cmg-ficha-titulo" data-qa-geometry-member>
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Corrida vigente</span>
          <strong id="cmg-ficha-titulo">
            {!c ? "Sin sorteo" : `${esCenso ? "Cobertura censal" : etiquetaMetodo(c.metodo)} · semilla ${c.semilla}`}
          </strong>
        </div>
        <div className="cmv2-panel-head-actions cmg-exportar">
          <button
            type="button"
            className="cmv2-ghost"
            onClick={() => void exportar()}
            disabled={!corrida || exp.exportando}
            aria-describedby="cmg-exportar-estado"
          >
            {exp.exportando
              ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
              : <Download size={14} aria-hidden="true" />}
            Descargar listado (XLSX)
          </button>
          <small id="cmg-exportar-estado" aria-live="polite">
            {!corrida
              ? MOTIVO_SIN_CORRIDA_EXPORT
              : exp.ultimo
                ? `Descargado: ${exp.ultimo}`
                : "Corrida, memoria de cálculo, estratos y listado."}
          </small>
        </div>
      </div>

      {exp.error && <ErrorDelMotor error={exp.error} label="No se pudo exportar el listado" />}

      {!corrida || !c ? (
        <EmptyState
          variant="inline"
          icon={<Shuffle size={18} aria-hidden="true" />}
          title="Todavía no hay sorteo"
          hint="Elige el método y sortea: aquí aparecerán la ficha, el reparto por estrato y el listado con π y peso."
        />
      ) : (
        <>
          {esCenso && <p className="cmg-nota cmg-censo">{TEXTO_COBERTURA_CENSAL}</p>}
          {desfase != null && (
            <Alert kind="warn">
              El n a campo actual es {formatearEntero(desfase)}; esta corrida usó {formatearEntero(corrida.n_fuente)}. Vuelve a sortear.
            </Alert>
          )}
          {c.piso_incumplible && (
            <Alert kind="warn">El piso por estrato no alcanza con este n: algunos estratos quedaron por debajo.</Alert>
          )}
          {c.reservas_omitidas_pps && (
            <Alert kind="info">En PPS no se sortean reservas; se pidieron y se omitieron.</Alert>
          )}

          <dl
            className="cmg-metricas"
            data-qa-geometry-group="calc-muestra/general-ficha-metricas"
            data-qa-geometry-contract="equal"
          >
            <div className="cmg-metrica" data-qa-geometry-member>
              <dt>{esCenso ? "Unidades a contactar" : "n a campo usado"}</dt>
              <dd>{formatearEntero(esCenso ? c.n_titulares : corrida.n_fuente)}</dd>
            </div>
            <div className="cmg-metrica" data-qa-geometry-member>
              <dt>{esCenso ? "π" : "Titulares"}</dt>
              <dd>{esCenso ? "1" : formatearEntero(c.n_titulares)}</dd>
            </div>
            <div className="cmg-metrica" data-qa-geometry-member>
              <dt>Reservas</dt>
              <dd>{formatearEntero(c.n_reservas)}</dd>
            </div>
            <div className="cmg-metrica" data-qa-geometry-member>
              <dt>N del marco</dt>
              <dd>{formatearEntero(c.N)}</dd>
            </div>
          </dl>

          <dl className="cmg-traza">
            <div><dt>Modalidad</dt><dd>{esCenso ? "Censo" : `Probabilística · ${etiquetaMetodo(c.metodo)}`}</dd></div>
            <div><dt>Semilla</dt><dd><code>{c.semilla}</code></dd></div>
            <div><dt>RNG</dt><dd><code>{partirEnBarras(c.rng_kind)}</code></dd></div>
            <div><dt>R</dt><dd>{c.r_version || "—"}</dd></div>
            <div><dt>Corrida</dt><dd><code title={c.run_id}>{hashCorto(c.run_id, 12)}</code></dd></div>
            <div><dt>Marco</dt><dd><code title={c.marco_hash}>{hashCorto(c.marco_hash)}</code></dd></div>
            <div><dt>Configuración</dt><dd><code title={c.config_hash}>{hashCorto(c.config_hash)}</code></dd></div>
            <div><dt>Fecha</dt><dd>{formatearFechaUtc(corrida.sorteado_at)}</dd></div>
          </dl>

          <div className="cmg-tabla-wrap">
            <table className="cmg-tabla">
              <caption className="cmg-sr-only">Reparto por estrato de la corrida</caption>
              <thead>
                <tr>
                  <th scope="col">Estrato</th>
                  <th scope="col" className="cmg-num cmg-simbolo">N<sub>h</sub></th>
                  <th scope="col" className="cmg-num cmg-simbolo">n<sub>h</sub> a campo</th>
                  <th scope="col" className="cmg-num">Reservas</th>
                  <th scope="col" className="cmg-num cmg-simbolo">π</th>
                </tr>
              </thead>
              <tbody>
                {corrida.estratos.map((e) => (
                  <tr key={e.clave}>
                    <td>{e.clave}</td>
                    <td className="cmg-num">{formatearEntero(e.N_h)}</td>
                    <td className="cmg-num">{formatearEntero(e.n_h)}</td>
                    <td className="cmg-num">{formatearEntero(e.n_reservas)}</td>
                    <td className="cmg-num" title={e.pi == null ? undefined : String(e.pi)}>
                      {c.metodo === "pps" ? "por unidad" : formatearPi(e.pi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** «Mersenne-Twister/Inversion/Rejection» se parte en las barras, no a mitad de palabra. */
function partirEnBarras(texto: string) {
  if (!texto) return "—";
  return texto.split("/").map((parte, i) => (
    <span key={parte}>{i > 0 && <>/<wbr /></>}{parte}</span>
  ));
}
