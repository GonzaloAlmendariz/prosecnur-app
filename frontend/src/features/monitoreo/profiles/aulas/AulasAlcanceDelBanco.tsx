import { useMemo } from "react";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { alcanceDelBanco, faltaTrasLaAgenda } from "./alcanceDelBanco";
import type { BancoDeExtras } from "./AulasBancoExtras";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { pctPerfil } from "./kpisDeAulas";
import { caidaObservada, DESENLACES_MINIMOS } from "./tasaDeCaida";
import { fmt } from "./kpisDeAulas";

/**
 * ¿Alcanza la reserva adicional para cerrar la cuota que falta?
 *
 * El panel de arriba dice cuántas aulas extra hay y cuántos alumnos tienen. Es
 * un inventario, y un inventario de 2 436 alumnos se lee como reserva de sobra
 * cuando la cuota pendiente es de 1 558. La cuenta real dice lo contrario:
 * ningún alumno de la reserva adicional es una encuesta, y con la tasa de
 * respuesta observada la reserva adicional entera rinde unas 1 430 —ni el
 * extremo alto de la banda llega—.
 *
 * No repite el cruce del inventario: aquél enseña qué hay, éste qué falta
 * después de gastarlo todo.
 */

// Punto decimal y coma de millar: la convención peruana, que es la que usa el
// resto del perfil. Ver la nota de `avanceCuota.ts`.
const pct = (n: number) => pctPerfil(n * 100);

const VEREDICTO = {
  alcanza: "La reserva adicional alcanza para cerrar la cuota",
  justo: "La reserva adicional alcanza justo, y sólo si rinde por encima de lo habitual",
  "no alcanza": "La reserva adicional no alcanza para cerrar la cuota",
} as const;

