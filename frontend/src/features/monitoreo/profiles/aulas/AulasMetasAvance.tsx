import type { ReactNode } from "react";

import { fmt, pctPerfil } from "./kpisDeAulas";
import { claseDeFacultad } from "./tonoDeFacultad";
import { aulasPorFacultad, filasAlfabeticas } from "./metasDeLaPestana";
import type {
  MonitoreoAulasPorFacultad,
  MonitoreoAulasProyeccionFila,
} from "../../../../api/monitoreo";
import "./aulasMetas.css";
import { etiquetaDeValorEnGrafico, etiquetaDelEje, type EjeDeclarado } from "./etiquetaDelEje";

/** El porcentaje de la casa (`pctPerfil`): un decimal y espacio antes del «%».
 *  Formatearlo aquí a mano era el tercer sitio del perfil escribiendo el mismo
 *  número de otra manera, que es la deuda que el guard de cifras cierra. */
const avancePct = (parte: number, total: number): string =>
  total > 0 ? pctPerfil((100 * parte) / total) : "—";

/**
 * «Avance por facultad y sexo»: efectivas conseguidas contra la cuota de cada
 * sexo, con las aulas de la facultad al lado.
 *
 * Mira HACIA ATRÁS —lo conseguido, sin proyectar nada—; la pregunta de si se va
 * a llegar es del bloque «Metas y aulas». Son dos lecturas y las dos sirven,
 * pero no se mezclan en la misma tabla: una barra que sumara lo proyectado
 * dejaría de decir dónde estamos.
 *
 * **Las dos columnas de aulas van en la fila de la FACULTAD, no en las de
 * sexo** (dictado suyo, 2026-09-09: «en Avance por facultad y sexo pon una
 * columna de cuántas aulas se han aplicado y cuántas se tienen planificadas»).
 * Un aula no se reparte entre hombres y mujeres —la misma visita da de los
 * dos—, así que repetirla en los dos carriles diría que hay aulas de hombres y
 * aulas de mujeres.
 *
 * «Planificadas» son los TITULARES del sorteo. Las reservas no se planifican:
 * se activan cuando una titular se cae, y contarlas daría las 1 392 filas del
 * banco, que no es el objetivo de nadie.
 */
export function AulasMetasAvance({ filas, aulas , eje}: {
  /**
   * La declaración del eje de cuotas (`avance_cuota.eje`). Sin ella el gráfico
   * se comporta igual que antes: el eje nace en facultad y su etiqueta es el
   * valor crudo, que es lo que HSVG tiene en pantalla.
   */
  eje?: EjeDeclarado;

  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null;
  aulas: ReadonlyArray<MonitoreoAulasPorFacultad> | null | undefined;
}): ReactNode {
  const orden = filasAlfabeticas(filas);
  if (!orden.length) return null;
  const porFacultad = aulasPorFacultad(aulas);
  return (
    <div className="aulas-metas-scroll">
      <table className="aulas-metas-tabla es-fija">
        {/* **Anchos declarados, no repartidos por el contenido.** Sin esto la
            tabla es `auto` y la columna de la barra se lleva lo que sobra: con
            una facultad de nombre largo o una barra al 100 %, las cifras de la
            derecha se estrujan y el carril se mete debajo de «Aulas aplicadas».
            Lo vio Gonzalo en pantalla el 2026-09-09 —«la barra puede incluso
            ponerse encima de la columna de aplicados»— y es lo mínimo que se le
            pide a una tabla: que sus columnas estén donde dicen que están, con
            cualquier dato. */}
        <colgroup>
          <col style={{ width: "13rem" }} />
          <col style={{ width: "7.5rem" }} />
          <col />
          <col style={{ width: "4.5rem" }} />
          <col style={{ width: "5rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "7.5rem" }} />
          <col style={{ width: "8.5rem" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="es-izq">Facultad</th>
            <th className="es-izq" />
            <th className="es-izq">Avance</th>
            <th>%</th>
            <th>Efectivas</th>
            <th>Meta</th>
            <th>Faltan</th>
            <th>Aulas aplicadas</th>
            <th>Aulas planificadas</th>
          </tr>
        </thead>
        {orden.map((f) => {
          const a = porFacultad.get(f.facultad);
          const carriles = [
            ["Hombres", "hombres", f.obtenidas_M, f.meta_M],
            ["Mujeres", "mujeres", f.obtenidas_F, f.meta_F],
          ] as const;
          return (
            <tbody key={f.facultad}>
              <tr className="es-facultad">
                <td colSpan={7} className="es-titulo-facultad">
                  <span className={claseDeFacultad(f.facultad)}>{etiquetaDeValorEnGrafico(f.facultad, eje)}</span>
                </td>
                {/* Sin dato de aulas se escribe «—» y no un cero: una facultad
                    sin aulas planificadas no existe, y el cero lo afirmaría. */}
                <td className="es-num">{a ? fmt(a.aplicadas) : "—"}</td>
                <td className="es-num">{a ? fmt(a.planificadas) : "—"}</td>
              </tr>
              {carriles.map(([sexo, tono, obtenidas, meta]) => {
                const faltan = Math.max(0, meta - obtenidas);
                const avance = meta > 0 ? Math.min(100, (100 * obtenidas) / meta) : 0;
                return (
                  <tr key={sexo}>
                    <td />
                    <td className="es-sexo">
                      <span className="aulas-metas-sexo" data-sexo={tono}>{sexo}</span>
                    </td>
                    <td>
                      {/* La barra llega hasta donde llega el avance: el carril
                          entero es la meta, así que un carril a medias se lee
                          sin mirar el número. */}
                      <div className="aulas-metas-gauge">
                        <i className="es-aplicado" data-sexo={tono} style={{ width: `${avance}%` }} />
                      </div>
                    </td>
                    <td className="es-num">{avancePct(obtenidas, meta)}</td>
                    <td className="es-num">{fmt(Math.round(obtenidas))}</td>
                    <td className="es-num">{fmt(Math.round(meta))}</td>
                    <td className={`es-num${faltan > 0 ? " es-falta" : ""}`}>
                      {fmt(Math.round(faltan))}
                    </td>
                    <td />
                    <td />
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
