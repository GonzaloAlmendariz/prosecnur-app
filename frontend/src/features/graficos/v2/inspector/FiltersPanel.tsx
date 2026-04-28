import { useMemo, useState } from "react";
import { Filter as FilterIcon, Plus, X, ChevronDown, Sliders, Sparkles } from "lucide-react";
import { ArgMetadata, GraficadorRef, Slide, VarInfo } from "../../../../api/client";
import { usePlanStore } from "../../store";
import { ArgGroup } from "../../ArgGroup";
import GraficadorSlot from "../../GraficadorSlot";
import { groupArgs } from "./InspectorV2";

// Tab de Filtros. Diseño:
//
//   1. Motor de filtros estilo "explorador de datos": chips con condiciones
//      sobre variables del instrumento (ej. `sexo == "Mujer"` AND
//      `edad > 30`). Cada filtro se aplica al subconjunto de respuestas
//      que el slide consume. Esto se persiste como `args.filtros` en
//      cada slot de graficador (formato canónico de prosecnur).
//
//   2. Args específicos del slide en grupos `filtro` (umbrales, top2box,
//      decimales) + `semaforo` (rangos de color por valor).
//
// El motor de filtros aquí es una UI sobre el array
// `graf.args.filtros: { var, op, value }[]` que el backend interpreta.

type FilterRule = {
  id: string;
  variable: string;
  op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "notin" | "contains";
  value: string;
};

const OPERATORS: { key: FilterRule["op"]; label: string; hint: string }[] = [
  { key: "eq",       label: "= igual",          hint: "var = valor" },
  { key: "neq",      label: "≠ distinto",       hint: "var ≠ valor" },
  { key: "gt",       label: "> mayor que",      hint: "numérico" },
  { key: "lt",       label: "< menor que",      hint: "numérico" },
  { key: "gte",      label: "≥ mayor o igual",  hint: "numérico" },
  { key: "lte",      label: "≤ menor o igual",  hint: "numérico" },
  { key: "in",       label: "en (lista)",       hint: "var ∈ [a, b, c]" },
  { key: "notin",    label: "no en",            hint: "var ∉ [a, b, c]" },
  { key: "contains", label: "contiene",         hint: "texto" },
];

export type FiltersPanelProps = {
  slide: Slide;
  args: ArgMetadata[];
  variables: VarInfo[];
  slotNames: string[];
};

function newRule(): FilterRule {
  return { id: `f-${Math.random().toString(36).slice(2, 8)}`, variable: "", op: "eq", value: "" };
}

