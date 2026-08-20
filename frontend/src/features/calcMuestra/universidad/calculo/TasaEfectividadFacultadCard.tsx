/**
 * «La tasa de efectividad de cada facultad» — la tarjeta didáctica de
 * Cursos-horario requeridos (plan 1b/E8).
 *
 * Mandato de Gonzalo, textual: «sumamente explicada de forma visual y
 * didáctica y explicativa en Cursos-horario requeridos, porque ahí se pide
 * cuántas aulas se requieren por facultad sabiendo la tasa de efectividad
 * por facultad».
 *
 * Cada fila cuenta la historia completa de una facultad: su tasa (con el
 * origen declarado — medida en el histórico o derivada de su mix), la barra
 * a escala común, y la aritmética viva del dimensionamiento reproducida:
 * cuota ÷ (P25 × tasa) → cupos. Un descuadre con el motor se declara.
 */
import { fmtInt } from "../../sharedCore";
import { tasasFacultad, type EstratoDimensionado } from "./tasaFacultadModel";
import "./tasaFacultad.css";

const pctTasa = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const coma = (v: number, dec = 2) => v.toFixed(dec).replace(".", ",");

export function TasaEfectividadFacultadCard({
  tasasRaw,
  estratos,
}: {
  /** frame.tasas_efectividad_facultad tal como llega (se normaliza adentro). */
  tasasRaw: unknown;
  /** aulas_por_estrato del componente activo (cuota, P25, cupos del motor). */
  estratos: EstratoDimensionado[] | null;
}) {
  const filas = tasasFacultad(tasasRaw, estratos);
  if (!filas.length) return null;
  const totalCupos = filas.reduce((s, f) => s + (f.cupos ?? 0), 0);
  const conCuenta = filas.filter((f) => f.cuota != null);

  return (
    <section
      className="cmv2-generales-card cmv2-tasafac"
      aria-label="La tasa de efectividad de cada facultad"
    >
      <header>
        <strong>La tasa de efectividad de cada facultad</strong>
        <span>
          de cada 100 elegibles en lista, cuántas encuestas efectivas deja el aula típica de la
          facultad; es el divisor que convierte su cuota en cursos-horario titulares
        </span>
      </header>

      <ol className="cmv2-tasafac-lista">
        {filas.map((f) => (
          <li key={f.facultad} className="cmv2-tasafac-fila">
            <div className="cmv2-tasafac-nombre">
              <b>{f.facultad}</b>
              {f.conResidual ? (
                <span className="cmv2-tasafac-chip" data-origen="historico">
                  medida en el histórico · k={f.k != null ? fmtInt(f.k) : "—"}
                </span>
              ) : (
                <span className="cmv2-tasafac-chip" data-origen="mix">
                  derivada de su mix de tamaños
                </span>
              )}
            </div>
            <div className="cmv2-tasafac-carril" role="img" aria-label={`Tasa de ${f.facultad}: ${pctTasa(f.tasa)}`}>
              <i className="cmv2-tasafac-track">
                <b style={{ width: `${Math.min(100, f.tasa * 100)}%` }} data-origen={f.conResidual ? "historico" : "mix"} />
              </i>
              <span className="cmv2-tasafac-valor">{pctTasa(f.tasa)}</span>
            </div>
            {f.cuota != null && f.p25 != null && f.cupos != null ? (
              <div className="cmv2-tasafac-cuenta" title="cuota ÷ (alumnos por CH × tasa de efectividad) = cursos-horario titulares">
                {fmtInt(f.cuota)} ÷ ({Number.isInteger(f.p25) ? fmtInt(f.p25) : coma(f.p25, 1)} × {coma(f.tasa)}) →{" "}
                <b>{fmtInt(f.cupos)} {f.cupos === 1 ? "titular" : "titulares"}</b>
              </div>
            ) : (
              <div className="cmv2-tasafac-cuenta" data-vacia="true">
                sin estrato dimensionado
              </div>
            )}
            {f.cuentaCuadra === false && (
              <p className="cmv2-tasafac-descuadre" role="note">
                La cuenta local no reproduce los titulares del motor: revisa que el estrato y la
                tasa sellada sean los vigentes.
              </p>
            )}
          </li>
        ))}
      </ol>

      <footer className="cmv2-tasafac-pie">
        <p>
          <b>De dónde sale cada tasa</b>: el aula típica de la facultad según su mezcla real de
          tamaños (las aulas chicas rinden más que las grandes), ajustada por lo que la facultad
          rindió en el histórico más allá de su mix — solo donde el histórico acumuló base
          suficiente (chip «medida»); en las demás rige su mix, declarado. La cuenta de cada
          aula concreta vive en <i>Selección → Solidez → De dónde sale el esperado de cada aula</i>.
        </p>
        {conCuenta.length > 0 && (
          <p className="cmv2-tasafac-total">
            Σ {fmtInt(totalCupos)} titulares para {fmtInt(conCuenta.length)} facultades.
          </p>
        )}
      </footer>
    </section>
  );
}
