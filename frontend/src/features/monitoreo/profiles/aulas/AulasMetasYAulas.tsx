import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import { claseDeFacultad } from "./tonoDeFacultad";
import { carrilesDeLaFila, filasAlfabeticas } from "./metasDeLaPestana";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";
import "./aulasMetas.css";
import { etiquetaDeValorEnGrafico, etiquetaDelEje, type EjeDeclarado } from "./etiquetaDelEje";

/**
 * «Metas y aulas»: lo aplicado más lo que cabe esperar de las aulas que ya
 * tienen día, contra la meta de cada sexo.
 *
 * Es el bloque que contesta la pregunta de Gonzalo —«con lo que ya tengo
 * agendado, ¿llego?»— y el único de la pestaña que consume la tasa, que por eso
 * lleva su mando DENTRO y no arriba con el de la meta.
 *
 * **La escala es POR FACULTAD y no común.** Las metas van de 20 a 792 personas:
 * con una escala compartida, doce facultades quedan en un hilo y no se puede
 * ver si llegan, que es justo lo que este bloque existe para decir. La magnitud
 * relativa entre facultades la enseña el bloque de barras, que sí comparte
 * escala — dos gráficos porque son dos preguntas.
 *
 * Y la marca de la meta va dentro del carril: si la barra no alcanza la marca,
 * ese sexo no llega ni yendo a todo lo que hay cerrado.
 */
export function AulasMetasYAulas({ filas , eje}: {
  /**
   * La declaración del eje de cuotas (`avance_cuota.eje`). Sin ella el gráfico
   * se comporta igual que antes: el eje nace en facultad y su etiqueta es el
   * valor crudo, que es lo que HSVG tiene en pantalla.
   */
  eje?: EjeDeclarado;

  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null;
}): ReactNode {
  const orden = filasAlfabeticas(filas);
  if (!orden.length) return null;
  return (
    // El contenedor de datos del panel «Metas por facultad y sexo». Sin
    // declararlo, el runner cae a los hijos del `section` y mide el ENCABEZADO
    // como si fuera datos: `capacity-drift` sobre sus 5 px de padding, un
    // síntoma que no se parece a su causa. Es el mismo patrón que ya arreglaron
    // «Respuestas», «Por facultad» y «Avance por facultad y sexo».
    <div className="aulas-metas" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-metas-leyenda">
        <span><i className="aulas-metas-swatch" data-tramo="aplicado" />Aplicado</span>
        <span><i className="aulas-metas-swatch" data-tramo="proyectado" />Proyectado de lo agendado</span>
        <span><i className="aulas-metas-swatch" data-tramo="meta" />Meta</span>
      </p>
      <div className="aulas-metas-scroll">
        <table className="aulas-metas-tabla es-fija">
          {/* Mismos anchos declarados que en «Avance por facultad y sexo»: una
              tabla cuyas columnas se mueven con el dato no es una tabla. */}
          <colgroup>
            <col style={{ width: "13rem" }} />
            <col style={{ width: "7.5rem" }} />
            <col />
            <col style={{ width: "5.5rem" }} />
            <col style={{ width: "5.5rem" }} />
            <col style={{ width: "5rem" }} />
            <col style={{ width: "7rem" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="es-izq">{etiquetaDelEje(eje)}</th>
              <th className="es-izq" />
              <th className="es-izq">Aplicado + proyectado contra la meta</th>
              <th>Aplicado</th>
              <th>Proyect.</th>
              <th>Meta</th>
              <th>Brecha</th>
            </tr>
          </thead>
          {/* Un `tbody` por facultad y no una tabla anidada: agrupa sus tres
              filas —la de la facultad y sus dos carriles— sin romper la rejilla
              de columnas, que es lo que mantiene alineadas las cifras de todas
              las facultades. */}
          {orden.map((f) => {
            const carriles = carrilesDeLaFila(f).map(
              (c) => [c.rotulo, c.tono, c.meta, c.obtenidas, c.proyectadas] as const);
            // **El techo NO puede depender del escenario.** Lo aplicado y la
            // meta son los mismos con la tasa del diseño y con la obtenida; lo
            // único que cambia entre las dos es la proyección. Si el techo se
            // calcula incluyendo lo proyectado —como se hizo primero—, cambiar
            // de tasa reescala el carril entero y se mueven la marca de la meta
            // y la barra de lo aplicado, que no han cambiado. Gonzalo lo vio en
            // pantalla el 2026-09-09: «se supone que lo único que debería
            // cambiar es la brecha y lo verde claro, pero cambia todo».
            //
            // Así que la escala sale de la meta y de lo conseguido, y lo
            // proyectado se recorta contra el borde cuando lo desborda: ver una
            // barra tocar el final dice «se pasa» sin mentir sobre el resto.
            const techo = Math.max(
              ...carriles.map(([, , meta, obtenidas]) => Math.max(meta, obtenidas)), 1,
            ) * 1.04;
            const ancho = (v: number | null) =>
              `${Math.max(0, Math.min(100, (100 * (v ?? 0)) / techo))}%`;
            return (
              <tbody key={f.facultad}>
                <tr className="es-facultad">
                  <td colSpan={7}>
                    <span className={claseDeFacultad(f.facultad)}>{etiquetaDeValorEnGrafico(f.facultad, eje)}</span>{" "}
                    {/* En la unidad del perfil —el curso-horario, masculino
                        (ADR 0060)— y no «aulas aplicadas»: los rótulos de
                        COLUMNA de «Avance por facultad y sexo» sí dicen «aulas»
                        porque son las palabras con las que él pidió esa
                        columna, pero la prosa del perfil habla su vocabulario. */}
                    <span className="aulas-metas-aulas">
                      {fmt(f.aulas_aplicadas)} cursos-horario aplicados ·{" "}
                      {fmt(f.aulas_agendadas)} agendados
                    </span>
                  </td>
                </tr>
                {carriles.map(([sexo, tono, meta, obtenidas, proyectadas]) => {
                  const brecha = obtenidas + (proyectadas ?? 0) - meta;
                  const falta = brecha < 0;
                  return (
                    <tr key={sexo}>
                      <td />
                      <td className="es-sexo">
                        <span className="aulas-metas-sexo" data-sexo={tono}>{sexo}</span>
                      </td>
                      <td>
                        <div className="aulas-metas-gauge">
                          <i className="es-aplicado" data-sexo={tono} style={{ width: ancho(obtenidas) }} />
                          <i
                            className="es-proyectado"
                            // Recortado contra el borde: lo que se pasa del techo
                            // se dibujaba fuera del carril y la celda desbordaba.
                            style={{ left: ancho(obtenidas),
                                     width: ancho(Math.min(proyectadas ?? 0, Math.max(0, techo - obtenidas))) }}
                          />
                          <i className="es-meta" style={{ left: ancho(meta) }} />
                        </div>
                      </td>
                      <td className="es-num">{fmt(Math.round(obtenidas))}</td>
                      <td className="es-num">
                        {proyectadas == null ? "—" : fmt(Math.round(proyectadas))}
                      </td>
                      <td className="es-num">{fmt(Math.round(meta))}</td>
                      <td className={`es-num${falta ? " es-falta" : ""}`}>
                        {falta ? `faltan ${fmt(Math.round(-brecha))}` : `+${fmt(Math.round(brecha))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
