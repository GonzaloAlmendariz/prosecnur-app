import { useMemo } from "react";

import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasEfectividadSeguimiento,
  MonitoreoRow,
} from "../../../../api/monitoreo";
import { avanceParaCliente, type FilaAvanceCliente } from "./avanceParaCliente";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt, pctPerfil } from "./kpisDeAulas";
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

/** El porcentaje de la casa. Esto era una copia del cuerpo de `pctPerfil()`, y
 *  una copia sólo espera a que alguien afine el original. */
const pct = (n: number | null) => (n == null ? "—" : pctPerfil(n * 100));

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

/**
 * ⚠ SIN MONTAR desde el 2026-09-08.
 *
 * Lo sustituyeron las cinco tablas que sirve el motor (`AulasTablasDeAvance`).
 * Gonzalo, sobre la tabla que este panel enseñaba: «esta tabla está súper pobre
 * y no refleja el avance real (...) se supone que la app debe ser una versión
 * mejorada del Excel y francamente veo todo lo contrario».
 *
 * Se queda en el árbol, no se borra: su view-model (`avanceParaCliente.ts`)
 * documenta decisiones que las tablas nuevas heredan, entre ellas que los
 * faltantes se suman grupo a grupo y no se netean (ADR 0079). Si dentro de unas
 * semanas nadie lo ha reclamado, se retira junto con su test.
 */
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
  // Los totales por sexo y de aulas, para la fila de cierre. Se suman de las
  // filas porque el motor no publica ese corte agregado; el total de la MUESTRA
  // sí sale del motor (`totalMuestra`, arriba), que es la lectura única.
  // **Un cero no es un vacío.** Si NINGUNA fila trae la columna —el estudio no
  // declara sexo, o no hay partes— la fila de cierre escribe «—» como el
  // cuerpo, en vez de un 0 que se leería como «se recogieron cero».
  const suma = (leer: (f: typeof filas[number]) => number | null | undefined): number | null => {
    let hay = false;
    let total = 0;
    for (const f of filas) {
      const v = Number(leer(f));
      if (!Number.isFinite(v)) continue;
      hay = true;
      total += v;
    }
    return hay ? total : null;
  };
  const cuenta = (v: number | null) => (v === null ? "—" : fmt(v));

  return (
    <div className="aulas-cliente" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* **Aquí iba un párrafo de cuatro frases** que repetía en prosa lo que la
          tabla de abajo dice en columnas y lo que los KPIs de la banda dicen en
          cifras grandes: la suma de las cuotas, lo que se lleva, lo que falta y
          en cuántas facultades, más la nota de la sobremuestra.

          Gonzalo lo cortó el 2026-09-08: «en primer lugar tiene[s] arriba [algo]
          que no ayuda y no tiene buen formato, es mejor quitarlo». Tenía razón
          por dos motivos: desde que los siete KPIs presiden la pestaña con
          Efectivas, Muestra, Avance y Sobremuestra, este párrafo era la tercera
          copia de las mismas cifras en la misma pantalla; y las empujaba a todas
          hacia abajo con texto corrido, que es el formato en el que peor se leen.

          Lo único que el párrafo decía y la tabla no —que los faltantes se suman
          grupo a grupo y no se netean— sobrevive como nota al pie, que es donde
          se busca cuando la resta no cuadra. */}

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
          {/* **La fila «Total»**, que Gonzalo pidió para el libro («debe haber
              una fila de total al final») y que aquí resuelve además lo que el
              párrafo retirado enseñaba: el total de la muestra sale del motor
              (`avance_cuota.total.cuota`), no de sumar la columna, y los
              faltantes se SUMAN sin netear —por eso la última celda no es la
              resta de las dos primeras—. En `tfoot` y no en el cuerpo: no es una
              facultad más y un lector de pantalla no debe leerla como tal. */}
          <tfoot>
            <tr className="aulas-cliente-total">
              <th scope="row">Total</th>
              <td className="aulas-cliente-cifra">{personas(totalMuestra)}</td>
              <td className="aulas-cliente-cifra es-debil">{personas(suma((f) => f.muestraMujeres))}</td>
              <td className="aulas-cliente-cifra es-debil">{personas(suma((f) => f.muestraHombres))}</td>
              <td className="aulas-cliente-cifra">{personas(totalConseguidas)}</td>
              <td className="aulas-cliente-cifra es-debil">{personas(suma((f) => f.conseguidasMujeres))}</td>
              <td className="aulas-cliente-cifra es-debil">{personas(suma((f) => f.conseguidasHombres))}</td>
              <td className="aulas-cliente-cifra es-debil">
                {cuenta(suma((f) => f.aulasAplicadas))} de {cuenta(suma((f) => f.aulasDelPlan))}
              </td>
              <td className="aulas-cliente-cifra">
                {totalMuestra > 0 ? pct(totalConseguidas / totalMuestra) : "—"}
              </td>
              <td className="aulas-cliente-cifra">{personas(totalFaltan, true)}</td>
            </tr>
            {techo ? (
              <tr className="aulas-cliente-total es-sobremuestra">
                <th scope="row">Sobremuestra</th>
                <td className="aulas-cliente-cifra">{personas(techo)}</td>
                <td className="aulas-cliente-cifra es-debil">—</td>
                <td className="aulas-cliente-cifra es-debil">—</td>
                <td className="aulas-cliente-cifra">{personas(totalConseguidas)}</td>
                <td className="aulas-cliente-cifra es-debil">—</td>
                <td className="aulas-cliente-cifra es-debil">—</td>
                <td className="aulas-cliente-cifra es-debil">—</td>
                <td className="aulas-cliente-cifra">{pct(totalConseguidas / techo)}</td>
                <td className="aulas-cliente-cifra">
                  {personas(Math.max(0, techo - totalConseguidas), true)}
                </td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>

      {/* El pie decía «la sobremuestra es hasta dónde se compró aforo, NO una
          segunda meta» y «aparece arriba cuando el estudio la declara». Las dos
          frases dejaron de ser ciertas el 2026-09-08: Gonzalo fijó que muestra
          (2 500) y sobremuestra (3 750) son **las dos metas del estudio**, con
          el mismo trato y sin llamar referencial a ninguna —hay un test del
          libro que prohíbe «referencial», «margen», «segunda meta» y «techo»—, y
          «arriba» era el párrafo que él mismo cortó. */}
      <p className="aulas-cliente-pie">
        <strong>Muestra</strong> es la cuota que el diseño fijó para esa facultad y{" "}
        <strong>Sobremuestra</strong> la segunda cifra del estudio: las dos se miden igual,
        en total, por sexo y por facultad.{" "}
        <strong>Cursos-horario aplicados</strong> se cuenta sobre los del plan de esa facultad.{" "}
        <strong>Avance del total</strong> compensa un sexo con el otro;{" "}
        <strong>Faltan</strong> suma el déficit de cada sexo por separado y es el que
        decide el estado. Por eso una facultad pasa del 100 % y sigue pendiente, y por eso
        lo que falta en el total no es la resta de las dos columnas: cubrir de más en una
        facultad —o en un sexo— no cubre lo que falta en otra.
      </p>
    </div>
  );
}
