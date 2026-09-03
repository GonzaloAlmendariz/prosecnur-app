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
 * Es la misma tabla que va en el PDF y en la hoja «Avance de campo» del libro:
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
 * «Le falta poco» existe porque cumplida y casi cumplida piden cosas distintas y
 * un umbral binario las junta: a 95 % de la cuota no hay que salir corriendo,
 * pero tampoco se puede dar por cerrada.
 *
 * ## Se decide con lo que FALTA, no con el avance
 *
 * Decía `f.avance >= 1` → «Cerrada», y `avance` es el cociente de los TOTALES de
 * la facultad, que compensa un sexo con el otro. `faltan`, en cambio, ya suma el
 * déficit de cada sexo por separado (`avanceParaCliente.ts`), tal como manda el
 * ADR 0079 y el encargo: «lo que me interesa es que TODAS LAS FACULTADES CUMPLAN
 * CON SU CUOTA DE SEXO. Ese es lo fundamental de todo esto».
 *
 * Con las dos reglas conviviendo, **la misma fila decía «Cerrada» y «Faltan
 * 17»**. Medido en pantalla el 2026-08-29 con `como_2025`:
 *
 *   Arquitectura     cuota 125 (85 M / 40 H) · lleva 126 (68 M / 58 H) · faltan 17
 *   Ciencias e Ing.  cuota 528 (130 M / 398 H) · lleva 535 (141 M / 394 H) · faltan 4
 *   Educación        cuota 24 (20 M / 4 H) · lleva 33 (32 M / 1 H) · faltan 3
 *
 * A Arquitectura le faltan 17 mujeres y le sobran 18 hombres: el total sale a
 * 100.8 % y la cuota que importa está sin cerrar. Quien lee la tabla —que es la
 * que va al PDF y al libro— se llevaba tres facultades por cerradas.
 *
 * El umbral de «le falta poco» también pasa a medirse sobre lo que falta: un
 * avance del 100.8 % no dice nada de si el hueco que queda es de 4 personas o de
 * 17.
 */
const CASI = 0.1;

function veredicto(f: FilaAvanceCliente): { texto: string; tono: string } {
  if (f.muestra == null) return { texto: "Sin cuota", tono: "es-neutro" };
  if (f.avance == null || f.faltan == null) return { texto: "Sin dato", tono: "es-neutro" };
  if (f.faltan === 0) return { texto: "Cuota cumplida", tono: "es-ok" };
  // Sobre la cuota, que es el tamaño contra el que un hueco es grande o chico.
  if (f.muestra > 0 && f.faltan <= f.muestra * CASI) {
    return { texto: "Le falta poco", tono: "es-aviso" };
  }
  return { texto: "Cuota pendiente", tono: "es-riesgo" };
}

