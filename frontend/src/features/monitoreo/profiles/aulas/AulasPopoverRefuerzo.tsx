import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ChipDato, ChipHora, ChipLugar } from "./AulasSistemaPabellon";
import type { BrechaPorSexo } from "./candidatosDeReemplazo";
import type { CuotaDeFacultad } from "./brechaDeLaFacultad";
import type { DeficitOperativo } from "./deficitOperativo";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { etiquetaDeFecha } from "./agendaPorDia";
import { facultadCorta } from "./facultadEnPalabras";
import { pronosticoDelAula } from "./pronosticoDelAula";
import { planDeRefuerzo, refuerzosDeFacultad, type CandidatoDeRefuerzo } from "./refuerzosDeFacultad";
import "./aulasPopoverRefuerzo.css";

/**
 * **Dónde se aplican los refuerzos (C).** El popover que faltaba.
 *
 * Gonzalo, 2026-09-10: «entiendo que hay aulas que tienen un rendimiento bajo, y
 * a partir de las aulas que tienen un rendimiento bajo podemos buscar relevos
 * que complementen, pero ¿dónde asignamos los refuerzos? […] el contexto de
 * rendimiento no sólo nos muestra las aulas bajas, sino nos permite también
 * tener un espacio para poder precisamente aplicar refuerzo».
 *
 * Esa frase describe dos puertas distintas y hasta hoy sólo existía una. El
 * complemento (B) se abre desde una FILA de la tabla de brechas —un aula que se
 * aplicó y se quedó corta, y entra otra parecida detrás—. El refuerzo (C) se
 * abre desde una FACULTAD del mapa de la deuda, porque no hay aula caída: hay
 * una cuota que no va a cerrar y se mete un aula adicional para cerrarla.
 *
 * Por eso este popover no se parece al de reemplazo aunque comparta catálogo:
 * allí la primera pregunta es «¿a qué se parece?» y aquí es «¿cuánto de lo que
 * debo cierra?». No hay parecido que medir porque no hay nada a lo que
 * parecerse.
 */
export function AulasPopoverRefuerzo({ facultad, filas, deuda, cuota, deficit, pedirAntesDe, onElegir, onCerrar }: {
  facultad: string;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** Lo que la facultad debe HOY, por sexo. Sale de las cuotas, no del cierre. */
  deuda: BrechaPorSexo;
  /** La cuota con su meta y lo logrado, para que la cifra se explique sola. */
  cuota?: CuotaDeFacultad;
  /** El déficit descontando lo que ya viene, y el marco del plan. */
  deficit?: DeficitOperativo;
  /**
   * El último día útil para llamar sin que la facultad se quede parada, de
   * `alertaDeAnticipacion`. Un refuerzo no se aplica el día que se decide: hay
   * que hablar con el docente y hay una semana de anticipación de por medio, y
   * sin esa fecha la decisión parece que no tiene reloj.
   */
  pedirAntesDe?: string | null;
  /** Tomar este curso-horario de refuerzo. Sin esto la lista sólo se mira. */
  onElegir?: (fila: MonitoreoAulasPlanRow) => void;
  onCerrar: () => void;
}): ReactNode {
  const caja = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) onCerrar();
    };
    document.addEventListener("keydown", tecla);
    // En el mismo tick el click que abre el popover cuenta como «fuera».
    const t = window.setTimeout(() => document.addEventListener("mousedown", fuera), 0);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", fuera);
      window.clearTimeout(t);
    };
  }, [onCerrar]);

  return createPortal(
    <div className="aulas-refuerzo-fondo" role="presentation">
      <div
        className="aulas-refuerzo-popover"
        data-pulso-panel="aulas-refuerzo"
        role="dialog"
        aria-modal="true"
        aria-label={`Refuerzo para ${facultad}: cursos-horario libres`}
        ref={(el) => { caja.current = el; }}
      >
        <ContenidoDeRefuerzo facultad={facultad} filas={filas} deuda={deuda} cuota={cuota}
          deficit={deficit} pedirAntesDe={pedirAntesDe} onElegir={onElegir} onCerrar={onCerrar} />
      </div>
    </div>,
    document.body,
  );
}

