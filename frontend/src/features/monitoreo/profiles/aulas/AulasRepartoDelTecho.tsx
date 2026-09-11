import type { ReactNode } from "react";

import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { repartoDelTecho, TECHO_DE_AULAS_AGENDABLES } from "./repartoDelTecho";
import "./aulasRepartoDelTecho.css";

/**
 * **Los mejores cursos-horario de refuerzo cuando el techo no da para todos.**
 *
 * Gonzalo, 2026-09-11: «dimensionemos los mejores refuerzos, qué facultades
 * ahora lo necesitan, partiendo de un techo de 15 aulas agendables más», y
 * «ojo, hay que pedir también el traslape entre las mejores candidatas».
 *
 * Tres cosas que el panel tiene que dejar ver, porque las tres cambian la
 * decisión: **a quién** va cada curso-horario y cuánto cierra, **qué facultad se queda
 * sin recibir** —que es el coste del techo, no un detalle— y **qué elegidas
 * solapan entre sí**, que es lo que hace que la suma de aportes prometa de más.
 */
export function AulasRepartoDelTecho({ bloque, celdasDeCuota, plan, techo }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  celdasDeCuota: ReadonlyArray<Record<string, unknown>> | null | undefined;
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  techo?: number;
}): ReactNode {
  const r = repartoDelTecho(bloque, celdasDeCuota, plan, techo ?? TECHO_DE_AULAS_AGENDABLES);

  if (!r.asignadas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {r.quedaSinCubrir > 0
          ? <>Hay <strong>{fmt(r.quedaSinCubrir)}</strong> respuestas por cubrir y ningún
              curso-horario del inventario las cierra: lo que queda disponible no aporta al
              sexo que falta.</>
          : <>Ninguna facultad necesita refuerzo ahora mismo: lo que tienen agendado
              cubre lo que les falta.</>}
      </p>
    );
  }

  const cerrado = r.asignadas.reduce((n, a) => n + a.util, 0);

  return (
    <div className="aulas-techo" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-techo-lectura">
        Con un techo de <strong>{fmt(r.techo)}</strong> cursos-horario más, éstos son los
        que más cierran: <strong>{fmt(r.asignadas.length)}</strong> en{" "}
        <strong>{fmt(new Set(r.asignadas.map((a) => a.facultad)).size)}</strong> facultades,
        que recuperan <strong>{fmt(cerrado)}</strong> respuestas.
        {r.sobran ? <> Sobran <strong>{fmt(r.sobran)}</strong> del techo: ya no hay más déficit que cerrar.</> : null}
        {r.quedaSinCubrir ? (
          // El coste del techo, dicho: sin esto parece que quince alcanzan.
          <> Aun así quedarían <strong>{fmt(r.quedaSinCubrir)}</strong> respuestas sin cubrir.</>
        ) : null}
      </p>

      <ol className="aulas-techo-lista">
        {r.asignadas.map((a, i) => (
          <li key={a.codigo} className={a.traslape ? `es-solapa es-${a.traslape}` : ""}>
            <span className="aulas-techo-puesto">{fmt(i + 1)}</span>
            <span className="aulas-techo-quien">
              <b>{a.codigo}</b>
              <em>{facultadCorta(a.facultad)}{a.docente ? ` · ${a.docente}` : ""}</em>
            </span>
            <span className="aulas-techo-aporte">
              <b>+{fmt(a.util)}</b>
              <em>de {fmt(a.aporta.total)} que rinde</em>
            </span>
            <span className="aulas-techo-resto">
              {a.quedaDespues > 0
                ? <>quedan <b>{fmt(a.quedaDespues)}</b></>
                : <b className="es-cierra">cierra su cuota</b>}
            </span>
            {/* **El traslape, con su grado de certeza.** El de docente es un
                hecho —la misma persona dos veces— y el de curso una sospecha:
                sin sección no se distingue otra sección de otra sesión del
                mismo grupo. Decirlos igual sería inventar precisión. */}
            <span className="aulas-techo-solape">
              {/* **Los dos traslapes son distintos y se dicen los dos.** Éste es
                  contra el campo YA HECHO de su facultad —cuántos de sus
                  convocados ya estuvieron en un aula aplicada— y el de abajo,
                  entre las candidatas elegidas. Gonzalo los pidió por separado
                  y lo son: uno dice si sus elegibles ya respondieron, el otro si
                  dos de las elegidas se pisan entre sí. */}
              {a.traslapeAplicado >= 0.25 ? (
                <b className={a.traslapeAplicado >= 0.5 ? "es-docente" : "es-curso"}>
                  {pctPerfil(a.traslapeAplicado * 100)} de su facultad ya aplicado
                </b>
              ) : null}
              {a.traslapeAplicado >= 0.25 && a.traslape ? " · " : null}
              {a.traslape === "docente" ? (
                <b className="es-docente">mismo docente que {a.solapaCon}</b>
              ) : a.traslape === "curso" ? (
                <b className="es-curso">mismo curso que {a.solapaCon}: podrían compartir alumnos</b>
              ) : a.docenteYaContactado ? (
                <em>a su docente ya se le llamó por {a.docenteYaContactado}</em>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {r.sinRecibir.length ? (
        <p className="aulas-techo-fuera">
          {/* Quién paga el techo. Sin nombrarlas, «15 aulas» se lee como si
              alcanzara para todos. */}
          No reciben ninguna y siguen debiendo:{" "}
          {r.sinRecibir.map((f) => (
            <span key={f.facultad}>
              <b>{facultadCorta(f.facultad)}</b> ({fmt(f.queda)}
              {f.hacenFalta > 0 ? `, le harían falta ${fmt(f.hacenFalta)}`
                : f.hacenFalta < 0 ? ", y su inventario no alcanza" : ""})
            </span>
          )).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, " · ", el] : [el]), [])}
        </p>
      ) : null}

      <p className="aulas-techo-pie">
        Cada curso-horario se asigna donde más cierra en ese momento, no a quien
        más debe: en cuanto una facultad recibe uno, el siguiente rinde menos
        allí. Lo que
        aporta es una proyección sobre su padrón, y el traslape de curso es
        sospecha —el plan no trae la sección— así que nunca se descuenta del
        aporte.
        {r.traslapes.docente || r.traslapes.curso ? (
          <> De las elegidas, <b>{fmt(r.traslapes.docente)}</b>{" "}
            {r.traslapes.docente === 1 ? "repite docente" : "repiten docente"} y{" "}
            <b>{fmt(r.traslapes.curso)}</b>{" "}
            {r.traslapes.curso === 1 ? "repite curso" : "repiten curso"} con otra de la lista.</>
        ) : null}
      </p>
    </div>
  );
}
