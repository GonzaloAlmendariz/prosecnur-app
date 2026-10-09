import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { ritmoPorFacultad } from "./ritmoPorFacultad";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt, pctPerfil } from "./kpisDeAulas";

/**
 * Cómo va cada facultad día a día, y hacia dónde.
 *
 * El ritmo del estudio entero ya existía; éste dice quién lo sostiene y quién se
 * paró. Una barra por día del rango, compartiendo escala entre facultades para
 * que las series se puedan comparar de un vistazo.
 */

/** «2026-08-11» → «11/08». La fecha larga no cabe bajo una barra de 8 px. */
function dm(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

/** ⚠ SIN MONTAR desde el 2026-09-08. Se retiró de «Rendimiento»: contaba
    efectivas del PARTE con el mismo nombre que «Ritmo de la recolección»
    cuenta válidas de PLATAFORMA, y manda la plataforma. Registrado en
    `componentesSinMontar.test.ts`. */
export function AulasRitmoPorFacultad({ partes, facultadEnFoco, onFoco }: {
  partes: ReadonlyArray<MonitoreoRow>;
  /**
   * La facultad enfocada, si la hay. **No filtra: resalta.** `foco` viaja en la
   * URL y sólo lo obedecía la tabla de cuotas, teniendo el perfil seis listas de
   * las mismas veinte facultades. Filtrar destruiría el ranking, que es lo que
   * estas listas aportan; el detalle se filtra, el control no.
   */
  facultadEnFoco?: string;
  /** Pulsar un nombre pone el foco. Sin esto, los nombres son sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const { facultades, fechas } = useMemo(() => ritmoPorFacultad(partes), [partes]);

  // **Dos causas distintas, un solo mensaje.** La lista queda vacía tanto si no
  // hay ni un parte de campo —el estado normal antes de salir— como si los hay y
  // ninguno trae fecha. Acusar a los partes de venir sin fecha cuando todavía no
  // existen manda a buscar un defecto en el libro que no está ahí.
  if (!facultades.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {partes.length
          ? `Ninguno de los ${fmt(partes.length)} partes de campo trae fecha de aplicación, así que no se puede seguir el ritmo.`
          : "Todavía no hay partes de campo: el ritmo aparece en cuanto se registre el primer curso-horario aplicado."}
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
        {/* «con parte de campo» y no «de campo» a secas: estas fechas salen de
            los PARTES, y el ritmo diario cuenta los días con respuestas en la
            plataforma. Dos ejes, dos cifras —2 contra 5 en el estudio real— y
            hasta ahora las mismas palabras. */}
        · {fmt(fechas.length)} {fechas.length === 1 ? "día" : "días"} con parte de campo,
        de {dm(fechas[0])} a {dm(fechas[fechas.length - 1])}
      </p>
      {/* Cabecera, como en los demás paneles del perfil: sin ella el «−37,9 %»
          de la derecha es un número suelto y hay que bajar al pie para saber
          qué mide. */}
      <ul role="table" aria-label="Ritmo diario por facultad" className="aulas-ritmofac-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {/* Roles de tabla sobre la rejilla, no `<table>`: el defecto es que la
            cabecera estaba oculta, no la maquetación. */}
        <li className="aulas-ritmofac-cabecera" role="row">
          <span role="columnheader">Facultad</span><span role="columnheader">Día a día</span><span role="columnheader">Tendencia</span>
        </li>
        {facultades.map((f) => (
          <li key={f.facultad} role="row" className={f.facultad === facultadEnFoco ? "es-en-foco" : undefined}>
            <NombreDeFacultad facultad={f.facultad} className="aulas-ritmofac-nombre"
              rol="rowheader"
              enFoco={f.facultad === facultadEnFoco}>
              {f.facultad}
              <em>{fmt(f.efectivas)} en {fmt(f.diasConCampo)} {f.diasConCampo === 1 ? "día" : "días"} · {f.mediaDiaria.toLocaleString("es-PE")}/día</em>
            </NombreDeFacultad>
            {/* Una barra por día del rango COMPARTIDO: los huecos son días sin
                recoger y tienen que ocupar su sitio, porque una facultad parada
                tres días es lo que hay que ver. */}
            {/* La serie conserva su `role="img"` dentro de una celda propia: si
                el rol de celda fuera suyo, el lector perdería la posición. */}
            <span role="cell" className="aulas-ritmofac-serie-celda">
            <span className="aulas-ritmofac-serie" role="img"
              aria-label={`${fmt(f.efectivas)} encuestas en ${fmt(f.diasConCampo)} días`}>
              {f.dias.map((d) => (
                <i key={d.fecha} title={`${dm(d.fecha)}: ${fmt(d.efectivas)}`}
                  style={{
                    height: `${d.efectivas ? Math.max(8, (100 * d.efectivas) / tope) : 3}%`,
                    background: d.efectivas ? COLOR_RESULTADO.efectiva : "var(--pulso-border)",
                  }} />
              ))}
            </span>
            </span>
            {/* La tendencia compara días YA OCURRIDOS: no es un pronóstico. Nula
                cuando hay menos de cuatro días con campo, porque con menos es
                ruido y decirlo sería inventar. */}
            <span
              role="cell"
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
              {f.tendencia == null ? "—" : `${f.tendencia > 0 ? "+" : ""}${pctPerfil(f.tendencia)}`}
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
