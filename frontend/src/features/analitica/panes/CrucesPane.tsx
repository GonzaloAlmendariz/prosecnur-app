import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download, Grid3x3, Play, X } from "lucide-react";
import { apiAnaliticaCruces, apiAnaliticaVariables, downloadUrl, FileJobResult, VariableInstrumento } from "../../../api/client";
import { Alert } from "../../../components/Alert";
import { JobProgress } from "../../../components/JobProgress";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";

// Cruces — versión simplificada.
// La significancia siempre aplica con α=0.05 (chi²) en modo estándar; no
// se expone como toggle porque nunca se modifica en la práctica. El modo
// "dimensiones" se gestiona en una página separada (fuera del módulo de
// Analítica estándar). Aquí solo: variables a cruzar + incluir total +
// semáforo + brechas.

export function CrucesPane() {
  const cruces = useAnaliticaStore((s) => s.config.cruces);
  const setCruces = useAnaliticaStore((s) => s.setCruces);
  const run = useReporteRun();

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        setVariables(r.variables);
      } catch {/* no-op */}
    })();
  }, []);

  async function onGenerate() {
    // Aseguramos modo="estandar" y significancia estándar (α=0.05, chi²)
    // en el store antes de lanzar — este pane no expone esos toggles.
    if (cruces.modo !== "estandar" || !cruces.show_sig || cruces.alpha !== 0.05) {
      setCruces({ modo: "estandar", show_sig: true, alpha: 0.05 });
    }
    await run.runAsync(() => apiAnaliticaCruces());
  }

  function addVar(v: string) {
    const clean = v.trim();
    if (!clean || cruces.cruces_vars.includes(clean)) return;
    setCruces({ cruces_vars: [...cruces.cruces_vars, clean] });
  }
  function removeVar(v: string) {
    setCruces({ cruces_vars: cruces.cruces_vars.filter((x) => x !== v) });
  }

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Grid3x3 size={16} /> Cruces</span>}
      hint={<>Cada variable listada se cruza contra todas las demás del instrumento. El reporte incluye chi² (α = 0.05) entre todos los cruces.</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Variables a cruzar con autocomplete */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Variables a cruzar</div>
          <VariablePicker
            selected={cruces.cruces_vars}
            variables={variables}
            onAdd={addVar}
            onRemove={removeVar}
          />
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={cruces.incluir_total}
            onChange={(e) => setCruces({ incluir_total: e.target.checked })}
          />
          <span>Incluir columna/fila de total</span>
        </label>

        {/* Semáforo (colapsable) */}
        <Collapsible title="Semáforo" defaultOpen={cruces.semaforo.activo}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={cruces.semaforo.activo}
              onChange={(e) => setCruces({ semaforo: { ...cruces.semaforo, activo: e.target.checked } })}
            />
            <span>Aplicar formato condicional por umbral</span>
          </label>
          {cruces.semaforo.activo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 26, marginTop: 10 }}>
              <div>
                <div className="pulso-section-eyebrow" style={{ marginBottom: 4 }}>Modo</div>
                <select
                  value={cruces.semaforo.modo}
                  onChange={(e) => setCruces({ semaforo: { ...cruces.semaforo, modo: e.target.value as typeof cruces.semaforo.modo } })}
                  style={{ fontSize: 12, padding: "4px 8px" }}
                >
                  <option value="grupos">Grupos (rojo/amarillo/verde por umbrales)</option>
                  <option value="degradado_automatico">Degradado automático</option>
                  <option value="degradado_manual">Degradado manual</option>
                </select>
              </div>
              {cruces.semaforo.modo === "grupos" && (
                <div>
                  <div className="pulso-section-eyebrow" style={{ marginBottom: 4 }}>Cortes (0-100)</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11 }}>rojo &lt;</span>
                    <input
                      type="number"
                      value={cruces.semaforo.cortes[0] ?? 50}
                      min={0} max={100}
                      onChange={(e) => setCruces({
                        semaforo: {
                          ...cruces.semaforo,
                          cortes: [Number(e.target.value) || 0, cruces.semaforo.cortes[1] ?? 75],
                        },
                      })}
                      style={{ width: 60, fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11 }}>· verde ≥</span>
                    <input
                      type="number"
                      value={cruces.semaforo.cortes[1] ?? 75}
                      min={0} max={100}
                      onChange={(e) => setCruces({
                        semaforo: {
                          ...cruces.semaforo,
                          cortes: [cruces.semaforo.cortes[0] ?? 50, Number(e.target.value) || 0],
                        },
                      })}
                      style={{ width: 60, fontSize: 12 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {(["rojo", "amarillo", "verde"] as const).map((k) => (
                      <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                        {k}
                        <input
                          type="color"
                          value={cruces.semaforo.colores?.[k] ?? (k === "rojo" ? "#F8D7DA" : k === "amarillo" ? "#FFF3CD" : "#D4EDDA")}
                          onChange={(e) => setCruces({
                            semaforo: {
                              ...cruces.semaforo,
                              colores: { ...(cruces.semaforo.colores ?? { rojo: "#F8D7DA", amarillo: "#FFF3CD", verde: "#D4EDDA" }), [k]: e.target.value },
                            },
                          })}
                          style={{ width: 32, height: 22, padding: 0, border: "1px solid var(--pulso-border)", borderRadius: 4 }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Collapsible>

        {/* Brechas (colapsable) */}
        <Collapsible title="Brechas max − min" defaultOpen={cruces.brecha.filas || cruces.brecha.cols}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={cruces.brecha.filas}
                onChange={(e) => setCruces({ brecha: { ...cruces.brecha, filas: e.target.checked } })}
              />
              <span>Mostrar brecha por fila</span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={cruces.brecha.cols}
                onChange={(e) => setCruces({ brecha: { ...cruces.brecha, cols: e.target.checked } })}
              />
              <span>Mostrar brecha por columna</span>
            </label>
          </div>
        </Collapsible>

        {/* Generar */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--pulso-border)", paddingTop: 14 }}>
          <button
            className="pulso-primary"
            onClick={onGenerate}
            disabled={run.busy || !!run.jobId || cruces.cruces_vars.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={14} /> {run.jobId ? "Generando…" : "Generar cruces"}
          </button>
          {cruces.cruces_vars.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
              Agrega al menos una variable arriba para habilitar el botón.
            </span>
          )}
          {run.fileId && (
            <a
              href={downloadUrl(run.fileId)}
              style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Download size={13} /> cruces.xlsx
            </a>
          )}
        </div>
        {run.jobId && (
          <JobProgress<FileJobResult>
            label="Generando cruces"
            jobId={run.jobId}
            onDone={run.onJobDone}
            onError={run.onJobError}
            onCancelled={run.onJobCancelled}
          />
        )}
        {run.error && <Alert kind="error">{run.error}</Alert>}
      </div>
    </Panel>
  );
}

// -- subcomponentes ---------------------------------------------------------

function VariablePicker({
  selected, variables, onAdd, onRemove,
}: {
  selected: string[];
  variables: VariableInstrumento[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [input, setInput] = useState("");
  const q = input.toLowerCase().trim();
  const suggestions = q
    ? variables
        .filter((v) => !selected.includes(v.name))
        .filter((v) => v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q))
        .slice(0, 8)
    : [];

  function pick(name: string) {
    onAdd(name);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((v) => (
            <span
              key={v}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 4px 3px 10px", borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                border: "1px solid var(--pulso-primary)",
                fontSize: 12, fontFamily: "monospace", color: "var(--pulso-primary)",
              }}
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(v)}
                className="pulso-icon"
                aria-label={`Quitar ${v}`}
                title="Quitar"
                style={{ minWidth: 18, minHeight: 18 }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: "relative", maxWidth: 480 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              pick(input.trim());
            }
          }}
          placeholder="Buscar variable por nombre o etiqueta…"
          style={{ width: "100%", fontSize: 13, padding: "6px 10px" }}
        />
        {suggestions.length > 0 && (
          <div
            style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "white", border: "1px solid var(--pulso-border)",
              borderRadius: 6, marginTop: 2, padding: 4,
              maxHeight: 240, overflowY: "auto",
              scrollbarWidth: "thin", scrollbarColor: "var(--pulso-border) transparent",
              boxShadow: "var(--pulso-shadow-low)",
            }}
          >
            {suggestions.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => pick(v.name)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "5px 8px", border: "none", background: "transparent",
                  cursor: "pointer", borderRadius: 4, fontSize: 12,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pulso-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <code style={{ fontFamily: "monospace", fontWeight: 700, marginRight: 8 }}>{v.name}</code>
                <span style={{ color: "var(--pulso-text-soft)" }}>{v.label.slice(0, 60)}</span>
                <span style={{ marginLeft: 6, fontSize: 9, color: "var(--pulso-text-soft)" }}>{v.tipo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--pulso-border)", borderRadius: 6, background: "var(--pulso-surface)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left",
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
          color: "var(--pulso-text-soft)",
        }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {title}
      </button>
      {open && <div style={{ padding: "4px 14px 12px", background: "white" }}>{children}</div>}
    </div>
  );
}
