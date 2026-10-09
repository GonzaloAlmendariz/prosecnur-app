import { useState, type ReactNode } from "react";

import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { repartoDelTecho } from "./repartoDelTecho";
import {
  leeTechoRecordado, recuerdaTecho, TECHO_MAXIMO, TECHO_MINIMO, TECHO_PASO,
} from "./techoElegible";
import { useMarcarRefuerzo } from "./useMarcarRefuerzo";
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
 *
 * Y dos que se pueden hacer desde aquí, del encargo del mismo día: **elegir el
 * techo** —«poder seleccionar el número de aulas»— y **marcarlas de una vez**
 * —«un autopicker de los mejores refuerzos»—. Lo marcado sale de esta lista y
 * aparece en «Refuerzos pedidos», justo debajo.
 */
export function AulasRepartoDelTecho({ bloque, celdasDeCuota, plan, techo, onGuardado }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  celdasDeCuota: ReadonlyArray<Record<string, unknown>> | null | undefined;
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  /** Fija el techo y esconde el control. Lo usan las pruebas, no la pantalla. */
  techo?: number;
  /** Recarga el tablero tras marcar; sin esto lo marcado no sale de la lista. */
  onGuardado?: () => void;
}): ReactNode {
  // **Los hooks van antes de cualquier salida temprana.** Uno colocado bajo el
  // vacío se llamaría en unos renders y no en otros: es el React #310 que ya
  // tumbó este perfil una vez.
  const [elegido, setElegido] = useState(() => leeTechoRecordado());
  const marca = useMarcarRefuerzo(onGuardado);

  const fijo = techo != null;
  const enUso = fijo ? techo : elegido;
  const r = repartoDelTecho(bloque, celdasDeCuota, plan, enUso);

  const mando = fijo ? null : (
    <div className="aulas-techo-mando">
      <span className="aulas-techo-cuantas">
        <label htmlFor="aulas-techo-n">Techo de cursos-horario agendables</label>
        {/* El 1fr de la izquierda tiene que trabajar: el control solo dejaba
            una franja vacía y no decía contra qué se está eligiendo el número. */}
        <em>cuántos más cabe agendar además de lo que ya hay en pie · el reparto
          los coloca donde más cierran, no donde más se debe</em>
      </span>
      <div className="aulas-techo-paso">
        <button
          type="button" aria-label="Bajar el techo"
          disabled={enUso <= TECHO_MINIMO}
          onClick={() => setElegido(recuerdaTecho(enUso - TECHO_PASO))}
        >−</button>
        <input
          id="aulas-techo-n" type="number" inputMode="numeric"
          min={TECHO_MINIMO} max={TECHO_MAXIMO} value={enUso}
          onChange={(e) => setElegido(recuerdaTecho(e.target.value))}
        />
        <button
          type="button" aria-label="Subir el techo"
          disabled={enUso >= TECHO_MAXIMO}
          onClick={() => setElegido(recuerdaTecho(enUso + TECHO_PASO))}
        >+</button>
      </div>
      {r.asignadas.length && onGuardado ? (
        <button
          type="button" className="aulas-techo-auto"
          disabled={!!marca.marcando || !!marca.progreso}
          onClick={() => { void marca.marcarVarias(r.asignadas.map((a) => ({
            codigo: a.codigo, tipo: "refuerzo" as const, para: a.facultad,
            motivo: `Reparto del techo: cierra ${fmt(a.util)} respuestas de su facultad.`,
          }))); }}
        >
          {/* El lote es UNA petición: el progreso por pieza sería mentira.
              Lo que se dice es cuántas se pidieron y que está en marcha. */}
          {marca.progreso
            ? `Marcando ${fmt(marca.progreso.total)}, puede tardar…`
            : `Marcar ${r.asignadas.length === 1 ? "el mejor" : `los ${fmt(r.asignadas.length)} mejores`}`}
        </button>
      ) : null}
    </div>
  );

  if (!r.asignadas.length) {
    return (
      <div className="aulas-techo" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {mando}
        <p className="mon-profile-muted">
          {/* «Nadie necesita refuerzo» sólo si se pudo mirar a alguien. Mismo
              trato que en «Cómo va cada facultad» (`0f434b03`) y que en la cola
              de elección: con cero grupos evaluados no se afirma, y se dice qué
              faltó. Ver la nota de `eleccionPorFacultad`. */}
          {r.quedaSinCubrir > 0
            ? <>Hay <strong>{fmt(r.quedaSinCubrir)}</strong> respuestas por cubrir y ningún
                curso-horario del inventario las cierra: lo que queda disponible no aporta al
                sexo que falta.</>
            : r.grupos > 0 && r.evaluadas === 0
              // **El vacío dice la causa Y a dónde ir.** Decir por qué no se
              // puede repartir deja al coordinador sin siguiente paso, y la
              // brecha que venía a buscar existe: Metas la publica cuota a
              // cuota, sea cual sea el eje. Una cláusula, no un párrafo.
              // «celda» es vocabulario interno y tiene su propio guard: no se
              // debilita el guard, se redacta de otra forma.
              ? <>No se puede repartir el techo: de <strong>{fmt(r.grupos)}</strong>{" "}
                {r.grupos === 1 ? "grupo" : "grupos"}, ninguno tiene una cuota por sexo que
                leer, y es por sexo como este reparto decide. La brecha de cada cuota está
                en Metas.</>
              : <>Ninguna facultad necesita refuerzo ahora mismo: lo que tienen agendado
                cubre lo que les falta.</>}
        </p>
      </div>
    );
  }

  const cerrado = r.asignadas.reduce((n, a) => n + a.util, 0);
  const cierran = r.asignadas.length - r.deHolgura;

  return (
    <div className="aulas-techo" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      {mando}
      <p className="aulas-techo-lectura">
        Con un techo de <strong>{fmt(r.techo)}</strong> cursos-horario más, éstos son los
        que más cierran: <strong>{fmt(r.asignadas.length)}</strong> en{" "}
        <strong>{fmt(new Set(r.asignadas.map((a) => a.facultad)).size)}</strong> facultades,
        que recuperan <strong>{fmt(cerrado)}</strong> respuestas.
        {r.deHolgura ? (
          // **Las dos cifras separadas, y su base.** Sumarlas prometería un
          // cierre que ya estaba hecho: las de margen no cierran nada.
          <> De ésos, <strong>{fmt(cierran)}</strong>{" "}
            {cierran === 1 ? "cierra brecha" : "cierran brecha"} y{" "}
            <strong>{fmt(r.deHolgura)}</strong>{" "}
            {r.deHolgura === 1 ? "es margen" : "son margen"} para las que quedaron
            más al filo, que es en lo que se gasta el techo sobrante.</>
        ) : null}
        {r.sobran ? <> Sobran <strong>{fmt(r.sobran)}</strong> del techo: no queda inventario libre que dar.</> : null}
        {r.quedaSinCubrir ? (
          // El coste del techo, dicho: sin esto parece que quince alcanzan.
          <> Aun así quedarían <strong>{fmt(r.quedaSinCubrir)}</strong> respuestas sin cubrir.</>
        ) : null}
      </p>

      {/* **La confirmación se ve.** Antes el motor contestaba y su mensaje se
          guardaba en un estado que nadie pintaba: quien pulsaba veía
          desaparecer la fila y nada más. */}
      {marca.aviso || marca.fallos.length ? (
        <p className={`aulas-techo-acuse${marca.fallos.length ? " es-fallo" : ""}`} role="status">
          {marca.aviso}
          {marca.fallos.length ? (
            <> {marca.fallos.length === 1 ? "No entró" : "No entraron"}{" "}
              <b>{marca.fallos.map((f) => f.codigo).join(", ")}</b>: {marca.fallos[0]?.motivo}</>
          ) : null}
          {" "}<button type="button" onClick={marca.limpiar}>Entendido</button>
        </p>
      ) : null}

      <ol className={`aulas-techo-lista${onGuardado ? " es-con-accion" : ""}`}>
        {r.asignadas.map((a, i) => (
          <li key={a.codigo} className={`${a.holgura ? "es-holgura " : ""}${a.traslape ? `es-solapa es-${a.traslape}` : ""}`.trim()}>
            <span className="aulas-techo-puesto">{fmt(i + 1)}</span>
            <span className="aulas-techo-quien">
              <b>{a.codigo}</b>
              <em>{facultadCorta(a.facultad)}{a.docente ? ` · ${a.docente}` : ""}</em>
            </span>
            <span className="aulas-techo-aporte">
              {/* En las de margen no hay brecha que cerrar, así que el «+N» sería
                  un cierre inventado: se enseña lo que rinde y ya. */}
              {a.holgura
                ? <b className="es-margen">{fmt(a.aporta.total)}</b>
                : <b>+{fmt(a.util)}</b>}
              <em>{a.holgura ? "de margen" : `de ${fmt(a.aporta.total)} que rinde`}</em>
            </span>
            <span className="aulas-techo-resto">
              {a.holgura
                ? <b className="es-margen">margen</b>
                : a.quedaDespues > 0
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
            {/* Marcar de una en una, para el caso en que el lote no valga: el
                traslape descalifica a una concreta y el resto sigue bien. */}
            {onGuardado ? (
              <span className="aulas-techo-accion">
                <button
                  type="button"
                  disabled={!!marca.marcando || !!marca.progreso}
                  onClick={() => { void marca.marcar(a.codigo, "refuerzo", a.facultad,
                    `Reparto del techo: cierra ${fmt(a.util)} respuestas de su facultad.`); }}
                >{marca.marcando === a.codigo ? "Marcando…" : "Marcar"}</button>
              </span>
            ) : null}
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
        {onGuardado ? (
          <> Marcar deja el curso-horario en <b>REFUERZO POR CONTACTAR</b>: no lo agenda,
            lo pone en la cola del agendador y lo saca de esta lista.</>
        ) : null}
      </p>
    </div>
  );
}
