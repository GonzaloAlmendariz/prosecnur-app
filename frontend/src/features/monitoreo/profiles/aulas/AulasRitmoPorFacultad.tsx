import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { ritmoPorFacultad } from "./ritmoPorFacultad";

/**
 * Cómo va cada facultad día a día, y hacia dónde.
 *
 * El ritmo del estudio entero ya existía; éste dice quién lo sostiene y quién se
 * paró. Una barra por día del rango, compartiendo escala entre facultades para
 * que las series se puedan comparar de un vistazo.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

/** «2026-08-11» → «11/08». La fecha larga no cabe bajo una barra de 8 px. */
function dm(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

export function AulasRitmoPorFacultad({ partes }: { partes: ReadonlyArray<MonitoreoRow> }) {
  const { facultades, fechas } = useMemo(() => ritmoPorFacultad(partes), [partes]);

  // **Dos causas distintas, un solo mensaje.** La lista queda vacía tanto si no
  // hay ni un parte de campo —el estado normal antes de salir— como si los hay y
  // ninguno trae fecha. Acusar a los partes de venir sin fecha cuando todavía no
  // existen manda a buscar un defecto en el libro que no está ahí.
  if (!facultades.length) {
    return (
      <p className="mon-profile-muted">
        {partes.length
          ? `Ninguno de los ${fmt(partes.length)} partes de campo trae fecha de aplicación, así que no se puede seguir el ritmo.`
          : "Todavía no hay partes de campo: el ritmo aparece en cuanto se registre la primera aula aplicada."}
      </p>
    );
  }

  const tope = Math.max(1, ...facultades.flatMap((f) => f.dias.map((d) => d.efectivas)));
  // **Sólo cuentan las caídas que el propio vaivén de la facultad no explica.**
  // El umbral del −15 % contaba las siete que salían «a menos ritmo» sobre un
  // estudio cuya producción diaria es plana: una facultad con una sola aula al
  // día, en un estudio donde un aula deja entre 13 y 74, produce un −48 % sin
  // que haya pasado nada.
  const cayendo = facultades.filter((f) => f.distinguible && (f.tendencia ?? 0) < 0).length;
  const conVaiven = facultades.filter((f) => f.tendencia != null && !f.distinguible).length;

  return (
    <div className="aulas-ritmofac">
      <p className="aulas-ritmofac-lectura">
        {cayendo ? (
          <>
            <strong>{fmt(cayendo)}</strong>{" "}
            {cayendo === 1 ? "facultad va" : "facultades van"} a menos ritmo que al empezar
          </>
        ) : (
          <>Ninguna facultad ha bajado su ritmo de forma apreciable.</>
        )}{" "}
        · {fmt(fechas.length)} {fechas.length === 1 ? "día" : "días"} de campo,
        de {dm(fechas[0])} a {dm(fechas[fechas.length - 1])}
      </p>
      {/* Cabecera, como en los demás paneles del perfil: sin ella el «−37,9 %»
          de la derecha es un número suelto y hay que bajar al pie para saber
          qué mide. */}
      <ul className="aulas-ritmofac-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="aulas-ritmofac-cabecera" aria-hidden="true">
          <span>Facultad</span><span>Día a día</span><span>Tendencia</span>
        </li>
        {facultades.map((f) => (
          <li key={f.facultad}>
            <span className="aulas-ritmofac-nombre" title={f.facultad}>
              {f.facultad}
              <em>{fmt(f.efectivas)} en {fmt(f.diasConCampo)} {f.diasConCampo === 1 ? "día" : "días"} · {f.mediaDiaria.toLocaleString("es-PE")}/día</em>
            </span>
            {/* Una barra por día del rango COMPARTIDO: los huecos son días sin
                recoger y tienen que ocupar su sitio, porque una facultad parada
                tres días es lo que hay que ver. */}
            <span className="aulas-ritmofac-serie" role="img"
              aria-label={`${f.efectivas} encuestas en ${f.diasConCampo} días`}>
              {f.dias.map((d) => (
                <i key={d.fecha} title={`${dm(d.fecha)}: ${fmt(d.efectivas)}`}
                  style={{
                    height: `${d.efectivas ? Math.max(8, (100 * d.efectivas) / tope) : 3}%`,
                    background: d.efectivas ? COLOR_RESULTADO.efectiva : "var(--pulso-border)",
                  }} />
              ))}
            </span>
            {/* La tendencia compara días YA OCURRIDOS: no es un pronóstico. Nula
                cuando hay menos de cuatro días con campo, porque con menos es
                ruido y decirlo sería inventar. */}
            <span
              className={`aulas-ritmofac-tend${
                f.tendencia == null || !f.distinguible
                  ? " es-ruido"
                  : f.tendencia < 0 ? " es-baja" : f.tendencia > 0 ? " es-sube" : ""}`}
              title={f.tendencia == null
                ? "Menos de cuatro días con campo: no hay tendencia que calcular."
                : f.distinguible
                  ? "El cambio es mayor que el vaivén normal de esta facultad."
                  : "El cambio cabe dentro del vaivén normal de esta facultad, así que no se puede distinguir de la casualidad."}
            >
              {f.tendencia == null ? "—" : `${f.tendencia > 0 ? "+" : ""}${f.tendencia.toLocaleString("es-PE")} %`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-ritmofac-pie">
        La tendencia compara la segunda mitad de sus días de campo con la primera. Es lo ya
        ocurrido, no una proyección.
        {/* La cifra se sigue enseñando siempre —el dato es el dato— pero apagada
            cuando cabe dentro del vaivén de esa facultad. Sin decirlo, una cifra
            apagada se lee como un fallo de la pantalla. */}
        {conVaiven
          ? ` En ${fmt(conVaiven)} ${conVaiven === 1 ? "facultad el cambio cabe" : "facultades el cambio cabe"} dentro de su propio vaivén: la cifra va apagada porque no se distingue de la casualidad.`
          : ""}
      </p>
    </div>
  );
}
