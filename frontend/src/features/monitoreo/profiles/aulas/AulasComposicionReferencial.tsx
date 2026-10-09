import { useMemo } from "react";

import type { MonitoreoAulasAvanceCuota } from "../../../../api/monitoreo";
import { composicionReferencial, type DimensionDeComposicion } from "./composicionReferencial";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { tonoDeFacultad } from "./tonoDeFacultad";
import { TONOS_DE_PABELLON } from "./sistemaPabellon";
import "./composicionReferencial.css";

/**
 * **Un tono por categoría, distinto dentro de su barra.**
 *
 * El tono sale del NOMBRE, como manda el sistema del perfil: así una carrera
 * conserva su color en todas las pantallas aunque cambie el orden. Pero una
 * barra apilada exige además que dos segmentos vecinos no coincidan, y ocho
 * tonos repartidos por hash colisionan con seis categorías más a menudo de lo
 * que parece. Cuando pasa, el segundo se corre al siguiente libre: conserva la
 * estabilidad donde importa —el mismo nombre, el mismo color mientras no
 * choque— y garantiza que la barra se pueda leer.
 */
function tonosDeLaDimension(d: DimensionDeComposicion): Map<string, number> {
  const usados = new Set<number>();
  const out = new Map<string, number>();
  for (const f of d.filas) {
    let t = tonoDeFacultad(f.etiqueta) ?? 0;
    let vueltas = 0;
    while (usados.has(t) && vueltas < TONOS_DE_PABELLON) {
      t = (t + 1) % TONOS_DE_PABELLON;
      vueltas += 1;
    }
    usados.add(t);
    out.set(f.categoria, t);
  }
  return out;
}

/**
 * **A quién se está alcanzando**, contra la composición de la población.
 *
 * El panel referencial que pedía la decisión 8 del plan del eje declarable.
 * Existe porque con la cuota por nivel sexo y carrera dejaron de ser cuota y se
 * quedaron sin sitio: el motor las calcula desde el 2026-09-17 y **ninguna
 * pantalla las pintaba**. Mismo patrón que las cuatro bolsas del avance, y la
 * misma lección: un campo que el motor publica y nadie consume no es una
 * capacidad, es deuda.
 *
 * **Lo que este panel NO hace, y es deliberado**: no pone umbrales, no avisa de
 * desvíos y no usa el tono de alarma. Gonzalo prometió las metas por nivel
 * curricular, con sexo y carrera referenciales; pintar en rojo una diferencia
 * de diez puntos convertiría en incumplimiento algo que el estudio no
 * prometió. Se enseña la forma de los dos repartos y quien lee decide si le
 * dice algo. El motor tiene una prueba de AUSENCIA que defiende lo mismo.
 *
 * **Dos barras APILADAS al 100 %, una por reparto.** Gonzalo, 2026-09-22:
 * «¿aquí no sería mejor barras apiladas elegantes por tipo de estrato —hombre
 * y mujer— y luego las carreras, con la barra de base y la barra de cómo va el
 * campo hasta ahora?».
 *
 * Tenía razón y el motivo se ve con las cifras de ese día: con una fila por
 * categoría eran seis pares de barras finas y la comparación había que hacerla
 * de dos en dos, de arriba abajo. Apiladas, el sesgo salta de un golpe —
 * Economía ocupa el 77 % de lo recogido y el 45 % de la población—, que es
 * justo lo que este panel existe para enseñar.
 *
 * Al 100 % y no a escala de volumen: lo que se compara es la FORMA de dos
 * repartos de tamaños muy distintos (105 personas contra 800). A escala, la
 * barra de lo recogido sería un hilo al lado de la otra y no habría nada que
 * comparar.
 */
