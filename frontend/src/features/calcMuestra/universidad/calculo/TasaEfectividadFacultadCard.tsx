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
import { tasasFacultad, type EstratoDimensionado, origenTasaFacultades } from "./tasaFacultadModel";
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
  const origen = origenTasaFacultades(filas);
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
          el aula típica de cada facultad (su P25 de elegibles, arriba) rinde P25 × tasa
          efectivas; la cuota se divide entre ese rendimiento para llegar a los titulares
        </span>
      </header>

      <ol className="cmv2-tasafac-lista" data-origen-global={origen}>
        {filas.map((f) => (
          <li key={f.facultad} className="cmv2-tasafac-fila">
            <div className="cmv2-tasafac-nombre">
              <b>{f.facultad}</b>
              {f.conResidual ? (
                <span className="cmv2-tasafac-chip" data-origen="historico">
                  medida en el histórico · k={f.k != null ? fmtInt(f.k) : "—"}
                </span>
              ) : origen === "general" ? (
                /* Sin histórico la tasa no se deriva de nada: es la de
                   referencia del preset, idéntica en todas. Decir «derivada de
                   su mix» prometía un cálculo propio que no ocurrió. */
                <span
                  className="cmv2-tasafac-chip"
                  data-origen="general"
                  title="Este estudio todavía no tiene datos propios de efectividad: se usa la tasa de referencia, igual para todas las facultades."
                >
                  tasa de referencia, sin datos propios
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
              // El concepto intermedio que faltaba (Gonzalo: «no entiendo como
              // llegamos a esos titulares»): el aula tipica RINDE P25 × tasa
              // efectivas, y la cuota se divide entre eso.
              <div
                className="cmv2-tasafac-cuenta"
                title={`El aula típica de la facultad rinde ${Number.isInteger(f.p25) ? fmtInt(f.p25) : coma(f.p25, 1)} alumnos × ${pctTasa(f.tasa)} ≈ ${coma(f.p25 * f.tasa, 1)} efectivas; la cuota se divide entre eso.`}
              >
                <span className="cmv2-tasafac-num"><b>{fmtInt(f.cuota)}</b><small>cuota</small></span>
                <span className="cmv2-tasafac-op">÷</span>
                <span className="cmv2-tasafac-num"><b>{coma(f.p25 * f.tasa, 1)}</b><small>efectivas por aula típica</small></span>
                <span className="cmv2-tasafac-op">→</span>
                <span className="cmv2-tasafac-num cmv2-tasafac-res"><b>{fmtInt(f.cupos)}</b><small>{f.cupos === 1 ? "titular" : "titulares"}</small></span>
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
