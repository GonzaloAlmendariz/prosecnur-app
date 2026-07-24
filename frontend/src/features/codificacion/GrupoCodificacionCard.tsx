import { useMemo } from "react";
import { ChevronDown, ChevronUp, Inbox, Plus, Trash2, X } from "lucide-react";
import { IconAI } from "../../lib/icons";
import type { CSSProperties } from "react";
import { Grupo, RespuestaUnica } from "../../api/client";
import { displayCodificacionValueLabel } from "./codificacionLabels";
import { grupoAccentColor } from "./codificacionGrupoColor";

// Classic Levenshtein edit distance (iterative, O(n*m) space O(n)).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Similarity 0-1 normalized by the longer string.
function similarity(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0 && lb === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(la, lb);
}

function truncateText(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * GrupoCodificacionCard — tarjeta de un grupo de codificación (destino de la
 * asignación). Estados:
 *  - "nuevo": inputs de código + etiqueta editables, badge Nuevo, borrar.
 *  - "existente": opción del choice list, código/etiqueta de solo lectura,
 *    badge Existente.
 *  - vacío: empty-state con ícono + microcopy (sin la línea "0 respuestas · 0
 *    casos" que antes se repetía y se leía pobre).
 *  - activo: superficie de acento + sugerencias de similitud.
 */
export function GrupoCodificacionCard({
  grupo, respuestas, asignacion, active, onActivate, onUpdate, onDelete,
  onRemoveRespuesta, onAddRespuesta, onMoveUp, onMoveDown, isFirst, isLast,
  allowMultiAssign = false,
}: {
  grupo: Grupo;
  respuestas: RespuestaUnica[];
  asignacion: Map<string, Grupo>;
  active: boolean;
  onActivate: () => void;
  onUpdate: (p: Partial<Grupo>) => void;
  onDelete: () => void;
  onRemoveRespuesta: (texto_normalizado: string) => void;
  onAddRespuesta: (texto_normalizado: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  allowMultiAssign?: boolean;
}) {
  const respByNorm = useMemo(() => new Map(respuestas.map((r) => [r.texto_normalizado, r])), [respuestas]);
  const total = grupo.respuestas.reduce((sum, t) => sum + (respByNorm.get(t)?.frecuencia ?? 0), 0);

  // Similitud: para cada respuesta SIN asignar, computar max similitud a las
  // respuestas asignadas al grupo. Top 6 con similarity >= 0.35. Solo cuando
  // el grupo está activo y tiene al menos una respuesta.
  const sugerencias = useMemo(() => {
    if (!active || grupo.respuestas.length === 0) return [];
    const seeds = grupo.respuestas;
    const hits: Array<{ t: RespuestaUnica; sim: number }> = [];
    for (const r of respuestas) {
      if (grupo.respuestas.includes(r.texto_normalizado)) continue;
      if (!allowMultiAssign && asignacion.has(r.texto_normalizado)) continue;
      let maxSim = 0;
      for (const s of seeds) {
        const sim = similarity(r.texto_normalizado, s);
        if (sim > maxSim) maxSim = sim;
        if (maxSim >= 0.99) break;
      }
      if (maxSim >= 0.35) hits.push({ t: r, sim: maxSim });
    }
    hits.sort((a, b) => b.sim - a.sim);
    return hits.slice(0, 6);
  }, [active, grupo.respuestas, respuestas, asignacion, allowMultiAssign]);

  const esExistente = grupo.origen === "existente";
  const empty = grupo.respuestas.length === 0;
  const groupDisplay = displayCodificacionValueLabel(grupo.codigo, grupo.etiqueta);
  const accentStyle = { "--cv2-chip-accent": grupoAccentColor(grupo.codigo, grupo.id) } as CSSProperties;

  return (
    <article
      className={`pulso-cv2-grupo${active ? " is-active" : ""}${esExistente ? " is-existente" : ""}${empty ? " is-empty" : ""}`}
      aria-label={`Grupo ${groupDisplay.code ? `${groupDisplay.code}, ${groupDisplay.label}` : groupDisplay.label}${active ? ", activo" : ""}`}
    >
      <div className="pulso-cv2-grupo-head">
        <span className="pulso-cv2-grupo-color" style={accentStyle} aria-hidden="true" />
        <button
          type="button"
          className={`pulso-cv2-active-toggle${active ? " is-active" : ""}`}
          aria-pressed={active}
          onClick={onActivate}
          title={active ? "Grupo activo" : "Usar este grupo como destino activo"}
        >
          {active ? "Activo" : "Usar"}
        </button>
        {esExistente ? (
          <>
            {groupDisplay.code && <span className="pulso-cv2-grupo-code is-static">{groupDisplay.code}</span>}
            <span className="pulso-cv2-grupo-label is-static" title={groupDisplay.title}>{groupDisplay.label}</span>
            <span className="pulso-cv2-badge is-existente">Existente</span>
            <MoveButtons onMoveUp={onMoveUp} onMoveDown={onMoveDown} isFirst={isFirst} isLast={isLast} />
          </>
        ) : (
          <>
            <input
              type="text"
              value={grupo.codigo}
              onChange={(e) => onUpdate({ codigo: e.target.value })}
              placeholder="cód."
              className="pulso-cv2-grupo-code"
              aria-label="Código numérico del grupo"
            />
            <input
              type="text"
              value={grupo.etiqueta}
              onChange={(e) => onUpdate({ etiqueta: e.target.value })}
              placeholder="Etiqueta descriptiva"
              className="pulso-cv2-grupo-label"
              aria-label="Etiqueta del grupo"
            />
            <span className="pulso-cv2-badge is-nuevo">Nuevo</span>
            <MoveButtons onMoveUp={onMoveUp} onMoveDown={onMoveDown} isFirst={isFirst} isLast={isLast} />
            <button
              type="button"
              onClick={onDelete}
              className="pulso-icon pulso-icon-danger"
              title="Eliminar grupo"
              aria-label="Eliminar grupo"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {!empty && (
        <div className="pulso-cv2-grupo-meta">
          <span>
            <strong>{grupo.respuestas.length}</strong> {grupo.respuestas.length === 1 ? "respuesta" : "respuestas"}
            {" · "}
            <strong>{total}</strong> {total === 1 ? "caso" : "casos"}
          </span>
          {active && <span className="pulso-cv2-grupo-active-flag">Activo</span>}
        </div>
      )}

      {empty ? (
        <div className="pulso-cv2-grupo-empty">
          <span className="pulso-cv2-grupo-empty-icon" aria-hidden="true"><Inbox size={16} /></span>
          <span className="pulso-cv2-grupo-empty-copy">
            {active
              ? "Marca respuestas de la izquierda para agruparlas aquí."
              : "Selecciona este grupo y marca respuestas para asignarlas."}
          </span>
        </div>
      ) : (
        <div className="pulso-cv2-chips">
          {grupo.respuestas.map((t, idx) => {
            const r = respByNorm.get(t);
            const formatted = displayCodificacionValueLabel(r?.texto ?? t, r?.label);
            const display = formatted.label;
            const freq = r?.frecuencia ?? 0;
            return (
              <span key={`${t}-${idx}`} className="pulso-cv2-chip">
                <span className="pulso-cv2-chip-text" title={formatted.title}>{display}</span>
                {freq > 0 && <span className="pulso-cv2-chip-freq">×{freq}</span>}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveRespuesta(t); }}
                  className="pulso-cv2-chip-x"
                  aria-label={`Quitar "${display}" del grupo`}
                  title="Quitar del grupo"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {active && sugerencias.length > 0 && (
        <div className="pulso-cv2-sugs">
          <div className="pulso-cv2-sugs-head">
            <IconAI size={11} /> Sugerencias similares
          </div>
          <div className="pulso-cv2-sugs-list">
            {sugerencias.map(({ t, sim }, idx) => {
              const pct = Math.round(sim * 100);
              const simTone = sim >= 0.85 ? "is-success" : sim >= 0.7 ? "is-warn" : "is-muted";
              return (
                <button
                  key={`${t.texto_normalizado}-${idx}`}
                  type="button"
                  onClick={() => onAddRespuesta(t.texto_normalizado)}
                  title={`${pct}% similar — click para agregar al grupo`}
                  className="pulso-cv2-sug"
                >
                  <Plus size={10} />
                  <span className="pulso-cv2-chip-text">{truncateText(t.texto, 22)}</span>
                  {t.frecuencia > 0 && <span className="pulso-cv2-chip-freq">×{t.frecuencia}</span>}
                  <span className={`pulso-cv2-sug-pct ${simTone}`}>{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

// Botones pequeños ↑/↓ para reordenar grupos (patrón copiado de
// TimelinePanel en Fase 5 Gráficos).
function MoveButtons({ onMoveUp, onMoveDown, isFirst, isLast }: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <span className="pulso-cv2-move">
      <button
        type="button"
        className="pulso-icon"
        onClick={onMoveUp}
        disabled={isFirst}
        title="Subir (el orden determina cómo aparecen en el xlsx final)"
        aria-label="Subir este grupo"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        className="pulso-icon"
        onClick={onMoveDown}
        disabled={isLast}
        title="Bajar (el orden determina cómo aparecen en el xlsx final)"
        aria-label="Bajar este grupo"
      >
        <ChevronDown size={14} />
      </button>
    </span>
  );
}