export function AulasComposicionReferencial({ avanceCuota }: {
  avanceCuota: MonitoreoAulasAvanceCuota | null | undefined;
}) {
  const vista = useMemo(() => composicionReferencial(avanceCuota), [avanceCuota]);

  if (vista.vacio) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {vista.vacio}
      </p>
    );
  }
  return (
    <div data-qa-geometry-capacity="owned" data-qa-geometry-member>
      {/* **La nota del motor NO se pinta.** Dice «Sexo y carrera son
          referenciales: describen a quién se está alcanzando…» encima de un
          título que ya dice «A quién se está alcanzando» y de un subtítulo que
          ya dice «no como cuota»: tres veces lo mismo en cuatro centímetros.
          Viaja en el payload para quien lo consuma —el PDF, el libro— y aquí el
          encabezado del panel hace su trabajo (C1). */}
      {/* **Los dos cuadraditos se fueron con las barras superpuestas.** Eran
          el color de cada carril —ámbar lo recogido, gris la población— y
          desde que la barra se colorea por CATEGORÍA no corresponden a nada:
          dos muestras de color que no aparecen en ninguna barra. Y los dos
          rótulos que acompañaban tampoco hacen falta, porque cada barra lleva
          el suyo pegado a la izquierda.

          Queda lo único que la pantalla no dice en otro sitio: sobre cuánta
          gente está medido todo esto. */}
      <p className="aulas-comp-leyenda">
        {fmt(vista.personas)} {vista.personas === 1 ? "persona que cuenta" : "personas que cuentan"} para la meta
      </p>
      <div className="aulas-comp-dimensiones">
        {vista.dimensiones.map((d) => (
          <section className="aulas-comp-dimension" key={d.clave}>
            <div className="aulas-comp-titulo">
              <h4>{d.etiqueta}</h4>
              {/* **Sin población declarada NO se escribe «de 0».** Un cero ahí
                  se lee como una población medida que resultó vacía, y lo que
                  pasa es que el proyecto no la trae. Se dice dónde mirar. */}
              <span>
                {d.poblacionDeclarada
                  ? `${fmt(d.obtenidasTotal)} de ${fmt(d.poblacionTotal)} de la población`
                  : "Sin población declarada en el proyecto"}
              </span>
            </div>
            {(() => {
              const tonos = tonosDeLaDimension(d);
              /**
               * **Los porcentajes son los del modelo, no se recalculan.**
               *
               * El primer intento normalizaba cada segmento sobre la suma de
               * las filas de su dimensión, y eso dice otra cosa que la leyenda
               * de al lado: con las categorías cubriendo sólo parte de la
               * población, la barra publicaba «ECONOMÍA 94 %» junto a un
               * «44,8 %» en su propio renglón. Dos lecturas del mismo dato en
               * cuatro centímetros.
               *
               * Lo que falta para el 100 % es real —categorías que el bloque no
               * lista, o gente sin ese dato— y va en un tramo sin nombre en vez
               * de repartirse entre las demás.
               */
              const pila = (cual: "obtenidas" | "poblacion") => {
                const pctDe = (f: (typeof d.filas)[number]) =>
                  (cual === "obtenidas" ? f.obtenidasPct : f.poblacionPct) ?? 0;
                const suma = d.filas.reduce((acc, f) => acc + pctDe(f), 0);
                const resto = Math.max(0, 100 - suma);
                return (
                  <div className="aulas-comp-pila" role="img"
                    aria-label={`${cual === "obtenidas" ? "Recogido hasta hoy" : "Población del estudio"}: ` +
                      (cual === "poblacion" && !d.poblacionDeclarada
                        // Quien no ve la barra sólo tiene esta frase: si enumera
                        // las categorías «sin porcentaje» una por una, suena a
                        // seis medidas fallidas en vez de a un dato que falta.
                        ? "el proyecto no la declara"
                        : d.filas.map((f) => {
                          const pct = cual === "obtenidas" ? f.obtenidasPct : f.poblacionPct;
                          return `${f.etiqueta} ${pct == null ? "sin porcentaje" : pctPerfil(pct)}`;
                        }).join(", "))}>
                    {/* Sin nada recogido la barra no se dibuja vacía con un
                        borde: se dice. Un carril gris al lado de otro lleno se
                        lee como «van iguales» de reojo. */}
                    {/* **«todavía nada» es del carril de lo RECOGIDO.** En el de
                        la población decía que está por llegar algo que no va a
                        llegar: no se midió poco, no se declaró. Dos ausencias
                        distintas se arreglan distinto. */}
                    {suma <= 0 ? (
                      <span className="aulas-comp-pila-vacia">
                        {cual === "poblacion" && !d.poblacionDeclarada
                          ? "sin población declarada"
                          : "todavía nada"}
                      </span>
                    ) : (
                      <>
                        {d.filas.map((f) => {
                          const pct = pctDe(f);
                          // Un cero medido NO dibuja astilla: que ANTROPOLOGÍA
                          // tenga 0 recogidas y 23 en la población ES el dato, y
                          // un hilo de cortesía lo taparía.
                          if (pct <= 0) return null;
                          return (
                            <i
                              key={f.categoria}
                              className={`aulas-comp-seg es-tono-${tonos.get(f.categoria) ?? 0}`}
                              style={{ width: `${pct}%` }}
                              // **El hover lleva la cifra, y por eso la leyenda
                              // ya no la lleva.** El `title` del navegador
                              // tarda un segundo largo, sale donde el sistema
                              // quiere y no se puede estilar; `data-info` lo
                              // pinta la hoja. `tabIndex` para que también
                              // salga con el teclado: un dato que sólo existe
                              // bajo el ratón no existe para quien no lo usa.
                              tabIndex={0}
                              data-info={`${f.etiqueta} · ${pctPerfil(pct)} · ${fmt(cual === "obtenidas" ? f.obtenidas : f.poblacion)}`}
                            >
                              {/* El rótulo dentro sólo donde cabe. Debajo de ~9 %
                                  se recorta a un guión ilegible, y la leyenda ya
                                  lo dice entero. */}
                              {pct >= 9 ? <em>{pctPerfil(pct)}</em> : null}
                            </i>
                          );
                        })}
                        {resto > 0.5 ? (
                          <i className="aulas-comp-seg es-resto" style={{ width: `${resto}%` }}
                            tabIndex={0}
                            data-info={`Otras categorías o sin dato · ${pctPerfil(resto)}`} />
                        ) : null}
                      </>
                    )}
                  </div>
                );
              };
              return (
                <>
                  <div className="aulas-comp-pilas">
                    {/* **Lo recogido ARRIBA**, no debajo: es lo que cambia cada
                        día y lo que se viene a mirar; la población es el marco
                        contra el que se compara y no se mueve. */}
                    <div className="aulas-comp-pila-fila">
                      <span className="aulas-comp-pila-rotulo">Recogido hasta hoy</span>
                      {pila("obtenidas")}
                    </div>
                    <div className="aulas-comp-pila-fila">
                      <span className="aulas-comp-pila-rotulo">Población del estudio</span>
                      {pila("poblacion")}
                    </div>
                  </div>
                  {/* **La leyenda, centrada y en línea.** Gonzalo: «creo que la
                      leyenda puede estar centrada y verse más elegante».

                      En rejilla vertical eran seis renglones de cuatro columnas
                      —una tabla pequeña debajo de un gráfico, compitiendo con
                      él—. En línea y centrada se lee como lo que es: el pie de
                      la barra. Cada item se lleva sus dos cifras juntas, así
                      que ninguna columna tiene que cuadrar con la de al lado.

                      Y sigue llevando las dos cifras de cada categoría porque
                      sin ellas una carrera en cero desaparecería de la barra y
                      del panel. */}
                  <ul className="aulas-comp-leyenda-cats">
                    {d.filas.map((f) => (
                      // **Sin cifras: las lleva el hover de la barra.** Una
                      // leyenda con números es una tabla pequeña debajo del
                      // gráfico, y entonces el gráfico sobra. Aquí sólo dice
                      // qué color es quién.
                      //
                      // **Salvo el cero, que se marca.** Que Antropología tenga
                      // 0 recogidas y 23 en la población ES el dato, y sin su
                      // segmento en la barra dejaría de verse en ninguna parte.
                      // Se dice con el tono y el color hueco, no con un «0»:
                      // un número suelto en una leyenda sin números se lee como
                      // un error de la pantalla.
                      <li key={f.categoria} data-cero={f.obtenidas ? undefined : "si"}>
                        <i className={`aulas-comp-swatch es-tono-${tonos.get(f.categoria) ?? 0}`} />
                        <span className="aulas-comp-nombre">{f.etiqueta}</span>
                        {f.obtenidas ? null : <em>sin ninguna</em>}
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </section>
        ))}
      </div>
    </div>
  );
}
