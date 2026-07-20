import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link2, Search, X } from "lucide-react";
import type { PreguntaAbierta } from "../../api/client";

const TIPO_STYLE: Record<string, { bg: string; border: string; fg: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", border: "var(--tipo-sm-border)", fg: "var(--tipo-sm-fg)" },
  select_one: { bg: "var(--tipo-so-bg)", border: "var(--tipo-so-border)", fg: "var(--tipo-so-fg)" },
  integer: { bg: "var(--tipo-int-bg)", border: "var(--tipo-int-border)", fg: "var(--tipo-int-fg)" },
  text: { bg: "var(--tipo-text-bg)", border: "var(--tipo-text-border)", fg: "var(--tipo-text-fg)" },
};

export function filterRelationTargets(candidates: PreguntaAbierta[], query: string): PreguntaAbierta[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return candidates;
  return candidates.filter((candidate) =>
    candidate.parent.toLowerCase().includes(normalizedQuery) ||
    candidate.parent_label.toLowerCase().includes(normalizedQuery) ||
    (candidate.section_label || "").toLowerCase().includes(normalizedQuery)
  );
}

export function RelationTargetDialog({
  source,
  candidates,
  onPick,
  onCancel,
}: {
  source: PreguntaAbierta;
  candidates: PreguntaAbierta[];
  onPick: (target: PreguntaAbierta) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterRelationTargets(candidates, query), [candidates, query]);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="pulso-cv2-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(15, 23, 42, 0.42)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
        />
        <Dialog.Content
          className="pulso-cv2-dialog pulso-codificacion-relation-target-dialog"
          aria-describedby="relation-target-desc"
        >
          <header className="pulso-codificacion-relation-target-head">
            <span className="pulso-codificacion-import-icon" aria-hidden="true"><Link2 size={18} /></span>
            <div>
              <Dialog.Title asChild>
                <h2>Relacionar con...</h2>
              </Dialog.Title>
              <Dialog.Description id="relation-target-desc">
                Elige la pregunta destino para definir la relación sin arrastrar.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="pulso-icon" aria-label="Cerrar selector de relación">
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>

          <div className="pulso-codificacion-relation-source">
            <span>Texto origen</span>
            <strong>{source.parent}</strong>
            <small>{truncate(source.parent_label, 110)}</small>
          </div>

          <div className="pulso-cv2-search pulso-codificacion-relation-search">
            <Search size={14} className="pulso-cv2-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pulso-cv2-search-input"
              placeholder="Buscar pregunta destino..."
              aria-label="Buscar pregunta destino para relacionar"
            />
          </div>

          <div className="pulso-codificacion-relation-target-list" role="listbox" aria-label="Preguntas destino">
            {visible.length === 0 ? (
              <div className="pulso-codificacion-relation-empty">No hay preguntas que coincidan.</div>
            ) : visible.map((candidate) => {
              const typeStyle = TIPO_STYLE[candidate.tipo] ?? TIPO_STYLE.text;
              return (
                <button
                  key={candidate.parent}
                  type="button"
                  role="option"
                  className="pulso-codificacion-relation-target-option"
                  onClick={() => onPick(candidate)}
                >
                  <code style={{ color: typeStyle.fg, background: typeStyle.bg, borderColor: typeStyle.border }}>{candidate.parent}</code>
                  <span>{truncate(candidate.parent_label, 120)}</span>
                  <small>{candidate.section_label || "Sin sección"}</small>
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function truncate(value: string, length: number) {
  if (!value) return "";
  return value.length > length ? value.slice(0, length - 1) + "…" : value;
}
