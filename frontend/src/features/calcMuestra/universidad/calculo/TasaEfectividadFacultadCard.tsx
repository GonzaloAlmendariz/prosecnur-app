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
import { CurvaRendimientoDiagrama } from "./CurvaRendimientoDiagrama";
import { estadisticoDelReparto, fraseEstadistico, nombreEstadistico } from "./estadisticoAula";
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
  // El diagrama necesita los tramos que publica el motor; sin ellos (motor
  // anterior) queda la prosa corta.
  const hayDiagrama = filas.some((f) => f.tramos.length > 0);
  // El divisor NO es siempre el P25: lo decide el analista y el motor declara
  // cuál usó. Se lee del reparto en vez de escribirlo a mano.
  const estadistico = estadisticoDelReparto(estratos);
  const nombreDivisor = nombreEstadistico(estadistico);

  return (
    <section
      className="cmv2-generales-card cmv2-tasafac"
      aria-label="La tasa de efectividad de cada facultad"
    >
      <header>
        <strong>La tasa de efectividad de cada facultad</strong>
        <span>
          el aula típica de cada facultad ({fraseEstadistico(estadistico)}, arriba) rinde ese
          tamaño × tasa efectivas; la cuota se divide entre ese rendimiento para llegar a los
          titulares
        </span>
      </header>

      {/* C5 · Sin esto la tabla enseña porcentajes sin decir de dónde salen, y
          el contraste entre chips se malinterpreta como «unas usan el
          histórico y otras no». */}
      <p className="cmv2-tasafac-regla" role="note">
        <b>Todas las facultades usan el estudio anterior; seis lo usan dos veces.</b>{" "}
        La <b>función de efectividad según tamaño</b> (cuánto rinde un aula de 12, de 30 o
        de 50 alumnos) se estima sobre el histórico completo, con las aulas de todas las
        facultades juntas, y se aplica a la <b>composición por tamaño</b> de cada una (qué
        mezcla de aulas grandes y chicas tiene hoy en el marco). Eso da su efectividad
        esperada. Cuando una facultad aplicó 12 aulas o más el año pasado se le estima
        además su <b>razón observado/esperado</b> (si rindió por encima o por debajo de lo
        que su tamaño predecía) y se multiplica. Con menos de 12 esa razón sería ruido y se
        fija en 1, el valor neutro; <b>nunca se sustituye por una tasa general</b>.
      </p>

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
              {/*
                * Los rótulos contrastaban «medida en el histórico» contra
                * «derivada de su mix», y eso se leía como que la segunda NO
                * usaba el histórico. Sí lo usa: la curva de cuánto rinde un
                * aula según su tamaño se mide sobre el estudio anterior
                * ENTERO. Lo que separa a los dos casos es si además hay
                * suficientes aulas propias (k ≥ 12) para estimarle un factor
                * de facultad. Gonzalo, 2026-08-21, tras leer la tarjeta:
                * «sigo sin entender qué pasa cuando una facultad tuvo menos
                * de doce aulas aplicadas el año pasado».
                */}
              {f.conResidual ? (
                <span
                  className="cmv2-tasafac-chip"
                  data-origen="historico"
                  title={`Su composición por tamaño (la mezcla de aulas que tiene en el marco) y además su razón observado/esperado: en 2025 aplicó ${f.k != null ? fmtInt(f.k) : "—"} aulas, suficientes para medir si rinde por encima o por debajo de lo que su tamaño predice.`}
                >
                  composición × razón O/E 2025 · k={f.k != null ? fmtInt(f.k) : "—"}
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
                <span
                  className="cmv2-tasafac-chip"
                  data-origen="mix"
                  title="Aplicó menos de 12 aulas en 2025, así que no se le estima una razón observado/esperado propia (sobre tan pocos casos sería ruido) y se fija en 1: rinde lo que su tamaño predice. La función de efectividad según tamaño sí sale del histórico; lo propio de esta facultad es su composición por tamaño."
                >
                  composición por tamaño · sin razón propia
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
                title={`El aula típica de la facultad —${nombreDivisor}— rinde ${Number.isInteger(f.p25) ? fmtInt(f.p25) : coma(f.p25, 1)} alumnos × ${pctTasa(f.tasa)} ≈ ${coma(f.p25 * f.tasa, 1)} efectivas; la cuota se divide entre eso.`}
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
            {/* El motor calculó OTRA tasa para esta facultad desde su marco y
                no es la que dimensiona. Se declara: quien lee tiene que poder
                ver que hay dos, y cuál manda. */}
            {f.tasaMarco != null && (
              <p className="cmv2-tasafac-otra" role="note">
                Su marco de {fmtInt(f.nAulasMarco)} aulas rinde <b>{pctTasa(f.tasaMarco)}</b> según
                el tamaño de cada una; el dimensionamiento usa {pctTasa(f.tasa)}.
              </p>
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
        {/* El diagrama sustituye al párrafo que describía la curva sin
            mostrarla. Si el motor no publica los tramos vuelve la prosa —
            corta, la larga era justamente lo que sobraba. */}
        {hayDiagrama ? (
          <CurvaRendimientoDiagrama filas={filas} />
        ) : (
          <p>
            <b>De dónde sale cada tasa</b>: el aula típica de la facultad según su mezcla real de
            tamaños —las chicas rinden más que las grandes—, ajustada por lo que la facultad rindió
            en el histórico, sólo donde acumuló base suficiente.
          </p>
        )}
        <p className="cmv2-tasafac-pie-nota">
          La cuenta de cada aula concreta vive en{" "}
          <i>Selección → Solidez → De dónde sale el esperado de cada aula</i>.
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
