import { Fragment, useMemo, useState } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import {
  calcularCarga,
  comoHora,
  ejeSugerido,
  porPabellon,
  type EjeDeCarga,
  type OpcionesDeCarga,
} from "./cargaDeCampo";
import { fmt } from "./kpisDeAulas";

/**
 * Cuánta gente hace falta en campo, a qué hora y en qué edificio.
 *
 * La pregunta que contesta no la contesta ninguna otra pestaña: Agenda lista el
 * plan por curso-horario y Por facultad dice a dónde ir cada día, pero ninguna
 * dice **cuántos aplicadores tienen que estar a la vez**. Eso depende del RANGO
 * de cada clase, no de su hora de inicio: medido sobre el plan de HSVG 2026,
 * contar por hora de inicio daba un pico de 8 aulas simultáneas y contar el
 * rango real da 19.
 *
 * Y depende de cuánto dure la aplicación dentro del aula, que es una decisión
 * del operativo y no un dato del plan: con 30 minutos al inicio bastan 8
 * aplicadores; si el encuestador se queda toda la sesión hacen falta 19. Por eso
 * los dos parámetros son controles y no constantes — el mismo plan admite
 * operativos de tamaño muy distinto.
 *
 * ## Dos lecturas del mismo plan
 *
 * **Patrón semanal** —seis filas, lunes a sábado— dimensiona el equipo mientras
 * casi nada está agendado. **Calendario** pone una fila por fecha concreta, que
 * es lo que hace falta cuando el operativo ya está confirmado: el campo se
 * reparte en varias semanas, y sobre el patrón dos aulas del mismo día de la
 * semana en semanas distintas caen en la misma celda e inventan un pico.
 *
 * La vista abre con la que corresponde al estado del estudio —`ejeSugerido`— y
 * el usuario cambia cuando quiera.
 */
const DURACION_POR_DEFECTO = 30;

const tituloDeCelda = (fila: string, hora: string, firme: number, plausible: number, enCurso: number): string =>
  [
    `${fila} ${hora}`,
    `${fmt(firme)} confirmados`,
    plausible ? `hasta ${fmt(plausible)} por agendar` : "",
    `${fmt(enCurso)} aulas en curso`,
  ]
    .filter(Boolean)
    .join(" · ");

