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
  onIrACalculo,
}: {
  /** frame.tasas_efectividad_facultad tal como llega (se normaliza adentro). */
  tasasRaw: unknown;
  /** aulas_por_estrato del componente activo (cuota, P25, cupos del motor). */
  estratos: EstratoDimensionado[] | null;
  /** Lleva a donde se resuelve la muestra objetivo y la sobremuestra. */
  onIrACalculo?: () => void;
}) {
  const filas = tasasFacultad(tasasRaw, estratos);
  const origen = origenTasaFacultades(filas);
  if (!filas.length) return null;
  const totalCupos = filas.reduce((s, f) => s + (f.cupos ?? 0), 0);
  const conCuenta = filas.filter((f) => f.cuota != null);
  // Ninguna facultad tiene cuota: no es que les falten datos, es que todavía
  // no se calculó la muestra. Se dice UNA vez y con el camino, en lugar de
  // repetir «sin estrato dimensionado» en cada fila — que se lee como si el
  // problema fuera de la facultad.
  const faltaCalcular = conCuenta.length === 0;

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

      {faltaCalcular && (
        <p className="cmv2-tasafac-falta" role="note">
          <b>Falta calcular la muestra.</b> La cuota de cada facultad es su parte de la
          sobremuestra operativa, y sin ella no hay titulares que mostrar acá. Las tasas de
          abajo ya están medidas sobre el marco.
          {onIrACalculo && (
            <button type="button" className="cmv2-tasafac-ir" onClick={onIrACalculo}>
              Ir a Propuestas
            </button>
          )}
        </p>
      )}

      <ol className="cmv2-tasafac-lista" data-origen-global={origen}>
        {filas.map((f) => (
          <li key={f.facultad} className="cmv2-tasafac-fila">
            <div className="cmv2-tasafac-nombre">
              <b>{f.facultad}</b>
              {f.respaldoFino && (
                <span
                  className="cmv2-tasafac-chip"
                  data-origen="fino"
                  title={`La tasa se calcula sobre ${fmtInt(f.nAulasMarco)} ${f.nAulasMarco === 1 ? "aula" : "aulas"} del marco: son muy pocas para leerla como un patrón de la facultad.`}
                >
                  sobre {fmtInt(f.nAulasMarco)} {f.nAulasMarco === 1 ? "aula" : "aulas"}
                </span>
              )}
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
            {/* De dónde sale ESA tasa, con sus dos factores a la vista. El
                motor los publica por separado justamente para poder mostrarlos
                (calc_muestra_aulas_efectividad.R); si no reconstruyen la tasa
                vigente, el modelo los anula y esta línea no se dibuja. */}
            {f.mix != null && f.residual != null && (
              <p className="cmv2-tasafac-desglose">
                <span className="cmv2-tasafac-factor">
                  <b>{pctTasa(f.mix)}</b>
                  <small>por el tamaño de sus aulas</small>
                </span>
                {f.residual !== 1 ? (
                  <>
                    <span className="cmv2-tasafac-op">×</span>
                    <span className="cmv2-tasafac-factor">
                      <b>{coma(f.residual, 2)}</b>
                      <small>
                        {f.residual > 1 ? "rindió más que su tamaño" : "rindió menos que su tamaño"} en {f.k != null ? `${fmtInt(f.k)} aulas de` : ""} el histórico
                      </small>
                    </span>
                  </>
                ) : (
                  <span className="cmv2-tasafac-factor" data-sin-ajuste="true">
                    <small>el histórico no dio base propia para ajustarla</small>
                  </span>
                )}
              </p>
            )}
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
                {faltaCalcular ? "titulares tras calcular la muestra" : "esta facultad no entró al reparto"}
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
