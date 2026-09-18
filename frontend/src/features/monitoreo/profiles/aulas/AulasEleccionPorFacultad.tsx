import { useState, type ReactNode } from "react";

import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { eleccionPorFacultad } from "./eleccionPorFacultad";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { leeTechoRecordado } from "./techoElegible";
import { useMarcarRefuerzo } from "./useMarcarRefuerzo";
import "./aulasEleccionPorFacultad.css";

/**
 * **Elegir facultad por facultad, de una en una.**
 *
 * Gonzalo, 2026-09-11: «deberíamos poder seleccionar la facultad, viendo cuál
 * está peor, y seleccionar que queremos 3 por ejemplo; podemos ir seleccionando
 * de uno en uno y el top se actualiza tomando en cuenta que si escogemos uno el
 * traslape podría aumentar para el resto y ya no serían las mejores
 * alternativas; y así ir de facultad en facultad: en algunas puedo coger 3, en
 * otras solo una, hasta llegar a mis 15».
 *
 * Es el otro modo de gastar el techo, y no sustituye al reparto: el reparto
 * **propone** un lote entero por utilidad, esto **decide** una a una. Tras cada
 * elección la cola se rehace —quien repite docente o curso con lo ya elegido
 * baja por debajo de todas las limpias— y el contador del techo baja.
 */
