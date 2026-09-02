import { Fragment, useMemo, useState } from "react";

import type { MonitoreoAulasFranjas, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import {
  calcularCarga,
  comoHora,
  ejeSugerido,
  hayHorarioDeCurso,
  porPabellon,
  ventanasDelMotor,
  type EjeDeCarga,
  type OpcionesDeCarga,
} from "./cargaDeCampo";
import { etiquetaDeFecha } from "./agendaPorDia";
import { hoyISO } from "./calendarioDeAgenda";
import { semanaInicial, semanasDeCarga } from "./semanasDeCarga";
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
    `${fmt(enCurso)} cursos-horario en curso`,
  ]
    .filter(Boolean)
    .join(" · ");

/** «2026-09-12» → «sáb 12/09»: la fecha exacta, corta para una línea de detalle. */
const fechaCorta = (iso: string): string => {
  const etiqueta = etiquetaDeFecha(iso); // «Sábado 12/09», o el crudo si no parsea
  const m = /^(\p{L}+) (.+)$/u.exec(etiqueta);
  return m ? `${m[1].slice(0, 3).toLowerCase()} ${m[2]}` : etiqueta;
};

/** El momento pactado de la clase, en palabras del operativo. */
const MOMENTO_LEGIBLE = { inicio: "al inicio", intermedio: "en el receso", final: "al final" } as const;

/** El nombre accesible de una celda ocupada: sus dos capas, concordadas. */
const nombreDeCelda = (fila: string, hora: string, firme: number, plausible: number): string => {
  const partes = [
    firme ? `${fmt(firme)} ${firme === 1 ? "confirmado" : "confirmados"}` : "",
    plausible ? `hasta ${fmt(plausible)} por agendar` : "",
  ].filter(Boolean);
  return `${fila} ${hora}: ${partes.join(", ")}`;
};

