import { useState } from "react";

import { anchoMinimoDeMalla, comoHora } from "./cargaDeCampo";
import { ChipDato, ChipHora } from "./AulasSistemaPabellon";
import { aplicadoresDeLaOferta, semanaDelAplicador } from "./disponibilidadDeAplicadores";
import type { MallaDeOferta } from "./disponibilidadDeAplicadores";
import { fmt } from "./kpisDeAulas";

/**
 * El tercer cuadro de Carga de campo: la malla de OFERTA (dictado 2026-09-02:
 * «deben haber tres cuadros/visualizaciones: Patrón semanal, Calendario y
 * Disponibilidad de aplicadores»).
 *
 * Espejo deliberado de la malla de demanda: mismas franjas de 30 minutos,
 * mismo orden de días, mismas convenciones de hover/foco/click y el MISMO
 * juego de columnas (`vivas` viene compartido desde el contenedor). La lectura
 * que habilita es comparativa —¿la gente declarada alcanza para el pico de la
 * demanda?— y esa comparación solo funciona si las dos mallas hablan la misma
 * geometría.
 *
 * La intensidad usa el tono informativo (`--pulso-info-fg`), no el verde de lo
 * confirmado ni el tono del módulo de lo por agendar: la oferta es una tercera
 * cosa —capacidad declarada, ni hecho ni techo de demanda— y pintarla con un
 * color ya cargado de significado la haría pasar por lo que no es.
 */
const DIA_DE_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/**
 * B74 (dictado 2026-09-03): «la pestaña de disponibilidad no tiene ningún
 * mecanismo para poder importarla… ¿qué pasa si quiero enviarte una
 * actualizada y volver a hacer una asignación?». El botón vive en la vista
 * —también en sus estados vacíos, que es donde más muerde su ausencia— y
 * dispara la vía de dos pasos (upload + import) que arma la página.
 */
function BotonDeImportarDisponibilidad({ onImportar }: {
  onImportar?: ((archivo: File) => void | Promise<void>) | null;
}) {
  if (!onImportar) return null;
  return (
    <label className="aulas-dispo-importar">
      <input
        type="file"
        accept=".xlsx,.xls,.xlsm"
        hidden
        onChange={(event) => {
          const archivo = event.target.files?.[0];
          // El valor se limpia para que elegir el MISMO archivo dos veces
          // vuelva a disparar el cambio (mismo idioma que el libro).
          event.target.value = "";
          if (archivo) void onImportar(archivo);
        }}
      />
      Importar disponibilidad (.xlsx)
      <em>reemplaza la oferta cargada y rearma la asignación; lo fijado a mano se conserva</em>
    </label>
  );
}

