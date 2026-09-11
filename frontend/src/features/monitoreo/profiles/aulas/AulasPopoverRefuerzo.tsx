import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ChipDato, ChipHora, ChipLugar } from "./AulasSistemaPabellon";
import type { BrechaPorSexo } from "./candidatosDeReemplazo";
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
export function AulasPopoverRefuerzo({ facultad, filas, deuda, pedirAntesDe, onElegir, onCerrar }: {
  facultad: string;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** Lo que la facultad debe HOY, por sexo. Sale de las cuotas, no del cierre. */
  deuda: BrechaPorSexo;
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
        <ContenidoDeRefuerzo facultad={facultad} filas={filas} deuda={deuda}
          pedirAntesDe={pedirAntesDe} onElegir={onElegir} onCerrar={onCerrar} />
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
export function ContenidoDeRefuerzo({ facultad: facultadCruda, filas, deuda, pedirAntesDe, onElegir, onCerrar }: {
  facultad: string;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  deuda: BrechaPorSexo;
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
                Debe <b>{fmt(debeM)}</b> mujeres y <b>{fmt(debeH)}</b> hombres
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
          </p>
        </div>
        {onCerrar ? (
          <button type="button" className="aulas-refuerzo-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        ) : null}
      </header>

      {/* El veredicto antes de la lista: si alcanza y con cuántas. Es con lo que
          se sale de aquí, y enterrarlo debajo de doce tarjetas obliga a
          sumarlas a mano. */}
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
            {" "}Toca pedir una ampliación de marco.
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
                c={c} puesto={i + 1} onElegir={onElegir}
              />
            ))}
          </ol>
        </>
      ) : (
        <p className="aulas-refuerzo-vacio">
          {facultad} no tiene ningún curso-horario libre. Sus reservas siguen
          comprometidas con una cadena que aún no se resolvió, o ya se usaron.
          Un refuerzo aquí pasa por ampliar el marco.
        </p>
      )}
    </div>
  );
}

function TarjetaDeRefuerzo({ c, puesto, onElegir }: {
  c: CandidatoDeRefuerzo;
  puesto: number;
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
                  Al ritmo de hoy
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
        </span>

        {/* **Lo que cierra, y lo que quedaría.** Las dos mitades de la misma
            decisión: cuánto de la deuda tapa este curso-horario, y con qué te quedas si
            la tomas. La segunda es la que él pidió —«si tomas uno, a la facultad
            le quedan…»— y es la que evita tomar tres cuando bastaba una. */}
        <span className="aulas-refuerzo-cierra">
          {/* El porcentaje lleva su signo: justo debajo va «quedarían 65», que
              es un absoluto, y sin la unidad las dos cifras se leían como la
              misma cosa. */}
          <span className="aulas-refuerzo-vara">
            <em>cierra</em>
            <i><b style={{ width: `${Math.min(100, Math.round(c.cierra * 100))}%` }} /></i>
            <strong>{Math.min(100, Math.round(c.cierra * 100))} %</strong>
          </span>
          <span className="aulas-refuerzo-util">
            <b>{fmt(c.util)}</b> de las que faltan
          </span>
          <span className="aulas-refuerzo-resto">
            {c.util ? (
              queda ? <>quedarían <b>{fmt(queda)}</b></> : <>cierra la deuda entera</>
            ) : (
              <>no cierra nada de lo que se debe</>
            )}
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
