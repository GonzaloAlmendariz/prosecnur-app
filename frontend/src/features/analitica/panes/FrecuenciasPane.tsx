import { useEffect, useMemo, useState } from "react";
import { ArrowDown01, ArrowUp01, BarChart2, ListOrdered, Hash, Plus, X } from "lucide-react";
import {
  apiAnaliticaDetectSecciones,
  apiAnaliticaFrecuencias,
  apiAnaliticaVariables,
  VariableInstrumento,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore, SeccionConfig } from "../store";
import { VariableSelect } from "../VariableSelect";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

// FrecuenciasPane — rediseñado.
// 1. Estructura del reporte: secciones a incluir, con editor inline.
// 2. Variables numéricas: resumen estadístico en vez de tabla.
// 3. Presentación: orden de respuestas + mostrar categorías vacías.
// 4. Generar.

export function FrecuenciasPane() {
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const setFrec = useAnaliticaStore((s) => s.setFrecuencias);
  const setSecciones = useAnaliticaStore((s) => s.setSecciones);
  const hydrated = useAnaliticaStore((s) => s.hydrated);
  const run = useReporteRun();

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  const [detectBusy, setDetectBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        setVariables(r.variables);
      } catch {/* no-op */}
    })();
  }, []);

  // Primera carga: si el store no tiene secciones, detectarlas
  // automáticamente al montar el pane (misma UX que antes vivía en
  // PrepararPane → SeccionesEditor).
  useEffect(() => {
    if (!hydrated || secciones.length > 0 || detectBusy) return;
    void detectar({ silencioso: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  async function detectar(opts: { silencioso?: boolean } = {}) {
    setDetectBusy(true);
    try {
      const r = await apiAnaliticaDetectSecciones();
      const byIdManual = new Map(
        secciones.filter((s) => s.manual).map((s) => [s.id, s]),
      );
      const merged: SeccionConfig[] = r.secciones.map((d, i) => {
        const prior = byIdManual.get(d.id);
        if (prior) return { ...prior, variables: d.variables, orden: prior.orden ?? i };
        return { ...d, orden: i, manual: false };
      });
      const detectedIds = new Set(r.secciones.map((d) => d.id));
      const orphans = secciones.filter((s) => s.manual && !detectedIds.has(s.id));
      setSecciones([...merged, ...orphans].map((s, i) => ({ ...s, orden: i })));
    } catch (e) {
      if (!opts.silencioso) run.clearError();
      console.error(e);
    } finally {
      setDetectBusy(false);
    }
  }

  async function onGenerate() {
    await run.runSync(() => apiAnaliticaFrecuencias());
  }

  // Numéricas: override local o global.
  const numericas = frec.numericas_override ?? numericasGlobal;
  function addNumerica(v: string) {
    if (!v || numericas.includes(v)) return;
    setFrec({ numericas_override: [...numericas, v] });
  }
  function removeNumerica(v: string) {
    setFrec({ numericas_override: numericas.filter((x) => x !== v) });
  }

  const seccionesVisibles = secciones.filter((s) => !s.oculto);
  const selected = new Set(frec.secciones_activas);
  const todasActivas = frec.secciones_activas.length === 0;
  const nSeccionesActivas = todasActivas ? seccionesVisibles.length : frec.secciones_activas.length;
  const nVariablesAfectadas = (todasActivas ? seccionesVisibles : seccionesVisibles.filter((s) => selected.has(s.id)))
    .reduce((sum, s) => sum + s.variables.length, 0);

  function toggleSeccion(id: string) {
    if (todasActivas) {
      setFrec({ secciones_activas: seccionesVisibles.filter((s) => s.id !== id).map((s) => s.id) });
      return;
    }
    const next = selected.has(id)
      ? frec.secciones_activas.filter((x) => x !== id)
      : [...frec.secciones_activas, id];
    const allIds = seccionesVisibles.map((s) => s.id);
    const allSelected = allIds.every((x) => next.includes(x));
    setFrec({ secciones_activas: allSelected ? [] : next });
  }

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><BarChart2 size={16} /> Frecuencias</span>}
      hint="Tablas univariadas estilo SPSS, una por variable, agrupadas según la estructura del instrumento. Ideal para revisar distribuciones rápidas."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* 1. Estructura del reporte */}
        <Section
          title="1. Estructura del reporte"
          subtitle={<>
            Las <strong>secciones</strong> del instrumento son los agrupadores del Excel: cada una aparece como una pestaña o bloque con sus variables. Se detectan automáticamente desde los <code>begin_group</code> del XLSForm y las puedes ajustar a tu criterio.
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
                <strong style={{ color: "var(--pulso-text)" }}>{nSeccionesActivas}</strong> de {seccionesVisibles.length} {seccionesVisibles.length === 1 ? "sección" : "secciones"} activas
                {" · "}
                <strong style={{ color: "var(--pulso-text)" }}>{nVariablesAfectadas}</strong> variables en el reporte
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setFrec({ secciones_activas: [] })}
                disabled={todasActivas}
                style={{ fontSize: 11, padding: "3px 10px" }}
                title="Incluir todas las secciones"
              >
                Activar todas
              </button>
              <button
                type="button"
                onClick={() => detectar()}
                disabled={detectBusy}
                style={{ fontSize: 11, padding: "3px 10px" }}
                title="Re-detectar desde el XLSForm (preserva renames manuales)"
              >
                {detectBusy ? "Detectando…" : "Detectar de nuevo"}
              </button>
            </div>

            {seccionesVisibles.length === 0 ? (
              <div style={{ padding: 14, border: "1px dashed var(--pulso-border)", borderRadius: 6, textAlign: "center", fontSize: 12, color: "var(--pulso-text-soft)" }}>
                No hay secciones detectadas. Intenta <strong>Detectar de nuevo</strong>.
              </div>
            ) : (
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 4,
                maxHeight: 220, overflowY: "auto",
                border: "1px solid var(--pulso-border)", borderRadius: 6,
                padding: 8, background: "white",
                scrollbarWidth: "thin", scrollbarColor: "var(--pulso-border) transparent",
              }}>
                {seccionesVisibles.map((s) => {
                  const active = todasActivas || selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSeccion(s.id)}
                      title={`${s.variables.length} variables`}
                      style={{
                        fontSize: 11, padding: "5px 10px", borderRadius: 999,
                        border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                        background: active ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
                        color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
                        cursor: "pointer", whiteSpace: "nowrap",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.nombre}</span>
                      <span style={{ opacity: 0.6, fontSize: 10 }}>{s.variables.length}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
              Para renombrar, fusionar u ocultar secciones estructuralmente, usa el editor completo (próximamente). Por ahora puedes <em>activar/desactivar</em> clickeando los chips.
            </div>
          </div>
        </Section>

        {/* 2. Variables numéricas */}
        <Section
          title="2. Variables con resumen numérico"
          subtitle={<>
            Las variables marcadas aquí se muestran con <strong>media, desviación, mínimo, máximo y percentiles</strong> en lugar de una tabla de frecuencias. Útil para edades, ingresos, tiempos de espera, etc.
          </>}
        >
          <NumericasPicker
            numericas={numericas}
            variables={variables}
            onAdd={addNumerica}
            onRemove={removeNumerica}
          />
        </Section>

        {/* 3. Presentación */}
        <Section
          title="3. Presentación"
          subtitle="Cómo se ordenan las respuestas dentro de cada tabla del reporte."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Orden de respuestas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(
                  [
                    { k: "desc", label: "Más frecuente arriba", icon: <ArrowDown01 size={12} /> },
                    { k: "asc", label: "Menos frecuente arriba", icon: <ArrowUp01 size={12} /> },
                    { k: "original", label: "Orden del instrumento", icon: <ListOrdered size={12} /> },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setFrec({ orden: o.k })}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 6,
                      border: `1px solid ${frec.orden === o.k ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                      background: frec.orden === o.k ? "var(--pulso-primary-soft)" : "white",
                      color: frec.orden === o.k ? "var(--pulso-primary)" : "var(--pulso-text)",
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {o.icon}
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={frec.mostrar_todo}
                onChange={(e) => setFrec({ mostrar_todo: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 500 }}>Mostrar todas las categorías declaradas</div>
                <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
                  Incluye las opciones del instrumento aunque no haya respuestas para ellas. Útil para reportes comparables entre olas.
                </div>
              </div>
            </label>
          </div>
        </Section>

        {/* 4. Generar */}
        <GenerateFooter
          label="Generar frecuencias"
          busy={run.busy}
          fileId={run.fileId}
          downloadName="frecuencias.xlsx"
          error={run.error}
          onGenerate={onGenerate}
          disabled={nVariablesAfectadas === 0}
          disabledHint={nVariablesAfectadas === 0 ? "Activa al menos una sección para habilitar el botón." : undefined}
        />
      </div>
    </Panel>
  );
}

// -- Numéricas picker -------------------------------------------------------

function NumericasPicker({
  numericas, variables, onAdd, onRemove,
}: {
  numericas: string[];
  variables: VariableInstrumento[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pendingVar, setPendingVar] = useState("");

  // Sugerencias automáticas: variables tipo integer del instrumento que
  // aún no están en el bucket de numéricas.
  const sugeridas = useMemo(() => {
    return variables
      .filter((v) => v.tipo === "integer" || v.tipo === "decimal")
      .filter((v) => !numericas.includes(v.name))
      .slice(0, 6);
  }, [variables, numericas]);

  function commitAdd() {
    if (pendingVar && !numericas.includes(pendingVar)) {
      onAdd(pendingVar);
    }
    setPendingVar("");
    setAdding(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {numericas.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Aún no hay variables marcadas como numéricas.
        </div>
      )}
      {numericas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {numericas.map((v) => {
            const meta = variables.find((x) => x.name === v);
            return (
              <span
                key={v}
                title={meta?.label}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 4px 3px 10px", borderRadius: 999,
                  background: "var(--pulso-primary-soft)",
                  border: "1px solid var(--pulso-primary)",
                  fontSize: 11, fontFamily: "monospace", color: "var(--pulso-primary)",
                }}
              >
                <Hash size={10} />
                {v}
                <button
                  type="button"
                  onClick={() => onRemove(v)}
                  className="pulso-icon"
                  aria-label={`Quitar ${v}`}
                  style={{ minWidth: 16, minHeight: 16 }}
                >
                  <X size={10} />
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
              variables={variables.filter((v) => !numericas.includes(v.name))}
              value={pendingVar}
              onChange={setPendingVar}
              placeholder="Seleccionar variable numérica…"
            />
          </div>
          <button
            type="button"
            className="pulso-primary"
            onClick={commitAdd}
            disabled={!pendingVar}
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setPendingVar(""); }}
            style={{ fontSize: 12, padding: "6px 10px" }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={12} /> Añadir variable numérica
          </button>
          {sugeridas.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginLeft: 4 }}>
                sugerencias:
              </span>
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
