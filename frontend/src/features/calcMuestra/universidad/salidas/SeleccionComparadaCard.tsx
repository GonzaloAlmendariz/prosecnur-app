/**
 * «La selección nueva contra lo aplicado» — el rendimiento, no los conteos.
 *
 * Pedido de Gonzalo (2026-08-19): comparar EN LA APP lo que se hizo el año
 * anterior con la selección nueva. El embudo comparado ya confronta conteos
 * paso a paso; esta tarjeta confronta lo que importa al cierre: las efectivas
 * que la selección nueva ESPERA (calibradas con las tasas del año pasado)
 * contra las efectivas que el año pasado LOGRÓ, facultad por facultad.
 *
 * Los rótulos dicen el denominador: «aplicadas» para el año anterior (las k
 * aulas donde el equipo llegó a levantar), «titulares» para lo nuevo (lo
 * planificado). Mezclarlos bajo una sola palabra es la trampa medida más
 * repetida del módulo.
 */
import { fmtInt } from "../../sharedCore";
import type {
  CalcMuestraAulasSelection,
  CalcMuestraReferenciaAsistencia,
} from "../../../../api/calcMuestra";
import { seleccionComparada } from "./seleccionComparadaModel";
import "./seleccionComparada.css";

const fmtMiles = (v: number | null): string => (v == null ? "—" : fmtInt(Math.round(v)));

export function SeleccionComparadaCard({
  seleccion,
  referencia,
  periodo,
}: {
  seleccion: CalcMuestraAulasSelection | null;
  referencia: CalcMuestraReferenciaAsistencia | null;
  periodo: string;
}) {
  const comp = seleccionComparada(seleccion, referencia);
  if (!comp.filas.length) return null;
  const etiquetaRef = periodo || "estudio anterior";
  const conRef = comp.totales.efectivasRef != null;

  return (
    <section className="cmv2-generales-card" aria-label="La selección nueva contra lo aplicado">
      <header>
        <strong>La selección nueva contra lo aplicado</strong>
        <span>
          titulares seleccionados hoy vs aulas APLICADAS en {etiquetaRef}; las esperadas salen de
          las tasas de {etiquetaRef}
        </span>
      </header>
      <div className="cmv2-tabla-scroll">
        <table className="cmv2-tabla-comparada">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">Titulares hoy</th>
              <th scope="col">Aplicadas {etiquetaRef}</th>
              <th scope="col">Elegibles hoy</th>
              <th scope="col">Esperadas hoy</th>
              <th scope="col">Efectivas {etiquetaRef}</th>
            </tr>
          </thead>
          <tbody>
            {comp.filas.map((f) => (
              <tr key={f.clave}>
                <th scope="row">{f.facultad}</th>
                <td>{fmtInt(f.aulasNuevas)}</td>
                <td>{fmtMiles(f.aulasAplicadasRef)}</td>
                <td>{fmtInt(f.elegiblesNuevos)}</td>
                <td>{fmtMiles(f.esperadasNuevas)}</td>
                <td>{fmtMiles(f.efectivasRef)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{fmtInt(comp.totales.aulasNuevas)}</td>
              <td>{fmtMiles(comp.totales.aulasAplicadasRef)}</td>
              <td />
              <td>{fmtMiles(comp.totales.esperadasNuevas)}</td>
              <td>{fmtMiles(comp.totales.efectivasRef)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {comp.sinReferencia && (
        <p className="cmv2-nota-denominador">
          Alguna facultad seleccionada no existe en {etiquetaRef}: su fila muestra «—» en las
          columnas de referencia en vez de inventar un cero.
        </p>
      )}
      {conRef && (
        <p className="cmv2-nota-denominador">
          Las columnas no son el mismo momento del operativo: «aplicadas» es donde {etiquetaRef}{" "}
          llegó a levantar datos; «titulares» es lo planificado hoy, antes de campo.
        </p>
      )}
    </section>
  );
}
