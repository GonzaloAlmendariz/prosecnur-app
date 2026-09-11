import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ChipDato, ChipHora, ChipLugar } from "./AulasSistemaPabellon";
import type { BrechaPorSexo } from "./candidatosDeReemplazo";
import { fmt, pctPerfil } from "./kpisDeAulas";
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
export function AulasPopoverRefuerzo({ facultad, filas, deuda, onCerrar }: {
  facultad: string;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** Lo que la facultad debe HOY, por sexo. Sale de las cuotas, no del cierre. */
  deuda: BrechaPorSexo;
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
        <ContenidoDeRefuerzo facultad={facultad} filas={filas} deuda={deuda} onCerrar={onCerrar} />
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
export function ContenidoDeRefuerzo({ facultad, filas, deuda, onCerrar }: {
  facultad: string;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  deuda: BrechaPorSexo;
  onCerrar?: () => void;
}) {
  const candidatos = useMemo(
    () => refuerzosDeFacultad(filas, facultad, deuda),
    [filas, facultad, deuda],
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
            <strong>{fmt(plan.restaM + plan.restaH)}</strong> respuestas sin cubrir
            {plan.restaM ? <> ({fmt(plan.restaM)} mujeres</> : <> (</>}
            {plan.restaH ? <>{plan.restaM ? ", " : ""}{fmt(plan.restaH)} hombres</> : null})
            . Toca pedir una ampliación de marco.
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
              <TarjetaDeRefuerzo key={String(c.fila.operational_code || c.fila.classroom_id || i)} c={c} puesto={i + 1} />
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

function TarjetaDeRefuerzo({ c, puesto }: { c: CandidatoDeRefuerzo; puesto: number }) {
  const f = c.fila;
  const anon = f as Record<string, unknown>;
  const tasa = Number(anon.tasa_efectividad_aula) > 0 ? Number(anon.tasa_efectividad_aula) : 0.55;
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
            <ChipDato>{fmt(Number(f.eligible_n) || 0)} elegibles al {pctPerfil(tasa)}</ChipDato>
          </span>
          <span className="aulas-refuerzo-rinde">
            Rinde <b>{fmt(c.aporta.mujeres)}</b> mujeres y <b>{fmt(c.aporta.hombres)}</b> hombres
            {" = "}<strong>{fmt(c.aporta.total)}</strong>
          </span>
        </span>

        {/* **Lo que cierra, y lo que quedaría.** Las dos mitades de la misma
            decisión: cuánto de la deuda tapa este curso-horario, y con qué te quedas si
            la tomas. La segunda es la que él pidió —«si tomas uno, a la facultad
            le quedan…»— y es la que evita tomar tres cuando bastaba una. */}
        <span className="aulas-refuerzo-cierra">
          <span className="aulas-refuerzo-vara">
            <em>cierra</em>
            <i><b style={{ width: `${Math.min(100, Math.round(c.cierra * 100))}%` }} /></i>
            <strong>{Math.min(100, Math.round(c.cierra * 100))}</strong>
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
    </li>
  );
}
