import { useMemo } from "react";

import type { MonitoreoAulasAvanceCuota } from "../../../../api/monitoreo";
import { composicionReferencial } from "./composicionReferencial";
import { fmt, pctPerfil } from "./kpisDeAulas";
import "./composicionReferencial.css";

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
 * Los dos carriles van APILADOS y no superpuestos, al contrario que en «Qué
 * grupos no llegan»: allí lo logrado está DENTRO de lo comprometido y el ojo
 * tiene que leer inclusión; aquí son dos repartos de dos poblaciones distintas
 * y lo que hay que poder medir es la diferencia de largo.
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
      <p className="aulas-comp-leyenda">
        <span><i className="aulas-comp-swatch es-obtenidas" />Recogido hasta hoy</span>
        <span><i className="aulas-comp-swatch es-poblacion" />Población del estudio</span>
        <span>{fmt(vista.personas)} {vista.personas === 1 ? "persona" : "personas"} resueltas contra el padrón</span>
      </p>
      <div className="aulas-comp-dimensiones">
        {vista.dimensiones.map((d) => (
          <section className="aulas-comp-dimension" key={d.clave}>
            <div className="aulas-comp-titulo">
              <h4>{d.etiqueta}</h4>
              <span>
                {fmt(d.obtenidasTotal)} de {fmt(d.poblacionTotal)} de la población
              </span>
            </div>
            <ul className="aulas-comp-filas">
              {d.filas.map((f) => {
                const ancho = (v: number | null) =>
                  `${Math.max(0, Math.min(100, (100 * (v ?? 0)) / d.tope))}%`;
                return (
                  <li className="aulas-comp-fila" key={f.categoria}>
                    <span className="aulas-comp-nombre">{f.etiqueta}</span>
                    <span
                      className="aulas-comp-carriles"
                      role="img"
                      aria-label={`${f.etiqueta}: ${f.poblacionPct == null ? "población sin porcentaje" : `${pctPerfil(f.poblacionPct)} de la población`}, ${f.obtenidasPct == null ? "recogido sin porcentaje" : `${pctPerfil(f.obtenidasPct)} de lo recogido`}`}
                    >
                      {/* **Lo recogido ARRIBA**, no debajo: las cifras de la
                          derecha lo ponen primero porque es lo que cambia cada
                          día, y con el orden invertido la pantalla se leía en
                          un sentido y se medía en el otro. */}
                      <i className="aulas-comp-carril">
                        <i className={`aulas-comp-tramo es-obtenidas${(f.obtenidasPct ?? 0) > 0 ? " es-algo" : ""}`}
                          style={{ width: ancho(f.obtenidasPct) }} />
                      </i>
                      <i className="aulas-comp-carril">
                        <i className={`aulas-comp-tramo es-poblacion${(f.poblacionPct ?? 0) > 0 ? " es-algo" : ""}`}
                          style={{ width: ancho(f.poblacionPct) }} />
                      </i>
                    </span>
                    <span className="aulas-comp-cifras">
                      {/* **El recogido primero y en negrita**: es la cifra que
                          cambia cada día. La de población es el marco y no se
                          mueve, así que va debajo y en el tono suave. */}
                      <b>
                        {f.obtenidasPct == null ? "S/D" : pctPerfil(f.obtenidasPct)}
                        {" · "}{fmt(f.obtenidas)}
                      </b>
                      <span>
                        {f.poblacionPct == null ? "S/D" : pctPerfil(f.poblacionPct)}
                        {" · "}{fmt(f.poblacion)} de la población
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
