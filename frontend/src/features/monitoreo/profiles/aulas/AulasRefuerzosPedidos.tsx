import type { ReactNode } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt } from "./kpisDeAulas";
import { seguimientoDeRefuerzos, type PasoDelRefuerzo } from "./seguimientoDeRefuerzos";
import { useMarcarRefuerzo } from "./useMarcarRefuerzo";
import "./aulasRefuerzosPedidos.css";

/**
 * **A dónde se fue lo que marcaste.**
 *
 * Gonzalo, 2026-09-11: «qué pasa cuando ya selecciones uno, a dónde se va, cómo
 * se muestra… ¿la app sabe reconocer cuándo pasó de su estado especial a estar
 * en contacto o incluso agendado o aplicado?».
 *
 * Hasta ahora marcar era un acto sin vuelta: la fila salía del reparto —porque
 * deja de ser candidata— y no aparecía en ninguna otra parte. Aquí viven, y
 * cada una dice en qué punto está, que es justo la transición por la que
 * pregunta: el agendador teclea EN CONTACTO y luego AGENDADA sobre el mismo
 * curso-horario, y la app lo reconoce porque `activation_origin` no se borra al
 * cambiar el estado de muestra.
 */

const RÓTULO: Record<PasoDelRefuerzo, string> = {
  por_contactar: "espera llamada",
  en_gestion: "en contacto",
  con_fecha: "con fecha",
  aplicado: "aplicado",
  rechazado: "rechazó",
  otro: "otro estado",
};

/** El orden del embudo, que es el que se dibuja aunque un paso esté en cero. */
const ESCALONES: PasoDelRefuerzo[] = ["por_contactar", "en_gestion", "con_fecha", "aplicado"];

export function AulasRefuerzosPedidos({ plan, onGuardado }: {
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  /** Recarga el tablero tras retirar una marca; sin esto la fila no se mueve. */
  onGuardado?: () => void;
}): ReactNode {
  // El hook va antes del vacío: uno bajo la guarda se llama en unos renders y
  // no en otros, que es el React #310 que ya tumbó este perfil una vez.
  const marca = useMarcarRefuerzo(onGuardado);
  const s = seguimientoDeRefuerzos(plan);
  const puedeRetirar = !!onGuardado;
  const enEspera = s.pedidos.filter((p) => p.paso === "por_contactar").map((p) => p.codigo);

  if (!s.pedidos.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Todavía no has marcado ningún refuerzo. Los que marques desde el reparto
        de arriba aparecen aquí con el punto en que está su gestión, desde que
        esperan llamada hasta que aplican.
      </p>
    );
  }

  return (
    <div className="aulas-pedidos" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-pedidos-lectura">
        La app pidió <strong>{fmt(s.pedidos.length)}</strong>{" "}
        {s.pedidos.length === 1 ? "curso-horario de refuerzo" : "cursos-horario de refuerzo"}.
        {" "}De ésos, <strong>{fmt(s.avanzaron)}</strong> ya{" "}
        {s.avanzaron === 1 ? "avanzó" : "avanzaron"} —tienen fecha o aplicaron— y{" "}
        <strong>{fmt(s.esperando)}</strong> {s.esperando === 1 ? "sigue" : "siguen"} en manos del agendador.
        {s.cuenta.rechazado ? (
          <> <strong>{fmt(s.cuenta.rechazado)}</strong>{" "}
            {s.cuenta.rechazado === 1 ? "rechazó" : "rechazaron"}.</>
        ) : null}
      </p>

      {marca.aviso || marca.fallos.length ? (
        <p className={`aulas-acuse-marca${marca.fallos.length ? " es-fallo" : ""}`} role="status">
          {marca.aviso}
          {marca.fallos.length ? (
            <>{marca.fallos.length === 1 ? "No se pudo retirar " : "No se pudieron retirar "}
              <b>{marca.fallos.map((f) => f.codigo).join(", ")}</b>: {marca.fallos[0]?.motivo}</>
          ) : null}
          {" "}<button type="button" onClick={marca.limpiar}>Entendido</button>
        </p>
      ) : null}

      {puedeRetirar && enEspera.length > 1 ? (
        <p className="aulas-pedidos-lote">
          {/* Deshacer el lote entero, que es la contracara del autopicker: si se
              marcan quince de una vez, tiene que poder soltarse quince de una
              vez. Sólo alcanza a las que nadie ha llamado. */}
          <button
            type="button"
            disabled={!!marca.marcando || !!marca.progreso}
            onClick={() => { void marca.retirarVarias(enEspera); }}
          >
            {marca.progreso
              ? `Retirando ${fmt(marca.progreso.total)}, puede tardar…`
              : `Retirar ${fmt(enEspera.length)} que aún esperan llamada`}
          </button>
        </p>
      ) : null}

      {/* El embudo, con los cuatro escalones siempre: un paso en cero es un
          dato —nadie ha llamado todavía— y esconderlo lo haría parecer que la
          cola empieza más adelante de donde empieza. */}
      <ol className="aulas-pedidos-escalera">
        {ESCALONES.map((paso) => (
          <li key={paso} className={`es-${paso}${s.cuenta[paso] ? "" : " es-vacio"}`}>
            <b>{fmt(s.cuenta[paso])}</b>
            <em>{RÓTULO[paso]}</em>
          </li>
        ))}
      </ol>

      <ul className={`aulas-pedidos-lista${puedeRetirar ? " es-con-accion" : ""}`}>
        {s.pedidos.map((p) => (
          <li key={p.codigo}>
            <span className={`aulas-pedidos-paso es-${p.paso}`}>{RÓTULO[p.paso]}</span>
            <span className="aulas-pedidos-quien">
              <b>{p.codigo}</b>
              <em>{facultadCorta(p.facultad)}{p.docente ? ` · ${p.docente}` : ""}</em>
            </span>
            <span className="aulas-pedidos-para">
              {p.origen === "complemento"
                ? <>complementa <b>{p.para || "su titular"}</b></>
                : <>refuerza <b>{facultadCorta(p.para) || "su facultad"}</b></>}
            </span>
            <span className="aulas-pedidos-fruto">
              {p.validas > 0
                ? <><b>{fmt(p.validas)}</b> respuestas</>
                : <em>sin respuestas aún</em>}
            </span>
            {/* **Retirar sólo mientras nadie la haya llamado.** En cuanto el
                agendador la pasa a EN CONTACTO deja de ser una decisión
                pendiente: soltarla borraría su trabajo, y el motor lo rechaza.
                Por eso el botón desaparece en vez de fallar al pulsarlo. */}
            <span className="aulas-pedidos-accion">
              {puedeRetirar && p.paso === "por_contactar" ? (
                <button
                  type="button"
                  disabled={!!marca.marcando || !!marca.progreso}
                  onClick={() => { void marca.retirar(p.codigo); }}
                >{marca.marcando === p.codigo ? "Retirando…" : "Retirar"}</button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="aulas-pedidos-pie">
        {/* V4: el hecho antes que el verbo. Está escrito aquí porque el panel
            entero se apoya en ello y quien lee una cifra tiene derecho a saber
            de dónde sale. */}
        El punto sale del HECHO, no del estado tecleado: un curso-horario con
        respuestas cuenta como aplicado aunque su casilla siga en otra cosa. La
        marca se reconoce por el sello que deja la app al pedirla, que el equipo
        no toca cuando cambia el estado en el libro.
      </p>
    </div>
  );
}