/**
 * El contenido, separado del portal para poder mirarlo con
 * `renderToStaticMarkup`: un portal en el servidor devuelve cadena vacía y no
 * se puede probar nada de lo que hay dentro.
 */
export function ContenidoDeRefuerzo({ facultad: facultadCruda, filas, deuda, cuota, deficit, pedirAntesDe, onElegir, onCerrar }: {
  facultad: string;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  deuda: BrechaPorSexo;
  /** La cuota con su meta y lo logrado, para que la cifra se explique sola. */
  cuota?: CuotaDeFacultad;
  /** El déficit descontando lo que ya viene, y el marco del plan. */
  deficit?: DeficitOperativo;
  pedirAntesDe?: string | null;
  /** Tomar este curso-horario de refuerzo. Sin esto la lista sólo se mira. */
  onElegir?: (fila: MonitoreoAulasPlanRow) => void;
  onCerrar?: () => void;
}) {
  // El nombre se normaliza UNA vez y se usa en las seis veces que aparece; el
  // filtro sigue mirando el nombre crudo, que es la clave del payload.
  const facultad = facultadCorta(facultadCruda);
  const candidatos = useMemo(
    () => refuerzosDeFacultad(filas, facultadCruda, deuda),
    [filas, facultadCruda, deuda],
  );
  const plan = useMemo(() => planDeRefuerzo(candidatos, deuda), [candidatos, deuda]);
  const debeM = Math.max(0, Math.round(deuda.mujeres));
  const debeH = Math.max(0, Math.round(deuda.hombres));

  return (
    <div className="aulas-refuerzo-cuerpo">
      <header className="aulas-refuerzo-head">
        <div>
          <p className="aulas-refuerzo-titulo">Refuerzo para {facultad}</p>
          {/* **La deuda, por sexo y en la cabecera.** Es el único criterio de
              esta pantalla: sin ella la lista de abajo no tiene orden. */}
          <p className="aulas-refuerzo-deuda">
            {debeM + debeH > 0 ? (
              <>
                {/* **La cifra dice QUÉ mide.** Gonzalo, 2026-09-11: «dice
                    déficit de 65 pero en la otra ventana el déficit es de 6, no
                    entiendo». Las dos eran ciertas: el ranking mide lo que se
                    perdió en las aulas YA VISITADAS, y esto mide lo que falta
                    para cerrar la CUOTA de la facultad, contando también lo que
                    aún no se ha visitado. Sin decirlo, la segunda parece
                    contradecir a la primera. */}
                Para cerrar su cuota faltan <b>{fmt(debeM)}</b> mujeres y{" "}
                <b>{fmt(debeH)}</b> hombres
                {" · "}<strong>{fmt(debeM + debeH)}</strong> respuestas
                {/* **El reloj de la decisión.** Un refuerzo no se aplica el día
                    que se elige: hay que hablar con el docente y median siete
                    días de anticipación. Sin la fecha, la lista de abajo parece
                    que se puede mirar mañana igual. */}
                {pedirAntesDe ? (
                  <> · pídelo antes del <b>{etiquetaDeFecha(pedirAntesDe)}</b></>
                ) : null}
              </>
            ) : (
              <>No debe respuestas: la cuota de esta facultad está cubierta.</>
            )}
            {/* De dónde sale esa cifra: la meta y lo que lleva. Una cifra que
                puede explicarse a sí misma no contradice a la de al lado. */}
            {cuota && (cuota.meta.mujeres || cuota.meta.hombres) ? (
              <em className="aulas-refuerzo-detrasDe">
                lleva {fmt(cuota.logrado.mujeres)} de {fmt(cuota.meta.mujeres)} mujeres
                {" y "}{fmt(cuota.logrado.hombres)} de {fmt(cuota.meta.hombres)} hombres
              </em>
            ) : null}
            {/* **El marco del plan.** Gonzalo, 2026-09-11: «el popover no avisa
                cuántos CH ya están agendados, cuántos están aplicados y cuántos
                propone el diseño». Sin ese marco, «82 respuestas» flota: no se
                sabe si la facultad tiene doce cursos-horario o dos, ni cuántos
                le quedan por delante. */}
            {deficit ? (
              <em className="aulas-refuerzo-plan">
                El diseño le dio <b>{fmt(deficit.plan.delDiseno)}</b> cursos-horario:
                {" "}<b>{fmt(deficit.plan.aplicados)}</b> aplicados ·{" "}
                <b>{fmt(deficit.plan.agendados)}</b> agendados ·{" "}
                <b>{fmt(deficit.plan.sinAgendar)}</b> sin agendar
              </em>
            ) : null}
          </p>
        </div>
        {onCerrar ? (
          <button type="button" className="aulas-refuerzo-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        ) : null}
      </header>

      {/* El veredicto antes de la lista: si alcanza y con cuántas. Es con lo que
          se sale de aquí, y enterrarlo debajo de doce tarjetas obliga a
          sumarlas a mano. */}
      {/* **Lo que ya viene, antes de decidir si hace falta más.**

          Gonzalo, 2026-09-11: «el déficit debería también tomar en cuenta que
          hay esperables agendadas, o sea que no es todo lo que debemos, porque
          ya hay aulas agendadas que esperan recibir más».

          No se estaba haciendo, y el efecto es grave: Ciencias Sociales pedía
          82 respuestas con 7 cursos-horario pendientes que esperan traer 118.
          La pantalla mandaba a reforzar una facultad ya cubierta, y reforzar de
          más gasta una reserva que otra facultad va a necesitar. */}
      {deficit && deficit.cursosEnCamino ? (
        <p className={`aulas-refuerzo-encamino${deficit.loAgendadoAlcanza ? " es-cubierto" : ""}`}>
          <b>{fmt(deficit.enCamino.total)}</b> respuestas ya en camino, de{" "}
          <b>{fmt(deficit.cursosEnCamino)}</b>{" "}
          {deficit.cursosEnCamino === 1 ? "curso-horario agendado" : "cursos-horario agendados"}
          {" "}({fmt(deficit.enCamino.mujeres)} mujeres · {fmt(deficit.enCamino.hombres)} hombres).
          {deficit.loAgendadoAlcanza
            ? " Con eso la cuota queda cubierta: reforzar aquí gastaría una reserva que otra facultad va a necesitar."
            : ` Aun así quedarían ${fmt(deficit.quedaria.total)} sin cubrir` +
              (deficit.quedaria.mujeres && deficit.quedaria.hombres
                ? ` (${fmt(deficit.quedaria.mujeres)} mujeres, ${fmt(deficit.quedaria.hombres)} hombres).`
                : deficit.quedaria.mujeres ? ` (todas mujeres).` : ` (todos hombres).`)}
          <i>Es una proyección sobre lo agendado, no un hecho.</i>
        </p>
      ) : null}

      <p className={`aulas-refuerzo-veredicto${plan.alcanza ? " es-alcanza" : " es-corto"}`}>
        {plan.sinDeuda ? (
          <>Nada que reforzar aquí. Los cursos-horario libres de {facultad} se quedan para relevar si cae un titular.</>
        ) : plan.alcanza ? (
          <>
            Alcanza: con <strong>{fmt(plan.hacenFalta)}</strong>{" "}
            {plan.hacenFalta === 1 ? "curso-horario" : "cursos-horario"} de los que hay libres en {facultad} se cierra lo que debe.
          </>
        ) : (
          <>
            No alcanza con lo libre en {facultad}: aun tomándolas todas quedarían{" "}
            {/* El desglose se arma en una sola expresión: partido en tres
                trozos de JSX dejaba un espacio suelto antes del punto —«(46
                mujeres, 36 hombres) . Toca»— que se veía en pantalla. */}
            <strong>{fmt(plan.restaM + plan.restaH)}</strong>{" "}
            {(() => {
              const trozos = [
                plan.restaM ? `${fmt(plan.restaM)} mujeres` : "",
                plan.restaH ? `${fmt(plan.restaH)} hombres` : "",
              ].filter(Boolean);
              return `respuestas sin cubrir${trozos.length ? ` (${trozos.join(", ")})` : ""}.`;
            })()}
            {" "}Se requiere ampliar el marco.
          </>
        )}
      </p>

      {candidatos.length ? (
        <>
          <p className="aulas-refuerzo-pie">
            {fmt(candidatos.length)} cursos-horario libres en {facultad}, por lo que cierran de la deuda.
            {" "}Ninguno sale de otra facultad, y ninguno estaba comprometido con una cadena viva.
          </p>
          <ol className="aulas-refuerzo-lista">
            {candidatos.map((c, i) => (
              <TarjetaDeRefuerzo
                key={String(c.fila.operational_code || c.fila.classroom_id || i)}
                c={c} puesto={i + 1} deficit={debeM + debeH} onElegir={onElegir}
              />
            ))}
          </ol>
        </>
      ) : (
        <p className="aulas-refuerzo-vacio">
          {facultad} no tiene ningún curso-horario libre. Sus reservas siguen
          comprometidas con una cadena que aún no se resolvió, o ya se usaron.
          Un refuerzo aquí exige ampliar el marco.
        </p>
      )}
    </div>
  );
}

function TarjetaDeRefuerzo({ c, puesto, deficit, onElegir }: {
  c: CandidatoDeRefuerzo;
  puesto: number;
  /** Lo que la facultad debe en total: el denominador de «17 de 82». */
  deficit: number;
  onElegir?: (fila: MonitoreoAulasPlanRow) => void;
}) {
  const f = c.fila;
  const pr = pronosticoDelAula(f);
  const queda = c.quedaria.mujeres + c.quedaria.hombres;

  return (
    <li className={`aulas-refuerzo-item${c.util ? "" : " es-inutil"}`}>
      <div className="aulas-refuerzo-fila">
        <span className="aulas-refuerzo-puesto">{puesto}</span>

        <span className="aulas-refuerzo-quien">
          <span className="aulas-refuerzo-codigo">
            {f.operational_code || f.classroom_id}
            <b className={`aulas-refuerzo-origen es-${c.procedencia}`}>
              {c.procedencia === "extra" ? "reserva adicional" : "al aire"}
            </b>
          </span>
          <span className="aulas-refuerzo-curso">
            {f.course_name || f.label || "Curso sin nombre"}
            {f.teacher ? <em> · {f.teacher}</em> : null}
          </span>
          <span className="aulas-chips-fila">
            {f.venue ? <ChipLugar lugar={f.venue} /> : null}
            {f.sesiones_dia_hora ? <ChipHora>{f.sesiones_dia_hora}</ChipHora> : null}
          </span>
          {/* **Su docente ya fue contactado.** Gonzalo, 2026-09-11: «ojo, no
              vaya a ser que estemos llamando a un docente ya contactado».
              Medido: 84 de 1.216 reservas libres lo comparten. Se avisa y no se
              excluye: a veces es justo el docente más dispuesto, y la decisión
              es de quien llama. */}
          {c.docenteYaContactado ? (
            <span className="aulas-refuerzo-aviso">
              Ya se contactó a este docente por otro curso-horario
            </span>
          ) : null}
          {/* **El traslape de alumnos, estimado.** No se sabe quién respondió,
              pero sí cuánta población de la facultad ya pasó por un
              curso-horario aplicado: alto, buena parte de los elegibles de éste
              probablemente ya respondieron y saldrán como duplicados.

              El umbral es la mitad: por debajo, la señal no distingue una
              facultad que empieza de una que va por la mitad. Y no se descuenta
              nada —un alumno cuenta en varias listas, así que el cociente es
              sobre cupos y no sobre gente—: avisa, no corrige. */}
          {c.exposicionDeLaFacultad >= 0.5 ? (
            <span className="aulas-refuerzo-aviso es-traslape">
              El {pctPerfil(c.exposicionDeLaFacultad * 100)} de los cupos de su facultad ya
              se aplicó: parte de estos elegibles ya habrá respondido
            </span>
          ) : null}
          {/* **Las mismas tres varas que el popover de reemplazo.** Es la misma
              decisión vista desde el otro extremo, y con dos lenguajes distintos
              había que reaprender la lectura al cambiar de pantalla. Aquí pesan
              todavía más: en C no hay un titular al que parecerse, así que lo
              único que se compara entre candidatos es lo que van a dar. */}
          <table className="aulas-refuerzo-varas3">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Mujeres</th>
                <th scope="col">Hombres</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="es-techo">
                <th scope="row">Elegibles</th>
                <td>{fmt(pr.elegibles.mujeres)}</td>
                <td>{fmt(pr.elegibles.hombres)}</td>
                <td><b>{fmt(pr.elegibles.total)}</b></td>
              </tr>
              {pr.plan ? (
                <tr className="es-plan">
                  <th scope="row">Según el plan</th>
                  <td>{fmt(pr.plan.mujeres)}</td>
                  <td>{fmt(pr.plan.hombres)}</td>
                  <td><b>{fmt(pr.plan.total)}</b></td>
                </tr>
              ) : null}
              <tr className="es-ritmo">
                <th scope="row">
                  Proyección actual
                  <em>
                    {pr.deDondeLaTasa === "aula" ? `${pctPerfil(pr.tasa * 100)} suyo`
                      : pr.deDondeLaTasa === "facultad" ? `${pctPerfil(pr.tasa * 100)} de su facultad`
                      : `${pctPerfil(pr.tasa * 100)} del perfil, sin medida propia`}
                  </em>
                </th>
                <td>{fmt(c.aporta.mujeres)}</td>
                <td>{fmt(c.aporta.hombres)}</td>
                <td><b>{fmt(c.aporta.total)}</b></td>
              </tr>
            </tbody>
          </table>
          {/* La discrepancia entre las dos varas, dicha: cuando coinciden leer
              dos filas iguales no aporta, y cuando se separan esa distancia es
              la decisión. */}
          {pr.desvio != null ? (
            <span className={`aulas-refuerzo-desvio${pr.desvio === 0 ? " es-igual" : pr.desvio < 0 ? " es-corto" : " es-sobra"}`}>
              {pr.desvio === 0 ? "La proyección coincide con el plan."
                : pr.desvio < 0 ? `Va a dar ${fmt(Math.abs(pr.desvio))} menos de lo que el plan le pedía.`
                : `Va a dar ${fmt(pr.desvio)} más de lo que el plan le pedía.`}
            </span>
          ) : null}
        </span>

        {/* **Lo que cierra, y lo que quedaría.** Las dos mitades de la misma
            decisión: cuánto de la deuda tapa este curso-horario, y con qué te quedas si
            la tomas. La segunda es la que él pidió —«si tomas uno, a la facultad
            le quedan…»— y es la que evita tomar tres cuando bastaba una. */}
        {/* **Una sola lectura, no tres cifras sueltas.**

            Gonzalo, 2026-09-11, señalando esta esquina: «esta sección no la
            entiendo». Y no se entendía: «cierra 21 %», «17 del déficit» y
            «quedarían 65» eran la misma cosa dicha tres veces, en tres unidades
            distintas, y ninguna decía de qué eran. El 21 % no declaraba su
            base, el 17 no decía sobre cuánto, y el 65 aparecía sin haber dicho
            nunca que el déficit eran 82.

            Ahora es una fracción con su denominador a la vista —«17 de 82»—, la
            barra como proporción de ESA fracción, y el resto debajo. Tres
            renglones que se leen en cadena en vez de tres cifras que hay que
            reconciliar. */}
        <span className="aulas-refuerzo-cubre">
          <em>cubre del déficit</em>
          <b>
            {fmt(c.util)} <i>de {fmt(deficit)}</i>
          </b>
          <span className="aulas-refuerzo-carril" aria-hidden="true">
            <b style={{ width: `${Math.min(100, Math.round(c.cierra * 100))}%` }} />
          </span>
          <span className="aulas-refuerzo-resto">
            {!c.util ? "no reduce el déficit"
              : queda ? `quedarían ${fmt(queda)}`
              : "lo cubre entero"}
          </span>
        </span>
      </div>

      {/* **Se puede decidir, no sólo mirar.** El popover de reemplazo cierra con
          «Elegir R X» desde que se escribió; éste enseñaba dieciocho candidatos
          y ninguna forma de tomar uno, así que obligaba a salir a otra pantalla
          con el código apuntado a mano. */}
      {onElegir ? (
        <button type="button" className="aulas-refuerzo-elegir" onClick={() => onElegir(f)}>
          Reforzar con {f.operational_code || f.classroom_id}
        </button>
      ) : null}
    </li>
  );
}
