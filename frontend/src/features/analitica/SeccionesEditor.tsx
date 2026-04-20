import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Merge, RefreshCw } from "lucide-react";
import { apiAnaliticaDetectSecciones, SeccionDetectada } from "../../api/client";
import { Alert } from "../../components/Alert";
import { Panel } from "../../components/Panel";
import { useAnaliticaStore, SeccionConfig } from "./store";

// Editor de secciones del instrumento. Auto-detecta desde XLSForm
// (begin_group/end_group) y permite renombrar, reordenar, fusionar y
// ocultar. Los cambios manuales se marcan con `manual:true` para que
// "Detectar de nuevo" haga merge no-destructivo.

export function SeccionesEditor() {
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const setSecciones = useAnaliticaStore((s) => s.setSecciones);
  const moveSeccion = useAnaliticaStore((s) => s.moveSeccion);
  const renameSeccion = useAnaliticaStore((s) => s.renameSeccion);
  const toggleSeccionOculto = useAnaliticaStore((s) => s.toggleSeccionOculto);
  const mergeSecciones = useAnaliticaStore((s) => s.mergeSecciones);
  const hydrated = useAnaliticaStore((s) => s.hydrated);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Primera carga: si el store está vacío (primera visita), detectar
  // automáticamente desde el instrumento.
  useEffect(() => {
    if (!hydrated) return;
    if (secciones.length > 0) return;
    void detectar({ silencioso: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  async function detectar(opts: { silencioso?: boolean } = {}) {
    setError("");
    setBusy(true);
    try {
      const r = await apiAnaliticaDetectSecciones();
      const detected = r.secciones;
      // Merge con las existentes: si hay una del mismo id y manual=true,
      // preservamos nombre/orden/oculto. Las variables se toman de la
      // detección fresca (el XLSForm es la fuente canónica).
      const byIdManual = new Map(
        secciones.filter((s) => s.manual).map((s) => [s.id, s]),
      );
      const merged: SeccionConfig[] = detected.map((d: SeccionDetectada, i: number) => {
        const prior = byIdManual.get(d.id);
        if (prior) {
          return {
            ...prior,
            variables: d.variables,
            orden: prior.orden ?? i,
          };
        }
        return { ...d, orden: i, manual: false };
      });
      // Secciones manuales que ya no están en la detección (p.ej. fusionadas)
      // se conservan al final.
      const detectedIds = new Set(detected.map((d: SeccionDetectada) => d.id));
      const orphans = secciones.filter((s) => s.manual && !detectedIds.has(s.id));
      setSecciones([...merged, ...orphans].map((s, i) => ({ ...s, orden: i })));
    } catch (e) {
      if (!opts.silencioso) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) return null;

  return (
    <Panel
      eyebrow="Estructura"
      title="Secciones del instrumento"
      hint={<>Estas secciones se detectan automáticamente desde los <code>begin_group</code> del XLSForm. Puedes renombrarlas, reordenarlas, fusionarlas u ocultarlas. Se usan como agrupadores en Frecuencias y Cruces.</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => detectar()}
            disabled={busy}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            title="Re-detecta desde el instrumento; preserva renames/merges manuales."
          >
            <RefreshCw size={12} /> {busy ? "Detectando…" : "Detectar de nuevo"}
          </button>
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
            {secciones.length} {secciones.length === 1 ? "sección" : "secciones"} · {secciones.filter((s) => !s.oculto).reduce((sum, s) => sum + s.variables.length, 0)} variables activas
          </span>
        </div>

        {secciones.length === 0 && !busy && (
          <Alert kind="info">No se detectaron secciones. Verifica que el XLSForm tenga grupos definidos.</Alert>
        )}

        {secciones.length > 0 && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            maxHeight: 480, overflowY: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--pulso-border) transparent",
            paddingRight: 4,
          }}>
            {secciones.map((s, idx) => (
              <SeccionRow
                key={s.id}
                seccion={s}
                isFirst={idx === 0}
                isLast={idx === secciones.length - 1}
                nextLabel={idx < secciones.length - 1 ? secciones[idx + 1].nombre : undefined}
                editing={editingId === s.id}
                onStartEdit={() => setEditingId(s.id)}
                onEndEdit={() => setEditingId(null)}
                onRename={(name) => renameSeccion(s.id, name)}
                onMoveUp={() => moveSeccion(s.id, "up")}
                onMoveDown={() => moveSeccion(s.id, "down")}
                onToggleOculto={() => toggleSeccionOculto(s.id)}
                onMergeNext={idx < secciones.length - 1 ? () => mergeSecciones(secciones[idx + 1].id, s.id) : undefined}
              />
            ))}
          </div>
        )}

        {error && <Alert kind="error">{error}</Alert>}
      </div>
    </Panel>
  );
}

function SeccionRow({
  seccion, isFirst, isLast, nextLabel, editing,
  onStartEdit, onEndEdit, onRename, onMoveUp, onMoveDown, onToggleOculto, onMergeNext,
}: {
  seccion: SeccionConfig;
  isFirst: boolean;
  isLast: boolean;
  nextLabel?: string;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onRename: (name: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleOculto: () => void;
  onMergeNext?: () => void;
}) {
  const [draft, setDraft] = useState(seccion.nombre);

  useEffect(() => {
    if (editing) setDraft(seccion.nombre);
  }, [editing, seccion.nombre]);

  function commit() {
    const clean = draft.trim();
    if (clean && clean !== seccion.nombre) onRename(clean);
    onEndEdit();
  }

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid var(--pulso-border)",
        borderRadius: 6,
        background: seccion.oculto ? "var(--pulso-surface-2)" : "white",
        opacity: seccion.oculto ? 0.65 : 1,
      }}
    >
      <span style={{ display: "inline-flex", gap: 2 }}>
        <button
          type="button"
          className="pulso-icon"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Mover arriba"
          aria-label="Mover arriba"
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          className="pulso-icon"
          onClick={onMoveDown}
          disabled={isLast}
          title="Mover abajo"
          aria-label="Mover abajo"
        >
          <ChevronDown size={12} />
        </button>
      </span>

      <div style={{ minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") onEndEdit();
            }}
            style={{ width: "100%", fontSize: 13, fontWeight: 600 }}
          />
        ) : (
          <div
            onClick={onStartEdit}
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: seccion.oculto ? "var(--pulso-text-soft)" : "var(--pulso-text)" }}
            title="Click para renombrar"
          >
            {seccion.nombre}
            {seccion.manual && (
              <span style={{ marginLeft: 6, fontSize: 9, color: "var(--pulso-text-soft)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }}>
                editado
              </span>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2 }}>
          <code style={{ fontFamily: "monospace" }}>{seccion.id}</code>
          <span style={{ marginLeft: 8 }}>{seccion.variables.length} {seccion.variables.length === 1 ? "variable" : "variables"}</span>
        </div>
      </div>

      <span style={{ display: "inline-flex", gap: 4 }}>
        {onMergeNext && (
          <button
            type="button"
            className="pulso-icon"
            onClick={onMergeNext}
            title={`Fusionar "${nextLabel}" en esta sección`}
            aria-label="Fusionar con siguiente"
          >
            <Merge size={12} />
          </button>
        )}
        <button
          type="button"
          className="pulso-icon"
          onClick={onToggleOculto}
          title={seccion.oculto ? "Mostrar sección" : "Ocultar sección"}
          aria-label={seccion.oculto ? "Mostrar" : "Ocultar"}
        >
          {seccion.oculto ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </span>
    </article>
  );
}
