import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, AlertCircle, Play, Download, Upload } from "lucide-react";
import {
  apiCodifColumnas,
  apiCodifFamiliasCommit,
  apiCodifFamiliasDraftGet,
  apiCodifFamiliasDraftSave,
  FamiliaRow,
  FamiliasCommitResponse,
} from "../../api/client";
import { Alert } from "../../components/Alert";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const TYPE_COLORS: Record<string, string> = {
  select_one: "#D9E1F2",
  select_multiple: "#E2F0D9",
  integer: "#E6D9F2",
  text: "#FFF2CC",
};

function splitCands(s: string | undefined): string[] {
  if (!s) return [];
  return s.split(/[,;]/).map((x) => x.trim()).filter((x) => x.length > 0);
}

type Props = {
  onCommitted?: (result: FamiliasCommitResponse) => void;
  onDraftChanged?: () => void;
};

export function FamiliasEditor({ onCommitted, onDraftChanged }: Props) {
  const [rows, setRows] = useState<FamiliaRow[] | null>(null);
  const [columnas, setColumnas] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string>("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [commitBusy, setCommitBusy] = useState(false);
  const [commitResult, setCommitResult] = useState<FamiliasCommitResponse | null>(null);

  // autosave debounce: skip first assignment after load
  const skipNextSave = useRef(true);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [draft, cols] = await Promise.all([apiCodifFamiliasDraftGet(), apiCodifColumnas()]);
        skipNextSave.current = true;
        setRows(draft.rows);
        setColumnas(cols.columnas);
        setSaveStatus(draft.source === "suggestion" ? "idle" : "saved");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!rows) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveStatus("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await apiCodifFamiliasDraftSave(rows);
        setSaveStatus("saved");
        onDraftChanged?.();
      } catch (e) {
        setSaveStatus("error");
        setError((e as Error).message);
      }
    }, 2000);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [rows, onDraftChanged]);

  function updateRow(i: number, patch: Partial<FamiliaRow>) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function onCommit() {
    setError("");
    setCommitBusy(true);
    // flush any pending save first
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      if (rows) {
        setSaveStatus("saving");
        await apiCodifFamiliasDraftSave(rows);
        setSaveStatus("saved");
      }
      const res = await apiCodifFamiliasCommit();
      setCommitResult(res);
      onCommitted?.(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCommitBusy(false);
    }
  }

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (filterTipo !== "all" && r.tipo !== filterTipo) return false;
        if (!q) return true;
        return (
          r.parent.toLowerCase().includes(q) ||
          (r.parent_label || "").toLowerCase().includes(q)
        );
      });
  }, [rows, query, filterTipo]);

  if (!rows) {
    return error ? <Alert kind="error">{error}</Alert> : <Alert kind="info">Cargando familias…</Alert>;
  }

  const counts = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      acc.use += r.use ? 1 : 0;
      acc.byTipo[r.tipo] = (acc.byTipo[r.tipo] || 0) + 1;
      return acc;
    },
    { total: 0, use: 0, byTipo: {} as Record<string, number> }
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <SaveBadge status={saveStatus} />
        <span style={{ color: "var(--pulso-text-soft)", fontSize: 13 }}>
          {counts.use} de {counts.total} en uso · {Object.entries(counts.byTipo).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} style={{ fontSize: 13 }}>
            <option value="all">todos los tipos</option>
            <option value="select_one">select_one</option>
            <option value="select_multiple">select_multiple</option>
            <option value="integer">integer</option>
            <option value="text">text</option>
          </select>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Search size={14} color="var(--pulso-text-soft)" />
            <input
              placeholder="buscar por nombre o etiqueta"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ fontSize: 13, width: 220 }}
            />
          </span>
          <button
            className="pulso-primary"
            disabled={commitBusy || saveStatus === "saving"}
            onClick={onCommit}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={14} /> Validar y pasar a códigos
          </button>
        </div>
      </div>

      <datalist id="familias-col-datalist">
        {columnas.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div style={{ overflowX: "auto", border: "1px solid var(--pulso-border)", borderRadius: 6, maxHeight: 560 }}>
        <table style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
          <thead style={{ background: "var(--pulso-surface)", position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th style={thStyle}>use</th>
              <th style={thStyle}>q</th>
              <th style={thStyle}>tipo</th>
              <th style={thStyle}>modo_so</th>
              <th style={thStyle}>parent</th>
              <th style={thStyle}>etiqueta</th>
              <th style={thStyle}>parent_col</th>
              <th style={thStyle}>other_dummy_col</th>
              <th style={thStyle}>text_col</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ r, i }) => {
              const bg = TYPE_COLORS[r.tipo] ?? "#f5f5f5";
              const rowStyle: React.CSSProperties = { background: bg, opacity: r.use ? 1 : 0.5 };
              return (
                <tr key={`${r.parent}-${i}`} style={rowStyle}>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={!!r.use}
                      onChange={(e) => updateRow(i, { use: e.target.checked })}
                    />
                  </td>
                  <td style={tdStyle}>{r.q_order}</td>
                  <td style={tdStyle}>{r.tipo}</td>
                  <td style={tdStyle}>
                    {r.tipo === "select_one" ? (
                      <select
                        value={r.modo_so || ""}
                        onChange={(e) => updateRow(i, { modo_so: e.target.value as FamiliaRow["modo_so"] })}
                        style={{ fontSize: 12 }}
                      >
                        <option value="">—</option>
                        <option value="padre">padre</option>
                        <option value="hijo">hijo</option>
                      </select>
                    ) : (
                      <span style={{ color: "#bbb" }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.parent}</td>
                  <td style={{ ...tdStyle, maxWidth: 320, whiteSpace: "normal" }}>
                    <span title={r.parent_label}>{truncate(r.parent_label, 80)}</span>
                  </td>
                  <td style={tdStyle}>
                    <ColField
                      value={r.parent_col}
                      cands={splitCands(r.parent_col_cands)}
                      onChange={(v) => updateRow(i, { parent_col: v })}
                    />
                  </td>
                  <td style={tdStyle}>
                    <ColField
                      value={r.other_dummy_col}
                      cands={splitCands(r.other_dummy_cands ?? r.dummy_cands)}
                      onChange={(v) => updateRow(i, { other_dummy_col: v })}
                    />
                  </td>
                  <td style={tdStyle}>
                    <ColField
                      value={r.text_col}
                      cands={splitCands(r.text_col_cands)}
                      onChange={(v) => updateRow(i, { text_col: v })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {commitResult && (
        <div style={{ marginTop: 14 }}>
          <Alert kind={commitResult.n_select_one + commitResult.n_select_multiple + commitResult.n_integer + commitResult.n_text === 0 ? "warn" : "info"}>
            Split aceptadas — select_one: {commitResult.n_select_one}, select_multiple: {commitResult.n_select_multiple},
            integer: {commitResult.n_integer}, text: {commitResult.n_text}
            {commitResult.n_huerfanos > 0 && ` · ${commitResult.n_huerfanos} texto(s) huérfano(s)`}
          </Alert>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <span style={badgeStyle("#eef3ff", "#2446a3")}>
        <Loader2 size={12} className="pulso-spin" /> Guardando…
      </span>
    );
  if (status === "saved")
    return (
      <span style={badgeStyle("#e8f5ea", "#1b6b2f")}>
        <Check size={12} /> Guardado
      </span>
    );
  if (status === "dirty")
    return (
      <span style={badgeStyle("#fff7e0", "#8a6100")}>
        Cambios sin guardar
      </span>
    );
  if (status === "error")
    return (
      <span style={badgeStyle("#fde7e7", "#a51f1f")}>
        <AlertCircle size={12} /> Error
      </span>
    );
  return <span style={badgeStyle("#f0f2f7", "#555")}>Sin cambios</span>;
}

function ColField({ value, cands, onChange }: { value: string; cands: string[]; onChange: (v: string) => void }) {
  const list = "familias-col-datalist";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <input
        list={list}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="col..."
        style={{ fontSize: 12, fontFamily: "monospace", width: 140 }}
      />
      {cands.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {cands.slice(0, 4).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={`Sugerido: ${c}`}
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                padding: "1px 5px",
                border: "1px solid var(--pulso-border)",
                background: value === c ? "var(--pulso-primary)" : "white",
                color: value === c ? "white" : "var(--pulso-text-soft)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function truncate(s: string | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  borderBottom: "1px solid var(--pulso-border)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "4px 10px",
  verticalAlign: "top",
  borderBottom: "1px solid #f2f2f2",
};

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color: fg,
    background: bg,
  };
}

// re-export unused icons to avoid TS unused import warnings while we iterate
export const _iconKeepalive = { Download, Upload };