export function AulasCargaDeCampo({
  filas,
  franjas,
  onExportar,
}: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * El bloque `franjas` del dashboard: las ventanas confirmadas YA parseadas
   * por el motor. La malla posiciona los confirmados desde aquí y nunca desde
   * `scheduled_time` crudo — el bug del 2026-09-02: «8:00pm» re-parseado en
   * el cliente pintaba a las 08:00 y el pico quedaba mal contado.
   */
  franjas?: MonitoreoAulasFranjas | null;
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
  // La celda explorada (dictado en vivo 2026-09-02: «cada 30 mins con
  // hover»): hover o foco la asoman, un click la fija. Estado UI efímero de
  // esta superficie — no es un panel enlazable ni un foco de entidad, el
  // mismo criterio que el eslabón de la Agenda.
  const [celdaActiva, setCeldaActiva] = useState<{ d: number; j: number } | null>(null);
  const [fijada, setFijada] = useState(false);
  // La semana visible del calendario. `null` = todas: paginar es un gesto del
  // usuario, no un recorte de apertura.
  const [semanaIdx, setSemanaIdx] = useState<number | null>(null);

  const ventanas = useMemo(() => ventanasDelMotor(franjas), [franjas]);
  const malla = useMemo(
    () => calcularCarga(filas, { duracionMin, eje, ventanas }),
    [filas, duracionMin, eje, ventanas],
  );
  const pabellones = useMemo(() => porPabellon(filas), [filas]);
  const { semanas, sinSemana } = useMemo(() => semanasDeCarga(malla.filas), [malla]);
  // Qué filas de fecha están en pantalla. `null` = todas; las fechas sin
  // semana legible se pintan SIEMPRE — recortarlas al paginar sería perder
  // filas que la malla completa sí enseña.
  const visibles = useMemo(() => {
    if (eje !== "calendario" || semanaIdx === null || !semanas[semanaIdx]) return null;
    return new Set([...semanas[semanaIdx].indices, ...sinSemana]);
  }, [eje, semanaIdx, semanas, sinSemana]);

  const cambiarEje = (valor: EjeDeCarga) => {
    // Los índices de celda y semana son de la malla del eje: al cambiarlo se
    // sueltan, o apuntarían a otra fila con el mismo número.
    setEje(valor);
    setCeldaActiva(null);
    setFijada(false);
    setSemanaIdx(null);
  };
  const paginar = (delta: number) => {
    setSemanaIdx((prev) => {
      const base = prev ?? (delta > 0 ? -1 : semanas.length);
      return Math.min(semanas.length - 1, Math.max(0, base + delta));
    });
  };

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
  // Cuántas aulas SÍ entran en la malla. La usa el aviso del pie, y la rama
  // vacía se decide con `hayHorarioDeCurso()`, que es la misma pregunta que hace
  // quien envuelve este panel para decidir si le da el alto de la pantalla.
  // Son dos expresiones del mismo número —`titulares − sinHorario` es por
  // definición `unidades.length`— y `cargaDeCampo.test.ts` fija que no se
  // separen.
  const conHorario = filas.filter((f) => !f.sample_role || f.sample_role === "titular").length
    - malla.sinHorario;

  if (!hayHorarioDeCurso(filas)) {
    return (
      <section className="aulas-carga" data-qa-geometry-group="aulas-carga" data-qa-geometry-contract="intrinsic">
        <header className="aulas-carga-cab">
          <h3>Carga de campo</h3>
          {/* «Según el horario» admite justo la lectura que esta pantalla
              existe para corregir: la de contar por hora de INICIO, que sobre
              el plan de HSVG 2026 da un pico de 8 y el rango real da 19. La
              rama con datos ya lo dice con precisión y el Excel también; ésta,
              que es la que se ve mientras el plan no trae horarios, era la
              única de las tres que se prestaba al malentendido. */}
          <p>Cuántos aplicadores hacen falta a la vez, sobre el rango horario de cada curso.</p>
        </header>
        {/* La rama vacía declara lo mismo que la de datos: es donde el grupo
            se quedaba sin contenedor declarado y el `header` entraba en la
            medida con sus 4 px. */}
        <p className="aulas-carga-vacio" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
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
    // La celda vacía NO se pinta: transparente deja pasar la regla de la hora
    // que lleva el `td`, y así la estructura de la malla la dan las horas y no
    // un campo de bloques grises compitiendo con los ocupados.
    if (firme + plausible === 0) return { background: "transparent", color: "var(--pulso-text-faint)" };
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

  // El carril «por agendar» NO se pinta en el calendario (dictado en vivo
  // 2026-09-02: «el por agendar ya está en patrón semanal, no lo necesitas en
  // calendario»): es el patrón de lo pendiente y su sitio es el eje semanal.
  // El KPI «Por agendar, en el pico del patrón» queda declarando dónde vive.
  /**
   * Qué filas abren una semana nueva, para separarlas con una regla.
   *
   * Quince fechas seguidas se leen como una lista plana; en semanas se leen como
   * el operativo que son. Se detecta por el día de la semana yendo hacia atrás o
   * repitiéndose —las fechas vienen ordenadas—, y no por «es lunes»: un campo
   * que arranca un miércoles no tiene lunes en su primera semana.
   */
  const abreSemana = useMemo(() => {
    const marcas = new Set<string>();
    let previo = -Infinity;
    for (const fila of malla.filas) {
      if (fila.porAgendar || fila.fecha === undefined) continue;
      if (previo !== -Infinity && fila.dia <= previo) marcas.add(fila.clave);
      previo = fila.dia;
    }
    return marcas;
  }, [malla]);
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
                onClick={() => cambiarEje(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {onExportar ? (
            /* El Excel sale con las MISMAS ventanas del motor que la vista:
               exportar con el texto crudo re-parsearía el «8:00pm». */
            <button type="button" className="aulas-carga-exportar" onClick={() => onExportar({ duracionMin, eje, ventanas })}>
              Descargar Excel
            </button>
          ) : null}
        </div>
      </header>

      <div className="aulas-carga-controles" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <label>
          <span>
            Duración de la aplicación: <strong>{fmt(duracionMin)} min</strong>
            <em>sólo afecta a los cursos-horario ya agendados</em>
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
                <dt>Cursos-horario en curso entonces</dt>
                <dd>{fmt(malla.pico?.aulas ?? 0)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {eje === "calendario" && malla.fechas === 0 ? (
        <p className="aulas-carga-aviso">
          Ningún curso-horario tiene fecha todavía, así que el calendario no tiene filas que
          mostrar. El patrón semanal es la lectura que dimensiona el equipo mientras tanto — y es
          donde vive lo que falta agendar.
        </p>
      ) : null}

      {/* El pager por semana (dictado en vivo 2026-09-02: «scrolleable por
          semana»). Abre en «todas»: paginar es un gesto del usuario, no un
          recorte de apertura. «Hoy» salta a la semana del reloj del usuario. */}
      {eje === "calendario" && semanas.length > 1 ? (
        <div className="aulas-carga-semana" role="group" aria-label="Semana visible">
          <button type="button" onClick={() => paginar(-1)} aria-label="Semana anterior">‹</button>
          <strong>
            {semanaIdx === null || !semanas[semanaIdx]
              ? `Todas las semanas · ${fmt(semanas.length)}`
              : `Semana ${fmt(semanaIdx + 1)} de ${fmt(semanas.length)} · ${semanas[semanaIdx].etiqueta}`}
          </strong>
          <button type="button" onClick={() => paginar(1)} aria-label="Semana siguiente">›</button>
          <button type="button" onClick={() => setSemanaIdx(semanaInicial(semanas, hoyISO()))}>Hoy</button>
          {semanaIdx !== null ? (
            <button type="button" onClick={() => setSemanaIdx(null)}>Todas</button>
          ) : null}
        </div>
      ) : null}

      <div className="aulas-carga-malla-scroll" data-qa-geometry-member data-qa-geometry-capacity="owned">
        <table
          className="aulas-carga-malla"
          onMouseLeave={() => { if (!fijada) setCeldaActiva(null); }}
        >
          <caption className="pulso-sr-only">
            Aplicadores ocupados por {eje === "calendario" ? "fecha" : "día"} y franja horaria, con{" "}
            {fmt(duracionMin)} minutos de aplicación
          </caption>
          <thead>
            <tr>
              <th scope="col">{eje === "calendario" ? "Fecha" : "Día"}</th>
              {vivas.map((j) => {
                const enPunto = malla.franjas[j] % 60 === 0;
                return (
                  <th key={j} scope="col" className={enPunto ? "es-hora" : "es-media"}>
                    {/* La media hora no se rotula: 25 etiquetas de 30 en 30 son
                        el mismo dato repetido. La regla vertical de `es-hora`
                        basta para saber en qué hora cae cada celda. */}
                    {enPunto ? comoHora(malla.franjas[j]) : <span className="pulso-sr-only">{comoHora(malla.franjas[j])}</span>}
                  </th>
                );
              })}
              {/* El total de la fila: cuántos cursos-horario DISTINTOS pisan
                  ese día — no la suma de celdas, que repetiría cada banda. */}
              <th scope="col" className="aulas-carga-total-cab" title="Cursos-horario distintos del día">CH</th>
            </tr>
          </thead>
          <tbody>
            {malla.filas.map((fila, d) => (
              <Fragment key={fila.clave}>
                {fila.porAgendar || (visibles !== null && !visibles.has(d)) ? null : (
                <tr className={abreSemana.has(fila.clave) ? "abre-semana" : undefined}>
                  <th scope="row">{fila.etiqueta}</th>
                  {vivas.map((j) => {
                    const firme = malla.firmes[d][j];
                    const plausible = malla.plausibles[d][j];
                    const n = firme + plausible;
                    // El pico del operativo se marca EN la malla, no sólo en el
                    // KPI.
                    const esPico = Boolean(malla.pico && malla.pico.dia === d && malla.pico.franja === malla.franjas[j]);
                    const activa = celdaActiva?.d === d && celdaActiva?.j === j;
                    const titulo = tituloDeCelda(fila.etiqueta, comoHora(malla.franjas[j]), firme, plausible, malla.aulas[d][j])
                      + (esPico ? " · pico del operativo" : "");
                    return (
                      <td key={j} className={malla.franjas[j] % 60 === 0 ? "es-hora" : undefined}>
                        {n ? (
                          /* Ocupada = botón: hover o foco asoman su detalle en el
                             panel de abajo y el click la fija — el equivalente
                             accesible del hover pedido. Las vacías quedan como
                             span: cien tab-stops muertos no son acceso. */
                          <button
                            type="button"
                            className={`aulas-carga-celda${esPico ? " es-pico" : ""}${activa ? " es-activa" : ""}`}
                            style={celda(firme, plausible)}
                            title={titulo}
                            aria-label={nombreDeCelda(fila.etiqueta, comoHora(malla.franjas[j]), firme, plausible)
                              + (esPico ? ". Pico del operativo" : "")}
                            aria-pressed={fijada && activa}
                            onMouseEnter={() => { if (!fijada) setCeldaActiva({ d, j }); }}
                            onFocus={() => { if (!fijada) setCeldaActiva({ d, j }); }}
                            onClick={() => {
                              if (fijada && activa) { setFijada(false); return; }
                              setCeldaActiva({ d, j });
                              setFijada(true);
                            }}
                          >
                            {n}
                          </button>
                        ) : (
                          <span className="aulas-carga-celda" style={celda(firme, plausible)} title={titulo} />
                        )}
                      </td>
                    );
                  })}
                  <td className="aulas-carga-total">
                    {(() => {
                      const distintos = new Set<string>();
                      for (const c of malla.quienes[d]) for (const o of c) distintos.add(o.codigo);
                      return distintos.size ? fmt(distintos.size) : "";
                    })()}
                  </td>
                </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* El detalle de la celda explorada: QUIÉNES caen en esa franja. Región
          fija bajo la malla y no un tooltip flotante: no pelea con el scroll
          horizontal, la lee el teclado igual que el puntero y el gate puede
          medirla. */}
      <div className="aulas-carga-detalle" role="status" data-qa-geometry-member data-qa-geometry-capacity="owned">
        {(() => {
          const activa = celdaActiva && malla.quienes[celdaActiva.d]?.[celdaActiva.j]?.length
            ? celdaActiva
            : null;
          if (!activa) {
            // «La malla» y no «una celda»: el guard del perfil reserva esa
            // palabra para la hoja de cálculo del equipo.
            return (
              <p className="aulas-carga-detalle-vacio">
                Pasa el puntero o el foco por la malla para ver qué cursos-horario caen en cada
                franja de 30 minutos; un click deja la franja fijada.
              </p>
            );
          }
          const ocupantes = malla.quienes[activa.d][activa.j];
          const TOPE_LISTA = 8;
          const grupo = (lista: typeof ocupantes, rotulo: string) => (lista.length ? (
            <div className="aulas-carga-detalle-grupo">
              <h4>{rotulo} · {fmt(lista.length)}</h4>
              <ul>
                {/* Las tres señas de la cita (dictado: «ni la fecha exacta ni
                    la hora en la que se acordó ir ni qué etapa de la clase»):
                    fecha exacta —en el patrón semanal la fila «sábado» agrega
                    varios sábados—, hora pactada textual y momento acordado.
                    Lo no acordado se omite, no se inventa. */}
                {lista.slice(0, TOPE_LISTA).map((o) => (
                  <li key={o.codigo}>
                    <strong>{o.codigo}</strong>
                    {o.docente ? ` · ${o.docente}` : ""}
                    {o.lugar ? ` · ${o.lugar}` : ""}
                    {o.fecha ? ` · ${fechaCorta(o.fecha)}` : ""}
                    {o.hora ? ` · ${o.hora}` : ""}
                    {o.momento ? ` · ${MOMENTO_LEGIBLE[o.momento]}` : ""}
                  </li>
                ))}
              </ul>
              {lista.length > TOPE_LISTA ? (
                <p className="aulas-carga-detalle-mas">… y {fmt(lista.length - TOPE_LISTA)} más — el Excel trae la lista completa.</p>
              ) : null}
            </div>
          ) : null);
          return (
            <>
              <p className="aulas-carga-detalle-titulo">
                <strong>{malla.filas[activa.d].etiqueta}</strong> · {comoHora(malla.franjas[activa.j])}–{comoHora(malla.franjas[activa.j] + 30)}
                {fijada ? <em> · fijada; otro click la suelta</em> : null}
              </p>
              {grupo(ocupantes.filter((o) => o.confirmada), "Confirmados")}
              {grupo(ocupantes.filter((o) => !o.confirmada), "Por agendar — toda su clase es posible")}
            </>
          );
        })()}
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
            ? "1 curso-horario tiene hora acordada pero no fecha, así que no cabe"
            : `${fmt(malla.agendadasSinFecha)} cursos-horario tienen hora acordada pero no fecha, así que no caben`}{" "}
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
