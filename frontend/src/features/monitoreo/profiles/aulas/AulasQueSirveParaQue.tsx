import type { ReactNode } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { fmt } from "./kpisDeAulas";
import { inventarioDelCorte } from "./refuerzosDeFacultad";
import "./aulasQueSirveParaQue.css";

/**
 * **Qué sirve para qué**: las tres procedencias contra los tres casos del libro.
 *
 * La regla que resume es dura y se olvida a diario: una reserva comprometida
 * con una cadena viva NO se puede gastar en un refuerzo, aunque esté libre hoy,
 * porque es la red de un titular que todavía no ha salido. Gastarla deja a ese
 * titular sin relevo, y esa consecuencia llega días después y en otra facultad.
 *
 * No es un cartel: cada procedencia trae **cuántas hay hoy**. Una matriz de
 * reglas sin el inventario detrás deja creer que la reserva del estudio es lo
 * poco que está libre, y es al revés —el grueso está comprometido—.
 *
 * Las tres columnas son los tres verbos del libro:
 * **A** reemplazada por (el titular sale y entra otra),
 * **B** complementada con (el titular se queda y las dos cuentan),
 * **C** aplicada de refuerzo (por cuota, sin titular caído).
 */
export function AulasQueSirveParaQue({ filas }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
}): ReactNode {
  const inv = inventarioDelCorte(filas);

  if (!inv.total) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        El plan todavía no trae reservas: sin catálogo no hay nada que repartir
        entre los tres casos.
      </p>
    );
  }

  const filasMatriz = [
    {
      clave: "cadena",
      titulo: "Su propia cadena",
      cuantas: inv.enCadenaViva,
      pie: "el orden que fijó el sorteo, todavía comprometido",
      a: "si", b: "si", c: "no",
      porque: "Es la red de su titular: mientras esa cadena no se resuelva, gastarla en un refuerzo deja al titular sin relevo.",
    },
    {
      clave: "al_aire",
      titulo: "Al aire",
      cuantas: inv.alAire,
      pie: "su cadena ya se resolvió y dejaron de estar comprometidas",
      a: "si", b: "si", c: "si",
      porque: "Su titular —o un reemplazo anterior— ya se aplicó, así que el slot está cubierto y ellas quedan libres para cualquiera de los tres casos, siempre dentro de su facultad.",
    },
    {
      clave: "extra",
      titulo: "Reserva adicional",
      cuantas: inv.extra,
      pie: "nunca entró en ninguna cadena",
      a: "si", b: "si", c: "si",
      porque: "No sirve para otra cosa, así que es la primera que se gasta a igualdad de todo lo demás.",
    },
  ] as const;

  return (
    <div className="aulas-qspq" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-qspq-lectura">
        <strong>{fmt(inv.total)}</strong> reservas en el corte, y sólo{" "}
        <strong>{fmt(inv.alAire + inv.extra)}</strong>{" "}
        {inv.alAire + inv.extra === 1 ? "se puede gastar" : "se pueden gastar"} en un refuerzo
        {inv.enCadenaViva ? (
          <>: {inv.enCadenaViva === 1 ? "la otra" : "las otras"}{" "}
            <strong>{fmt(inv.enCadenaViva)}</strong>{" "}
            {inv.enCadenaViva === 1 ? "sigue siendo" : "siguen siendo"} la red de un titular que no ha salido</>
        ) : null}.
      </p>

      <div className="aulas-qspq-marco">
        <table className="aulas-qspq-tabla">
          <caption className="aulas-qspq-caption">
            Qué procedencia sirve para cada caso del libro. La facultad es
            frontera dura en los tres: de ahí no se sale nunca.
          </caption>
          <thead>
            <tr>
              <th scope="col">De dónde sale</th>
              <th scope="col" className="es-caso"><b>A</b> reemplaza<em>el titular cae</em></th>
              <th scope="col" className="es-caso"><b>B</b> complementa<em>el titular se queda</em></th>
              <th scope="col" className="es-caso"><b>C</b> refuerza<em>por cuota, sin caído</em></th>
            </tr>
          </thead>
          <tbody>
            {filasMatriz.map((f) => (
              <tr key={f.clave}>
                <th scope="row">
                  <span className="aulas-qspq-nombre">
                    {f.titulo}
                    <b>{fmt(f.cuantas)}</b>
                  </span>
                  <span className="aulas-qspq-pie">{f.pie}</span>
                </th>
                {([f.a, f.b, f.c] as const).map((v, i) => (
                  <td key={i} className={v === "si" ? "es-si" : "es-no"}>
                    <span aria-hidden="true">{v === "si" ? "✓" : "✗"}</span>
                    <i>{v === "si" ? "sirve" : "no"}</i>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="aulas-qspq-nota">
        {filasMatriz[0].porque}
      </p>
    </div>
  );
}
