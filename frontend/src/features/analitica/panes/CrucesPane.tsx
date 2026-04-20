import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ArrowUpDown, Grid3x3, Plus, Sparkles, X } from "lucide-react";
import {
  apiAnaliticaCruces,
  apiAnaliticaVariables,
  VariableInstrumento,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import { Section, Collapsible, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

// CrucesPane — rediseñado.
// Modo "dimensiones" y toggle de significancia se excluyeron: la
// significancia siempre aplica con α=0.05 (chi²) en el modo estándar,
// y "dimensiones" se gestiona en un módulo separado.
// Pasos:
// 1. Variables a cruzar (contra todas las demás).
// 2. Presentación (incluir total).
// 3. Formato condicional (semáforo).
// 4. Brechas max − min (opcional).
// 5. Generar.

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
    // Fuerza modo estándar + sig por defecto antes de lanzar.
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

  const nVars = cruces.cruces_vars.length;
  const nResto = Math.max(0, variables.length - nVars);

  // Sugerencias: variables categóricas comunes para cruzar (select_one),
  // que no estén ya en cruces_vars.
  const sugeridas = useMemo(() => {
    return variables
      .filter((v) => v.tipo === "select_one")
      .filter((v) => !cruces.cruces_vars.includes(v.name))
      .slice(0, 4);
  }, [variables, cruces.cruces_vars]);

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Grid3x3 size={16} /> Cruces</span>}
      hint={<>Tablas cruzadas 2D. Cada variable elegida se cruza contra el resto del instrumento, con chi² al <strong>5%</strong> para marcar diferencias significativas.</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* 1. Variables a cruzar */}
        <Section
          title="1. Variables a cruzar"
          subtitle={<>
            Cada variable que listes aquí <strong>define las columnas</strong> de un bloque de tablas. Se cruza contra todas las demás variables del instrumento. Típicamente: sexo, distrito, servicio, grupo etario.
          </>}
        >
          <VariableChips
            selected={cruces.cruces_vars}
            variables={variables}
            sugeridas={sugeridas}
            onAdd={addVar}
            onRemove={removeVar}
          />
          {nVars > 0 && (
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 8 }}>
              El reporte generará <strong>{nVars}</strong> {nVars === 1 ? "bloque de tablas" : "bloques de tablas"} cruzando cada variable seleccionada contra las otras <strong>{nResto}</strong> variables del instrumento.
            </div>
          )}
        </Section>

        {/* 2. Presentación */}
        <Section
          title="2. Presentación"
          subtitle="Cómo se compone cada tabla cruzada."
        >
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={cruces.incluir_total}
              onChange={(e) => setCruces({ incluir_total: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Incluir columna y fila de total</div>
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
                Agrega la fila "Total" al final de cada tabla con la suma de las categorías. Útil para comparar cada grupo contra la muestra completa.
              </div>
            </div>
          </label>
        </Section>

        {/* 3. Formato condicional */}
        <Section
          title="3. Formato condicional"
          subtitle="Resalta las celdas con colores según el valor. Útil cuando las tablas se miran en grande."
        >
          <Collapsible
            title="Semáforo por umbrales"
            summary={cruces.semaforo.activo ? `activo · cortes ${cruces.semaforo.cortes[0]}% / ${cruces.semaforo.cortes[1]}%` : "desactivado"}
            defaultOpen={cruces.semaforo.activo}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={cruces.semaforo.activo}
                  onChange={(e) => setCruces({ semaforo: { ...cruces.semaforo, activo: e.target.checked } })}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Sparkles size={13} color="#b45309" /> Aplicar semáforo
                  </div>
                  <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
                    Colorea cada celda porcentual según esté por debajo, en el medio o sobre los umbrales.
                  </div>
                </div>
              </label>

              {cruces.semaforo.activo && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 26 }}>
                  <div>
                    <div className="pulso-section-eyebrow" style={{ marginBottom: 4 }}>Cortes (0–100%)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <ColorSwatch color={cruces.semaforo.colores?.rojo ?? "#F8D7DA"} />
                      <span style={{ fontSize: 11 }}>&lt;</span>
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
                        style={{ width: 60, fontSize: 12, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>%</span>
                      <ColorSwatch color={cruces.semaforo.colores?.amarillo ?? "#FFF3CD"} />
                      <span style={{ fontSize: 11 }}>≥</span>
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
                        style={{ width: 60, fontSize: 12, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>%</span>
                      <ColorSwatch color={cruces.semaforo.colores?.verde ?? "#D4EDDA"} />
                    </div>
                  </div>

                  <div>
                    <div className="pulso-section-eyebrow" style={{ marginBottom: 4 }}>Colores</div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      {(
                        [
                          { k: "rojo", label: "Bajo", default: "#F8D7DA" },
                          { k: "amarillo", label: "Medio", default: "#FFF3CD" },
                          { k: "verde", label: "Alto", default: "#D4EDDA" },
                        ] as const
                      ).map((c) => (
                        <label key={c.k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <input
                            type="color"
                            value={cruces.semaforo.colores?.[c.k] ?? c.default}
                            onChange={(e) => setCruces({
                              semaforo: {
                                ...cruces.semaforo,
                                colores: {
                                  ...(cruces.semaforo.colores ?? { rojo: "#F8D7DA", amarillo: "#FFF3CD", verde: "#D4EDDA" }),
                                  [c.k]: e.target.value,
                                },
                              },
                            })}
                            style={{ width: 36, height: 24, padding: 0, border: "1px solid var(--pulso-border)", borderRadius: 4, cursor: "pointer" }}
                          />
                          <span style={{ color: "var(--pulso-text-soft)" }}>{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <SemaforoPreview cortes={cruces.semaforo.cortes} colores={cruces.semaforo.colores} />
                </div>
              )}
            </div>
          </Collapsible>
        </Section>

        {/* 4. Brechas max − min */}
        <Section
          title="4. Brechas"
          subtitle={<>
            Muestra la <strong>diferencia entre la categoría más alta y la más baja</strong> en cada fila o columna. Útil para detectar desigualdades a simple vista.
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={cruces.brecha.filas}
                onChange={(e) => setCruces({ brecha: { ...cruces.brecha, filas: e.target.checked } })}
              />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <ArrowLeftRight size={12} color="var(--pulso-text-soft)" />
                Brecha por fila (diferencia entre columnas)
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={cruces.brecha.cols}
                onChange={(e) => setCruces({ brecha: { ...cruces.brecha, cols: e.target.checked } })}
              />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <ArrowUpDown size={12} color="var(--pulso-text-soft)" />
                Brecha por columna (diferencia entre filas)
              </span>
            </label>
          </div>
        </Section>

        {/* 5. Generar */}
        <GenerateFooter
          label="Generar cruces"
          busy={run.busy}
          jobId={run.jobId}
          fileId={run.fileId}
          downloadName="cruces.xlsx"
          error={run.error}
          onGenerate={onGenerate}
          disabled={nVars === 0}
          disabledHint={nVars === 0 ? "Agrega al menos una variable a cruzar arriba." : undefined}
          onJobDone={run.onJobDone}
          onJobError={run.onJobError}
          onJobCancelled={run.onJobCancelled}
        />
      </div>
    </Panel>
  );
}

// -- Variable chips + picker ------------------------------------------------

function VariableChips({
  selected, variables, sugeridas, onAdd, onRemove,
}: {
  selected: string[];
  variables: VariableInstrumento[];
  sugeridas: VariableInstrumento[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pendingVar, setPendingVar] = useState("");

  function commit() {
    if (pendingVar && !selected.includes(pendingVar)) onAdd(pendingVar);
    setPendingVar("");
    setAdding(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selected.length === 0 && !adding && (
        <div style={{ padding: 14, border: "1px dashed var(--pulso-border)", borderRadius: 6, textAlign: "center", fontSize: 12, color: "var(--pulso-text-soft)" }}>
          Aún no elegiste variables. Haz click en <strong>+ Añadir variable</strong> o usa una sugerencia.
        </div>
      )}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((v) => {
            const meta = variables.find((x) => x.name === v);
            return (
              <span
                key={v}
                title={meta?.label}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 4px 4px 12px", borderRadius: 999,
                  background: "var(--pulso-primary-soft)",
                  border: "1px solid var(--pulso-primary)",
                  fontSize: 12, color: "var(--pulso-primary)",
                  maxWidth: 320,
                }}
              >
                <code style={{ fontFamily: "monospace", fontWeight: 700 }}>{v}</code>
                {meta?.label && (
                  <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    · {meta.label.slice(0, 36)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(v)}
                  className="pulso-icon"
                  aria-label={`Quitar ${v}`}
                  style={{ minWidth: 18, minHeight: 18 }}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {adding ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <VariableSelect
              variables={variables.filter((v) => !selected.includes(v.name))}
              value={pendingVar}
              onChange={setPendingVar}
              placeholder="Seleccionar variable a cruzar…"
            />
          </div>
          <button type="button" className="pulso-primary" onClick={commit} disabled={!pendingVar} style={{ fontSize: 12, padding: "6px 14px" }}>Añadir</button>
          <button type="button" onClick={() => { setAdding(false); setPendingVar(""); }} style={{ fontSize: 12, padding: "6px 10px" }}>Cancelar</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={12} /> Añadir variable
          </button>
          {sugeridas.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginLeft: 4 }}>sugerencias:</span>
              {sugeridas.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onAdd(v.name)}
                  title={v.label}
                  style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 999,
                    border: "1px dashed var(--pulso-border)",
                    background: "white", color: "var(--pulso-text-soft)",
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 3,
                  }}
                >
                  <Plus size={9} />
                  <code style={{ fontFamily: "monospace" }}>{v.name}</code>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// -- Semáforo preview -------------------------------------------------------

function SemaforoPreview({ cortes, colores }: { cortes: number[]; colores?: { rojo: string; amarillo: string; verde: string } }) {
  const [lo, hi] = [cortes[0] ?? 50, cortes[1] ?? 75];
  const samples = [15, (lo + 10) | 0, ((lo + hi) / 2) | 0, hi + 10, 92];
  const c = colores ?? { rojo: "#F8D7DA", amarillo: "#FFF3CD", verde: "#D4EDDA" };

  function colorFor(v: number) {
    if (v < lo) return c.rojo;
    if (v >= hi) return c.verde;
    return c.amarillo;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="pulso-section-eyebrow" style={{ fontSize: 10 }}>Vista previa</div>
      <div style={{ display: "flex", gap: 4 }}>
        {samples.map((s) => (
          <div
            key={s}
            style={{
              flex: 1, minWidth: 40,
              padding: "6px 8px",
              background: colorFor(s),
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: 700,
              textAlign: "center",
              color: "rgba(0,0,0,0.7)",
            }}
          >
            {s}%
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block", width: 14, height: 14, borderRadius: 3,
        background: color, border: "1px solid rgba(0,0,0,0.15)",
      }}
    />
  );
}
