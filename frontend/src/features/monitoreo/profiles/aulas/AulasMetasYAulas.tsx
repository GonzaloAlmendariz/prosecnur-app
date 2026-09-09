import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import { filasAlfabeticas } from "./metasDeLaPestana";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";
import "./aulasMetas.css";

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
export function AulasMetasYAulas({ filas }: {
  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null;
}): ReactNode {
  const orden = filasAlfabeticas(filas);
  if (!orden.length) return null;
  return (
    <>
      <p className="aulas-metas-leyenda">
        <span><i className="aulas-metas-swatch" data-tramo="aplicado" />Aplicado</span>
        <span><i className="aulas-metas-swatch" data-tramo="proyectado" />Proyectado de lo agendado</span>
        <span><i className="aulas-metas-swatch" data-tramo="meta" />Meta</span>
      </p>
      <div className="aulas-metas-scroll">
        <table className="aulas-metas-tabla">
          <thead>
            <tr>
              <th className="es-izq">Facultad</th>
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
            const carriles = [
              ["Hombres", f.meta_M, f.obtenidas_M, f.proyectadas_M],
              ["Mujeres", f.meta_F, f.obtenidas_F, f.proyectadas_F],
            ] as const;
            // El techo del carril: la meta o el total proyectado, lo que sea
            // mayor. Sin el segundo término una facultad que se pasa saldría
            // con la barra cortada justo donde empieza la buena noticia.
            const techo = Math.max(
              f.meta_M, f.meta_F,
              f.obtenidas_M + (f.proyectadas_M ?? 0),
              f.obtenidas_F + (f.proyectadas_F ?? 0),
              1,
            ) * 1.04;
            const ancho = (v: number | null) =>
              `${Math.max(0, Math.min(100, (100 * (v ?? 0)) / techo))}%`;
            return (
              <tbody key={f.facultad}>
                <tr className="es-facultad">
                  <td colSpan={7}>
                    <span className="aulas-sexo-chip">{f.facultad}</span>{" "}
                    <span className="aulas-metas-aulas">
                      {fmt(f.aulas_aplicadas)} aplicadas · {fmt(f.aulas_agendadas)} agendadas
                    </span>
                  </td>
                </tr>
                {carriles.map(([sexo, meta, obtenidas, proyectadas]) => {
                  const brecha = obtenidas + (proyectadas ?? 0) - meta;
                  const falta = brecha < 0;
                  return (
                    <tr key={sexo}>
                      <td />
                      <td className="es-sexo">
                        <span className="aulas-sexo-chip">{sexo}</span>
                      </td>
                      <td>
                        <div className="aulas-metas-gauge">
                          <i className="es-aplicado" style={{ width: ancho(obtenidas) }} />
                          <i
                            className="es-proyectado"
                            style={{ left: ancho(obtenidas), width: ancho(proyectadas) }}
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
    </>
  );
}