export function AulasCargaDeCampo({
  filas,
  onExportar,
}: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * El libro sale con lo que hay EN PANTALLA —eje y duración—, no con los
   * valores por defecto: la duración es un control y exportar 30 minutos
   * mientras el usuario mira 90 entrega un pico que no es el que decidió.
   */
  onExportar?: (opciones: OpcionesDeCarga) => void;
}) {
  const [duracionMin, setDuracion] = useState(DURACION_POR_DEFECTO);
  // `null` = todavía no lo eligió nadie, así que manda la sugerencia. Fijar el
  // eje en el estado inicial lo congelaría con el plan VACÍO del primer render
  // —el dashboard llega después— y la vista abriría siempre en semanal por muy
  // agendado que estuviera el estudio.
  const [ejeElegido, setEje] = useState<EjeDeCarga | null>(null);
  const eje = ejeElegido ?? ejeSugerido(filas);

  const malla = useMemo(
    () => calcularCarga(filas, { duracionMin, eje }),
    [filas, duracionMin, eje],
  );
  const pabellones = useMemo(() => porPabellon(filas), [filas]);

  // Sólo se pintan las franjas donde ocurre algo: de 07:00 a 22:00 hay treinta
  // columnas y más de un tercio están siempre vacías.
  const vivas = useMemo(
    () =>
      malla.franjas
        .map((_, j) => j)
        .filter((j) => malla.filas.some((__, d) => malla.aulas[d][j] > 0)),
    [malla],
  );
  // Una escala por capa. Con un tope unico, el carril —que suma todas las
  // semanas— marcaba el maximo y las fechas quedaban todas en el tono mas
  // palido: 15 dias de operativo se veian como un lavado uniforme.
  // El suelo es 2, no 1. Con un maximo de 1 aula simultanea, dividir por el
  // maximo pinta TODA celda ocupada al 100% y la malla dice «pico en todas
  // partes» donde en realidad no se solapa nada: un aplicador a la vez no es
  // carga maxima. Con el suelo, 1 se lee palido y el color solo se satura
  // cuando de verdad hay concurrencia.
  const escala = (matriz: number[][]) => Math.max(2, ...malla.filas.map((_, d) => Math.max(...matriz[d])));
  const topeFirme = escala(malla.firmes);
  const topePlausible = escala(malla.plausibles);
  const conHorario = filas.filter((f) => !f.sample_role || f.sample_role === "titular").length - malla.sinHorario;

  if (!conHorario) {
    return (
      <section className="aulas-carga" data-qa-geometry-group="aulas-carga" data-qa-geometry-contract="intrinsic">
        <header className="aulas-carga-cab">
          <h3>Carga de campo</h3>
          <p>Cuántos aplicadores hacen falta a la vez, según el horario de cada curso.</p>
        </header>
        <p className="aulas-carga-vacio">
          El plan no trae el horario de los cursos-horario. Se completa al construir el marco desde el catálogo
          de Cursos-Horarios, que es de donde sale el rango de cada sesión.
        </p>
      </section>
    );
  }

  /**
   * Dos escalas de color, no una: lo CONFIRMADO en verde y lo que falta agendar
   * en el tono del módulo. Un solo degradado hacía pasar por lo mismo un hecho
   * —el docente ya dio hora— y un techo —cualquier tramo de su clase es
   * posible—, que es justo la distinción que esta vista existe para mostrar.
   */
  const celda = (firme: number, plausible: number) => {
    if (firme + plausible === 0) return { background: "var(--pulso-surface-2)", color: "var(--pulso-text-faint)" };
    if (firme > 0) {
      const t = firme / topeFirme;
      return {
        background: `color-mix(in srgb, var(--pulso-success-fg) ${Math.round(22 + t * 78)}%, var(--pulso-surface-2))`,
        color: t > 0.45 ? "var(--pulso-surface)" : "var(--pulso-text)",
      };
    }
    const t = plausible / topePlausible;
    return {
      color: "var(--pulso-text-soft)",
      background: `color-mix(in srgb, var(--pulso-module-monitoring) ${Math.round(8 + t * 30)}%, var(--pulso-surface))`,
      boxShadow: "inset 0 0 0 1px var(--pulso-border)",
    };
  };

  const primeraPorAgendar = malla.filas.findIndex((f) => f.porAgendar);
  const cuando = malla.pico ? `${malla.pico.fila.etiqueta} ${comoHora(malla.pico.franja)}` : "—";

  return (
    <section className="aulas-carga" data-qa-geometry-group="aulas-carga" data-qa-geometry-contract="intrinsic">
      <header className="aulas-carga-cab">
        <div>
          <h3>Carga de campo</h3>
          <p>
            Cuántos aplicadores hacen falta a la vez. Lo confirmado se cuenta en su hora;
            lo que falta agendar, como rango posible sobre la clase entera.
          </p>
        </div>
        <div className="aulas-carga-acciones">
          {/* El eje es una LECTURA del mismo plan, no un filtro: por eso es un
              par de pestañas y no un desplegable con opciones sueltas. */}
          <div className="aulas-carga-eje" role="group" aria-label="Cómo se ordenan las filas">
            {([
              ["semana", "Patrón semanal", "Lunes a sábado, sobre el horario del curso"],
              ["calendario", "Calendario", "Una fila por fecha agendada"],
            ] as const).map(([valor, rotulo, ayuda]) => (
              <button
                key={valor}
                type="button"
                className={eje === valor ? "es-activo" : ""}
                aria-pressed={eje === valor}
                title={ayuda}
                onClick={() => setEje(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {onExportar ? (
            <button type="button" className="aulas-carga-exportar" onClick={() => onExportar({ duracionMin, eje })}>
              Descargar Excel
            </button>
          ) : null}
        </div>
      </header>

      <div className="aulas-carga-controles">
        <label>
          <span>
            Duración de la aplicación: <strong>{fmt(duracionMin)} min</strong>
            <em>sólo afecta a las aulas ya agendadas</em>
          </span>
          <input
            type="range"
            min={10}
            max={180}
            step={5}
            value={duracionMin}
            onChange={(e) => setDuracion(Number(e.target.value))}
            aria-label="Duración de la aplicación dentro del aula, en minutos"
          />
        </label>
        <dl className="aulas-carga-kpis">
          <div>
            <dt>Confirmados en el pico</dt>
            <dd>{fmt(malla.pico?.firmes ?? 0)}</dd>
          </div>
          {/* El segundo indicador NO puede sumar el carril al pico de una fecha:
              son dos denominadores distintos —un día concreto contra el patrón
              de todas las semanas— y sumarlos da un número que no ocurre nunca.
              Por eso cada lectura tiene los suyos. */}
          {eje === "calendario" ? (
            <>
              <div>
                <dt>Cuándo</dt>
                <dd className="es-texto">{cuando}</dd>
              </div>
              <div>
                <dt>Por agendar, en el pico del patrón</dt>
                <dd>{fmt(malla.picoPorAgendar?.plausibles ?? 0)}</dd>
              </div>
              <div>
                <dt>Días de campo</dt>
                <dd>{fmt(malla.fechas)}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Hasta, si caen los que faltan</dt>
                <dd>{fmt((malla.pico?.firmes ?? 0) + (malla.pico?.plausibles ?? 0))}</dd>
              </div>
              <div>
                <dt>Cuándo</dt>
                <dd className="es-texto">{cuando}</dd>
              </div>
              <div>
                <dt>Aulas en curso entonces</dt>
                <dd>{fmt(malla.pico?.aulas ?? 0)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {eje === "calendario" && malla.fechas === 0 ? (
        <p className="aulas-carga-aviso">
          Ninguna aula tiene fecha todavía, así que el calendario sólo puede mostrar el carril de las que
          faltan agendar. El patrón semanal es la lectura que dimensiona el equipo mientras tanto.
        </p>
      ) : null}

      <div className="aulas-carga-malla-scroll">
        <table className="aulas-carga-malla">
          <caption className="pulso-sr-only">
            Aplicadores ocupados por {eje === "calendario" ? "fecha" : "día"} y franja horaria, con{" "}
            {fmt(duracionMin)} minutos de aplicación
          </caption>
          <thead>
            <tr>
              <th scope="col">{eje === "calendario" ? "Fecha" : "Día"}</th>
              {vivas.map((j) => (
                <th key={j} scope="col">{comoHora(malla.franjas[j])}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {malla.filas.map((fila, d) => (
              <Fragment key={fila.clave}>
                {/* El carril de lo que falta agendar se separa con su propio
                    rótulo: son días de la semana, no fechas, y sin decirlo se
                    leerían como una fecha más del calendario. */}
                {eje === "calendario" && d === primeraPorAgendar ? (
                  <tr className="aulas-carga-carril">
                    <th scope="row" colSpan={vivas.length + 1}>
                      Por agendar · todavía sin fecha, sobre el horario del curso
                    </th>
                  </tr>
                ) : null}
                <tr className={fila.porAgendar ? "es-por-agendar" : undefined}>
                  <th scope="row">{fila.etiqueta}</th>
                  {vivas.map((j) => {
                    const firme = malla.firmes[d][j];
                    const plausible = malla.plausibles[d][j];
                    const n = firme + plausible;
                    return (
                      <td key={j}>
                        <span
                          className="aulas-carga-celda"
                          style={celda(firme, plausible)}
                          title={tituloDeCelda(fila.etiqueta, comoHora(malla.franjas[j]), firme, plausible, malla.aulas[d][j])}
                        >
                          {n || ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="aulas-carga-pie">
        <ul className="aulas-carga-leyenda">
          <li><i style={celda(topeFirme, 0)} aria-hidden="true" />Confirmado · hora acordada</li>
          <li><i style={celda(0, topePlausible)} aria-hidden="true" />Por agendar · toda su clase es posible</li>
          <li className="aulas-carga-estado">
            {fmt(malla.agendadas)} de {fmt(malla.agendadas + malla.porAgendar)} aulas ya tienen hora
          </li>
        </ul>
        <p className="aulas-carga-pabellones">
          <span>Por pabellón:</span>{" "}
          {pabellones.slice(0, 9).map((p, i) => (
            <span key={p.pabellon}>
              {i ? " · " : ""}
              <strong>{p.pabellon}</strong> {fmt(p.aulas)}
            </span>
          ))}
        </p>
      </div>

      {eje === "calendario" && malla.agendadasSinFecha > 0 ? (
        <p className="aulas-carga-aviso">
          {malla.agendadasSinFecha === 1
            ? "1 aula tiene hora acordada pero no fecha, así que no cabe"
            : `${fmt(malla.agendadasSinFecha)} aulas tienen hora acordada pero no fecha, así que no caben`}{" "}
          en el calendario. {malla.agendadasSinFecha === 1 ? "Aparece" : "Aparecen"} en el patrón semanal.
        </p>
      ) : null}

      {malla.sinHorario > 0 ? (
        <p className="aulas-carga-aviso">
          {fmt(malla.sinHorario)} de {fmt(malla.sinHorario + conHorario)} aulas no declaran horario en el
          catálogo y no entran en este cálculo.
        </p>
      ) : null}
    </section>
  );
}