export function AulasEleccionPorFacultad({ bloque, celdasDeCuota, plan, techo, onGuardado }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  celdasDeCuota: ReadonlyArray<Record<string, unknown>> | null | undefined;
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  /** Fija el techo; sin él se usa el que el panel de arriba recuerda. */
  techo?: number;
  onGuardado?: () => void;
}): ReactNode {
  // Los hooks van antes de cualquier salida temprana: uno bajo la guarda se
  // llama en unos renders y no en otros, que es el React #310 de este perfil.
  const [enFoco, setEnFoco] = useState("");
  const [cuantas, setCuantas] = useState(3);
  const marca = useMarcarRefuerzo(onGuardado);

  const e = eleccionPorFacultad(bloque, celdasDeCuota, plan, enFoco,
    techo ?? leeTechoRecordado());

  if (!e.facultades.length) {
    /**
     * **«Nadie debe nada» sólo si se pudo mirar a alguien.**
     *
     * Medido el 2026-09-17 sobre el simulacro de CCSS por nivel: esta frase se
     * publicaba con los cinco grupos del motor sin evaluar, mientras Metas
     * decía en la misma sesión que los cuatro niveles no llegan y faltan 342
     * personas. La causa está en `eleccionPorFacultad`: toda esta maquinaria
     * lee la cuota por SEXO, y una cuota por el eje declarado no lo tiene.
     *
     * Mismo trato que en «Cómo va cada facultad» (`0f434b03`): con cero
     * evaluados no se afirma, y se dice qué faltó.
     */
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {e.grupos > 0 && e.evaluadas === 0
          // El vacío dice la causa y a dónde ir: la brecha que se venía a
          // buscar existe: Metas la publica cuota a cuota.
          ? `No se puede decir a quién reforzar: de ${fmt(e.grupos)} ${e.grupos === 1 ? "grupo" : "grupos"}, ninguno tiene una cuota por sexo que leer, y es por sexo como esta cola elige. La brecha de cada cuota está en Metas.`
          : "Ninguna facultad debe nada ahora mismo: lo que tienen agendado cubre lo que les falta, así que no hay a quién reforzar."}
      </p>
    );
  }

  // Lo que cabe pedir aquí: ni más de lo que queda del techo, ni más de lo que
  // la facultad puede absorber.
  const aLaVista = Math.max(1, Math.min(cuantas, e.quedanDelTecho || 1, e.cola.length || 1));
  const primeras = e.cola.slice(0, aLaVista);

  return (
    <div className="aulas-eleccion" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-eleccion-lectura">
        La app lleva <strong>{fmt(e.gastadas)}</strong> de un techo de{" "}
        <strong>{fmt(techo ?? leeTechoRecordado())}</strong>:{" "}
        {e.quedanDelTecho > 0
          ? <>quedan <strong>{fmt(e.quedanDelTecho)}</strong> por repartir.</>
          : <>el techo está gastado; para pedir más, súbelo arriba o retira alguna.</>}
      </p>

      {/* Las facultades, la peor primero: el orden ES el dato. */}
      <ol className="aulas-eleccion-facultades">
        {e.facultades.map((f) => (
          <li key={f.facultad}>
            <button
              type="button"
              className={f.facultad === e.facultad ? "es-activa" : ""}
              aria-pressed={f.facultad === e.facultad}
              onClick={() => setEnFoco(f.facultad)}
            >
              <b>{facultadCorta(f.facultad)}</b>
              <em>
                debe {fmt(f.debe)}
                {/* El verbo concuerda con el número: «1 pedidas» y «1 la cierran»
                    salían así con los 15 refuerzos reales dentro. */}
                {f.elegidas ? ` · ${fmt(f.elegidas)} ${f.elegidas === 1 ? "pedida" : "pedidas"}` : ""}
                {f.hacenFalta > 0 ? ` · ${fmt(f.hacenFalta)} la ${f.hacenFalta === 1 ? "cierra" : "cierran"}`
                  : f.hacenFalta < 0 ? " · su inventario no alcanza" : ""}
              </em>
            </button>
          </li>
        ))}
      </ol>

      <div className="aulas-eleccion-mando">
        <span className="aulas-eleccion-quien">
          <b>{facultadCorta(e.facultad)}</b>
          <em>cuántas quieres tomar aquí antes de pasar a la siguiente</em>
        </span>
        <div className="aulas-eleccion-paso">
          <button type="button" aria-label="Ver menos candidatas"
            disabled={aLaVista <= 1} onClick={() => setCuantas(Math.max(1, aLaVista - 1))}>−</button>
          <input type="number" inputMode="numeric" min={1} max={20} value={aLaVista}
            aria-label="Cuántas tomar en esta facultad"
            onChange={(ev) => setCuantas(Math.max(1, Math.min(20, Number(ev.target.value) || 1)))} />
          <button type="button" aria-label="Ver más candidatas"
            disabled={aLaVista >= Math.min(20, e.cola.length)}
            onClick={() => setCuantas(aLaVista + 1)}>+</button>
        </div>
      </div>

      {marca.aviso || marca.fallos.length ? (
        <p className={`aulas-acuse-marca${marca.fallos.length ? " es-fallo" : ""}`} role="status">
          {marca.aviso}
          {marca.fallos.length ? (
            <>No entró <b>{marca.fallos.map((f) => f.codigo).join(", ")}</b>: {marca.fallos[0]?.motivo}</>
          ) : null}
          {" "}<button type="button" onClick={marca.limpiar}>Entendido</button>
        </p>
      ) : null}

      {!e.cola.length ? (
        <p className="mon-profile-muted">
          A <strong>{facultadCorta(e.facultad)}</strong> no le queda inventario
          disponible: todas sus reservas están pedidas o comprometidas.
        </p>
      ) : (
        <ol className="aulas-eleccion-cola">
          {primeras.map((c, i) => (
            <li key={c.codigo} className={c.relegadaPor ? `es-relegada es-${c.relegadaPor}` : ""}>
              <span className="aulas-eleccion-puesto">{fmt(i + 1)}</span>
              <span className="aulas-eleccion-cand">
                <b>{c.codigo}</b>
                <em>{c.docente || "sin docente en el plan"}{c.curso ? ` · ${c.curso}` : ""}</em>
              </span>
              <span className="aulas-eleccion-aporte">
                <b>+{fmt(c.util)}</b>
                <em>de {fmt(c.aporta.total)} que rinde</em>
              </span>
              <span className="aulas-eleccion-resto">
                {c.quedaDespues > 0
                  ? <>quedarían <b>{fmt(c.quedaDespues)}</b></>
                  : <b className="es-cierra">cierra su cuota</b>}
              </span>
              <span className="aulas-eleccion-nota">
                {/* **Por qué bajó.** El relego es lo que hace que el orden
                    cambie tras cada elección; sin decirlo, la lista parecería
                    desordenada. Nada se resta del aporte: el plan no trae la
                    sección y un descuento sería precisión inventada. */}
                {c.relegadaPor === "docente" ? (
                  <b className="es-docente">baja: mismo docente que {c.solapaCon}</b>
                ) : c.relegadaPor === "curso" ? (
                  <b className="es-curso">baja: mismo curso que {c.solapaCon}, podrían compartir alumnos</b>
                ) : c.docenteYaContactado ? (
                  <em>a su docente ya se le llamó por {c.docenteYaContactado}</em>
                ) : c.traslapeAplicado >= 0.25 ? (
                  <em>{pctPerfil(c.traslapeAplicado * 100)} de su facultad ya aplicado</em>
                ) : null}
              </span>
              <span className="aulas-eleccion-accion">
                {onGuardado ? (
                  <button
                    type="button"
                    disabled={!!marca.marcando || !!marca.progreso || e.quedanDelTecho <= 0}
                    onClick={() => { void marca.marcar(c.codigo, "refuerzo", e.facultad,
                      `Elegida a mano para ${e.facultad}: cierra ${fmt(c.util)} respuestas.`); }}
                  >{marca.marcando === c.codigo ? "Tomando…" : "Tomar"}</button>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="aulas-eleccion-pie">
        Tras cada «Tomar», la cola se rehace: la elegida sale, lo que repite su
        docente o su curso baja por debajo de todas las limpias, y el techo baja
        uno. El aporte nunca se descuenta por traslape —el plan no trae la
        sección, así que compartir curso es sospecha y no hecho—: lo que cambia
        es el puesto, no la cifra.
      </p>
    </div>
  );
}
