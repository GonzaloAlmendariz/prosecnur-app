import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, AlertCircle, Play } from "lucide-react";
import {
  apiCodifCodigosPatches,
  apiCodifCodigosSheet,
  apiCodifCodigosSheets,
  apiCodifPlantillaCodigosGenerar,
  CodigoPatch,
  CodigosColMeta,
  CodigosColRole,
  CodigosSheetMeta,
  CodigosSheetResponse,
} from "../../api/client";
import { Alert } from "../../components/Alert";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const ROLE_BG: Record<CodigosColRole, string> = {
  id: "#f3f4f8",
  ref: "#fafbff",
  recod: "#eaf7e6",
  control: "#fff4e8",
  aux: "#fde8d6",
  computed: "#f5f5f5",
  pad: "#ffffff",
};

const ROLE_LABEL: Record<CodigosColRole, string> = {
  id: "id",
  ref: "ref",
  recod: "recod",
  control: "control",
  aux: "aux",
  computed: "computed",
  pad: "",
};

type Props = {
  onApply?: () => void;
  applyBusy?: boolean;
};

export function CodigosEditor({ onApply, applyBusy }: Props) {
  const [sheets, setSheets] = useState<CodigosSheetMeta[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<CodigosSheetResponse | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string>("");
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [generating, setGenerating] = useState(false);

  const pendingRef = useRef<Map<string, CodigoPatch>>(new Map());
  const saveTimer = useRef<number | null>(null);

  const loadSheetsList = useCallback(async () => {
    try {
      const r = await apiCodifCodigosSheets();
      setSheets(r.sheets);
      if (!selected && r.sheets.length > 0) {
        setSelected(r.sheets[0].name);
      }
    } catch (e) {
      // Sheets not generated yet — that's OK, user will click "Generar".
      setSheets([]);
    }
  }, [selected]);

  useEffect(() => {
    void loadSheetsList();
  }, [loadSheetsList]);

  const loadSheet = useCallback(async (name: string) => {
    setError("");
    setLoadingSheet(true);
    try {
      const r = await apiCodifCodigosSheet(name);
      setSheet(r);
      pendingRef.current.clear();
      setSaveStatus("saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingSheet(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadSheet(selected);
  }, [selected, loadSheet]);

  async function flushPatches() {
    if (!sheet) return;
    const patches = Array.from(pendingRef.current.values());
    if (patches.length === 0) return;
    pendingRef.current.clear();
    setSaveStatus("saving");
    try {
      await apiCodifCodigosPatches(sheet.name, patches);
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("error");
      setError((e as Error).message);
    }
  }

  function scheduleSave() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveStatus("dirty");
    saveTimer.current = window.setTimeout(() => {
      void flushPatches();
    }, 2000);
  }

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    setSheet((prev) => {
      if (!prev) return prev;
      const newRows = prev.rows.slice();
      const row = newRows[rowIdx].slice();
      row[colIdx] = value;
      newRows[rowIdx] = row;
      return { ...prev, rows: newRows };
    });
    const key = `${rowIdx}-${colIdx}`;
    pendingRef.current.set(key, { row: rowIdx, col_index: colIdx, value });
    scheduleSave();
  }

  async function changeSheet(name: string) {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await flushPatches();
    setSelected(name);
  }

  async function onGenerate() {
    setError("");
    setGenerating(true);
    try {
      const r = await apiCodifPlantillaCodigosGenerar();
      setSheets(r.sheets);
      if (r.sheets.length > 0) setSelected(r.sheets[0].name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function onApplyClick() {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await flushPatches();
    onApply?.();
  }

  const editableIdx = useMemo(() => {
    if (!sheet) return new Set<number>();
    const s = new Set<number>();
    sheet.col_meta.forEach((c, i) => {
      if (c.role === "recod" || c.role === "control" || c.role === "aux") s.add(i);
    });
    return s;
  }, [sheet]);

  if (sheets === null) {
    return <Alert kind="info">Cargando plantilla…</Alert>;
  }

  if (sheets.length === 0) {
    return (
      <div>
        <Alert kind="info">
          Aún no hay plantilla de códigos generada. Genera desde el split de familias.
        </Alert>
        <div style={{ marginTop: 12 }}>
          <button
            className="pulso-primary"
            disabled={generating}
            onClick={onGenerate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {generating ? <Loader2 size={14} className="pulso-spin" /> : <Play size={14} />}
            Generar plantilla
          </button>
        </div>
        {error && <div style={{ marginTop: 12 }}><Alert kind="error">{error}</Alert></div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* Sidebar with sheet list */}
      <div style={{ minWidth: 180, borderRight: "1px solid var(--pulso-border)", paddingRight: 10 }}>
        <div className="pulso-section-eyebrow" style={{ marginBottom: 8 }}>Hojas</div>
        {sheets.map((s) => (
          <button
            key={s.name}
            onClick={() => void changeSheet(s.name)}
            style={{
              display: "block",
              textAlign: "left",
              width: "100%",
              padding: "6px 8px",
              marginBottom: 4,
              border: "1px solid var(--pulso-border)",
              borderRadius: 4,
              background: selected === s.name ? "var(--pulso-primary)" : "white",
              color: selected === s.name ? "white" : "var(--pulso-text)",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{s.tipo} · {s.n} filas</div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <SaveBadge status={saveStatus} />
          {sheet && (
            <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
              {sheet.rows.length} filas · {editableIdx.size} columnas editables
            </span>
          )}
          <div style={{ marginLeft: "auto" }}>
            <button
              className="pulso-primary"
              disabled={!!applyBusy}
              onClick={() => void onApplyClick()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Play size={14} /> Aplicar codificación
            </button>
          </div>
        </div>

        {loadingSheet && <Alert kind="info">Cargando hoja…</Alert>}

        {sheet && !loadingSheet && (
          <div style={{ overflow: "auto", border: "1px solid var(--pulso-border)", borderRadius: 6, maxHeight: 560 }}>
            <table style={{ fontSize: 11, borderCollapse: "collapse", minWidth: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr style={{ background: "var(--pulso-surface)" }}>
                  {sheet.tech_row.map((cn, i) => (
                    <th key={i} style={{ ...headerTech, background: ROLE_BG[sheet.col_meta[i].role] }}>
                      <div style={{ fontFamily: "monospace", fontSize: 11 }}>{cn || "\u00a0"}</div>
                      <div style={{ fontSize: 9, color: "var(--pulso-text-soft)", textTransform: "uppercase" }}>
                        {ROLE_LABEL[sheet.col_meta[i].role]}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr style={{ background: "var(--pulso-surface-2)" }}>
                  {sheet.label_row.map((lb, i) => (
                    <th key={i} style={{ ...headerLabel, background: ROLE_BG[sheet.col_meta[i].role] }}>
                      <span title={lb}>{truncate(lb, 60)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((val, ci) => {
                      const meta = sheet.col_meta[ci];
                      const editable = editableIdx.has(ci);
                      return (
                        <td
                          key={ci}
                          style={{ ...cellStyle, background: editable ? ROLE_BG[meta.role] : undefined }}
                        >
                          {editable ? (
                            <input
                              value={val ?? ""}
                              onChange={(e) => updateCell(ri, ci, e.target.value)}
                              style={{ fontSize: 11, width: "100%", minWidth: 60, padding: "2px 4px", border: "1px solid transparent", background: "transparent" }}
                            />
                          ) : (
                            <span style={{ color: "var(--pulso-text-soft)" }} title={val}>
                              {truncate(val ?? "", 40)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <div style={{ marginTop: 10 }}><Alert kind="error">{error}</Alert></div>}
      </div>
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
    return <span style={badgeStyle("#fff7e0", "#8a6100")}>Cambios sin guardar</span>;
  if (status === "error")
    return (
      <span style={badgeStyle("#fde7e7", "#a51f1f")}>
        <AlertCircle size={12} /> Error
      </span>
    );
  return <span style={badgeStyle("#f0f2f7", "#555")}>Sin cambios</span>;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const headerTech: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "1px solid var(--pulso-border)",
  borderRight: "1px solid #f0f0f4",
  whiteSpace: "nowrap",
};

const headerLabel: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "2px solid var(--pulso-border)",
  borderRight: "1px solid #f0f0f4",
  fontWeight: 400,
  fontSize: 10,
  maxWidth: 180,
};

const cellStyle: React.CSSProperties = {
  padding: "2px 6px",
  borderBottom: "1px solid #f2f2f2",
  borderRight: "1px solid #fafafa",
  verticalAlign: "top",
  maxWidth: 260,
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
