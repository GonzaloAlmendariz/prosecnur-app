import { useMemo } from "react";

import type { FocoDeCuota } from "./AulasCuotasResumen";
import { NombreDeFacultad } from "./NombreDeFacultad";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { aulasQueCierran, cierranConHasta, loQueFaltaParaCerrar, porFacultad } from "./loQueFaltaParaCerrar";
import { fmt } from "./kpisDeAulas";

/**
 * Cuánto cuesta cerrar las aulas que no llegaron.
 *
 * La Base de control termina en un veredicto —«23 de 152 efectivas»— y ahí se
 * detiene. Este panel convierte ese veredicto en una **cola de trabajo
 * ordenada por esfuerzo**: la escalera dice cuántas aulas se ganan con cada
 * encuesta adicional, y la lista dice a cuáles ir primero.
 *
 * No es el mismo cruce que la matriz de umbrales: aquélla reparte las aulas en
 * los cuatro casos, ésta mide el precio de sacarlas del caso en que están.
 *
 * Cuidado con leerlo como una promesa: que un aula quede a dos encuestas no
 * dice que se pueda volver a ella. Dice cuánto costaría si se puede, que es lo
 * que hoy no se sabe.
 */

const MARGEN = 6;

// Se leen detrás de «falla», así que la frase entera tiene que decir lo que
// pasa. «falla ninguno de los dos umbrales» decía exactamente lo contrario de
// lo que le pasa a esa aula, que es fallar los dos.
const FALLA: Record<string, string> = {
  ambos: "los dos umbrales",
  total: "el umbral de asistentes",
  poblacion: "el umbral de matriculados",
};

