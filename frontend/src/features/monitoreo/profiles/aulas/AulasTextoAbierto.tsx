import { useMemo, useState } from "react";

import { MessageSquare } from "../../../../vendor/lucide-react";
import { textoAbierto } from "./textoAbierto";

/**
 * Las respuestas abiertas, para leerlas rápido.
 *
 * **Es un visualizador, no un diagnóstico.** Ordena por dónde conviene empezar
 * —lo vacío primero, después lo más corto— y no esconde ninguna respuesta.
 * Quien decide invalidar es una persona.
 *
 * Cada pregunta trae su perfil al lado porque una señal sólo significa algo
 * contra su propia pregunta: en `acnur_pdm`, el 99.3 % de las respuestas del
 * nombre del encuestador se repiten, y ahí repetir es lo correcto.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`);

export function AulasTextoAbierto({ bloque }: { bloque: unknown }) {
  const t = useMemo(() => textoAbierto(bloque), [bloque]);
  const [activa, setActiva] = useState(0);

  if (!t.disponible) {
    return (
      <div className="aulas-abiertas" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <p className="aulas-cadenas-lectura">
          Este estudio <strong>no tiene preguntas abiertas que revisar</strong>.{" "}
          {t.motivo}
        </p>
        <p className="mon-profile-muted">
          Con el instrumento cargado, aquí se leen las respuestas de cada
          pregunta abierta ordenadas por las que conviene mirar primero.
        </p>
        {t.excluidas.length > 0 && (
          <p className="mon-profile-muted">
            Quedan fuera {fmt(t.excluidas.length)}:{" "}
            {t.excluidas.map((e) => e.variable).join(", ")}.
          </p>
        )}
      </div>
    );
  }

  const q = t.preguntas[Math.min(activa, t.preguntas.length - 1)];

  return (
    <div className="aulas-abiertas" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <div
        className="aulas-abiertas-preguntas"
        role="tablist"
        aria-label="Preguntas abiertas"
        data-gliding-opt-out="Este selector lo dicta el instrumento, no el recorrido del módulo: son tantas píldoras como preguntas abiertas tenga el formulario y la tira envuelve en varias filas (flex-wrap), así que un indicador deslizante tendría que saltar de renglón. La pregunta activa se señala con su propia píldora entintada en el tono de Monitoreo."
      >
        {t.preguntas.map((p, i) => (
          <button
            key={p.variable}
            type="button"
            role="tab"
            aria-selected={p.variable === q.variable}
            className={p.variable === q.variable ? "is-activa" : undefined}
            onClick={() => setActiva(i)}
          >
            {p.etiqueta}
            <small>{fmt(p.contestadas)}</small>
          </button>
        ))}
      </div>

      <p className="aulas-cadenas-lectura">
        <strong>{fmt(q.contestadas)}</strong> contestaron esta pregunta y{" "}
        <strong>{fmt(q.distintas)}</strong> dijeron algo distinto.
        {q.pctNegativa !== null && q.pctNegativa > 0 && (
          <> El {pct(q.pctNegativa)} contestó que no tenía nada que añadir.</>
        )}
      </p>

      <ul className="aulas-abiertas-perfil">
        <li><span>{pct(q.pctRelleno)}</span><small>rellenó sin decir nada</small></li>
        <li><span>{pct(q.pctRepetida)}</span><small>repite otra respuesta</small></li>
        <li><span>{pct(q.pctUnaPalabra)}</span><small>una sola palabra</small></li>
      </ul>

      <ul className="aulas-abiertas-lista">
        {q.respuestas.map((r) => (
          <li key={`${r.fila}-${r.texto}`} className={r.relleno ? "is-relleno" : undefined}>
            <span className="aulas-abiertas-texto">{r.texto}</span>
            <span className="aulas-abiertas-meta">
              {r.relleno && <em>sin contenido</em>}
              {!r.relleno && r.negativa && <em>dice que no</em>}
              {r.repeticiones > 1 && <small>×{fmt(r.repeticiones)}</small>}
            </span>
          </li>
        ))}
      </ul>

      <p className="mon-profile-muted">
        <MessageSquare size={13} aria-hidden="true" />
        {q.mostradas < q.contestadas
          ? `Se muestran las ${fmt(q.mostradas)} primeras de ${fmt(q.contestadas)}, ordenadas por las que conviene mirar antes.`
          : "Están todas, ordenadas por las que conviene mirar antes."}{" "}
        Las señales dicen por dónde empezar; qué se invalida lo decides tú.
      </p>
    </div>
  );
}