export function AulasAlcanceDelBanco({ banco, control, quotas, agenda, partes }: {
  banco: BancoDeExtras | null;
  control: ReadonlyArray<Readonly<Record<string, unknown>>>;
  quotas: ReadonlyArray<Readonly<Record<string, unknown>>>;
  /** La agenda comprometida y los partes, para saber qué viene sin tocar la reserva adicional. */
  agenda: ReadonlyArray<MonitoreoRow>;
  partes: ReadonlyArray<MonitoreoRow>;
}) {
  const r = useMemo(() => {
    if (!banco) return null;
    // **Lo que faltará CUANDO SE ACABE LA AGENDA, no lo que falta hoy.**
    //
    // La reserva adicional se abre después de agotar las aulas ya
    // comprometidas, así que pedirle que cubra lo que ésas van a traer es
    // contarlo dos veces. Medido en este corte: faltan 1 558 hoy y 1 192
    // cuando la agenda termine —366 encuestas que ya vienen—, y con el
    // denominador de hoy el panel podía declarar «no alcanza» sobre una
    // reserva adicional que sí cubre.
    //
    // Salió de comparar este panel con la pirámide, que proyecta lo mismo y
    // decía otra cifra. Dos superficies del mismo hecho tienen que coincidir.
    const falta = faltaTrasLaAgenda(proyeccionPorAgenda(agenda, partes, quotas as MonitoreoRow[]));
    const filas = (banco.por_facultad ?? []).map((f) => ({
      faculty: f.faculty,
      elegibles: Number(f.elegibles ?? 0),
    }));
    // Las que QUEDAN, no las que existen: una reserva adicional de la que ya
    // se gastó la mitad no proyecta como una intacta.
    const aulas = banco.disponibles ?? banco.total ?? filas.length;
    // La caída observada en ESTE estudio, no la constante de 2025: es la que
    // manda cuando ya hay desenlaces suficientes, y la propia alerta de
    // anticipación avisa cuando las dos se separan.
    // La caída observada en ESTE estudio, y sólo cuando hay desenlaces
    // suficientes para que sea una tasa y no ruido: con cinco titulares
    // resueltos, «se cae el 20 %» es un accidente. Sin evidencia, cero —el
    // panel prefiere quedarse corto a inventar un descuento—.
    const caida = caidaObservada(agenda);
    const descuento = caida.tasa != null && caida.decididos >= DESENLACES_MINIMOS ? caida.tasa : 0;
    return alcanceDelBanco(control, filas, falta, aulas, descuento);
  }, [banco, control, quotas, agenda, partes]);

  if (!r) {
    // C5 categoría 1: el vacío dice qué falta y de dónde sale, dentro de la caja.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Para saber si la reserva adicional alcanza hace falta la hoja «Base de
        control» del libro: de ahí sale la tasa con la que responde un
        curso-horario, y sin ella proyectar sus alumnos sería inventar.
      </p>
    );
  }

  const conDeficit = r.facultades.filter((f) => f.deficit > 0);
  const tono = r.veredicto === "alcanza" ? COLOR_RESULTADO.efectiva
    : r.veredicto === "justo" ? COLOR_RESULTADO.parcial
    : COLOR_RESULTADO.rechazo;

  return (
    <div className="aulas-alcance" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-alcance-titular" style={{ color: tono }}>
        {VEREDICTO[r.veredicto]}
      </p>
      <p className="aulas-cadenas-lectura">
        Vaciarlo entero rinde <strong>{fmt(r.rinde)}</strong> encuestas
        {" "}—entre {fmt(r.bajo)} y {fmt(r.alto)}— y cuando se acabe la agenda
        faltarán <strong>{fmt(r.falta)}</strong>
      </p>
      <p className="mon-profile-muted aulas-alcance-base">
        {/* De dónde sale la proyección. Sin esto, «1 430» parece un dato de la
            reserva adicional y es una cuenta hecha con la tasa a la que
            responden las aulas ya aplicadas.

            **Y CON QUÉ NUMERADOR, que es lo que faltaba.** Esta tasa se calcula
            con `sent_total` —lo que la Base de control da por ENVIADO—, no con
            las respuestas que llegaron a la plataforma y pasaron los filtros.
            Decía «han respondido», que es la forma exacta de nombrar τ, y el
            ADR 0082 lo señaló por su nombre: el parte y la Base de control no
            producen τ, producen el cuadre, y van con su propio rótulo. */}
        Con lo que la Base de control da por enviado en los cursos-horario aplicados:{" "}
        <strong>{pct(r.tasa.tasa)}</strong> de su población elegible, medida en{" "}
        {fmt(r.tasa.aulas)} aulas. No es la efectiva de plataforma, que es la que
        define el cumplimiento del estudio. La banda es la variación de un curso-horario a otro, que es
        alta —{fmt(Math.round(r.tasa.sd * 100))} puntos—, así que una cifra sola
        prometería una precisión que no hay.
        {r.caida > 0 ? (
          <>
            {" "}Y descontando el <strong>{(r.caida * 100).toFixed(0)} %</strong>{" "}
            que se cae: un curso-horario de la reserva adicional tampoco llega siempre a aplicarse.
          </>
        ) : null}
      </p>
      {conDeficit.length ? (
        <>
          <ul className="aulas-alcance-lista">
            {conDeficit.slice(0, 8).map((f) => (
              <li key={f.facultad}>
                <span className="aulas-alcance-fac">{f.facultad}</span>
                <span className="aulas-alcance-barra">
                  <span style={{ width: `${Math.min(100, (100 * f.rinde) / Math.max(1, f.falta))}%` }} />
                </span>
                <span className="aulas-alcance-n"><strong>−{fmt(f.deficit)}</strong></span>
                <span className="aulas-alcance-por">
                  faltan {fmt(f.falta)} · su reserva adicional rinde {fmt(f.rinde)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mon-profile-muted aulas-alcance-pie">
            {conDeficit.length > 8 ? <>Las ocho de mayor déficit, de {fmt(conDeficit.length)}. </> : null}
            {/* La otra superficie que mira la reserva adicional. Cuenta AULAS y
                pide sobre el neto, así que puede señalar más facultades que
                ésta, que cuenta encuestas: decirlo evita que las dos cifras se
                lean como una contradicción. */}
            «A quién hay que agendar», en Avance, cuenta lo mismo en cursos-horario
            por pedir y puede señalar más facultades.{" "}
            {/* La cuenta optimista, dicha. Es la que sale de restar totales, y
                es la que uno hace de cabeza mirando el inventario. */}
            Sumado por facultad faltarían <strong>{fmt(r.deficit)}</strong>{" "}
            encuestas tras vaciar la reserva adicional
            {r.deficit !== r.deficitSiSeCompensara ? (
              <>
                ; restando totales saldrían {fmt(r.deficitSiSeCompensara)}, pero
                pasarse en una facultad no cubre lo que falta en otra
              </>
            ) : null}.
          </p>
        </>
      ) : (
        <p className="mon-profile-muted aulas-alcance-pie">
          Ninguna facultad se queda corta: la reserva adicional de cada una
          cubre su propia cuota pendiente.
        </p>
      )}
    </div>
  );
}
