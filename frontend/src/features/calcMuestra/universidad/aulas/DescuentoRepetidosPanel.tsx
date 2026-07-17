/**
 * Panel del descuento de repetidos en la pestaña "Cursos-horario titulares":
 * modo aplicado por el engine (secuencial / auditoría post-selección), resumen
 * bruto vs neto por estrato derivado de las filas titulares (sin recálculos:
 * solo agrega columnas del motor) y el aviso no bloqueante `descuento_sin_ids`
 * cuando el marco no tiene ids parseables y se seleccionó sin descuento.
 * Tolerante a ausencia: si la corrida no trae señal de descuento, no pinta nada.
 */
import { Users } from "lucide-react";
import type { CalcMuestraAulasSelection } from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import {
  buildDescuentoResumen,
  discountModeDetalle,
  discountModeLabel,
  findDescuentoSinIds,
  normalizeDescuentoResumenBloque,
  resolveDiscountMode,
} from "./descuentoRepetidosModel";
import "./aulas.css";

export function DescuentoRepetidosPanel({
  selection,
  m1Rows,
}: {
  selection: CalcMuestraAulasSelection | null;
  /** Filas titulares (M1) de la selección vigente. */
  m1Rows: Array<Record<string, unknown>>;
}) {
  const mode = resolveDiscountMode(selection);
  const sinIds = findDescuentoSinIds(selection);
  // Primario: derivado de las filas titulares (trae aporte neto por estrato);
  // fallback: el resumen por_estrato del bloque del engine.
  const resumen = buildDescuentoResumen(m1Rows) ?? normalizeDescuentoResumenBloque(selection?.sequential_discount);
  const engineUsed = String(selection?.selector_engine_used ?? selection?.selector_engine ?? "");
  if (!mode && !sinIds && !resumen) return null;
  return (
    <section className="cmv2-panel cmv2-aulas-panel cmv2-aulas-descuento-panel" aria-label="Descuento de estudiantes repetidos">
      <div className="cmv2-subhead">
        <strong>Descuento de repetidos</strong>
      </div>
      {sinIds && (
        <AvisoModulo tone="warn" title="Esta selección corrió sin descuento de repetidos.">
          {sinIds.message}
        </AvisoModulo>
      )}
      {mode && !sinIds && (
        <p className="cmv2-aulas-nota-suave cmv2-aulas-descuento-modo">
          <Users size={13} aria-hidden="true" />
          <strong>{discountModeLabel(mode)}.</strong> {discountModeDetalle(mode)}
        </p>
      )}
      {resumen && (
        <>
          <div className="cmv2-classroom-table-wrap">
            <table className="cmv2-table cmv2-classroom-table cmv2-aulas-descuento-tabla">
              <thead>
                <tr>
                  <th>Estrato</th>
                  <th className="is-num">Titulares</th>
                  <th className="is-num">Elegibles bruto</th>
                  <th className="is-num">Elegibles netos</th>
                  <th className="is-num">Ya cubiertos</th>
                  <th className="is-num">Aporte neto</th>
                </tr>
              </thead>
              <tbody>
                {resumen.estratos.map((row) => (
                  <tr key={row.estrato}>
                    <td>{row.estrato}</td>
                    <td className="is-num">{fmtInt(row.aulas)}</td>
                    <td className="is-num">{fmtInt(row.bruto)}</td>
                    <td className="is-num">{fmtInt(row.neto)}</td>
                    <td className="is-num">{fmtInt(row.yaCubiertos)}</td>
                    <td className="is-num">{fmtInt(row.aporteNeto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="is-num">{fmtInt(resumen.total.aulas)}</td>
                  <td className="is-num">{fmtInt(resumen.total.bruto)}</td>
                  <td className="is-num">{fmtInt(resumen.total.neto)}</td>
                  <td className="is-num">{fmtInt(resumen.total.yaCubiertos)}</td>
                  <td className="is-num">{fmtInt(resumen.total.aporteNeto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="cmv2-aulas-nota-suave">
            Bruto = elegibles del aula en el marco; neto = lo que el aula aporta después de descontar a
            los estudiantes ya cubiertos por aulas elegidas antes.
            {engineUsed === "manual_auditable"
              ? " En el método manual auditable, la columna de elegibles netos es el insumo de decisión: compara aulas por lo que aportan de verdad, no por su tamaño bruto."
              : ""}
          </p>
        </>
      )}
    </section>
  );
}
