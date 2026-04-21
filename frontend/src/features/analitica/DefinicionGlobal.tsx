import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, EyeOff, Layers, Loader2, RefreshCw, Eye } from "lucide-react";
import {
  apiAnaliticaDetectSecciones,
  apiAnaliticaVariables,
  SeccionDetectada,
  VariableInstrumento,
} from "../../api/client";
import { useAnaliticaStore, SeccionConfig } from "./store";
import { VariablesExcluidas } from "./VariablesExcluidas";

// Definición global de Analítica. Vive arriba del stepper de reportes
// porque las "secciones del instrumento" + las "variables excluidas"
// son insumo compartido: Codebook, Frecuencias y Cruces los consumen.
// Aquí se define UNA vez y se aplica a todos los reportes.
//
// Layout:
// - Bloque colapsable "Definición de sección y variables"
// - Dentro, dos columnas:
//   · Secciones del instrumento (auto-detect + reorder + rename + merge + ocultar)
//   · Variables excluidas globalmente (bucket compartido)

export function DefinicionGlobal() {
  const hydrated = useAnaliticaStore((s) => s.hydrated);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);

  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        setVariables(r.variables);
      } catch {/* no-op */}
    })();
  }, []);

  if (!hydrated) return null;

  const nSecciones = secciones.length;
  const nActivas = secciones.filter((s) => !s.oculto).length;
  const nOcultas = nSecciones - nActivas;

  const summaryBits: string[] = [];
  if (nSecciones === 0) summaryBits.push("secciones se detectarán al abrir");
  else summaryBits.push(`${nActivas} ${nActivas === 1 ? "sección" : "secciones"}${nOcultas > 0 ? ` (+${nOcultas} oculta${nOcultas === 1 ? "" : "s"})` : ""}`);
  summaryBits.push(
    excluidas.length === 0
      ? "sin variables excluidas"
      : `${excluidas.length} ${excluidas.length === 1 ? "variable excluida" : "variables excluidas"}`,
  );

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        // Sin overflow:hidden porque los dropdowns de VariableSelect
        // (que usan position:absolute) necesitan escapar verticalmente.
        marginBottom: 14,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-expanded={open}
        style={{
          width: "100%", textAlign: "left",
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: hover || open ? "var(--pulso-surface)" : "white",
          border: "none", cursor: "pointer",
          // Border-radius del button iguala el del outer menos el border,
          // así el hover bg no se desborda del contenedor redondeado.
          borderRadius: open ? "9px 9px 0 0" : 9,
          transition: "background 120ms ease",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
          <Layers size={14} />
          Definición global
        </span>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4, flex: 1 }}>
          {summaryBits.join(" · ")}
        </span>
        <span style={{ color: "var(--pulso-text-soft)" }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, borderTop: "1px solid var(--pulso-border)" }}>
          <SeccionesBlock variables={variables} />
          <VariablesExcluidasBlock variables={variables} />
        </div>
      )}
    </div>
  );
}

// ---- Secciones block ------------------------------------------------------