export function AulasDisponibilidadDeAplicadores({
  oferta,
  vivas,
  demandaFirme = null,
  fechaQueToca = null,
  onImportar = null,
}: {
  /** `null` = la sesión no cargó la disponibilidad; se declara, no se rompe. */
  oferta: MallaDeOferta | null;
  /** Columnas visibles COMPARTIDAS con la malla de demanda (lectura conjunta). */
  vivas: number[];
  /**
   * B38: citas CONFIRMADAS por franja, alineadas a `oferta.filas` (una fila
   * por día, `null` si el día no está en la demanda). Con esto la malla
   * contesta sola «¿la gente alcanza?»: anillo donde hay citas, alarma donde
   * las citas superan a la gente. `null` = sin capa de demanda (p. ej. la
   * malla activa no es semanal) y la vista queda como antes.
   */
  demandaFirme?: Array<number[] | null> | null;
  /**
   * La fecha del despliegue inminente (`YYYY-MM-DD`): su día de semana lleva
   * el sello «toca» — es la fila de oferta que alimenta el próximo día de
   * campo. `null` = sin sello.
   */
  fechaQueToca?: string | null;
  /** B74: importar/reemplazar el excel de disponibilidad. */
  onImportar?: ((archivo: File) => void | Promise<void>) | null;
}) {
  const [celdaActiva, setCeldaActiva] = useState<{ i: number; j: number } | null>(null);
  const [fijada, setFijada] = useState(false);
  // B76 (dictado 2026-09-03): «un desplegable para poder ver disponibilidad
  // por aplicador» — la lente inversa de la malla: elegir UNA persona y ver
  // su semana. "" = el agregado de siempre.
  const [aplicadorElegido, setAplicadorElegido] = useState("");

  if (!oferta) {
    return (
      <div className="aulas-dispo-vacio" data-qa-geometry-member="true" data-qa-geometry-capacity="owned">
        <p className="aulas-carga-vacio">
          Este estudio todavía no tiene cargada la disponibilidad de los aplicadores. Sale del
          libro de disponibilidad del equipo (Excel): al cargarlo aquí, esta malla enseña
          quién puede estar en campo en cada franja de 30 minutos y la pestaña de Asignación
          reparte las citas pactadas.
        </p>
        <BotonDeImportarDisponibilidad onImportar={onImportar} />
      </div>
    );
  }

  const hayOferta = oferta.disponibles.some((fila) => fila.some((n) => n > 0));
  if (!hayOferta) {
    return (
      <div className="aulas-dispo-vacio" data-qa-geometry-member="true" data-qa-geometry-capacity="owned">
        <p className="aulas-carga-aviso">
          La disponibilidad está cargada, pero nadie declaró horas todavía: no hay oferta que
          pintar. Es distinto de no haberla cargado — el marco existe y se llenará con el equipo.
        </p>
        <BotonDeImportarDisponibilidad onImportar={onImportar} />
      </div>
    );
  }

  // El suelo es 2, la misma convención que la demanda: con un máximo de 1, la
  // única persona disponible se pintaría como saturación total y la malla
  // diría «oferta plena» donde hay exactamente una.
  const positivos = oferta.disponibles.flat().filter((n) => n > 0);
  const tope = Math.max(2, ...positivos);
  // Loop mejora-ui E2: el contraste mapea el RANGO REAL observado (piso..tope),
  // no 0..tope. Con el equipo real la oferta vive en 11–24 y la rampa desde
  // cero pintaba toda la malla en el mismo slate medio: la densidad no se
  // leía. El span con suelo de 4 evita el efecto contrario — una semana
  // pareja (todo 20±1) no debe amplificar ruido como si fuera contraste.
  const piso = Math.min(...positivos);
  const span = Math.max(4, tope - piso);
  const celda = (n: number) => {
    if (n === 0) return { background: "transparent", color: "var(--pulso-text-faint)" };
    const t = Math.max(0, Math.min(1, (n - piso) / span));
    return {
      background: `color-mix(in srgb, var(--pulso-info-fg) ${Math.round(16 + t * 64)}%, var(--pulso-surface))`,
      color: t > 0.5 ? "var(--pulso-surface)" : "var(--pulso-text)",
    };
  };

  const citasEn = (i: number, j: number): number => demandaFirme?.[i]?.[j] ?? 0;

  const nombreDeFranja = (i: number, j: number): string => {
    const n = oferta.disponibles[i][j];
    const quienes = oferta.nombres[i][j];
    const citas = citasEn(i, j);
    let base = `${oferta.filas[i].etiqueta} ${comoHora(oferta.franjas[j])}: ${fmt(n)} ${
      n === 1 ? "disponible" : "disponibles"}`;
    if (citas > 0) {
      base += `, ${fmt(citas)} ${citas === 1 ? "cita confirmada" : "citas confirmadas"}`;
      if (citas > n) base += " — más citas que gente";
    }
    return quienes.length ? `${base} — ${quienes.join(", ")}` : base;
  };

  const activa = celdaActiva && oferta.disponibles[celdaActiva.i]?.[celdaActiva.j] > 0
    ? celdaActiva
    : null;
  const esPico = (i: number, j: number) =>
    Boolean(oferta.pico && oferta.pico.fila === i && oferta.pico.franja === oferta.franjas[j]);

  return (
    <>
      <div className="aulas-carga-controles" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <p className="aulas-carga-oferta-lead">
          {demandaFirme
            ? "La oferta declarada del equipo, con las citas confirmadas encima: el anillo dice dónde hay citas y la franja alarma cuando las citas superan a la gente."
            : "La oferta declarada del equipo, sobre la misma malla horaria que la demanda: conmuta con el patrón semanal para ver si la gente alcanza."}
        </p>
        <BotonDeImportarDisponibilidad onImportar={onImportar} />
        {(() => {
          const nombres = aplicadoresDeLaOferta(oferta);
          if (!nombres.length) return null;
          return (
            <label className="aulas-dispo-persona">
              Ver a
              <select
                value={aplicadorElegido}
                onChange={(e) => setAplicadorElegido(e.target.value)}
                aria-label="Ver la disponibilidad de un aplicador concreto"
              >
                <option value="">Todo el equipo</option>
                {nombres.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          );
        })()}
        {aplicadorElegido ? (() => {
          const semana = semanaDelAplicador(oferta, aplicadorElegido);
          return (
            <p className="aulas-dispo-semana">
              <strong>{aplicadorElegido}</strong>
              {semana.length === 0
                ? " no declaró horas."
                : semana.map((d) => (
                    <span key={d.etiqueta} className="aulas-dispo-semana-dia">
                      <em>{d.etiqueta}</em> {d.bloques.join(" · ")}
                    </span>
                  ))}
            </p>
          );
        })() : null}
        <dl className="aulas-carga-kpis">
          {/* Dictado 2026-09-03 («eso aplica a las barras KPI, que no se
              entiende»): rótulos en llano con su title, como el patrón. */}
          <div>
            <dt title="Cuántas personas del equipo declararon su disponibilidad en el excel">
              Aplicadores declarados
            </dt>
            <dd>{fmt(oferta.aplicadores)}</dd>
          </div>
          <div>
            <dt title="El máximo de personas libres a la vez en alguna franja de la semana">
              Máximo libres a la vez
            </dt>
            <dd>{fmt(oferta.pico?.disponibles ?? 0)}</dd>
          </div>
          <div>
            <dt title="El día y la franja donde más gente declaró estar libre">
              El mejor momento
            </dt>
            <dd className="es-texto">
              {oferta.pico
                ? `${oferta.filas[oferta.pico.fila].etiqueta} ${comoHora(oferta.pico.franja)}`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="aulas-carga-malla-scroll" data-qa-geometry-member data-qa-geometry-capacity="owned">
        <table
          className="aulas-carga-malla"
          /* El mismo piso de ancho que la demanda: las columnas son las mismas
             y el espejo se rompería si una malla scrollea donde la otra
             comprime. */
          style={{ minWidth: anchoMinimoDeMalla(vivas.length) }}
          onMouseLeave={() => { if (!fijada) setCeldaActiva(null); }}
        >
          <caption className="pulso-sr-only">
            Aplicadores disponibles por día de semana y franja de 30 minutos
          </caption>
          <thead>
            <tr>
              <th scope="col">Día</th>
              {vivas.map((j) => {
                const enPunto = oferta.franjas[j] % 60 === 0;
                return (
                  <th key={j} scope="col" className={enPunto ? "es-hora" : "es-media"}>
                    {enPunto
                      ? comoHora(oferta.franjas[j])
                      : <span className="pulso-sr-only">{comoHora(oferta.franjas[j])}</span>}
                  </th>
                );
              })}
              {/* Cuántas personas DISTINTAS tiene el día: el relevo posible,
                  no la suma de franjas, que contaría a la misma persona una
                  vez por cada media hora. */}
              <th scope="col" className="aulas-carga-total-cab" title="Aplicadores distintos del día">Equipo</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // El día de semana del despliegue inminente, con la clave del
              // motor (minúscula, sin tilde) para casar con `filas`.
              const d = fechaQueToca ? new Date(`${fechaQueToca}T00:00:00`) : null;
              const claveQueToca = d && !Number.isNaN(d.getTime()) ? DIA_DE_SEMANA[d.getDay()] : null;
              return oferta.filas.map((fila, i) => ({ fila, i, esQueToca: fila.clave === claveQueToca }));
            })().map(({ fila, i, esQueToca }) => (
              <tr key={fila.clave} className={esQueToca ? "es-el-que-toca" : undefined}>
                <th scope="row">
                  {fila.etiqueta}
                  {esQueToca ? <span className="aulas-carga-toca">próxima salida</span> : null}
                </th>
                {vivas.map((j) => {
                  const n = oferta.disponibles[i][j];
                  const estaActiva = activa?.i === i && activa?.j === j;
                  const pico = esPico(i, j);
                  const citas = citasEn(i, j);
                  // B38: el anillo dice «aquí hay citas confirmadas»; la
                  // alarma, «más citas que gente». El muro de conteos recede
                  // y las franjas que importan al operativo saltan solas.
                  const marca = citas > 0 ? (citas > n ? " es-deficit" : " tiene-citas") : "";
                  // B76: con una persona elegida, SUS franjas saltan y el
                  // resto recede — los conteos siguen visibles en tenue.
                  const lente = aplicadorElegido
                    ? ((oferta.nombres[i]?.[j] ?? []).includes(aplicadorElegido)
                        ? " es-suyo" : " es-ajeno")
                    : "";
                  return (
                    <td key={j} className={oferta.franjas[j] % 60 === 0 ? "es-hora" : undefined}>
                      {n ? (
                        <button
                          type="button"
                          className={`aulas-carga-celda${pico ? " es-pico" : ""}${estaActiva ? " es-activa" : ""}${marca}${lente}`}
                          style={celda(n)}
                          title={nombreDeFranja(i, j) + (pico ? " · pico de la oferta" : "")}
                          aria-label={nombreDeFranja(i, j) + (pico ? ". Pico de la oferta" : "")}
                          aria-pressed={fijada && estaActiva}
                          onMouseEnter={() => { if (!fijada) setCeldaActiva({ i, j }); }}
                          onFocus={() => { if (!fijada) setCeldaActiva({ i, j }); }}
                          onClick={() => {
                            if (fijada && estaActiva) { setFijada(false); return; }
                            setCeldaActiva({ i, j });
                            setFijada(true);
                          }}
                        >
                          {n}
                        </button>
                      ) : (
                        /* Cita confirmada sin NADIE declarado: el hueco más
                           grave de la lectura conjunta — se pinta y se dice,
                           no queda como celda vacía cualquiera. */
                        <span
                          className={`aulas-carga-celda${marca}`}
                          style={celda(n)}
                          title={citas > 0 ? nombreDeFranja(i, j) : undefined}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="aulas-carga-total">
                  {(() => {
                    const distintos = new Set<string>();
                    for (const quienes of oferta.nombres[i]) for (const n of quienes) distintos.add(n);
                    if (distintos.size) return fmt(distintos.size);
                    const max = Math.max(0, ...oferta.disponibles[i]);
                    return max ? fmt(max) : "";
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quiénes: la región fija bajo la malla, el mismo gesto que la demanda
          — hover o foco la asoman, un click la fija, el teclado la lee. */}
      <div className="aulas-carga-detalle" role="status" data-qa-geometry-member data-qa-geometry-capacity="owned">
        {activa ? (
          <>
            <p className="aulas-carga-detalle-titulo">
              <strong>{oferta.filas[activa.i].etiqueta}</strong>{" "}
              <ChipHora>{comoHora(oferta.franjas[activa.j])}–{comoHora(oferta.franjas[activa.j] + 30)}</ChipHora>
              {fijada ? <em> · fijada; otro click la suelta</em> : null}
            </p>
            <div className="aulas-carga-detalle-grupo">
              <h4>
                Disponibles · {fmt(oferta.disponibles[activa.i][activa.j])}
                {citasEn(activa.i, activa.j) > 0 ? (
                  <span className={`aulas-carga-detalle-citas${
                    citasEn(activa.i, activa.j) > oferta.disponibles[activa.i][activa.j] ? " es-deficit" : ""}`}>
                    {" "}· {fmt(citasEn(activa.i, activa.j))}{" "}
                    {citasEn(activa.i, activa.j) === 1 ? "cita confirmada" : "citas confirmadas"}
                    {citasEn(activa.i, activa.j) > oferta.disponibles[activa.i][activa.j]
                      ? " — más citas que gente"
                      : ""}
                  </span>
                ) : null}
              </h4>
              {oferta.nombres[activa.i][activa.j].length ? (
                /* Cada persona en su chip (dictado 2026-09-02, sistema de
                   chips): la lista se escanea, no se lee de corrido. Completa
                   siempre — los techos quedaron revocados. */
                <ul className="aulas-carga-nombres">
                  {oferta.nombres[activa.i][activa.j].map((n) => (
                    <li key={n}><ChipDato>{n}</ChipDato></li>
                  ))}
                </ul>
              ) : (
                <p className="aulas-carga-detalle-mas">El bloque no trajo los nombres de esta franja; la cifra es del motor.</p>
              )}
            </div>
          </>
        ) : (
          <p className="aulas-carga-detalle-vacio">
            Pasa el puntero o el foco por la malla para ver quién está disponible en cada franja
            de 30 minutos; un click deja la franja fijada.
          </p>
        )}
      </div>

      <div className="aulas-carga-pie">
        <ul className="aulas-carga-leyenda">
          <li><i style={celda(Math.max(1, Math.round(tope / 3)))} aria-hidden="true" />Poca gente disponible</li>
          <li><i style={celda(tope)} aria-hidden="true" />Mucha gente disponible</li>
          {demandaFirme ? (
            <>
              <li><i className="aulas-carga-celda tiene-citas" style={celda(tope)} aria-hidden="true" />Con citas confirmadas a esa hora</li>
              <li><i className="aulas-carga-celda es-deficit" style={celda(1)} aria-hidden="true" />Más citas que gente</li>
            </>
          ) : null}
          {fechaQueToca ? (
            <li><span className="aulas-carga-toca">próxima salida</span> ese día de semana cae la próxima salida de campo</li>
          ) : null}
          <li className="aulas-carga-estado">
            {fmt(oferta.aplicadores)} aplicadores declararon disponibilidad
          </li>
        </ul>
      </div>

      {oferta.fueraDeEje > 0 || oferta.ilegibles > 0 ? (
        <p className="aulas-carga-aviso">
          {oferta.fueraDeEje > 0
            ? oferta.fueraDeEje === 1
              ? "1 franja declarada queda fuera del eje de 07:00 a 22:00 y no se pinta."
              : `${fmt(oferta.fueraDeEje)} franjas declaradas quedan fuera del eje de 07:00 a 22:00 y no se pintan.`
            : ""}
          {oferta.fueraDeEje > 0 && oferta.ilegibles > 0 ? " " : ""}
          {oferta.ilegibles > 0
            ? oferta.ilegibles === 1
              ? "1 entrada del bloque llegó ilegible y no se pinta."
              : `${fmt(oferta.ilegibles)} entradas del bloque llegaron ilegibles y no se pintan.`
            : ""}
        </p>
      ) : null}
    </>
  );
}
