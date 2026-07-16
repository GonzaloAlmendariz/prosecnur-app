import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, HelpCircle, Info, Landmark, Plus, Scale,
  SlidersHorizontal, X,
} from "lucide-react";
import {
  apiAnaliticaColumnValues, apiAnaliticaPonderacionPreview, apiAnaliticaVariables,
  PonderPreview, ValorColumna, VariableInstrumento,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { PonderMargin, useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";

// PonderacionPane — pondera los reportes (frecuencias, cruces, dimensiones)
// para que representen a la población. Flujo guiado: guía de decisión →
// activar → método → variables y objetivos → diagnóstico en vivo → aplicar.
// La ponderación se persiste en analitica_config.ponderacion (autosave) y el
// backend recalcula el peso de forma determinista; aquí solo se previsualiza.

const fmt1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "—");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const intfmt = (x: number) => Math.round(x).toLocaleString("es-PE");

export function PonderacionPane() {
  const pond = useAnaliticaStore((s) => s.config.ponderacion);
  const setPonderacion = useAnaliticaStore((s) => s.setPonderacion);
  const upsertMargin = useAnaliticaStore((s) => s.upsertPonderMargin);
  const removeMargin = useAnaliticaStore((s) => s.removePonderMargin);

  const margins = pond.rake?.margins ?? [];
  const designOn = !!pond.design;
  const cap = pond.trim?.cap ?? 0;

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  const [preview, setPreview] = useState<PonderPreview | null>(null);
  const [catCache, setCatCache] = useState<Record<string, ValorColumna[]>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try { setVariables((await apiAnaliticaVariables()).variables); } catch { /* no-op */ }
    })();
  }, []);

  const categoricas = useMemo(() => variables.filter((v) => !!v.categorica), [variables]);
  const labelOf = (name: string) =>
    variables.find((v) => v.name === name)?.label || name;

  // Categorías de una variable (cacheadas) para armar los inputs de objetivo.
  async function ensureCats(name: string) {
    if (!name || catCache[name]) return;
    try {
      const r = await apiAnaliticaColumnValues(name);
      setCatCache((c) => ({ ...c, [name]: r.values }));
    } catch { /* no-op */ }
  }
  useEffect(() => {
    [...margins.map((m) => m.var), pond.design?.var].forEach((v) => v && ensureCats(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(margins.map((m) => m.var)), pond.design?.var]);

  // Preview con debounce ante cualquier cambio de la config de ponderación.
  useEffect(() => {
    if (!pond.enabled) { setPreview(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { setPreview(await apiAnaliticaPonderacionPreview(pond)); }
      catch { setPreview(null); }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [JSON.stringify(pond)]);

  const d = preview?.diagnostics;
  const nEff = d ? intfmt(d.n_eff) : "—";
  const deff = d ? d.deff.toFixed(2) : "—";
  const loss = d && Number.isFinite(d.loss_pct) ? Math.round(d.loss_pct) : null;

  return (
    <Panel className="analitica-ponderacion-panel">
      <div className="analitica-report-shell" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Docbar */}
        <div className="analitica-cruces-docbar">
          <span className="analitica-cruces-docbar-icon" aria-hidden="true"><Scale size={16} /></span>
          <div className="analitica-cruces-docbar-copy">
            <span>Producto analítico</span>
            <strong>Ponderación</strong>
            <small>Ajusta tus resultados para que representen a la población.</small>
          </div>
          <div className="analitica-cruces-docbar-stats" aria-label="Estado de la ponderación">
            <span>Estado<strong style={{ color: pond.enabled ? "var(--pulso-primary)" : "var(--pulso-text-soft)" }}>{pond.enabled ? "Activa" : "Inactiva"}</strong></span>
            <span>n efectivo<strong>{nEff}</strong></span>
            <span>DEFF<strong>{deff}</strong></span>
          </div>
        </div>

        {/* Guía de decisión */}
        <DecisionAid />

        {/* Master switch */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          background: "var(--pulso-surface)", border: `1px solid ${pond.enabled ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
          borderRadius: 12,
        }}>
          <Toggle on={pond.enabled} onClick={() => setPonderacion({ enabled: !pond.enabled })} label="Activar ponderación" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Activar ponderación</div>
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
              {pond.enabled
                ? "Frecuencias, cruces y dimensiones usan los pesos. Apágala para volver a peso 1 en cada caso."
                : "Tus reportes usan cada caso con peso 1 (sin ponderar)."}
            </div>
          </div>
        </div>

        {pond.enabled && (
          <>
            {/* Paso 1 — Método */}
            <StepLabel n={1} text="¿Qué quieres corregir?" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <MetodoCard
                icon={<SlidersHorizontal size={17} />}
                title="Ajustar a la población"
                active={margins.length > 0}
                activeLabel={margins.length > 0 ? "en uso" : undefined}
                copy="Corrige la no-respuesta: lleva sexo, edad o distrito a las cifras reales de la población."
              />
              <MetodoCard
                icon={<Scale size={17} />}
                title="Reequilibrar la asignación"
                active={designOn}
                toggle
                onToggle={() => setPonderacion({ design: designOn ? null : { var: "", pop_sizes: {} } })}
                copy="Cuando muestreaste distinto de la población (ej. n igual por distrito, pero unos son más grandes)."
              />
            </div>

            {/* Paso 2 — Variables y objetivos */}
            <StepLabel n={2} text="Variables y objetivos" />

            {margins.map((m) => (
              <CategoryEditor
                key={m.var}
                mode="rake"
                variable={m.var}
                label={labelOf(m.var)}
                categorias={catCache[m.var] ?? []}
                values={m.targets}
                observed={preview?.margins?.[m.var]}
                onChange={(vals) => upsertMargin({ var: m.var, targets: vals })}
                onRemove={() => removeMargin(m.var)}
              />
            ))}

            <AddVariable
              variables={categoricas.filter((v) => !margins.some((m) => m.var === v.name) && v.name !== pond.design?.var)}
              label="Agregar variable a ajustar (sexo, edad, distrito…)"
              onPick={(name) => { ensureCats(name); upsertMargin({ var: name, targets: {} }); }}
            />

            {designOn && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", margin: "4px 2px 6px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Scale size={13} /> Reequilibrio: elige el estrato y su población real
                </div>
                {pond.design?.var ? (
                  <CategoryEditor
                    mode="design"
                    variable={pond.design.var}
                    label={labelOf(pond.design.var)}
                    categorias={catCache[pond.design.var] ?? []}
                    values={pond.design.pop_sizes}
                    onChange={(vals) => setPonderacion({ design: { var: pond.design!.var, pop_sizes: vals } })}
                    onRemove={() => setPonderacion({ design: { var: "", pop_sizes: {} } })}
                  />
                ) : (
                  <AddVariable
                    variables={categoricas.filter((v) => !margins.some((m) => m.var === v.name))}
                    label="Elegir variable de estrato (distrito, sede…)"
                    onPick={(name) => { ensureCats(name); setPonderacion({ design: { var: name, pop_sizes: {} } }); }}
                  />
                )}
              </div>
            )}

            {/* Paso 3 — Diagnóstico */}
            <StepLabel n={3} text="Revisa el efecto" />
            <Diagnostico preview={preview} nEff={nEff} deff={deff} loss={loss} cap={cap}
              onCap={(v) => setPonderacion({ trim: v > 1 ? { cap: v } : null })} />
          </>
        )}

      </div>
    </Panel>
  );
}

// ---- Guía de decisión -------------------------------------------------------
function DecisionAid() {
  const [describe, setDescribe] = useState<boolean | null>(null);
  const [margins, setMargins] = useState<boolean | null>(null);
  const answered = describe !== null && margins !== null;
  const conviene = describe === true && margins === true;
  const comparar = describe === false;
  return (
    <div style={{ background: "var(--pulso-surface)", border: "1px solid var(--pulso-border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <HelpCircle size={17} style={{ color: "var(--pulso-primary)" }} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>Antes de empezar: ¿lo necesitas?</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--pulso-text-soft)", marginBottom: 12 }}>
        Ponderar corrige el sesgo, pero cuesta precisión. Responde dos cosas y te digo si conviene.
      </div>
      <YesNo
        q="¿Vas a describir a la población (no solo comparar grupos entre sí)?"
        yes="Describir población"
        no="Solo comparar grupos"
        value={describe}
        onChange={setDescribe}
      />
      <YesNo
        q="¿Tienes cifras poblacionales confiables (censo, padrón)?"
        yes="Con cifras confiables"
        no="Sin cifras confiables"
        value={margins}
        onChange={setMargins}
      />
      {answered && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 8,
          background: conviene ? "var(--pulso-success-soft, #E9F6EE)" : "var(--pulso-warning-soft, #FBF3E2)",
        }}>
          {conviene ? <CheckCircle2 size={17} style={{ color: "var(--pulso-success-fg)" }} />
            : <Info size={17} style={{ color: "var(--pulso-warning-fg, #9A6B12)" }} />}
          <span style={{ fontSize: 12.5, color: conviene ? "var(--pulso-success-fg)" : "var(--pulso-warning-fg, #9A6B12)" }}>
            {conviene
              ? "Ponderar tiene sentido aquí. Configura los objetivos abajo."
              : comparar
                ? "Si tu objetivo es comparar grupos con un diseño balanceado, probablemente no necesites ponderar: cuesta precisión sin corregir sesgo."
                : "Sin cifras poblacionales confiables no puedes fijar objetivos. Consíguelas antes de ponderar."}
          </span>
        </div>
      )}
    </div>
  );
}

function YesNo({ q, yes, no, value, onChange }: {
  q: string; yes: string; no: string; value: boolean | null; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--pulso-surface-2)", borderRadius: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 13, flex: 1 }}>{q}</span>
      <div className="analitica-segmented" role="group">
        <button type="button" className={value === true ? "is-on" : ""} onClick={() => onChange(true)}>{yes}</button>
        <button type="button" className={value === false ? "is-on" : ""} onClick={() => onChange(false)}>{no}</button>
      </div>
    </div>
  );
}

// ---- Método card ------------------------------------------------------------
function MetodoCard({ icon, title, copy, active, activeLabel, toggle, onToggle }: {
  icon: React.ReactNode; title: string; copy: string; active: boolean;
  activeLabel?: string; toggle?: boolean; onToggle?: () => void;
}) {
  return (
    <div
      role={toggle ? "button" : undefined}
      onClick={toggle ? onToggle : undefined}
      style={{
        background: "var(--pulso-surface)", borderRadius: 12, padding: 14, cursor: toggle ? "pointer" : "default",
        border: active ? "2px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)" }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        {(active && (activeLabel || toggle)) && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--pulso-primary)", background: "var(--pulso-primary-soft)", padding: "2px 8px", borderRadius: 999 }}>
            {activeLabel ?? "activo"}
          </span>
        )}
        {toggle && !active && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--pulso-text-soft)" }}>activar</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>{copy}</div>
    </div>
  );
}

// ---- Editor de categorías (rake targets / design pop_sizes) -----------------
function CategoryEditor({ mode, variable, label, categorias, values, observed, onChange, onRemove }: {
  mode: "rake" | "design";
  variable: string; label: string;
  categorias: ValorColumna[];
  values: Record<string, number>;
  observed?: { categoria: string; muestra: number }[];
  onChange: (vals: Record<string, number>) => void;
  onRemove: () => void;
}) {
  const obs = (cat: string) => observed?.find((o) => o.categoria === cat)?.muestra;
  const set = (cat: string, raw: string) => {
    const next = { ...values };
    const num = parseFloat(raw);
    if (raw === "" || !Number.isFinite(num)) delete next[cat];
    else next[cat] = num;
    onChange(next);
  };
  const usarMuestra = () => {
    const next: Record<string, number> = {};
    categorias.forEach((c) => { const o = obs(c.value); if (o != null) next[c.value] = +(o * 100).toFixed(1); });
    onChange(next);
  };
  const igualar = () => {
    const next: Record<string, number> = {};
    const k = categorias.length || 1;
    categorias.forEach((c) => { next[c.value] = +(100 / k).toFixed(1); });
    onChange(next);
  };
  const isRake = mode === "rake";
  return (
    <div style={{ background: "var(--pulso-surface)", border: "1px solid var(--pulso-border)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        {isRake && (
          <>
            <button className="analitica-add-inline" style={{ marginLeft: "auto", fontSize: 11.5 }} onClick={usarMuestra} title="Prefijar los objetivos con la distribución actual de tu muestra">
              Usar muestra
            </button>
            <button className="analitica-add-inline" style={{ fontSize: 11.5 }} onClick={igualar}>Igualar</button>
            <button className="analitica-add-inline" style={{ fontSize: 11.5, opacity: 0.55, cursor: "not-allowed" }} disabled title="Disponible para estudios territoriales (próximamente)">
              <Landmark size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Censo INEI
            </button>
          </>
        )}
        <button aria-label="Quitar variable" onClick={onRemove} style={{ marginLeft: isRake ? 4 : "auto", padding: "4px 7px", background: "transparent", border: "none", color: "var(--pulso-text-soft)", cursor: "pointer" }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `1fr auto ${isRake ? "auto" : ""}`.trim(), gap: "4px 14px", alignItems: "center", fontSize: 11, color: "var(--pulso-text-soft)", paddingBottom: 4, borderBottom: "1px solid var(--pulso-border)" }}>
        <span>categoría</span>
        {isRake && <span style={{ textAlign: "right" }}>en tu muestra</span>}
        <span style={{ textAlign: "right" }}>{isRake ? "objetivo %" : "población"}</span>
      </div>
      {categorias.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: "10px 0" }}>Cargando categorías…</div>
      )}
      {categorias.map((c) => (
        <div key={c.value} style={{ display: "grid", gridTemplateColumns: `1fr auto ${isRake ? "auto" : ""}`.trim(), gap: "4px 14px", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--pulso-border)" }}>
          <span style={{ fontSize: 13 }}>{c.label}</span>
          {isRake && (
            <span style={{ fontSize: 12.5, color: "var(--pulso-text-soft)", textAlign: "right", minWidth: 52 }}>
              {obs(c.value) != null ? pct(obs(c.value)!) : "—"}
            </span>
          )}
          <input
            value={values[c.value] ?? ""}
            onChange={(e) => set(c.value, e.target.value)}
            placeholder={isRake ? "%" : "n"}
            inputMode="decimal"
            style={{ width: isRake ? 66 : 92, height: 30, textAlign: "right", fontSize: 13 }}
            aria-label={`${isRake ? "objetivo" : "población"} ${c.label}`}
          />
        </div>
      ))}
    </div>
  );
}

// ---- Agregar variable -------------------------------------------------------
function AddVariable({ variables, label, onPick }: {
  variables: VariableInstrumento[]; label: string; onPick: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <button className="analitica-add-inline" style={{ alignSelf: "flex-start", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setAdding(true)}>
        <Plus size={15} /> {label}
      </button>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, maxWidth: 360 }}>
        <VariableSelect variables={variables} value="" onChange={(name) => { if (name) onPick(name); setAdding(false); }} placeholder="Elegir variable categórica…" />
      </div>
      <button className="analitica-add-inline" style={{ fontSize: 12 }} onClick={() => setAdding(false)}>Cancelar</button>
    </div>
  );
}

// ---- Diagnóstico ------------------------------------------------------------
function Diagnostico({ preview, nEff, deff, loss, cap, onCap }: {
  preview: PonderPreview | null; nEff: string; deff: string; loss: number | null;
  cap: number; onCap: (v: number) => void;
}) {
  const d = preview?.diagnostics;
  const firstVar = preview?.margins ? Object.keys(preview.margins)[0] : null;
  const rows = firstVar ? preview!.margins![firstVar] : [];
  const max = Math.max(0.4, ...rows.flatMap((r) => [r.muestra, r.ponderado, r.objetivo]));
  const capVal = cap > 1 ? cap : 5;
  return (
    <div style={{ background: "var(--pulso-surface)", border: "1px solid var(--pulso-border)", borderRadius: 12, padding: 16 }}>
      {!preview?.ok && (
        <div style={{ fontSize: 12.5, color: "var(--pulso-text-soft)" }}>Configura al menos una variable con objetivos para ver el efecto.</div>
      )}
      {preview?.ok && firstVar && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{firstVar}: antes y después de ponderar</div>
          {rows.map((r) => (
            <div key={r.categoria} style={{ display: "flex", alignItems: "center", gap: 10, margin: "7px 0" }}>
              <span style={{ fontSize: 12, width: 64, color: "var(--pulso-text-soft)" }}>{r.categoria}</span>
              <div style={{ flex: 1, position: "relative", height: 22, background: "var(--pulso-surface-2)", borderRadius: 5 }}>
                <div style={{ position: "absolute", top: 3, height: 7, left: 0, width: `${(r.muestra / max) * 100}%`, background: "var(--pulso-border-strong, #C7D0DE)", borderRadius: 3 }} />
                <div style={{ position: "absolute", bottom: 3, height: 7, left: 0, width: `${(r.ponderado / max) * 100}%`, background: "var(--pulso-primary)", borderRadius: 3 }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(r.objetivo / max) * 100}%`, width: 2, background: "var(--pulso-text)" }} />
              </div>
              <span style={{ fontSize: 12, width: 104, textAlign: "right", color: "var(--pulso-text-soft)" }}>{pct(r.muestra)} → {pct(r.ponderado)}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "var(--pulso-text-soft)" }}>
            <Legend color="var(--pulso-border-strong, #C7D0DE)" text="tu muestra" />
            <Legend color="var(--pulso-primary)" text="ponderado" />
            <Legend color="var(--pulso-text)" line text="objetivo" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 12, margin: "16px 0" }}>
            <StatCard label="muestra efectiva" value={<>{nEff} <span style={{ fontSize: 13, color: "var(--pulso-text-soft)" }}>de {d ? intfmt(d.n) : "—"}</span></>} />
            <StatCard label="efecto de diseño" value={deff} />
            <StatCard label="precisión que cedes" value={loss != null ? `${loss}%` : "—"} tone={loss != null && loss >= 25 ? "warn" : undefined} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--pulso-surface-2)", borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Limitar pesos extremos</div>
              <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
                {cap > 1 ? <>Ningún caso pesa más de <strong style={{ color: "var(--pulso-text)" }}>{cap}×</strong> el promedio. Estabiliza sin sesgar.</>
                  : "Sin recorte. Actívalo si aparecen pesos muy dispersos."}
              </div>
            </div>
            <input type="range" min={2} max={8} step={1} value={capVal} onChange={(e) => onCap(parseInt(e.target.value, 10))} style={{ width: 150 }} aria-label="Recorte de pesos extremos" />
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 26 }}>{capVal}×</span>
          </div>

          {(preview.warnings ?? []).map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 8, background: w.level === "warn" ? "var(--pulso-warning-soft, #FBF3E2)" : "var(--pulso-primary-soft)" }}>
              {w.level === "warn" ? <AlertTriangle size={16} style={{ color: "var(--pulso-warning-fg, #9A6B12)", flexShrink: 0, marginTop: 1 }} />
                : <Info size={16} style={{ color: "var(--pulso-primary)", flexShrink: 0, marginTop: 1 }} />}
              <span style={{ fontSize: 12, color: w.level === "warn" ? "var(--pulso-warning-fg, #9A6B12)" : "var(--pulso-text)" }}>{w.message}</span>
            </div>
          ))}

          <div style={{ fontSize: 11.5, color: "var(--pulso-text-soft)", marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={13} style={{ color: "var(--pulso-success-fg)" }} />
            Se aplica automáticamente a frecuencias, cruces y dimensiones. El método queda documentado en la ficha técnica.
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" }) {
  return (
    <div style={{ background: "var(--pulso-surface-2)", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: tone === "warn" ? "var(--pulso-warning-fg, #9A6B12)" : "var(--pulso-text)" }}>{value}</div>
    </div>
  );
}

function Legend({ color, text, line }: { color: string; text: string; line?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: line ? 12 : 10, height: line ? 2 : 10, borderRadius: line ? 0 : 2, background: color, display: "inline-block" }} />{text}
    </span>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", margin: "6px 2px 0", fontWeight: 600 }}>
      Paso {n} — {text}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      style={{
        width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, padding: 0,
        background: on ? "var(--pulso-primary)" : "var(--pulso-border-strong, #C7D0DE)", position: "relative",
        transition: "background 160ms",
      }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 160ms" }} />
    </button>
  );
}
