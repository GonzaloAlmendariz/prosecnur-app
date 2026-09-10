import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { ChipHora, ChipLugar } from "./AulasSistemaPabellon";
import { frenteDelOperativo } from "./frenteDelOperativo";
import { fmt } from "./kpisDeAulas";

/**
 * A qué aulas hay que ir a reclamar hoy.
 *
 * Avance contesta cuánto se lleva; esta vista, qué se quedó atrás. Son preguntas
 * distintas: un operativo puede ir al 90 % de respuestas y tener treinta aulas
 * que pasaron su día sin que nadie las registrara.
 */

function fechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString("es-PE", { weekday: "short" }).replace(".", "");
  return `${dia} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * ⚠ SIN MONTAR desde el 2026-09-10.
 *
 * Gonzalo, reorganizando Resumen: «Cursos-horario vencidos sin aplicar se va
 * porque no es necesario». Lo que este panel contaba —cursos-horario cuya fecha
 * ya pasó y siguen sin parte de campo— lo dice el reparto por rol del panel de
 * agendación, que separa «agendadas» de «aplicadas» sobre el plan entero.
 *
 * Se desmonta, no se borra: el cruce agenda × partes no lo hace nadie más y si
 * la pregunta vuelve, vuelve montado.
 */
export function AulasFrenteDelOperativo({ filas, partes, corte }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  partes: ReadonlyArray<Record<string, unknown>>;
  corte: string;
}) {
  const f = useMemo(() => frenteDelOperativo(filas, partes, corte), [filas, partes, corte]);

  if (!f.conFecha) {
    // El vacío declara lo mismo que la rama con datos: es miembro del grupo y
    // posee su hueco. Sin esto, cuando el panel no tiene nada que pintar el
    // único miembro visible pasa a ser el encabezado de la sección y el gate
    // canta `capacity-drift` sobre sus 5 px de padding.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {f.sinFecha
          ? `Ninguno de los ${fmt(f.sinFecha)} cursos-horario del plan tiene fecha agendada, así que no se puede decir cuáles van con atraso.`
          : "La agenda todavía no declara fechas."}
      </p>
    );
  }

  const alDia = f.vencidas === f.vencidasConParte;
  // «Ya pasaron su fecha» respecto de CUÁNDO. El corte es el sello del tablero,
  // no el reloj del navegador, así que un proyecto reabierto días después
  // contaba el atraso contra un día que el panel no nombraba en ninguna parte.
  const diaDelCorte = (() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) return "";
    const [a, m, d] = corte.split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString("es-PE",
      { day: "numeric", month: "long" });
  })();
  const ancho = f.vencidas ? Math.round((100 * f.vencidasConParte) / f.vencidas) : 100;

  return (
    /* **El contenedor declara la capacidad, no sus ramas.**

       Estaba declarada en el estado vacío y en la lista de pendientes, y
       ninguna de las dos se renderiza cuando hay datos y CERO pendientes —el
       caso «los 131 cursos-horario que ya pasaron su fecha tienen su parte en el
       libro»—. Sin un solo miembro explícito, el auditor de geometría cae a los
       hijos del grupo y mide el `mon-profile-panel-head`, cuyos 4-5 px de
       padding declaraba como `capacity-drift`.

       Es la misma avería que ya se reparó en el runner para un `<details>`
       cerrado, con otra causa: allí el filtro descartaba al miembro, aquí el
       miembro no existe en esa rama. La declaración va al contenedor visible de
       datos, que es lo que el contrato pide y lo único que está en las tres. */
    <div className="aulas-frente" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-frente-lectura">
        {f.vencidas === 0 ? (
          <>Todavía no vence ningún curso-horario: los <strong>{fmt(f.conFecha)}</strong> con fecha
            están por delante del corte.</>
        ) : alDia ? (
          <>Los <strong>{fmt(f.vencidas)}</strong> cursos-horario que ya pasaron su fecha tienen
            su parte en el libro.</>
        ) : (
          <>
            <strong>{fmt(f.pendientes.length)}</strong> de{" "}
            <strong>{fmt(f.vencidas)}</strong> cursos-horario que ya pasaron su fecha siguen sin
            parte en el libro
          </>
        )}
        {f.porVenir ? <> · <strong>{fmt(f.porVenir)}</strong> aún por venir</> : null}
        {/* Sin fecha DECLARADO aparte: no están al día ni atrasados, y meterlos
            en cualquiera de los dos lados inventaría un diagnóstico. */}
        {f.sinFecha ? <> · <strong>{fmt(f.sinFecha)}</strong> sin fecha en la agenda</> : null}
        {/* Va en el flujo con el mismo separador que el resto del panel: es una
            calificación de todas las cifras de la frase, no un dato aparte. */}
        {diaDelCorte ? <> · <span className="aulas-frente-corte">al {diaDelCorte}</span></> : null}
      </p>
      {f.vencidas ? (
        <div className="aulas-frente-carril" role="img"
          aria-label={`${fmt(f.vencidasConParte)} de ${fmt(f.vencidas)} cursos-horario vencidos con parte`}>
          <i style={{ width: `${ancho}%`, background: COLOR_RESULTADO.efectiva }} />
          <i style={{ width: `${100 - ancho}%`, background: COLOR_RESULTADO.rechazo }} />
        </div>
      ) : null}
      {/* **El carril iba desnudo, y lleno de verde miente.**

          Sus dos hermanas de la misma pestana —«Cumplimiento aula por aula» y
          «Estado de aplicacion»— llevan la leyenda debajo, con su punto de color
          y su cifra. Esta no, y en el caso al dia queda una franja verde de todo
          el ancho sin una sola marca: lo que un lector entiende de eso es «el
          estudio va al 100 %», cuando lo que dice es «de los 131 que ya
          vencieron, todos tienen parte» con 1.216 aun por venir.

          El denominador es lo vencido, no el plan, y la leyenda es donde eso se
          puede decir. Se reusa la lista del panel hermano para que las tres
          barras de la pestana se lean igual. */}
      {f.vencidas ? (
        <ul className="aulas-avance-mermas" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          <li className="es-cubierto">
            <strong>{fmt(f.vencidasConParte)}</strong> con parte
          </li>
          <li className="es-sin-parte">
            <strong>{fmt(f.vencidas - f.vencidasConParte)}</strong> sin parte
          </li>
          <li className="es-sin-meta">de <strong>{fmt(f.vencidas)}</strong> ya vencidos</li>
        </ul>
      ) : null}
      {f.pendientes.length ? (
        <ul className="aulas-frente-lista">
          {f.pendientes.map((a) => (
            <li key={a.codigo}>
              {/* Los DÍAS delante: es lo que ordena la lista y lo que decide a
                  cuál ir primero. La fecha sola obliga a restar de cabeza. */}
              <span className="aulas-frente-dias">
                <strong>{fmt(a.dias)}</strong> {a.dias === 1 ? "día" : "días"}
              </span>
              <span className="aulas-frente-codigo">{a.codigo}</span>
              <span className="aulas-frente-facultad" title={a.facultad}>{a.facultad}</span>
              <span className="aulas-frente-cuando">{fechaCorta(a.fecha)}</span>
              {/* El `title` lleva el texto ENTERO del Excel —«LUN 16:00 V110»—
                  aunque la celda muestre la sesión ya ordenada: el vocabulario
                  del equipo no se pierde. La hora y el aula van como el par de
                  chips del Sistema Pabellón (B33), el mismo A206 que la
                  Agenda; la columna de la fecha queda con el día, que es lo
                  que se compara contra el corte. */}
              <span className="aulas-frente-donde" title={a.sesion || a.donde || undefined}>
                {a.hora || a.donde ? (
                  <span className="aulas-chip-sesion">
                    {a.hora ? <ChipHora>{a.hora}</ChipHora> : null}
                    {a.donde ? <ChipLugar lugar={a.donde} /> : null}
                  </span>
                ) : "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
