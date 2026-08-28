import { useMemo } from "react";

import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasEfectividadSeguimiento,
  MonitoreoRow,
} from "../../../../api/monitoreo";
import { avanceParaCliente, type FilaAvanceCliente } from "./avanceParaCliente";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt } from "./kpisDeAulas";
import "./avanceParaCliente.css";

/**
 * El avance como se lo enseñas al cliente: por facultad y por sexo.
 *
 * Es la misma tabla que va en el PDF y en la hoja «Cómo va el campo» del libro:
 * un solo contenido en tres soportes, decidido una vez.
 *
 * Se construye con el criterio que Gonzalo aprobó en la tabla de Efectividad:
 * tabla semántica con nombres de columna reales, porcentajes en vez de
 * fracciones, personas enteras, y el estado en palabra además de en color.
 */

const pct = (n: number | null) =>
  n == null ? "—" : `${(n * 100).toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/** Personas enteras. Lo que falta no se subestima; lo demás no se promete de más. */
const personas = (n: number | null, esFaltante = false) => {
  if (n == null) return "—";
  const v = esFaltante ? Math.ceil(n) : Math.floor(n);
  return v.toLocaleString("es-PE");
};

/**
 * El veredicto en palabra, no sólo en color.
 *
 * `ajustada` existe porque «cerrada» y «le falta poco» piden cosas distintas y
 * un umbral binario las junta: a 95 % de la cuota no hay que salir corriendo,
 * pero tampoco se puede dar por cerrada.
 */
function veredicto(f: FilaAvanceCliente): { texto: string; tono: string } {
  if (f.muestra == null) return { texto: "Sin cuota", tono: "es-neutro" };
  if (f.avance == null) return { texto: "Sin dato", tono: "es-neutro" };
  if (f.avance >= 1) return { texto: "Cerrada", tono: "es-ok" };
  if (f.avance >= 0.9) return { texto: "Le falta poco", tono: "es-aviso" };
  return { texto: "Abierta", tono: "es-riesgo" };
}

export function AulasAvanceParaCliente({
  avanceCuota, celdasSexo = [], efectividad = null, avancePorFacultad = [],
  facultadEnFoco, onFoco,
}: {
  avanceCuota: MonitoreoAulasAvanceCuota | null | undefined;
  celdasSexo?: ReadonlyArray<MonitoreoRow>;
  efectividad?: MonitoreoAulasEfectividadSeguimiento | null;
  avancePorFacultad?: ReadonlyArray<MonitoreoRow>;
  facultadEnFoco?: string;
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const filas = useMemo(
    () => avanceParaCliente(avanceCuota, celdasSexo, efectividad, avancePorFacultad),
    [avanceCuota, celdasSexo, efectividad, avancePorFacultad],
  );

  // C3: el vacío es suyo y dice cuál de los dos es, porque se arreglan distinto.
  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {avanceCuota?.vigencia === "sin_diseno"
          ? "El estudio importado no trae la cuota del diseño, así que no hay contra qué medir el avance."
          : "Todavía no hay facultades con cuota que mostrar."}
      </p>
    );
  }

  const totalMuestra = filas.reduce((s, f) => s + (f.muestra ?? 0), 0);
  const totalConseguidas = filas.reduce((s, f) => s + f.conseguidas, 0);
  // Los faltantes se SUMAN, no se netean: el superávit de una facultad no cubre
  // lo que falta en otra (ADR 0079).
  const totalFaltan = filas.reduce((s, f) => s + (f.faltan ?? 0), 0);
  const abiertas = filas.filter((f) => (f.faltan ?? 0) > 0).length;

  return (
    <div className="aulas-cliente" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cliente-cabeza">
        <span>
          De una muestra de <strong>{personas(totalMuestra)}</strong> alumnos se llevan{" "}
          <strong>{personas(totalConseguidas)}</strong>.
        </span>
        {totalFaltan > 0 ? (
          <span>
            Faltan <strong>{personas(totalFaltan, true)}</strong> repartidos en{" "}
            {fmt(abiertas)} {abiertas === 1 ? "facultad" : "facultades"}.
          </span>
        ) : (
          <span>Todas las facultades tienen su cuota cubierta.</span>
        )}
        {/* Los faltantes no se netean, y quien vea el total querrá restarlo. */}
        <span className="aulas-cliente-nota">
          lo que falta se suma por facultad: cubrir de más en una no cubre otra
        </span>
      </p>

      <div className="aulas-cliente-marco">
        <table className="aulas-cliente-tabla">
          <caption className="aulas-cliente-caption">
            Avance por facultad y sexo contra la cuota del diseño, con las aulas aplicadas
          </caption>
          {/* CABECERA AGRUPADA. Con una sola fila, «Mujeres» y «Hombres»
              aparecían DOS veces —bajo la muestra y bajo lo conseguido— y nada
              decía cuál era cuál: visto en pantalla el 2026-08-27. El grupo lo
              resuelve sin alargar los rótulos, y `scope="colgroup"` hace que un
              lector de pantalla anuncie «Muestra, Mujeres» en vez de «Mujeres»
              a secas. */}
          <thead>
            <tr className="aulas-cliente-grupos">
              <td />
              <th scope="colgroup" colSpan={3}>La muestra que le toca</th>
              <th scope="colgroup" colSpan={3}>Lo que se lleva</th>
              <td />
              <td />
              <td />
            </tr>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col" className="es-num">Total</th>
              <th scope="col" className="es-num">Mujeres</th>
              <th scope="col" className="es-num">Hombres</th>
              <th scope="col" className="es-num">Total</th>
              <th scope="col" className="es-num">Mujeres</th>
              <th scope="col" className="es-num">Hombres</th>
              <th scope="col" className="es-num">Aulas aplicadas</th>
              <th scope="col" className="es-num">Avance</th>
              <th scope="col" className="es-num">Faltan</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const v = veredicto(f);
              const enFoco = f.facultad === facultadEnFoco;
              const abierta = (f.faltan ?? 0) > 0;
              return (
                <tr key={f.facultyKey}
                  className={[abierta ? "es-abierta" : "", enFoco ? "es-en-foco" : ""].filter(Boolean).join(" ") || undefined}>
                  <th scope="row" className="aulas-cliente-nombre-celda">
                    <span className={`aulas-cliente-chip ${v.tono}`}>{v.texto}</span>
                    <NombreDeFacultad facultad={f.facultad} className="aulas-cliente-nombre"
                      enFoco={enFoco} onFoco={onFoco}>
                      {f.facultad}
                    </NombreDeFacultad>
                  </th>
                  <td className="aulas-cliente-cifra">{personas(f.muestra)}</td>
                  <td className="aulas-cliente-cifra es-debil">{personas(f.muestraMujeres)}</td>
                  <td className="aulas-cliente-cifra es-debil">{personas(f.muestraHombres)}</td>
                  <td className="aulas-cliente-cifra">{personas(f.conseguidas)}</td>
                  <td className="aulas-cliente-cifra es-debil">{personas(f.conseguidasMujeres)}</td>
                  <td className="aulas-cliente-cifra es-debil">{personas(f.conseguidasHombres)}</td>
                  {/* Las aplicadas y las del plan juntas: son dos denominadores
                      y separarlas evita que se lea un ratio contra el equivocado. */}
                  <td className="aulas-cliente-cifra es-debil">
                    {f.aulasAplicadas == null ? "—" : `${fmt(f.aulasAplicadas)} de ${f.aulasDelPlan == null ? "—" : fmt(f.aulasDelPlan)}`}
                  </td>
                  <td className="aulas-cliente-cifra">{pct(f.avance)}</td>
                  <td className={`aulas-cliente-cifra${abierta ? "" : " es-debil"}`}>{personas(f.faltan, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="aulas-cliente-pie">
        <strong>Muestra</strong> es la cuota que el diseño fijó para esa facultad, y{" "}
        <strong>se lleva</strong> lo recogido que pasó los filtros del estudio.{" "}
        <strong>Aulas aplicadas</strong> se cuenta sobre las del plan de esa facultad.{" "}
        La sobremuestra operativa no llega a Monitoreo, así que esta tabla no la compara.
      </p>
    </div>
  );
}