export function AulasLoQueFalta({ filas, facultadEnFoco, onFoco }: {
  filas: ReadonlyArray<Readonly<Record<string, unknown>>>;
  /** El corte que cruza la sección entera; viaja en la URL. */
  facultadEnFoco?: string;
  /** Sin esto la lista no es pulsable, igual que las otras cinco. */
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const r = useMemo(() => loQueFaltaParaCerrar(filas), [filas]);

  if (!r.evaluadas) {
    // «Ninguna se quedó corta» con CERO evaluadas es cierto por vacuidad y se
    // lee como la buena noticia: el libro llegó con 190 filas sin un solo
    // veredicto y el panel anunciaba que todas alcanzaron sus umbrales. Son dos
    // estados con distinta acción —celebrar o ir a llenar la hoja—.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        El libro todavía no evalúa ningún curso-horario, así que no se puede decir
        cuáles se quedaron cortas. El veredicto sale de las dos columnas de
        umbral de «Base de control».
      </p>
    );
  }

  if (!r.noEfectivas) {
    // AQUI si es la mejor noticia del operativo —hay aulas evaluadas y todas
    // llegaron—. Decirlo como «sin datos» la haría parecer un fallo del panel.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Ningún curso-horario evaluado se quedó corto: los que el libro evalúa alcanzaron
        sus dos umbrales.
      </p>
    );
  }
  if (!r.aulas.length) {
    return (
      // **No se manda a buscar columnas que ya no se escriben.**
      // Decía «hacen falta las enviadas y el umbral en encuestas (columnas 70T
      // y 70P)», y esas dos columnas la app dejó de escribirlas: en un libro de
      // 2026 el equipo iba a buscarlas y no estaban. Lo que falta hoy es lo que
      // el aula consiguió, porque la meta ya viaja con cada curso-horario.
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {fmt(r.noEfectivas)} aulas no alcanzaron su meta, pero el libro no trae
        con qué calcular cuánto les falta: hace falta cuántas efectivas
        consiguió cada una (columna «EFECTIVAS OBTENIDAS»).
      </p>
    );
  }

  const total = r.aulas.length;
  const costo = r.costoTotal;
  const conCinco = cierranConHasta(r.aulas, 5);
  const conDiez = cierranConHasta(r.aulas, 10);
  // La escalera: un punto por aula cerrada, en el gasto acumulado que la cierra.
  const puntos: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  let acumulado = 0;
  r.aulas.forEach((a, i) => {
    acumulado += a.faltan;
    puntos.push({ x: acumulado, y: i + 1 });
  });
  const util = 100 - MARGEN * 2;
  const x = (v: number) => MARGEN + (costo ? (v / costo) * util : 0);
  const y = (v: number) => 100 - MARGEN - (total ? (v / total) * util : 0);
  const linea = puntos
    .map((p, i) => (i === 0 ? `M ${x(p.x)} ${y(p.y)}` : `L ${x(p.x)} ${y(puntos[i - 1].y)} L ${x(p.x)} ${y(p.y)}`))
    .join(" ");
  const gastoCinco = r.aulas.filter((a) => a.faltan <= 5).reduce((s, a) => s + a.faltan, 0);
  // La mitad del esfuerzo no cierra la mitad de las aulas, y ésa es justo la
  // lectura que la escalera existe para dar: las baratas van primero.
  const conLaMitad = aulasQueCierran(r.aulas, Math.round(costo / 2)).cerradas;
  const grupos = porFacultad(r.aulas);
  const enFoco = facultadEnFoco ? r.aulas.filter((a) => a.facultad === facultadEnFoco) : r.aulas;

  return (
    // Quién posee el vacío interior de este panel.
    //
    // Sin esta declaración el runner elige un candidato por su cuenta y le tocó
    // el `mon-profile-panel-head`: 5 px de padding de encabezado leídos como
    // capacidad sin dueño (`capacity-drift`). El contenedor de datos es éste,
    // que es donde el vacío tiene sentido —la lista tiene tope de diez—.
    <div className="aulas-falta" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(costo)}</strong> encuestas cierran las {fmt(total)} aulas
        que no llegaron
        {conCinco ? (
          <>
            {" · "}
            <strong>{fmt(conCinco)}</strong>{" "}
            {fmt(conCinco) === "1" ? "está" : "están"} a cinco o menos
          </>
        ) : null}
      </p>
      {/* Los rótulos van en HTML sobre el lienzo y no dentro del SVG: el
          `preserveAspectRatio="none"` que estira la curva a lo ancho estiraría
          también el texto. Es el mismo patrón del pronóstico de cierre. */}
      <div className="aulas-falta-lienzo">
        {/* **El aria-label describe el gráfico; no lo bautiza.**

            Abría con «Escalera de esfuerzo», que es una metáfora y no un
            término: dentro del código se entiende —los peldaños son aulas que se
            van cerrando— pero quien no ve la pantalla oye un nombre propio que
            nadie le ha definido, y es lo único que oye. El panel ya se llama «Lo
            que falta para cerrar»; esto dice qué se está mirando. */}
        <svg className="aulas-falta-grafico" viewBox="0 0 100 100" preserveAspectRatio="none"
          role="img"
          aria-label={`Cursos-horario que se cierran según lo que cuestan: con ${fmt(costo)} encuestas cierran los ${fmt(total)}; ${fmt(conCinco)} necesitan cinco o menos`}>
          {[0.5, 1].map((f) => (
            <line key={f} x1={MARGEN} y1={y(total * f)} x2={100 - MARGEN} y2={y(total * f)}
              stroke="var(--pulso-border)" strokeWidth="1" vectorEffect="non-scaling-stroke"
              opacity={f === 1 ? 1 : 0.55} />
          ))}
          {/* Dónde acaba el tramo barato. Era un rectángulo relleno y competía
              con la propia curva —un bloque gris bajo una línea de dos píxeles—,
              cuando lo único que hay que ver es EL PUNTO en el que se acaban las
              aulas de cinco encuestas o menos. */}
          {conCinco ? (
            <line x1={x(gastoCinco)} y1={y(0)} x2={x(gastoCinco)} y2={y(conCinco)}
              stroke={COLOR_RESULTADO.efectiva} strokeWidth="1" strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke" opacity="0.75" />
          ) : null}
          <path d={linea} fill="none" stroke={COLOR_RESULTADO.efectiva} strokeWidth="2"
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {/* La escala del eje Y. Sin ella la curva sube pero no dice hacia
            cuántas aulas, que es la mitad de la lectura. */}
        <span className="aulas-falta-y es-alto">{fmt(total)} aulas</span>
        <span className="aulas-falta-y es-medio">{fmt(Math.round(total / 2))}</span>
        {conCinco ? (
          <span className="aulas-falta-marca" style={{ left: `${x(gastoCinco)}%` }}>
            {fmt(conCinco)} a cinco o menos
          </span>
        ) : null}
      </div>
      <p className="aulas-falta-eje">
        <span>0</span>
        <span>{fmt(costo)} encuestas adicionales</span>
      </p>
      {/* Por facultad, porque es como se sale a campo: ocho aulas de una misma
          facultad son UNA salida y ocho repartidas son ocho. Va antes que la
          lista de aulas —primero a dónde ir, después a cuál— y ordenada por lo
          que RINDE la visita, no por lo que cuesta: la barra mide aulas. */}
      {grupos.filas.length > 1 ? (
        <ul className="aulas-falta-facultades">
          {grupos.filas.slice(0, 6).map((f) => (
            <li key={f.facultad} className={f.facultad === facultadEnFoco ? "es-en-foco" : undefined}>
              {/* La sexta lista que pone el foco. La séptima superficie de las
                  mismas veinte facultades que se conformaba con enseñarlas. */}
              <NombreDeFacultad
                facultad={f.facultad}
                className="aulas-falta-fac"
                enFoco={f.facultad === facultadEnFoco}
              />
              <span className="aulas-falta-barra">
                <span style={{ width: `${(f.aulas / grupos.filas[0].aulas) * 100}%` }} />
              </span>
              <span className="aulas-falta-n"><strong>{fmt(f.aulas)}</strong></span>
              {/* Corto a propósito: con «· N a cinco o menos» detrás, el detalle
                  envolvía a dos líneas y las seis filas quedaban de alturas
                  distintas. Ese dato ya está arriba para el conjunto y abajo
                  aula por aula. */}
              <span className="aulas-falta-por">
                {f.aulas === 1 ? "curso-horario" : "cursos-horario"} · {fmt(f.costo)} encuestas
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {/* La lista OBEDECE el foco; el bloque de facultades de arriba no.
          Filtrar también aquel dejaría en una sola fila el bloque que existe
          para comparar facultades entre sí —la misma razón por la que la
          pirámide recibe todas las filas: es el control—. Aquí es al revés:
          quien está siguiendo a una facultad quiere SUS aulas. */}
      {/* La lista ENTERA, del más barato al más caro: el techo de diez quedó
          revocado (B33, principio 3 — se organiza, no se esconde). El orden es
          la priorización; el scroll de la sección recorre lo que no quepa. */}
      <ul className="aulas-falta-lista">
        {enFoco.map((a) => (
          <li key={a.codigo}>
            {/* El codigo abre la ficha de esa aula. Es el unico sitio del perfil
                que lista aulas pintando sus propias filas —`DataTable` no
                admite render por celda—, asi que es de donde se puede entrar
                sin inventar una tabla nueva. */}
            {onFoco ? (
              <button
                type="button"
                className="aulas-falta-cod es-enlace"
                onClick={() => onFoco({ tipo: "aula", valor: a.codigo })}
              >
                {a.codigo}
              </button>
            ) : (
              <span className="aulas-falta-cod">{a.codigo}</span>
            )}
            <span className="aulas-falta-n"><strong>{fmt(a.faltan)}</strong></span>
            <span className="aulas-falta-por">
              {a.enviadas} de {a.umbral} · falla {FALLA[a.falla]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-falta-pie">
        {/* Cuál es el conjunto que se está listando. Sin esto, con el foco
            puesto se ven tres aulas y se leen como si fueran todas. */}
        {facultadEnFoco ? (
          <>
            {/* «Los … cursos-horario»: el sujeto es la unidad, y aquí sí está
                escrito, así que arrastraba artículo y sustantivo. */}
            Los {fmt(enFoco.length)}{" "}
            {enFoco.length === 1 ? "curso-horario" : "cursos-horario"} de {facultadEnFoco}, que es la facultad en foco.{" "}
          </>
        ) : total > 1 ? (
          /* La lectura del ORDEN, que era lo que el tope decía de paso: la
             lista va del más barato al más caro y el último dice el peor caso. */
          <>Del más barato al más caro; el último pide {fmt(r.aulas[total - 1].faltan)} encuestas. </>
        ) : null}
        {conDiez > conCinco ? <>Con diez o menos cierran {fmt(conDiez)}. </> : null}
        {conLaMitad ? <>Con la mitad del esfuerzo —{fmt(Math.round(costo / 2))} encuestas— se cierran {fmt(conLaMitad)} de las {fmt(total)}. </> : null}
        {/* Lo que este panel NO puede priorizar se dice, no se calla: sin esto
            «{total} aulas» se leería como todas las que se quedaron cortas. */}
        {grupos.filas.length > 6 ? <>Las seis facultades que más cierran, de {fmt(grupos.filas.length)}. </> : null}
        {/* El cruce con el plan se cuenta, no se da por hecho: en este mismo
            perfil catorce campos que parecían llegar eran homónimos. */}
        {grupos.sinFacultad ? <>{fmt(grupos.sinFacultad)} de estos cursos-horario no cruzan con ninguna facultad del plan por su código, así que quedan fuera del reparto de arriba. </> : null}
        {r.sinCifras ? <>Otros {fmt(r.sinCifras)} se quedaron cortos y el libro no trae con qué medirles el faltante. </> : null}
        {r.contradicciones ? (
          <>
            En {fmt(r.contradicciones)} el libro dice que no cumple aunque las
            enviadas ya pasan su umbral: eso lo decide el equipo, no la app.
          </>
        ) : null}
        {/* **De dónde sale lo conseguido, cuando no sale de un solo sitio.**
            La brecha es meta menos conseguido, y el conseguido recorre tres
            numeradores distintos: la efectiva de plataforma —la única que el
            ADR 0082 reconoce como τ—, la cuenta del aplicador en el parte, y lo
            que la hoja da por enviado. Con más de uno en juego, el faltante de
            un aula NO es comparable con el de su vecina, y callarlo es
            exactamente el defecto que ese ADR nombra: un rótulo que promete
            otro número. Con todo de plataforma no se dice nada, porque no hay
            nada que advertir. */}
        {r.mezclaDeOrigenes ? (
          <>
            {" "}Ojo al comparar: {fmt(r.origenes.plataforma)} de estos cursos-horario
            miden lo conseguido con las respuestas que llegaron a la plataforma,
            {r.origenes.parte ? ` ${fmt(r.origenes.parte)} con lo que anotó el aplicador al salir` : ""}
            {r.origenes.hoja ? ` y ${fmt(r.origenes.hoja)} con lo que la hoja da por enviado` : ""}.
            Son cuentas distintas del mismo aula.
          </>
        ) : null}
      </p>
    </div>
  );
}
