import { useMemo } from "react";

import { fmt, pctPerfil } from "./kpisDeAulas";
import { lasQueNoLlegan, tresLecturasDeCuota } from "./tresLecturasDeCuota";
import "./tresLecturasDeCuota.css";

/**
 * «Qué celdas no llegan, y con qué remedio» — las tres lecturas juntas.
 *
 * Gonzalo, 2026-09-10: «creo que tanto b como c son importantes, deben servir
 * para mayor contexto» y «dale con la superficie, que las tres se vean juntas».
 *
 * Las tres salen del MISMO motor y una CONTIENE a la otra por construcción —lo
 * logrado dentro de lo comprometido, lo comprometido dentro del techo—, así que
 * el carril las dibuja superpuestas y no en fila: el ojo tiene que leer
 * inclusión, no suma.
 *
 * **Por qué esto no repite a «Cumplimiento».** Aquél dice cuánto llevas; éste
 * dice si vas a llegar y QUÉ HACER si no. La distinción que da el remedio es
 * `esFaltaDeAgenda`: si el techo alcanza la cuota y lo comprometido no, el plan
 * tiene aulas de sobra y lo que falta es ponerles fecha; si no alcanza ni el
 * techo, agendar no basta y hay que ir al banco. Son dos acciones distintas y
 * hasta hoy la pantalla no las separaba.
 *
 * Se pinta SÓLO donde hay decisión que tomar. Una lista de treinta celdas con
 * veintitrés diciendo «todo bien» compite por la atención con las siete que
 * piden acción.
 */
export function AulasTresLecturas({ celdas }: {
  /** `avance_sexo_facultad`: las celdas de facultad × sexo del alumno. */
  celdas: ReadonlyArray<Record<string, unknown>>;
}) {
  const todas = useMemo(() => tresLecturasDeCuota(celdas), [celdas]);
  const filas = useMemo(() => lasQueNoLlegan(todas), [todas]);

  if (!todas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        El estudio no declara cuotas de facultad y sexo que proyectar.
      </p>
    );
  }
  if (!filas.length) {
    // No es un vacío: es la mejor noticia posible, y darla como «no hay datos»
    // la haría parecer un fallo.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Los {fmt(todas.length)} grupos llegan a su cuota con lo que ya está agendado.
      </p>
    );
  }

  const deAgenda = filas.filter((f) => f.esFaltaDeAgenda).length;
  // La escala es POR FILA y no común: las cuotas van de 4 a 398 personas, y con
  // una escala compartida las pequeñas quedan en un hilo — que es justo donde
  // hay que ver si llegan.
  return (
    <div data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-tres-lectura">
        <strong>{fmt(filas.length)}</strong> de {fmt(todas.length)} grupos no llegan a su cuota
        con lo que ya tiene fecha
        {deAgenda > 0 ? (
          <> · en <strong>{fmt(deAgenda)}</strong> el plan alcanza y lo que falta es agendar</>
        ) : null}
      </p>
      <p className="aulas-tres-leyenda">
        <span><i className="aulas-tres-swatch" style={{ background: "var(--pulso-resultado-efectiva)" }} />Ya recogido</span>
        <span><i className="aulas-tres-swatch" style={{ background: "color-mix(in srgb, var(--pulso-resultado-parcial) 34%, transparent)" }} />Con lo agendado</span>
        <span><i className="aulas-tres-swatch" style={{ background: "color-mix(in srgb, var(--pulso-text) 12%, transparent)" }} />Techo: todo el plan</span>
        <span><i className="aulas-tres-swatch" style={{ background: "var(--pulso-text)", width: 2 }} />Meta</span>
      </p>
      <ul className="aulas-tres-filas">
        {filas.map((f) => {
          // El tope del carril: lo mayor entre el techo y la meta, para que la
          // marca de la meta siempre entre en el dibujo.
          const tope = Math.max(f.techo, f.cuota, 1);
          const pc = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / tope))}%`;
          return (
            <li className="aulas-tres-fila" key={`${f.facultad}|${f.sexo}`}>
              <span className="aulas-tres-nombre">
                <strong>{f.facultad}</strong>
                <em>{f.sexo}</em>
              </span>
              <span
                className="aulas-tres-carril"
                role="img"
                aria-label={`${f.facultad}, ${f.sexo}: cuota ${fmt(f.cuota)}, recogido ${fmt(f.logrado)}, con lo agendado ${fmt(Math.round(f.comprometido))}, techo ${fmt(Math.round(f.techo))}`}
              >
                <i className="aulas-tres-tramo es-techo" style={{ width: pc(f.techo) }} />
                <i className="aulas-tres-tramo es-comprometido" style={{ width: pc(f.comprometido) }} />
                <i className="aulas-tres-tramo es-logrado" style={{ width: pc(f.logrado) }} />
                {/* La lectura corregida por lo que rinde el campo. Sólo cuando
                    se separa de lo comprometido: dibujar una marca encima de
                    otra dice «hay dos cosas» donde sólo hay una. */}
                {Math.abs(f.conElCampo - f.comprometido) >= 1 ? (
                  <i className="aulas-tres-campo" style={{ left: pc(f.conElCampo) }}
                    title={`Con lo que está rindiendo el campo: ${fmt(Math.round(f.conElCampo))}`} />
                ) : null}
                <i className="aulas-tres-meta" style={{ left: pc(f.cuota) }} />
              </span>
              <span className="aulas-tres-cifras">
                <b>faltan {fmt(Math.round(f.faltaComprometido))}</b>
                {fmt(Math.round(f.comprometido))} de {fmt(f.cuota)}
                {f.factorDeCampo != null && Math.abs(f.factorDeCampo - 1) >= 0.01 ? (
                  <> · el campo va al {pctPerfil(f.factorDeCampo * 100)} de lo previsto</>
                ) : null}
                <br />
                <span className={`aulas-tres-remedio ${f.esFaltaDeAgenda ? "es-agenda" : "es-banco"}`}>
                  {f.esFaltaDeAgenda ? "agendar" : "ir al banco"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