export function AulasAvanceParaCliente({
  avanceCuota, celdasSexo = [], efectividad = null, avancePorFacultad = [],
  diseno = null, facultadEnFoco, onFoco,
}: {
  avanceCuota: MonitoreoAulasAvanceCuota | null | undefined;
  celdasSexo?: ReadonlyArray<MonitoreoRow>;
  efectividad?: MonitoreoAulasEfectividadSeguimiento | null;
  avancePorFacultad?: ReadonlyArray<MonitoreoRow>;
  /**
   * Las metas del diseño, cuando el estudio las publica. De aquí sale la
   * comparación contra la SOBREMUESTRA, que hasta ahora no llegaba a Monitoreo
   * y por eso el pie de esta tabla declaraba que no la comparaba.
   */
  diseno?: { meta_diseno?: unknown; sobremuestra?: unknown; meta_operativa?: unknown } | null;
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

  // **La muestra del estudio NO es la suma de las cuotas por facultad.**
  //
  // Medido el 2026-08-29 sobre HSVG2026: el diseño declara `n_objetivo = 2500`
  // y `meta: tipo=objetivo · valor=2500 · variable_control=facultad_sexo`;
  // sumar las quince filas da 3.491, porque una cuota por celda no se netea
  // entre celdas (ADR 0079) y el reparto con mínimos por estrato sobrepasa el
  // objetivo por construcción. Este panel se llama «El avance que ve el
  // cliente» y abría diciendo «De una muestra de 3.491 alumnos»: ninguna de las
  // dos cifras del diseño —2.500 de objetivo, 3.750 de operativo— y presentada
  // como el tamaño del estudio.
  //
  // El motor publica el total en `avance_cuota$total$cuota` y se usa ése: una
  // sola lectura en vez de dos que pueden separarse. **Pero no vale 2.500.**
  // `monitoreo_aulas_metas_diseno.R:117` lo define como
  // `round(sum(cuotas_por_facultad))`, o sea el MISMO 3.491 — comprobado en
  // pantalla el 2026-08-29, tras cambiar la fuente el número no se movió—. El
  // objetivo del estudio vive en `n_objetivo` del componente activo y no viaja
  // a Monitoreo.
  //
  // Por eso lo que se arregla aquí es el RÓTULO, que es lo inequívoco: 3.491 no
  // es «una muestra», es lo que suman las cuotas. Cuál de los dos debe presidir
  // el panel del cliente —el objetivo, 2.500, o el reparto operativo— es una
  // decisión metodológica pendiente, anotada como ítem 24.
  //
  // `totalFaltan` NO cambia: ahí la suma sin netear es lo correcto, es lo que
  // dice la nota de debajo, y `total.brecha` del motor viene neteada.
  const cuotaDelMotor = Number(avanceCuota?.total?.cuota);
  const totalMuestra = Number.isFinite(cuotaDelMotor) && cuotaDelMotor > 0
    ? cuotaDelMotor
    : filas.reduce((s, f) => s + (f.muestra ?? 0), 0);
  const totalConseguidas = filas.reduce((s, f) => s + f.conseguidas, 0);
  // Los faltantes se SUMAN, no se netean: el superávit de una facultad no cubre
  // lo que falta en otra (ADR 0079).
  const totalFaltan = filas.reduce((s, f) => s + (f.faltan ?? 0), 0);

  // **La sobremuestra, si el diseño la publica.** Se calla entera cuando no
  // está: inventar un techo sería peor que no tenerlo.
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const techo = num(diseno?.meta_operativa);
  const extra = num(diseno?.sobremuestra);
  const sobremuestra = techo ? (
    <span>
      Con la sobremuestra el techo es <strong>{personas(techo)}</strong>
      {extra ? <> ({personas(extra)} sobre la meta)</> : null}, y se lleva el{" "}
      <strong>{Math.round((totalConseguidas / techo) * 100)} %</strong> de ese techo.
    </span>
  ) : null;
  const abiertas = filas.filter((f) => (f.faltan ?? 0) > 0).length;

  return (
    <div className="aulas-cliente" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cliente-cabeza">
        <span>
          Las cuotas por facultad suman{" "}
          <strong>{personas(totalMuestra)}</strong> alumnos; se llevan{" "}
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
        {/* **La segunda vara, cuando el estudio la declara.**
            El operativo compara contra dos cifras: la meta, que es lo que hay
            que conseguir, y la sobremuestra, que es hasta dónde se compró aforo.
            Gonzalo: «sobrellegar a la muestra no es una necesidad [...] la
            sobremuestra podría servir como un valor referencial», así que se
            dice como referencia y nunca como algo que falte. */}
        {sobremuestra}
        {/* Los faltantes no se netean, y quien vea el total querrá restarlo. */}
        <span className="aulas-cliente-nota">
          Lo que falta se suma grupo a grupo: cubrir de más en una facultad —o en un sexo— no cubre lo que falta en otra
        </span>
      </p>

      <div className="aulas-cliente-marco">
        <table className="aulas-cliente-tabla">
          <caption className="aulas-cliente-caption">
            Avance por facultad y sexo contra la cuota del diseño, con los cursos-horario aplicados
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
              <th scope="colgroup" colSpan={3}>Cuota asignada</th>
              <th scope="colgroup" colSpan={3}>Encuestas logradas</th>
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
              <th scope="col" className="es-num">Cursos-horario aplicados</th>
              <th scope="col" className="es-num">Avance del total</th>
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
                      enFoco={enFoco}>
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
        <strong>Cursos-horario aplicados</strong> se cuenta sobre los del plan de esa facultad.{" "}
        <strong>Avance del total</strong> compensa un sexo con el otro;{" "}
        <strong>Faltan</strong> suma el déficit de cada sexo por separado y es el que
        decide el estado. Por eso una facultad pasa del 100 % y sigue pendiente.{" "}
        La <strong>sobremuestra</strong> es hasta dónde se compró aforo, no una segunda meta:
        lo que decide el cierre sigue siendo la cuota de cada facultad y sexo. Aparece arriba
        cuando el estudio la declara.
      </p>
    </div>
  );
}