export function FiltersPanel({ slide, args, variables, slotNames }: FiltersPanelProps) {
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);

  // Cargar filtros existentes desde el primer slot poblado (todos los
  // slots del slide comparten el mismo dataset, por lo que aplicamos los
  // mismos filtros a todos al guardar).
  const existingFilters = useMemo<FilterRule[]>(() => {
    for (const slot of slotNames) {
      const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
      const f = v?.args?.["filtros"];
      if (Array.isArray(f) && f.length > 0) {
        return f.map((r, i) => {
          const obj = r as Record<string, unknown>;
          return {
            id: typeof obj.id === "string" ? (obj.id as string) : `f-restored-${i}`,
            variable: typeof obj.variable === "string" ? (obj.variable as string) : "",
            op: (typeof obj.op === "string" ? (obj.op as FilterRule["op"]) : "eq"),
            value: typeof obj.value === "string" ? (obj.value as string) : String(obj.value ?? ""),
          };
        });
      }
    }
    return [];
  }, [slide.payload, slotNames]);

  const [rules, setRules] = useState<FilterRule[]>(existingFilters);

  // Sync local state cuando el slide cambia (selección de otro slide)
  const slideId = slide.id;
  const lastSlideRef = useState({ id: slideId })[0];
  if (lastSlideRef.id !== slideId) {
    lastSlideRef.id = slideId;
    setRules(existingFilters);
  }

  function commit(next: FilterRule[]) {
    setRules(next);
    // Persistir al payload de cada slot. Si el slide no tiene slots,
    // guardamos en payload.filtros directamente (slides estructurales).
    if (slotNames.length === 0) {
      updatePayload(slide.id, { filtros: next });
      return;
    }
    for (const slot of slotNames) {
      const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
      if (!v) continue;
      updateSlotArgs(slide.id, slot, { filtros: next });
    }
  }

  function addRule() { commit([...rules, newRule()]); }
  function updateRule(id: string, patch: Partial<FilterRule>) {
    commit(rules.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  function removeRule(id: string) { commit(rules.filter((r) => r.id !== id)); }
  function clearAll() {
    if (rules.length === 0) return;
    if (!window.confirm(`¿Eliminar los ${rules.length} filtro(s) activos de este slide?`)) return;
    commit([]);
  }

  // Args agrupados por grupo (filtro, semaforo)
  const grouped = groupArgs(args);

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Motor de filtros */}
      <section className="pulso-gv2-filters-section">
        <div className="pulso-gv2-filters-head">
          <span className="pulso-gv2-filters-title">
            <FilterIcon size={14} /> Motor de filtros
          </span>
          <span className="pulso-gv2-filters-count">
            {rules.length === 0 ? "Sin filtros" : `${rules.length} filtro${rules.length === 1 ? "" : "s"} activo${rules.length === 1 ? "" : "s"}`}
          </span>
          {rules.length > 0 && (
            <button type="button" className="pulso-gv2-filters-clear" onClick={clearAll}>
              <X size={11} /> Limpiar
            </button>
          )}
        </div>
        <div className="pulso-gv2-filters-hint">
          Reduce las respuestas que el slide consume. Las reglas se combinan con <strong>AND</strong>.
          {slotNames.length > 1 && " Aplican a todos los gráficos del slide."}
        </div>

        {rules.length === 0 ? (
          <div className="pulso-gv2-filters-empty">
            <FilterIcon size={20} />
            <div className="pulso-gv2-filters-empty-text">
              Sin filtros. El slide usa <strong>todas las respuestas</strong> de la base.
            </div>
            <button type="button" className="pulso-gv2-filters-add-cta" onClick={addRule}>
              <Plus size={12} /> Añadir primer filtro
            </button>
          </div>
        ) : (
          <div className="pulso-gv2-filters-list">
            {rules.map((rule, i) => (
              <FilterRow
                key={rule.id}
                rule={rule}
                index={i}
                variables={variables}
                onUpdate={(patch) => updateRule(rule.id, patch)}
                onRemove={() => removeRule(rule.id)}
              />
            ))}
            <button type="button" className="pulso-gv2-filters-add-row" onClick={addRule}>
              <Plus size={12} /> Añadir condición
            </button>
          </div>
        )}
      </section>

      {/* Args de cálculo del SLIDE (top2box global, etc.) */}
      {grouped.length > 0 && (
        <section className="pulso-gv2-filters-section">
          <div className="pulso-gv2-filters-head">
            <span className="pulso-gv2-filters-title">
              <Sliders size={14} /> Ajustes globales del slide
            </span>
          </div>
          <div className="pulso-gv2-filters-hint">
            Aplica a todos los gráficos del slide. Para ajustes individuales, usa cada sub-card de abajo.
          </div>
          {grouped.map(({ grupo, args: gargs }) => (
            <ArgGroup
              key={grupo}
              grupo={grupo}
              args={gargs}
              values={slide.payload}
              onChangeArg={(name, value) => updatePayload(slide.id, { [name]: value })}
              variables={variables}
            />
          ))}
        </section>
      )}

      {/* Sub-cards por slot — args de filtro/semáforo de cada graficador */}
      {slotNames.length > 0 && (
        <section className="pulso-gv2-filters-section">
          <div className="pulso-gv2-filters-head">
            <span className="pulso-gv2-filters-title">
              <Sparkles size={14} /> Cálculo y semáforo por gráfico
            </span>
          </div>
          <div className="pulso-gv2-filters-hint">
            Umbrales, decimales, top-2-box, semáforo de colores. Cada gráfico se ajusta individualmente.
          </div>
          {slotNames.map((slotName) => (
            <GraficadorSlot
              key={slotName}
              slideId={slide.id}
              slotName={slotName}
              value={(slide.payload as Record<string, unknown>)[slotName] as never}
              mode="filters"
            />
          ))}
        </section>
      )}

      {grouped.length === 0 && rules.length === 0 && slotNames.length === 0 && (
        <div style={{ marginTop: 12, padding: 16, fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center", border: "1px dashed var(--pulso-border)", borderRadius: 8 }}>
          Este tipo de slide no consume datos — los filtros no aplican.
        </div>
      )}
    </div>
  );
}


// --- Sub-componente: una fila de regla -----------------------------------

function FilterRow({ rule, index, variables, onUpdate, onRemove }: {
  rule: FilterRule;
  index: number;
  variables: VarInfo[];
  onUpdate: (patch: Partial<FilterRule>) => void;
  onRemove: () => void;
}) {
  const [varOpen, setVarOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);

  const selectedVar = variables.find((v) => v.name === rule.variable);
  const opLabel = OPERATORS.find((o) => o.key === rule.op)?.label ?? rule.op;

  return (
    <div className="pulso-gv2-filter-row">
      <span className="pulso-gv2-filter-row-conn">
        {index === 0 ? "DONDE" : "Y"}
      </span>

      {/* Variable picker */}
      <div className="pulso-gv2-filter-cell" style={{ flex: 2 }}>
        <button
          type="button"
          className="pulso-gv2-filter-cell-btn"
          onClick={() => setVarOpen((o) => !o)}
        >
          <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedVar ? (
              <>
                <strong>{selectedVar.name}</strong>{selectedVar.label ? ` — ${selectedVar.label}` : ""}
              </>
            ) : (
              <span style={{ color: "var(--pulso-text-soft)" }}>Variable…</span>
            )}
          </span>
          <ChevronDown size={11} />
        </button>
        {varOpen && (
          <div className="pulso-gv2-filter-cell-popup" role="menu">
            <input
              type="text"
              className="pulso-gv2-popover-search"
              placeholder="Buscar variable…"
              autoFocus
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                const items = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button[data-var]");
                items?.forEach((btn) => {
                  const v = (btn.dataset.var ?? "").toLowerCase();
                  const l = (btn.dataset.label ?? "").toLowerCase();
                  btn.style.display = v.includes(q) || l.includes(q) ? "" : "none";
                });
              }}
            />
            <div className="pulso-gv2-popover-list">
              {variables.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  data-var={v.name}
                  data-label={v.label}
                  className={`pulso-gv2-popover-item ${v.name === rule.variable ? "is-selected" : ""}`}
                  onClick={() => { onUpdate({ variable: v.name }); setVarOpen(false); }}
                >
                  <span style={{ fontWeight: 600 }}>{v.name}</span>
                  {v.label && <span style={{ color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 6 }}>{v.label}</span>}
                  <span className="pulso-gv2-popover-item-meta">{v.tipo}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Operator picker */}
      <div className="pulso-gv2-filter-cell" style={{ flex: 1.2 }}>
        <button
          type="button"
          className="pulso-gv2-filter-cell-btn"
          onClick={() => setOpOpen((o) => !o)}
        >
          <span>{opLabel}</span>
          <ChevronDown size={11} />
        </button>
        {opOpen && (
          <div className="pulso-gv2-filter-cell-popup" role="menu">
            <div className="pulso-gv2-popover-list">
              {OPERATORS.map((op) => (
                <button
                  key={op.key}
                  type="button"
                  className={`pulso-gv2-popover-item ${op.key === rule.op ? "is-selected" : ""}`}
                  onClick={() => { onUpdate({ op: op.key }); setOpOpen(false); }}
                >
                  <span style={{ fontWeight: 600 }}>{op.label}</span>
                  <span className="pulso-gv2-popover-item-meta">{op.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Value input */}
      <input
        type="text"
        className="pulso-gv2-filter-cell-input"
        placeholder={rule.op === "in" || rule.op === "notin" ? "valor1, valor2…" : "valor"}
        value={rule.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        style={{ flex: 1.5 }}
      />

      <button
        type="button"
        className="pulso-gv2-filter-row-remove"
        onClick={onRemove}
        title="Eliminar esta regla"
        aria-label="Eliminar regla"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// re-export para evitar warnings de unused
