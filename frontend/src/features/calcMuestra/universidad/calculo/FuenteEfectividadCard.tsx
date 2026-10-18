/**
 * «De dónde sale la tasa»: declara la fuente de la tasa de efectividad del
 * estudio, encima de la tarjeta de tasas por facultad.
 *
 * Sin declaración el motor usa la calibración embebida, medida en otro
 * estudio. Para un estudio sin histórico propio (UNSA 2026, 2026-10-14) eso
 * dimensionaba con las tasas de otra universidad y no había cómo decir «usa
 * la tasa del Diseño para todas» sin escribir la config por la API. Aquí se
 * declara, y como la tasa vive anotada en el marco, declarar reconstruye.
 */
import { fmtInt } from "../../sharedCore";
import type { CalcMuestraTauReseteado } from "../../../../api/calcMuestra";
import {
  efectividadDesactualizada,
  fuenteConstruida,
  fuenteDeclarada,
} from "../shared/efectividadFuente";
import "./fuenteEfectividad.css";

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

export function FuenteEfectividadCard({
  efectividad,
  aulaFrame,
  tauDiseno,
  puedeReconstruir,
  onDeclararTauGlobal,
  onVolverACalibracion,
  onReconstruir,
  manuales = 0,
  reseteados = [],
}: {
  /** `aulas_config.efectividad` del estudio. */
  efectividad: unknown;
  /** `frame.aula_frame`: cada fila anota con qué fuente se construyó. */
  aulaFrame: unknown;
  /** τ del Diseño (`parametros.tau` del componente activo). */
  tauDiseno: number | null;
  puedeReconstruir: boolean;
  /** Declara `tau_global` con esta tasa y reconstruye el marco. */
  onDeclararTauGlobal: (tau: number) => void;
  /** Quita la declaración (rige la calibración embebida) y reconstruye. */
  onVolverACalibracion: () => void;
  /** Reconstruye el marco con lo ya declarado. */
  onReconstruir: () => void;
  /** Estratos con `tau_origen = "manual"`: conservan su tasa. */
  manuales?: number;
  /** `resultado.tau_reseteados` del componente activo. */
  reseteados?: CalcMuestraTauReseteado[];
}) {
  const declarada = fuenteDeclarada(efectividad);
  const construida = fuenteConstruida(aulaFrame);
  const pendiente = efectividadDesactualizada(efectividad, aulaFrame);
  const tauValido = tauDiseno != null && tauDiseno > 0 && tauDiseno <= 1;
  // La tasa declarada se copia del Diseño al declararla. Si después se cambia
  // el Diseño, el marco sigue con la vieja: se dice y se ofrece igualarla.
  const difiereDelDiseno =
    declarada.tipo === "tau_global" && tauValido && declarada.tau != null &&
    Math.round(declarada.tau * 1000) !== Math.round(tauDiseno * 1000);
  const filasMarco = Array.isArray(aulaFrame) ? aulaFrame.length : 0;

  return (
    <section className="cmv2-generales-card cmv2-fuenteef" aria-label="De dónde sale la tasa">
      <header>
        <strong>De dónde sale la tasa</strong>
        <span data-tipo={declarada.tipo}>
          {declarada.tipo === "tau_global"
            ? "tasa única declarada por el estudio"
            : declarada.tipo === "historico"
              ? `histórico propio del estudio${declarada.periodo ? ` · ${declarada.periodo}` : ""}`
              : "calibración de un estudio anterior"}
        </span>
      </header>

      {declarada.tipo === "tau_global" && declarada.tau != null ? (
        <p className="cmv2-tasafac-regla">
          {manuales > 0 ? (
            <>
              Las facultades sin tasa fijada a mano usan <b>{pct(declarada.tau)}</b>.{" "}
              {manuales === 1
                ? "1 la tiene fijada a mano y la conserva."
                : `${fmtInt(manuales)} la tienen fijada a mano y la conservan.`}
            </>
          ) : (
            <>
              Todas las facultades usan <b>{pct(declarada.tau)}</b>: cada aula rinde sus elegibles ×{" "}
              {pct(declarada.tau)}.
            </>
          )}
          {declarada.periodo && <> {declarada.periodo}.</>}
        </p>
      ) : declarada.tipo === "historico" ? (
        <p className="cmv2-tasafac-regla">
          La tasa sale de lo que rindieron las aulas aplicadas en el histórico del estudio.
        </p>
      ) : (
        <p className="cmv2-tasafac-regla">
          La tasa depende del tamaño del aula y se midió en <b>otro estudio</b>. Si este estudio
          no tiene histórico propio, conviene declarar una tasa única.
        </p>
      )}

      {reseteados.length > 0 && (
        <p className="cmv2-tasafac-falta" role="status">
          <span>
            <b>
              {fmtInt(reseteados.length)}{" "}
              {reseteados.length === 1 ? "facultad volvió" : "facultades volvieron"} a la tasa{" "}
              {declarada.tipo === "tau_global" ? "única declarada" : "del diseño"} (
              {pct(reseteados[0].tau_vigente)})
            </b>{" "}
            porque el marco ya no publica su tasa propia:{" "}
            {reseteados.map((r) => `${r.facultad} (antes ${pct(r.tau_anterior)})`).join(", ")}.
          </span>
        </p>
      )}

      {pendiente && (
        <p className="cmv2-tasafac-falta" role="status">
          <b>Pendiente de aplicar.</b> El marco se construyó con{" "}
          {construida?.tipo === "tau_global" && construida.tau != null
            ? `una tasa única de ${pct(construida.tau)}`
            : construida?.tipo === "historico"
              ? "el histórico"
              : "la calibración anterior"}
          ; reconstrúyelo para que rija la declarada.
        </p>
      )}

      {difiereDelDiseno && (
        <p className="cmv2-tasafac-falta" role="status">
          {/* Una sola caja: el aviso es flex con separación y cada nodo suelto
              se aparta del anterior («50,0 % .»). */}
          <span>
            El Diseño usa <b>{pct(tauDiseno)}</b> y la tasa declarada es{" "}
            <b>{pct(declarada.tau as number)}</b>.
          </span>
        </p>
      )}

      <div className="cmv2-fuenteef-acciones">
        {tauValido && (declarada.tipo !== "tau_global" || difiereDelDiseno) && (
          <button
            type="button"
            className="cmv2-tasafac-ir"
            disabled={!puedeReconstruir}
            onClick={() => onDeclararTauGlobal(tauDiseno)}
          >
            {declarada.tipo === "tau_global"
              ? `Igualar a la tasa del Diseño (${pct(tauDiseno)})`
              : `Usar la tasa del Diseño (${pct(tauDiseno)}) para todas`}
          </button>
        )}
        {pendiente && !difiereDelDiseno && (
          <button
            type="button"
            className="cmv2-tasafac-ir"
            disabled={!puedeReconstruir}
            onClick={onReconstruir}
          >
            Reconstruir el marco
          </button>
        )}
        {declarada.tipo === "tau_global" && (
          <button
            type="button"
            className="cmv2-tasafac-ir"
            data-variante="secundaria"
            disabled={!puedeReconstruir}
            onClick={onVolverACalibracion}
          >
            Volver a la calibración
          </button>
        )}
        {!puedeReconstruir && (
          <small>
            {filasMarco
              ? "Declarar reconstruye el marco: hace falta la base cargada."
              : "Carga la base y construye el marco para declarar la tasa."}
          </small>
        )}
      </div>
      {filasMarco > 0 && (
        <p className="cmv2-fuenteef-nota">Se aplica a los {fmtInt(filasMarco)} cursos-horario del marco.</p>
      )}
    </section>
  );
}
