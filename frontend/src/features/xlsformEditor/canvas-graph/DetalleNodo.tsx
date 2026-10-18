// =============================================================================
// canvas-graph/DetalleNodo.tsx — panel lateral del nodo elegido en el Mapa
// =============================================================================
// El clic en un nodo del Mapa de lógica lo selecciona y abre este panel dentro
// del lienzo (arriba a la derecha, sin tapar el minimapa): sus datos, la
// visibilidad heredada y sus reglas entrantes («Depende de») y salientes
// («Condiciona a»). Un clic en una regla elige ese otro nodo, sin salir del
// Mapa. La única salida al Constructor es «Editar en Constructor», al pie
// (ítem 50). Extraído de `LogicCanvas.tsx`, que no debe crecer.
// =============================================================================

import { CircleDot, Folder, X } from "../../../vendor/lucide-react";
import { stripMarkdown } from "../helpers/markdown";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import type { GraphNode, LogicGraph } from "./buildGraph";
import "./detalleNodo.css";

/** Una pregunta citada en el detalle: su título en prosa (dos líneas como mucho) y el código debajo, chico. Antes el
 *  código mono se comía el ancho y el título caía en columnas de una sílaba (S6). */
function Referencia({ nodo, prefijo }: { nodo: GraphNode; prefijo?: string }) {
  const titulo = nodeDisplayName(nodo);
  return (
    <span className="xfg-ref">
      <span className="xfg-ref__titulo">{prefijo}{titulo}</span>
      {titulo !== nodo.name ? <code className="xfg-ref__codigo">{nodo.name}</code> : null}
    </span>
  );
}

/** Referencia compacta de una pregunta para la narrativa de condiciones:
 *  limpia el markdown crudo (`**…**`) y trunca prompts largos a un incipit
 *  reconocible. La condición REFERENCIA la pregunta, no la transcribe —
 *  antes volcaba el párrafo completo (ej. el texto de consentimiento). */
export function compactTitle(raw: string, max = 46): string {
  const clean = stripMarkdown(raw).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Título humano LIMPIO (sin markdown crudo `**…**` ni el `(name)` embutido).
 *  El `name` técnico se muestra aparte en su propia línea mono. */
export function nodeDisplayName(node: GraphNode): string {
  const title = stripMarkdown(node.title || "").replace(/\s+/g, " ").trim();
  if (!title || title === node.name) return node.name;
  return title;
}

export function DetalleNodo({
  node,
  graph,
  humanize,
  onElegir,
  onCerrar,
  onEditar,
}: {
  node: GraphNode;
  graph: LogicGraph | null;
  humanize: (expr: string) => string;
  /** Elige otro nodo del Mapa (una regla entrante/saliente o una sección madre). */
  onElegir: (id: string) => void;
  onCerrar: () => void;
  /** «Editar en Constructor». Sin él (Mapa de solo lectura de Carga), no hay salida. */
  onEditar?: (rowIndex: number) => void;
}) {
  // "Alimentadores" (lo que condiciona a este nodo) y "consumidores" (a quién afecta).
  const incoming = (graph?.edges ?? []).filter((e) => e.target === node.id);
  const outgoing = (graph?.edges ?? []).filter((e) => e.source === node.id);
  const tituloId = `xf-graph-detalle-${node.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  // Dos secciones anidadas con la MISMA condición (S4 dentro de S2 en el ACNUR) se leen una sola vez.
  const heredadas = node.inheritedRelevant.filter(
    (p, i, todas) => todas.findIndex((q) => q.expression.replace(/\s+/g, "") === p.expression.replace(/\s+/g, "")) === i,
  );
  return (
    <aside className={`pulso-graph-detail is-${node.kind}`} aria-labelledby={tituloId} data-qa-geometry-group="xlsform/logica-detalle" data-qa-geometry-contract="intrinsic">
      <header>
        <span className="pulso-graph-detail-avatar" aria-hidden="true">
          {node.kind === "section" ? (
            <Folder size={16} strokeWidth={2.2} />
          ) : (
            <CircleDot size={16} strokeWidth={2.2} />
          )}
        </span>
        <div className="pulso-graph-detail-title">
          <strong id={tituloId} title={nodeDisplayName(node)}>
            {nodeDisplayName(node)}
          </strong>
          <span>
            {node.kind === "section" ? "Sección" : "Pregunta"}
            {" · "}
            <code>{node.name}</code>
          </span>
        </div>
        <button
          type="button"
          className="pulso-icon"
          onClick={onCerrar}
          title="Cerrar detalle (Esc)"
          aria-label="Cerrar detalle"
        >
          <X size={12} />
        </button>
      </header>
      {/* El catálogo de la lista (listName · N opciones) es info de DATOS, no de
          lógica: no vive en el Mapa de lógica (mismo criterio que el chip del nodo). */}

      {node.relevantExpression && (
        <div className="pulso-graph-detail-block">
          <span className="pulso-graph-detail-block-label">Aparece si</span>
          <p className="xfg-lectura">{humanize(node.relevantExpression)}</p>
        </div>
      )}

      {/* Visibilidad HEREDADA de secciones ancestro: la cadena de condiciones
          implícitas que afectan a este nodo aunque él no tenga `relevant` propio. */}
      {heredadas.length > 0 && (
        <div className="pulso-graph-detail-block">
          <span className="pulso-graph-detail-block-label">
            {node.relevantExpression ? "También hereda de" : "Hereda visibilidad de"}
          </span>
          <ul className="pulso-graph-detail-list xfg-lista">
            {heredadas.map((parent, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="xfg-link"
                  onClick={() => onElegir(parent.fromSectionId)}
                  title={`Ver sección ${stripMarkdown(parent.fromSectionLabel || parent.fromSectionName)}`}
                >
                  <span className="xfg-ref">
                    <span className="xfg-ref__titulo">{compactTitle(parent.fromSectionLabel || parent.fromSectionName, 60)}</span>
                    <span className="xfg-ref__lee">si {humanize(parent.expression)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="pulso-graph-detail-block">
          <span className="pulso-graph-detail-block-label">Depende de</span>
          <ul className="pulso-graph-detail-list xfg-lista">
            {incoming.map((e, i) => {
              const src = graph?.byId.get(e.source);
              if (!src) return null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    className="xfg-link"
                    onClick={() => onElegir(src.id)}
                    title={stripMarkdown(src.title || "") || src.name}
                  >
                    <Referencia nodo={src} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="pulso-graph-detail-block">
          <span className="pulso-graph-detail-block-label">Condiciona a</span>
          <ul className="pulso-graph-detail-list xfg-lista">
            {outgoing.map((e, i) => {
              const tgt = graph?.byId.get(e.target);
              if (!tgt) return null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    className="xfg-link"
                    onClick={() => onElegir(tgt.id)}
                    title={stripMarkdown(tgt.title || "") || tgt.name}
                  >
                    <Referencia nodo={tgt} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {incoming.length === 0 && outgoing.length === 0 && node.inheritedRelevant.length === 0 && !node.relevantExpression && (
        <p className="pulso-graph-detail-vacio">Sin reglas: aparece siempre y no condiciona a otras preguntas.</p>
      )}

      {onEditar && <EditarEnConstructor onEditar={() => onEditar(node.rowIndex)} describedBy={tituloId} />}
    </aside>
  );
}
