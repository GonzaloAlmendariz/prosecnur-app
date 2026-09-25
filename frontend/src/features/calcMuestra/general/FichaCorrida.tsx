import { useReducer } from "react";
import { Download, Loader2, Shuffle } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { apiCalcMuestraGeneralExportar, type CalcMuestraGeneralCorrida } from "../../../api/calcMuestraGeneral";
import { downloadUrl } from "../../../api/core";
import { EmptyState } from "../../../components/States";
import { fmtDec, fmtInt } from "../sharedCore";
import { AvisoModulo } from "../universidad/shared/AvisoModulo";
import { CifraFila, CifraMotor } from "../universidad/ui";
import { useValorSwap } from "../universidad/ui/useValorSwap";
import { ErrorDelMotor } from "./ErrorDelMotor";
import {
  EXPORT_INICIAL,
  MOTIVO_SIN_CORRIDA_EXPORT,
  TEXTO_COBERTURA_CENSAL,
  errorGeneralDesde,
  exportReducer,
  formatearFechaUtc,
  formatearPi,
  hashCorto,
} from "./modelo";
import { vigenciaSorteo } from "./bandaDisenoModelo";
import { filasDesdeCorrida } from "./repartoEstratos";
import { RepartoEstratosGrafico } from "./RepartoEstratosGrafico";
import { corridaEstratificada, nombreDeCorrida } from "./tituloCorrida";
import { useMuestraGeneralStore } from "./store";
import { guardarEstudioPendiente } from "./useMuestraGeneral";
import "./mesa.css";

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
  const marco = useMuestraGeneralStore((s) => (componenteId ? s.marcos[componenteId] ?? null : null));
  // La misma vigencia que la banda y el estado de la mesa: marco, cálculo y n.
  const vigencia = vigenciaSorteo({ comp: componente, corrida, marco });
  const desactualizado = vigencia.estado === "desactualizado" ? vigencia : null;
  const nombre = corrida && c ? nombreDeCorrida(corrida, componente) : null;
  // Re-sortear cambia la corrida vigente: su nombre cruza (E16 · M7). «Sin
  // sorteo» no es un nombre: el primer sorteo no cruza, aparece.
  const tituloCambiando = useValorSwap(nombre?.titulo ?? null);
  const estratificada = Boolean(corrida && c && !esCenso && corridaEstratificada(corrida) && corrida.estratos.length > 1);

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
          <h3 id="cmg-ficha-titulo" className="cmg-panel-titulo cmv2-uni-swap" data-cambiando={tituloCambiando || undefined}>
            {nombre ? nombre.titulo : "Sin sorteo"}
          </h3>
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
          {/* Región viva persistente: un aviso que aparece después de montar
              (el n a campo cambió en Método) se anuncia sin robar el foco. */}
          <div className="cmg-avisos-vivos" aria-live="polite">
            {desactualizado && (
              <AvisoModulo tone="warn" role="note" title="El sorteo quedó desactualizado">
                {desactualizado.texto} Vuelve a sortear.
              </AvisoModulo>
            )}
            {c.piso_incumplible && (
              <AvisoModulo tone="warn" role="note">
                El piso por estrato no alcanza con este n: algunos estratos quedaron por debajo.
              </AvisoModulo>
            )}
            {c.reservas_omitidas_pps && (
              <AvisoModulo tone="info" role="note">En PPS no se sortean reservas; se pidieron y se omitieron.</AvisoModulo>
            )}
          </div>

          <CifraFila>
            <CifraMotor
              label={esCenso ? "Unidades a contactar" : "n a campo usado"}
              value={fmtInt(esCenso ? c.n_titulares : corrida.n_fuente)}
              detalle={esCenso ? "el marco entero" : "del cálculo vigente al sortear"}
              tono={desactualizado?.motivo === "n" ? "alerta" : undefined}
              hero
            />
            <CifraMotor label={esCenso ? "π" : "Titulares"} value={esCenso ? "1" : fmtInt(c.n_titulares)} detalle={esCenso ? "cada unidad" : "a contactar primero"} />
            <CifraMotor label="Reservas" value={fmtInt(c.n_reservas)} detalle={c.n_reservas > 0 ? "se liberan por lotes" : "sin reservas"} />
            <CifraMotor label="N del marco" value={fmtInt(c.N)} detalle={`huella ${hashCorto(c.marco_hash, 8)}`} />
          </CifraFila>

          <dl className="cmg-traza">
            <div><dt>Modalidad</dt><dd>{nombre?.modalidad}</dd></div>
            <div><dt>Semilla</dt><dd><code>{c.semilla}</code></dd></div>
            <div><dt>RNG</dt><dd><code>{partirEnBarras(c.rng_kind)}</code></dd></div>
            <div><dt>R</dt><dd>{c.r_version || "—"}</dd></div>
            <div><dt>Corrida</dt><dd><code title={c.run_id}>{hashCorto(c.run_id, 12)}</code></dd></div>
            <div><dt>Marco</dt><dd><code title={c.marco_hash}>{hashCorto(c.marco_hash)}</code></dd></div>
            <div><dt>Configuración</dt><dd><code title={c.config_hash}>{hashCorto(c.config_hash)}</code></dd></div>
            <div><dt>Fecha</dt><dd>{formatearFechaUtc(corrida.sorteado_at)}</dd></div>
          </dl>

          {estratificada && (
            <RepartoEstratosGrafico
              titulo="Reparto del sorteo por estrato"
              filas={filasDesdeCorrida(corrida)}
              origen="corrida"
              tablaAlternativa={false}
            />
          )}

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
                  <th scope="col" className="cmg-num">Peso base</th>
                </tr>
              </thead>
              <tbody>
                {corrida.estratos.map((e) => (
                  <tr key={e.clave}>
                    <th scope="row" className="cmg-fila-estrato">{e.clave}</th>
                    <td className="cmg-num">{fmtInt(e.N_h)}</td>
                    <td className="cmg-num">{fmtInt(e.n_h)}</td>
                    <td className="cmg-num">{fmtInt(e.n_reservas)}</td>
                    <td className="cmg-num" title={e.pi == null ? undefined : String(e.pi)}>
                      {c.metodo === "pps" ? "por unidad" : formatearPi(e.pi)}
                    </td>
                    <td className="cmg-num">
                      {c.metodo === "pps" || e.pi == null || e.pi <= 0 ? "por unidad" : fmtDec(1 / e.pi, 2)}
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