function SeccionesBlock({ variables: _variables }: { variables: VariableInstrumento[] }) {
  void _variables;
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const setSecciones = useAnaliticaStore((s) => s.setSecciones);
  const renameSeccion = useAnaliticaStore((s) => s.renameSeccion);
  const toggleSeccionOculto = useAnaliticaStore((s) => s.toggleSeccionOculto);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Auto-detect en la primera carga si el store está vacío.
  useEffect(() => {
    if (secciones.length > 0) return;
    void detectar({ silencioso: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function detectar(opts: { silencioso?: boolean } = {}) {
    setError("");
    setBusy(true);
    try {
      const r = await apiAnaliticaDetectSecciones();
      const detected = r.secciones;
      const byIdManual = new Map(
        secciones.filter((s) => s.manual).map((s) => [s.id, s]),
      );
      const merged: SeccionConfig[] = detected.map((d: SeccionDetectada, i: number) => {
        const prior = byIdManual.get(d.id);
        if (prior) return { ...prior, variables: d.variables, orden: prior.orden ?? i };
        return { ...d, orden: i, manual: false };
      });
      const detectedIds = new Set(detected.map((d: SeccionDetectada) => d.id));
      const orphans = secciones.filter((s) => s.manual && !detectedIds.has(s.id));
      setSecciones([...merged, ...orphans].map((s, i) => ({ ...s, orden: i })));
    } catch (e) {
      if (!opts.silencioso) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const nVarsActivas = secciones.filter((s) => !s.oculto).reduce((sum, s) => sum + s.variables.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)", lineHeight: 1.3 }}>
          Secciones del instrumento
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 3, lineHeight: 1.5 }}>
          Detectadas desde los <code>begin_group</code> del XLSForm. Agrupan las variables en <strong>Frecuencias</strong> y <strong>Cruces</strong>. Click en el nombre para renombrar; ícono <Eye size={10} style={{ display: "inline", verticalAlign: "-1px" }} /> para incluir/excluir en los reportes (por defecto incluidas).
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => detectar()}
          disabled={busy}
          style={{ fontSize: 11, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
          title="Re-detecta desde el instrumento; preserva renames/merges manuales."
        >
          {busy ? <Loader2 size={11} className="pulso-spin" /> : <RefreshCw size={11} />}
          {busy ? "Detectando…" : "Detectar de nuevo"}
        </button>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
          {secciones.length} {secciones.length === 1 ? "sección" : "secciones"} · {nVarsActivas} variables activas
        </span>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "#b91c1c" }}>{error}</div>
      )}

      {secciones.length === 0 && !busy && (
        <div
          style={{
            padding: 12, border: "1px dashed var(--pulso-border)", borderRadius: 6,
            textAlign: "center", fontSize: 11, color: "var(--pulso-text-soft)",
          }}
        >
          Sin secciones detectadas. Verifica que el XLSForm tenga <code>begin_group</code>.
        </div>
      )}

      {secciones.length > 0 && (
        <div
          style={{
            display: "flex", flexDirection: "column", gap: 4,
            maxHeight: 320, overflowY: "auto",
            border: "1px solid var(--pulso-border)", borderRadius: 6,
            padding: 4, background: "white",
            scrollbarWidth: "thin", scrollbarColor: "var(--pulso-border) transparent",
          }}
        >
          {secciones.map((s) => (
            <SeccionRow
              key={s.id}
              seccion={s}
              editing={editingId === s.id}
              onStartEdit={() => setEditingId(s.id)}
              onEndEdit={() => setEditingId(null)}
              onRename={(name) => renameSeccion(s.id, name)}
              onToggleOculto={() => toggleSeccionOculto(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeccionRow({
  seccion, editing,
  onStartEdit, onEndEdit, onRename, onToggleOculto,
}: {
  seccion: SeccionConfig;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onRename: (name: string) => void;
  onToggleOculto: () => void;
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
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        border: "1px solid transparent",
        borderRadius: 5,
        background: seccion.oculto ? "var(--pulso-surface-2)" : "white",
        opacity: seccion.oculto ? 0.7 : 1,
        transition: "opacity 120ms ease, background 120ms ease",
      }}
    >
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
            style={{ width: "100%", fontSize: 12, fontWeight: 600, padding: "2px 4px" }}
          />
        ) : (
          <div
            onClick={onStartEdit}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStartEdit(); } }}
            style={{
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              color: seccion.oculto ? "var(--pulso-text-soft)" : "var(--pulso-text)",
              lineHeight: 1.3,
              textDecoration: seccion.oculto ? "line-through" : undefined,
            }}
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
        <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <code style={{ fontFamily: "monospace" }}>{seccion.id}</code>
          <span>·</span>
          <span>{seccion.variables.length} {seccion.variables.length === 1 ? "variable" : "variables"}</span>
        </div>
      </div>

      <button
        type="button"
        className="pulso-icon"
        onClick={onToggleOculto}
        title={seccion.oculto ? "Incluir en los reportes" : "Excluir de los reportes"}
        aria-label={seccion.oculto ? "Incluir" : "Excluir"}
        style={{ minWidth: 24, minHeight: 24 }}
      >
        {seccion.oculto ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </article>
  );
}

// ---- Variables excluidas block --------------------------------------------

function VariablesExcluidasBlock({ variables }: { variables: VariableInstrumento[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)", lineHeight: 1.3 }}>
          Variables excluidas del análisis
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 3, lineHeight: 1.5 }}>
          Variables que <strong>no aparecen</strong> en Libro de códigos, Bases ni Frecuencias. Usa esto para metadata (<code>_uuid</code>, <code>deviceid</code>), timestamps o campos técnicos que no aportan al análisis. Cruces no se ve afectado.
        </div>
      </div>
      <VariablesExcluidas variables={variables} />
    </div>
  );
}
