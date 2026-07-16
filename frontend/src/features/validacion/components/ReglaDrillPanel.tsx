import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Code2,
  Eye,
  EyeOff,
  Filter as FilterIcon,
  GitBranch,
  Hash,
  Info,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReglaInstrumento } from "../../../api/client";
import DrilldownTable, { formatDisplayValue } from "./DrilldownTable";

type Props = {
  regla: ReglaInstrumento;
  displayName?: string;
  casos: Array<Record<string, unknown>>;
  uuidCol: string | null;
  onToggleActiva: (activa: boolean) => Promise<void>;
  onClose: () => void;
  invalidatedHint?: string;
  surface?: "inline" | "bubble";
  /**
   * Mostrar el botón "Ignorar/Reactivar regla". Default true.
   * Se oculta en vista panorama (InstrumentoTab) — ahí sólo se explora;
   * la decisión de ignorar se toma en Limpieza.
   */
  showToggleActiva?: boolean;
  /**
   * Mostrar el botón "Cerrar" interno del header. Default true.
   * Se oculta cuando el drill se renderiza dentro de un ContextLens
   * (que ya tiene su propio X de cerrar) para no duplicar el control.
   */
  showClose?: boolean;
};

type RoleKey = "target" | "drivers" | "compare" | "gate";
type RoleTone = "target" | "drivers" | "compare" | "gate";
type RoleItem = { key: string; label: string | null; table: string | null };
type RoleSection = {
  key: RoleKey;
  title: string;
  hint: string;
  eyebrow: string;
  description: string;
  tone: RoleTone;
  Icon: LucideIcon;
  items: RoleItem[];
};

const ROLE_META: Record<RoleKey, Omit<RoleSection, "items">> = {
  target: {
    key: "target",
    title: "Respuesta que revisamos",
    hint: "Es la respuesta que esta regla evalua directamente.",
    eyebrow: "Respuesta central",
    description: "Es el dato que debe quedar correcto segun el instrumento.",
    tone: "target",
    Icon: CircleDot,
  },
  drivers: {
    key: "drivers",
    title: "Condiciones que activan esta regla",
    hint: "Son respuestas previas que hacen que esta pregunta aplique.",
    eyebrow: "Activadores",
    description: "Cuando estas respuestas se cumplen, la regla entra en juego.",
    tone: "drivers",
    Icon: GitBranch,
  },
  compare: {
    key: "compare",
    title: "Se compara con",
    hint: "Son datos o referencias que sirven para contrastar la respuesta.",
    eyebrow: "Comparacion",
    description: "Aqui vemos con que otra informacion se contrasta la respuesta.",
    tone: "compare",
    Icon: Scale,
  },
  gate: {
    key: "gate",
    title: "Condiciones heredadas",
    hint: "Vienen de la logica de la seccion o del grupo del formulario.",
    eyebrow: "Contexto",
    description: "Acompanan la regla desde la estructura del formulario.",
    tone: "gate",
    Icon: Hash,
  },
};

const ROLE_TONES: Record<RoleTone, { bg: string; fg: string; border: string }> = {
  target: {
    bg: "var(--pulso-primary-soft)",
    fg: "var(--pulso-primary)",
    border: "var(--pulso-primary-border)",
  },
  drivers: {
    bg: "var(--pulso-success-bg)",
    fg: "var(--pulso-success-fg)",
    border: "var(--pulso-border)",
  },
  compare: {
    bg: "var(--pulso-warn-bg)",
    fg: "var(--pulso-warn-fg)",
    border: "var(--pulso-border)",
  },
  gate: {
    bg: "var(--pulso-surface-2)",
    fg: "var(--pulso-text-soft)",
    border: "var(--pulso-border)",
  },
};

export default function ReglaDrillPanel({
  regla,
  displayName,
  casos,
  uuidCol,
  onToggleActiva,
  onClose,
  invalidatedHint,
  surface = "inline",
  showToggleActiva = true,
  showClose = true,
}: Props) {
  const [expandProc, setExpandProc] = useState(false);
  const [focusedVariable, setFocusedVariable] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setFocusedVariable(null);
    setExpandProc(false);
    setFilters({});
    setFiltersOpen(false);
  }, [regla.id]);

  const orderedAllVariables = useMemo(() => {
    const fromRoles = asStringArray(regla.variable_roles?.all ?? null);
    return uniqueStrings(fromRoles.length ? fromRoles : regla.variables);
  }, [regla.variable_roles, regla.variables]);

  const filterableCols = useMemo(
    () => orderedAllVariables.filter((c) => c !== uuidCol),
    [orderedAllVariables, uuidCol],
  );

  const orderedFilterableCols = useMemo(
    () => (focusedVariable ? uniqueStrings([focusedVariable, ...filterableCols]) : filterableCols),
    [focusedVariable, filterableCols],
  );

  const distinctByCol = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const col of filterableCols) {
      const seen = new Set<string>();
      for (const row of casos) {
        const value = row[col];
        if (value === null || value === undefined || value === "") continue;
        seen.add(String(value));
      }
      out[col] = Array.from(seen).sort();
    }
    return out;
  }, [casos, filterableCols]);

  const filteredCasos = useMemo(() => {
    const active = Object.entries(filters).filter(([, set]) => !!set);
    if (!active.length) return casos;
    return casos.filter((row) =>
      active.every(([col, set]) => {
        const value = row[col];
        if (value === null || value === undefined || value === "") return false;
        return set!.has(String(value));
      }),
    );
  }, [casos, filters]);

  const variableRoles = regla.variable_roles ?? null;
  const roleSections = useMemo<RoleSection[]>(() => {
    const labels = variableRoles?.labels ?? {};
    const tables = variableRoles?.tables ?? {};
    const fallbackTarget = orderedAllVariables[0] ?? null;
    const roleValues: Record<RoleKey, string[]> = {
      target: asStringArray(variableRoles?.target ?? fallbackTarget),
      drivers: asStringArray(variableRoles?.drivers ?? (!variableRoles ? orderedAllVariables.slice(1) : null)),
      compare: asStringArray(variableRoles?.compare ?? null),
      gate: asStringArray(variableRoles?.gate ?? null),
    };
    return (Object.keys(ROLE_META) as RoleKey[])
      .map((key) => ({
        ...ROLE_META[key],
        items: uniqueStrings(roleValues[key]).map((value) => ({
          key: value,
          label: labels?.[value] ?? null,
          table: tables?.[value] ?? null,
        })),
      }))
      .filter((section) => section.items.length > 0);
  }, [orderedAllVariables, variableRoles]);

  const roleByKey = useMemo(() => {
    const out = new Map<RoleKey, RoleSection>();
    for (const section of roleSections) out.set(section.key, section);
    return out;
  }, [roleSections]);

  const targetSection = roleByKey.get("target") ?? null;
  const compareSection = roleByKey.get("compare") ?? null;
  const activationSections = roleSections.filter((section) => section.key === "drivers" || section.key === "gate");
  const targetItem = targetSection?.items[0] ?? null;
  const targetLabel = targetItem?.label ?? targetItem?.key ?? null;
  const targetDisplay = targetLabel ? `«${shortRuleLabel(targetLabel)}»` : "esta respuesta";
  const gateHumano = cleanSentence(regla.presentation?.gate_humano ?? "");
  const detalleCondicion = cleanSentence(regla.presentation?.detalle_condicion ?? "");
  const plainReading = buildPlainRuleReading(regla, targetDisplay, targetItem, activationSections, compareSection);
  const heroText = plainReading.headline || buildExpectationHeadline(regla, targetDisplay);
  const technicalVariables = orderedAllVariables.length ? orderedAllVariables : uniqueStrings(regla.variables);
  const subtipoSemantico = (regla.presentation?.subtipo_semantico ?? "").toLowerCase();
  const tipoObservacion = (regla.tipo_observacion ?? "").toLowerCase();
  const hasRouteLogicSummary =
    !!targetItem &&
    filteredCasos.length > 0 &&
    (tipoObservacion.includes("skip") || subtipoSemantico === "nodebe" || subtipoSemantico === "debe");

  const selectedQuickValues = useMemo(
    () => (focusedVariable ? distinctByCol[focusedVariable] ?? [] : []),
    [focusedVariable, distinctByCol],
  );

  const preferredOrder = useMemo(
    () => uniqueStrings([uuidCol ?? "", focusedVariable ?? "", ...technicalVariables]),
    [focusedVariable, technicalVariables, uuidCol],
  );

  function toggleFilterValue(col: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      const current = next[col];
      if (!current) {
        const all = new Set(distinctByCol[col] ?? []);
        all.delete(value);
        next[col] = all;
      } else {
        const copy = new Set(current);
        if (copy.has(value)) copy.delete(value);
        else copy.add(value);
        next[col] = copy;
      }
      return next;
    });
  }

  function selectOnlyFilterValue(col: string, value: string) {
    setFilters((prev) => {
      const current = prev[col];
      if (current && current.size === 1 && current.has(value)) {
        const next = { ...prev };
        delete next[col];
        return next;
      }
      return {
        ...prev,
        [col]: new Set([value]),
      };
    });
  }

  function clearFilterCol(col: string) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
  }

  function clearAllFilters() {
    setFilters({});
  }

  function handleVariableFocus(key: string) {
    setFocusedVariable((prev) => (prev === key ? null : key));
    if (filterableCols.includes(key)) setFiltersOpen(true);
  }

  const nActiveFilters = Object.values(filters).filter((set) => !!set).length;
  const isFiltered = filteredCasos.length !== casos.length;

  return (
    <section
      style={{
        background: surface === "bubble" ? "transparent" : regla.activa ? "white" : "var(--pulso-surface-2)",
        border:
          surface === "bubble"
            ? "none"
            : `1px solid ${regla.activa ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        borderRadius: surface === "bubble" ? 26 : 10,
        boxShadow: surface === "bubble" ? "none" : "var(--pulso-shadow-low)",
        opacity: regla.activa ? 1 : 0.82,
        overflow: "hidden",
      }}
    >
      <style>
        {`
          @keyframes pulsoRuleStepIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .pulso-rule-flow-item {
            animation: pulsoRuleStepIn 360ms var(--motion-ease-out) both;
          }
          .pulso-rule-accordion {
            overflow: hidden;
            transition: max-height 220ms ease, opacity 220ms ease, margin-top 220ms ease;
          }
          .pulso-rule-info {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 999px;
            border: 1px solid var(--pulso-border);
            background: white;
            color: var(--pulso-text-soft);
            cursor: help;
            outline: none;
          }
          .pulso-rule-info:focus-visible {
            box-shadow: 0 0 0 2px var(--pulso-primary-soft);
            border-color: var(--pulso-primary-border);
          }
          .pulso-rule-info-bubble {
            position: absolute;
            left: 50%;
            top: calc(100% + 8px);
            transform: translateX(-50%) translateY(4px);
            min-width: 180px;
            max-width: 240px;
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid var(--pulso-border);
            background: white;
            color: var(--pulso-text);
            box-shadow: var(--pulso-shadow-low);
            font-size: 11px;
            font-weight: 500;
            line-height: 1.45;
            opacity: 0;
            pointer-events: none;
            z-index: 4;
            transition: opacity 160ms ease, transform 160ms ease;
          }
          .pulso-rule-info:hover .pulso-rule-info-bubble,
          .pulso-rule-info:focus-visible .pulso-rule-info-bubble,
          .pulso-rule-info:focus-within .pulso-rule-info-bubble {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          .pulso-variable-block {
            transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
            white-space: normal;
          }
          .pulso-variable-block > * {
            min-width: 0;
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: normal;
          }
          .pulso-vars-used-layout {
            display: grid;
            grid-template-columns: minmax(260px, 0.9fr) minmax(360px, 1.35fr);
            gap: 12px;
            margin-top: 8px;
            align-items: start;
          }
          .pulso-variable-block:hover,
          .pulso-variable-block:focus-visible {
            transform: translateY(-1px);
            box-shadow: var(--pulso-shadow-low);
          }
          @media (max-width: 980px) {
            .pulso-vars-used-layout {
              grid-template-columns: minmax(0, 1fr);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .pulso-rule-flow-item,
            .pulso-rule-accordion,
            .pulso-rule-info-bubble,
            .pulso-variable-block {
              animation: none !important;
              transition: none !important;
            }
          }
        `}
      </style>

      <div style={{ padding: "18px 20px 14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "var(--pulso-surface-2)",
                  color: "var(--pulso-text-soft)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {regla.id}
              </span>
              {!regla.activa && (
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "var(--pulso-warn-bg)",
                    color: "var(--pulso-warn-fg)",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Ignorada
                </span>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--pulso-text)",
                  lineHeight: 1.28,
                }}
              >
                {displayName ?? regla.nombre}
              </div>
            </div>

            {regla.nombre_tecnico && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--pulso-text-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                <Code2 size={12} />
                {regla.nombre_tecnico}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            {showToggleActiva && (
              <button
                type="button"
                onClick={() => void onToggleActiva(!regla.activa)}
                title={regla.activa ? "Ignorar esta regla en la proxima auditoria" : "Reactivar esta regla"}
                style={{
                  ...ghostButtonStyle,
                  background: regla.activa ? "white" : "var(--pulso-success-bg)",
                  color: regla.activa ? "var(--pulso-text-soft)" : "var(--pulso-success-fg)",
                }}
              >
                {regla.activa ? <EyeOff size={13} /> : <Eye size={13} />}
                {regla.activa ? "Ignorar" : "Reactivar"}
              </button>
            )}
            {showClose && (
              <button type="button" onClick={onClose} title="Cerrar drill" style={ghostButtonStyle}>
                Cerrar
              </button>
            )}
          </div>
        </div>

        {invalidatedHint && (
          <div
            style={{
              marginTop: 14,
              padding: "9px 12px",
              fontSize: 11,
              color: "var(--pulso-warn-fg)",
              background: "var(--pulso-warn-bg)",
              border: "1px solid var(--pulso-warn-border)",
              borderRadius: 8,
              lineHeight: 1.45,
            }}
          >
            {invalidatedHint}
          </div>
        )}
      </div>

      <div style={bandStyle}>
        <SectionHeading
          title="Que significa"
          subtitle="La lectura principal en palabras simples. La condicion exacta queda en detalle tecnico."
        />

        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--pulso-text)",
              lineHeight: 1.4,
              maxWidth: 980,
            }}
          >
            {heroText}
          </div>

          <PlainRuleSteps reading={plainReading} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {regla.tipo_observacion && (
              <Chip label={regla.tipo_observacion} color="primary" icon={<Check size={10} />} />
            )}
            {regla.seccion && <Chip label={regla.seccion} color="neutral" />}
            {regla.categoria && <Chip label={regla.categoria} color="neutral" />}
            {regla.tabla && regla.tabla !== "principal" && <Chip label={`Tabla ${regla.tabla}`} color="neutral" />}
            {regla.n_inconsistencias != null && (
              <Chip
                label={`${regla.n_inconsistencias} caso${regla.n_inconsistencias === 1 ? "" : "s"}`}
                color={regla.n_inconsistencias > 0 ? "warn" : "success"}
              />
            )}
          </div>
        </div>
      </div>

      <div style={bandStyle}>
        <SectionHeading
          title={hasRouteLogicSummary ? "Ruta lógica y casos detectados" : "Variables usadas"}
          subtitle={
            hasRouteLogicSummary
              ? "Condición que activa u omite la sección, variables que la deciden y evidencia encontrada."
              : "Estas preguntas ayudan a decidir si la respuesta era esperada o no."
          }
        />

        {hasRouteLogicSummary && (
          <CaseLogicSummary
            regla={regla}
            casos={filteredCasos}
            targetItem={targetItem}
            activationSections={activationSections}
          />
        )}

        {roleSections.length > 0 && !hasRouteLogicSummary && (
          <VariablesUsedLayout
            targetSection={targetSection}
            activationSections={activationSections}
            compareSection={compareSection}
            focusedVariable={focusedVariable}
            onFocusVariable={handleVariableFocus}
          />
        )}
      </div>

      <div style={bandStyle}>
        <button
          type="button"
          onClick={() => setExpandProc((open) => !open)}
          style={{
            ...sectionToggleStyle,
            color: expandProc ? "var(--pulso-primary)" : "var(--pulso-text)",
          }}
        >
          {expandProc ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Code2 size={14} />
          {expandProc ? "Ocultar detalle tecnico" : "Ver detalle tecnico"}
        </button>

        <div
          className="pulso-rule-accordion"
          style={{
            maxHeight: expandProc ? 720 : 0,
            opacity: expandProc ? 1 : 0,
            marginTop: expandProc ? 12 : 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {regla.nombre_tecnico && (
              <TechField label="Nombre tecnico">
                <code style={codeTextStyle}>{regla.nombre_tecnico}</code>
              </TechField>
            )}
            {regla.tipo_observacion && <TechField label="Tipo de observacion">{regla.tipo_observacion}</TechField>}
            {regla.categoria && <TechField label="Categoria">{regla.categoria}</TechField>}
            {regla.presentation?.subtipo_semantico && (
              <TechField label="Subtipo semantico">
                <code style={codeTextStyle}>{regla.presentation.subtipo_semantico}</code>
              </TechField>
            )}
            {gateHumano && <TechField label="Condicion humanizada">{gateHumano}</TechField>}
            {technicalVariables.length > 0 && (
              <TechField label="Vista tecnica de variables">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {technicalVariables.map((value) => (
                    <button
                      key={`tech-${value}`}
                      type="button"
                      onClick={() => handleVariableFocus(value)}
                      className="pulso-variable-block"
                      style={{
                        ...techVariableChipStyle,
                        borderColor:
                          focusedVariable === value ? "var(--pulso-primary-border)" : "var(--pulso-border)",
                        background:
                          focusedVariable === value ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
                        color: focusedVariable === value ? "var(--pulso-primary)" : "var(--pulso-text)",
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </TechField>
            )}
          </div>

          {regla.procesamiento && (
            <div style={{ marginTop: 14 }}>
              <div style={sectionMiniTitleStyle}>Expresion evaluada</div>
              <pre
                style={{
                  marginTop: 6,
                  padding: "11px 12px",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                  overflow: "auto",
                  lineHeight: 1.55,
                  maxHeight: 240,
                }}
              >
                {regla.procesamiento}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div style={bandStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <Hash size={13} color="var(--pulso-text-soft)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
            Casos detectados {isFiltered ? `(${filteredCasos.length} de ${casos.length})` : `(${casos.length})`}
          </span>
          {uuidCol && (
            <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
              UUID: {uuidCol}
            </span>
          )}

          {filterableCols.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              style={{
                marginLeft: "auto",
                fontSize: 11,
                padding: "5px 10px",
                borderRadius: 8,
                border: `1px solid ${nActiveFilters > 0 ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                background: nActiveFilters > 0 ? "var(--pulso-primary-soft)" : "white",
                color: nActiveFilters > 0 ? "var(--pulso-primary)" : "var(--pulso-text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <FilterIcon size={12} />
              {filtersOpen ? "Ocultar filtros" : "Filtros"}
              {nActiveFilters > 0 && (
                <span
                  style={{
                    background: "var(--pulso-primary)",
                    color: "white",
                    borderRadius: 999,
                    padding: "0 6px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {nActiveFilters}
                </span>
              )}
            </button>
          )}

          {nActiveFilters > 0 && (
            <button type="button" onClick={clearAllFilters} style={clearFiltersButtonStyle}>
              Limpiar
            </button>
          )}
        </div>

        {focusedVariable && selectedQuickValues.length > 0 && (
          <div
            style={{
              marginBottom: 10,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--pulso-border)",
              background: "white",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
              Sugerencia rapida para <code style={codeTextStyle}>{focusedVariable}</code>: toca un valor y dejamos la tabla enfocada en esa variable.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {selectedQuickValues.slice(0, 10).map((value) => {
                const selected = filters[focusedVariable]?.size === 1 && filters[focusedVariable]?.has(value);
                const shown = formatDisplayValue(focusedVariable, value, regla.value_labels);
                return (
                  <button
                    key={`quick-${focusedVariable}-${value}`}
                    type="button"
                    onClick={() => selectOnlyFilterValue(focusedVariable, value)}
                    style={{
                      fontSize: 10,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: `1px solid ${selected ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                      background: selected ? "var(--pulso-primary-soft)" : "white",
                      color: selected ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
                      cursor: "pointer",
                      fontFamily: "ui-monospace, monospace",
                    }}
                    title={shown.title}
                  >
                    {shown.display}
                  </button>
                );
              })}
              {selectedQuickValues.length > 10 && (
                <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", alignSelf: "center" }}>
                  +{selectedQuickValues.length - 10} valores mas
                </span>
              )}
            </div>
          </div>
        )}

        {filtersOpen && orderedFilterableCols.length > 0 && (
          <div
            style={{
              marginBottom: 10,
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--pulso-border)",
              background: "var(--pulso-surface)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {orderedFilterableCols.map((col) => {
              const distinct = distinctByCol[col] ?? [];
              if (!distinct.length) return null;
              const activeSet = filters[col];
              const allShown = !activeSet;
              const label = findRoleLabel(roleSections, col);
              const isFocused = focusedVariable === col;
              return (
                <div
                  key={col}
                  style={{
                    padding: isFocused ? "10px 10px 8px" : undefined,
                    borderRadius: isFocused ? 8 : undefined,
                    background: isFocused ? "white" : "transparent",
                    border: isFocused ? "1px solid var(--pulso-primary-border)" : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text)" }}>
                      {col}
                    </span>
                    {label && <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{label}</span>}
                    <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>
                      {distinct.length} {distinct.length === 1 ? "valor" : "valores"}
                    </span>
                    {!allShown && (
                      <button type="button" onClick={() => clearFilterCol(col)} style={tinyGhostButtonStyle}>
                        Todos
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {distinct.map((value) => {
                      const included = allShown || activeSet!.has(value);
                      const shown = formatDisplayValue(col, value, regla.value_labels);
                      return (
                        <button
                          key={`${col}-${value}`}
                          type="button"
                          onClick={() => toggleFilterValue(col, value)}
                          style={{
                            fontSize: 10,
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: `1px solid ${included ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                            background: included ? "var(--pulso-primary-soft)" : "white",
                            color: included ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
                            cursor: "pointer",
                            fontFamily: "ui-monospace, monospace",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={shown.title}
                        >
                          {shown.display}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DrilldownTable
          rows={filteredCasos}
          preferredOrder={preferredOrder}
          valueLabels={regla.value_labels}
          emptyHint={isFiltered ? "Ningun caso coincide con los filtros actuales." : "Sin casos inconsistentes."}
        />
      </div>
    </section>
  );
}

const bandStyle: React.CSSProperties = {
  padding: "16px 20px",
  borderTop: "1px solid var(--pulso-border)",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.015), transparent)",
};

const sectionMiniTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--pulso-text-soft)",
};

const ghostButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  padding: "8px 11px",
  border: "1px solid var(--pulso-border)",
  background: "white",
  borderRadius: 8,
  cursor: "pointer",
  color: "var(--pulso-text)",
};

const tinyGhostButtonStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 6,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text-soft)",
  cursor: "pointer",
};

const clearFiltersButtonStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "5px 8px",
  borderRadius: 8,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text-soft)",
  cursor: "pointer",
};

const sectionToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const codeTextStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
};

const techVariableChipStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid var(--pulso-border)",
  cursor: "pointer",
  fontFamily: "ui-monospace, monospace",
};

const logicPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minWidth: 0,
  maxWidth: "100%",
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
  fontSize: 11,
  lineHeight: 1.3,
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

const logicStepHeadingStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  fontSize: 11,
  fontWeight: 800,
  color: "var(--pulso-text)",
  textTransform: "uppercase",
  letterSpacing: 0.7,
};

const logicStepNumberStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "white",
  color: "var(--pulso-primary)",
  border: "1px solid var(--pulso-border)",
  fontSize: 11,
  fontWeight: 850,
};

const logicCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 10,
  alignItems: "start",
  minWidth: 0,
  padding: "9px 10px",
  borderRadius: 8,
  border: "1px solid var(--pulso-border)",
  background: "white",
};

const logicCodeStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  fontWeight: 850,
  color: "var(--pulso-primary)",
  paddingTop: 1,
};

const logicQuestionStyle: React.CSSProperties = {
  minWidth: 0,
  fontSize: 12,
  fontWeight: 750,
  color: "var(--pulso-text)",
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const logicMutedStyle: React.CSSProperties = {
  marginTop: 3,
  minWidth: 0,
  fontSize: 11,
  color: "var(--pulso-text-soft)",
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={sectionMiniTitleStyle}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
        {subtitle}
      </div>
    </div>
  );
}

type PlainRuleReading = {
  found: string;
  expected: string;
  reason: string;
  headline: string;
};

function PlainRuleSteps({ reading }: { reading: PlainRuleReading }) {
  const steps = [
    { title: "Se encontró", body: reading.found },
    { title: "Lo esperado", body: reading.expected },
    { title: "Por eso se marca", body: reading.reason },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 10,
        maxWidth: 980,
      }}
    >
      {steps.map((step, index) => (
        <div
          key={step.title}
          style={{
            display: "grid",
            gap: 7,
            padding: "12px 13px",
            borderRadius: 8,
            border: "1px solid var(--pulso-border)",
            background: "white",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {index + 1}
            </span>
            <span style={sectionMiniTitleStyle}>{step.title}</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--pulso-text)" }}>
            {step.body}
          </div>
        </div>
      ))}
    </div>
  );
}

function CaseLogicSummary({
  regla,
  casos,
  targetItem,
  activationSections,
}: {
  regla: ReglaInstrumento;
  casos: Array<Record<string, unknown>>;
  targetItem: RoleItem | null;
  activationSections: RoleSection[];
}) {
  if (!targetItem || !casos.length) return null;

  const tipo = (regla.tipo_observacion ?? "").toLowerCase();
  const subtipo = (regla.presentation?.subtipo_semantico ?? "").toLowerCase();
  const isSkip = tipo.includes("skip") || subtipo === "nodebe" || subtipo === "debe";
  if (!isSkip) return null;

  const driverItems = uniqueRoleItems(activationSections.flatMap((section) => section.items))
    .filter((item) => item.key !== targetItem.key)
    .slice(0, 4);
  const routeComparisons = extractRouteComparisons(regla.procesamiento ?? "", driverItems, regla.value_labels);
  const targetSummary = summarizeObservedValues(targetItem.key, casos, regla.value_labels);
  const failedComparisons = routeComparisons.filter((comparison) =>
    comparisonObservedState(comparison, casos, regla.value_labels).some((state) => !state.matches),
  );
  const driverSummaries = driverItems
    .map((item) => ({ item, summary: summarizeObservedValues(item.key, casos, regla.value_labels) }))
    .filter(({ summary }) => summary.nonEmpty > 0);

  const n = casos.length;
  const nText = `${n} caso${n === 1 ? "" : "s"}`;
  const sectionLabel = regla.seccion ?? "esta sección";
  const targetLabel = targetItem.label ? shortRuleLabel(targetItem.label, 92) : targetItem.key;
  const targetValue = targetSummary.text || "con dato registrado";
  const failedText = failedComparisons.length
    ? humanList(failedComparisons.map((comparison) => comparison.key))
    : "la ruta de entrada";
  const routeIntro = subtipo === "nodebe"
    ? `Regla aplicada: «${targetLabel}» esta dentro de ${sectionLabel}. Esa pregunta solo se puede responder si todas las condiciones de entrada de la sección se cumplen.`
    : `Regla aplicada: «${targetLabel}» esta dentro de ${sectionLabel}. Esa pregunta debe responderse cuando todas las condiciones de entrada de la sección se cumplen.`;
  const resultText = subtipo === "nodebe"
    ? `Con los valores observados, ${failedText} cierra ${sectionLabel}. Por eso ${targetItem.key} debia quedar vacio. Valor registrado: ${targetValue}.`
    : `Con los valores observados, ${sectionLabel} queda abierta. Por eso ${targetItem.key} debia tener respuesta. Valor registrado: vacio.`;

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        padding: "14px 15px",
        borderRadius: 8,
        border: "1px solid var(--pulso-warn-border)",
        background: "color-mix(in srgb, var(--pulso-warn-bg) 52%, white 48%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <GitBranch size={14} color="var(--pulso-warn-fg)" />
        <span style={sectionMiniTitleStyle}>Ruta lógica del salto</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--pulso-text)" }}>{routeIntro}</div>

      {routeComparisons.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={logicStepHeadingStyle}>
            <span style={logicStepNumberStyle}>1</span>
            <span>Condición para que la sección se muestre</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {routeComparisons.map((comparison) => (
              <RouteConditionCard
                key={`route-condition-${comparison.key}-${comparison.op}-${comparison.expectedRaw}`}
                comparison={comparison}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <div style={logicStepHeadingStyle}>
          <span style={logicStepNumberStyle}>2</span>
          <span>Qué ocurrió en los casos detectados</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
          Se detectaron {nText} con esta combinación de respuestas.
        </div>
        {routeComparisons.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {routeComparisons.map((comparison) => {
              const states = comparisonObservedState(comparison, casos, regla.value_labels);
              const matches = states.every((state) => state.matches);
              return (
                <RouteObservedCard
                  key={`route-observed-${comparison.key}-${comparison.op}-${comparison.expectedRaw}`}
                  comparison={comparison}
                  observed={summarizeObservedValues(comparison.key, casos, regla.value_labels).text}
                  matches={matches}
                  sectionLabel={sectionLabel}
                />
              );
            })}
          </div>
        ) : driverSummaries.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {driverSummaries.map(({ item, summary }) => (
              <span key={`case-summary-${item.key}`} style={logicPillStyle} title={item.label ?? item.key}>
                <code style={{ fontFamily: "ui-monospace, monospace" }}>{item.key}</code>
                <span>=</span>
                <strong>{summary.text}</strong>
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
            No se pudo reconstruir la condición legible desde la expresión técnica.
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={logicStepHeadingStyle}>
          <span style={logicStepNumberStyle}>3</span>
          <span>Resultado de validación</span>
        </div>
        <div
          style={{
            padding: "10px 11px",
            borderRadius: 8,
            background: "white",
            border: "1px solid var(--pulso-warn-border)",
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--pulso-text)",
            fontWeight: 650,
          }}
        >
          {resultText}
        </div>
      </div>
    </div>
  );
}

function RouteConditionCard({ comparison }: { comparison: RouteComparison }) {
  return (
    <div
      style={{
        ...logicCardStyle,
        background: "var(--pulso-success-bg)",
        borderColor: "color-mix(in srgb, var(--pulso-success-fg) 28%, var(--pulso-border) 72%)",
      }}
    >
      <code style={logicCodeStyle}>{comparison.key}</code>
      <div style={{ minWidth: 0 }}>
        <div style={logicQuestionStyle}>{comparison.label || comparison.key}</div>
        <div style={{ ...logicMutedStyle, color: "var(--pulso-success-fg)" }}>
          Para mostrar la sección: {conditionPhrase(comparison)}
        </div>
      </div>
    </div>
  );
}

function RouteObservedCard({
  comparison,
  observed,
  matches,
  sectionLabel,
}: {
  comparison: RouteComparison;
  observed: string;
  matches: boolean;
  sectionLabel: string;
}) {
  return (
    <div
      style={{
        ...logicCardStyle,
        borderColor: matches ? "var(--pulso-border)" : "var(--pulso-warn-border)",
        background: matches ? "var(--pulso-success-bg)" : "var(--pulso-warn-bg)",
      }}
    >
      <code style={logicCodeStyle}>{comparison.key}</code>
      <div style={{ minWidth: 0 }}>
        <div style={logicQuestionStyle}>{comparison.label || comparison.key}</div>
        <div style={logicMutedStyle}>Observado: {observed || "sin dato"}</div>
        <div style={{ ...logicMutedStyle, color: matches ? "var(--pulso-success-fg)" : "var(--pulso-warn-fg)" }}>
          {matches ? `Permite continuar hacia ${sectionLabel}.` : `Impide llegar a ${sectionLabel}.`}
        </div>
      </div>
    </div>
  );
}

function VariablesUsedLayout({
  targetSection,
  activationSections,
  compareSection,
  focusedVariable,
  onFocusVariable,
}: {
  targetSection: RoleSection | null;
  activationSections: RoleSection[];
  compareSection: RoleSection | null;
  focusedVariable: string | null;
  onFocusVariable: (key: string) => void;
}) {
  const drivers = activationSections.find((section) => section.key === "drivers") ?? null;
  const gate = activationSections.find((section) => section.key === "gate") ?? null;

  return (
    <div
      className="pulso-vars-used-layout"
      style={{
        minWidth: 0,
      }}
    >
      <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
        {targetSection && (
          <RolePanel
            section={targetSection}
            focusedVariable={focusedVariable}
            onFocusVariable={onFocusVariable}
            density="featured"
          />
        )}
        {compareSection && (
          <RolePanel
            section={compareSection}
            focusedVariable={focusedVariable}
            onFocusVariable={onFocusVariable}
            density="compact"
          />
        )}
      </div>
      <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
        {drivers && (
          <RolePanel
            section={drivers}
            focusedVariable={focusedVariable}
            onFocusVariable={onFocusVariable}
            density="compact"
          />
        )}
        {gate && (
          <RolePanel
            section={gate}
            focusedVariable={focusedVariable}
            onFocusVariable={onFocusVariable}
            density="compact"
            nested
          />
        )}
      </div>
    </div>
  );
}

function RolePanel({
  section,
  focusedVariable,
  onFocusVariable,
  density = "compact",
  nested = false,
}: {
  section: RoleSection;
  focusedVariable: string | null;
  onFocusVariable: (key: string) => void;
  density?: "compact" | "featured";
  nested?: boolean;
}) {
  const colors = ROLE_TONES[section.tone];
  const { Icon } = section;
  return (
    <div
      style={{
        display: "grid",
        gap: nested ? 8 : 10,
        padding: nested ? "10px 11px" : "12px 13px",
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: nested ? "rgba(248,250,252,0.78)" : "white",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <Icon size={13} color={colors.fg} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text)" }}>{section.title}</span>
          <InfoHint text={section.hint} />
        </div>
        <div
          style={{
            minWidth: 0,
            fontSize: 11,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.5,
            overflowWrap: "anywhere",
          }}
        >
          {section.description}
        </div>
      </div>

      <div style={{ display: "grid", gap: density === "featured" ? 8 : 7, minWidth: 0 }}>
        {section.items.map((item) => (
          <VariableBlock
            key={`${section.key}-panel-${item.key}`}
            item={item}
            tone={section.tone}
            active={focusedVariable === item.key}
            onClick={() => onFocusVariable(item.key)}
            density={density}
          />
        ))}
      </div>
    </div>
  );
}

function VariableBlock({
  item,
  tone,
  active,
  onClick,
  density,
}: {
  item: RoleItem;
  tone: RoleTone;
  active: boolean;
  onClick: () => void;
  density: "compact" | "featured";
}) {
  const colors = ROLE_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="pulso-variable-block"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 6,
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        padding: density === "featured" ? "10px 12px" : "9px 10px",
        textAlign: "left",
        borderRadius: 10,
        border: `1px solid ${active ? colors.fg : colors.border}`,
        background: active ? "white" : colors.bg,
        color: "var(--pulso-text)",
        cursor: "pointer",
        justifyItems: "start",
        justifyContent: "stretch",
        alignItems: "start",
        alignContent: "start",
        whiteSpace: "normal",
        overflow: "hidden",
      }}
      title={item.label ? `${item.key} - ${item.label}` : item.key}
      aria-pressed={active}
    >
      <code
        style={{
          minWidth: 0,
          display: "block",
          width: "100%",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          color: colors.fg,
          overflowWrap: "anywhere",
          whiteSpace: "normal",
        }}
      >
        {item.key}
      </code>
      {item.label && (
        <span
          style={{
            minWidth: 0,
            display: "block",
            width: "100%",
            fontSize: 11,
            lineHeight: 1.38,
            color: "var(--pulso-text-soft)",
            overflowWrap: "anywhere",
            wordBreak: "normal",
            whiteSpace: "normal",
            textAlign: "left",
          }}
        >
          {item.label}
        </span>
      )}
      {item.table && item.table !== "principal" && (
        <span
          style={{
            minWidth: 0,
            display: "block",
            width: "100%",
            fontSize: 10,
            color: "var(--pulso-text-soft)",
            overflowWrap: "anywhere",
            whiteSpace: "normal",
          }}
        >
          Tabla {item.table}
        </span>
      )}
    </button>
  );
}

function InfoHint({ text }: { text: string }) {
  return (
    <span className="pulso-rule-info" tabIndex={0} aria-label={text}>
      <Info size={11} />
      <span className="pulso-rule-info-bubble">{text}</span>
    </span>
  );
}

function TechField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={sectionMiniTitleStyle}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--pulso-text)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

const CHIP_COLORS: Record<string, { bg: string; fg: string }> = {
  primary: { bg: "var(--pulso-primary-soft)", fg: "var(--pulso-primary)" },
  neutral: { bg: "var(--pulso-surface-2)", fg: "var(--pulso-text-soft)" },
  warn: { bg: "var(--pulso-warn-bg)", fg: "var(--pulso-warn-fg)" },
  success: { bg: "var(--pulso-success-bg)", fg: "var(--pulso-success-fg)" },
};

function Chip({
  label,
  color = "neutral",
  icon,
}: {
  label: string;
  color?: keyof typeof CHIP_COLORS;
  icon?: React.ReactNode;
}) {
  const current = CHIP_COLORS[color];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        padding: "4px 8px",
        borderRadius: 999,
        background: current.bg,
        color: current.fg,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function asStringArray(value: string | Array<string | null> | null | undefined): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || !value.length || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function uniqueRoleItems(items: RoleItem[]): RoleItem[] {
  const out: RoleItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.key || seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

function summarizeObservedValues(
  key: string,
  rows: Array<Record<string, unknown>>,
  valueLabels?: Record<string, Record<string, string | null> | null> | null,
): { text: string; nonEmpty: number } {
  const counts = new Map<string, number>();
  let nonEmpty = 0;
  for (const row of rows) {
    const raw = row[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const formatted = formatDisplayValue(key, raw, valueLabels).display.trim();
    if (!formatted || formatted === "—") continue;
    nonEmpty += 1;
    counts.set(formatted, (counts.get(formatted) ?? 0) + 1);
  }
  const parts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([label, count]) => `${shortRuleLabel(label, 54)}${count > 1 ? ` en ${count} casos` : ""}`);
  const remaining = Math.max(0, counts.size - parts.length);
  const suffix = remaining > 0 ? ` y ${remaining} mas` : "";
  return { text: `${parts.join(", ")}${suffix}`, nonEmpty };
}

type RouteComparison = {
  key: string;
  label: string | null;
  op: "==" | "!=" | "<" | ">" | "<=" | ">=";
  expectedRaw: string;
  expectedDisplay: string;
};

function extractRouteComparisons(
  expression: string,
  items: RoleItem[],
  valueLabels?: Record<string, Record<string, string | null> | null> | null,
): RouteComparison[] {
  const itemByKey = new Map(items.map((item) => [item.key, item]));
  const keys = new Set(items.map((item) => item.key));
  if (!expression || !keys.size) return [];
  const out: RouteComparison[] = [];
  const seen = new Set<string>();
  const patterns = [
    /\$\{([A-Za-z_][\w.]*)\}\s*(==|!=|<=|>=|<|>)\s*['"]?([^'")\]&|]+)['"]?/g,
    /as\.character\(([A-Za-z_][\w.]*)\)\s*(==|!=|<=|>=|<|>)\s*['"]?([^'")\]&|]+)['"]?/g,
    /as\.numeric\(([A-Za-z_][\w.]*)\)\)\s*(==|!=|<=|>=|<|>)\s*([0-9.+-]+)/g,
    /\b([A-Za-z_][\w.]*)\b\s*(==|!=|<=|>=|<|>)\s*['"]?([^'")\]&|]+)['"]?/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(expression)) !== null) {
      const key = match[1] ?? "";
      const op = match[2] as RouteComparison["op"];
      const expectedRaw = cleanComparisonValue(match[3] ?? "");
      if (!keys.has(key) || !isMeaningfulRouteValue(expectedRaw)) continue;
      if ((op === "==" || op === "!=") && expectedRaw === "") continue;
      const id = `${key}|${op}|${expectedRaw}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        key,
        label: itemByKey.get(key)?.label ?? null,
        op,
        expectedRaw,
        expectedDisplay: formatDisplayValue(key, expectedRaw, valueLabels).display,
      });
    }
  }
  return out;
}

function isMeaningfulRouteValue(value: string): boolean {
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  if (!normalized) return false;
  if (normalized.toUpperCase() === "NA") return false;
  if (normalized.toLowerCase() === "nan") return false;
  return true;
}

function cleanComparisonValue(value: string): string {
  return value
    .replace(/[`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function conditionPhrase(comparison: RouteComparison): string {
  const value = `«${shortRuleLabel(comparison.expectedDisplay || comparison.expectedRaw, 48)}»`;
  switch (comparison.op) {
    case "==":
      return `igual a ${value}`;
    case "!=":
      return `distinto de ${value}`;
    case "<":
      return `menor que ${value}`;
    case ">":
      return `mayor que ${value}`;
    case "<=":
      return `menor o igual que ${value}`;
    case ">=":
      return `mayor o igual que ${value}`;
    default:
      return value;
  }
}

function comparisonObservedState(
  comparison: RouteComparison,
  rows: Array<Record<string, unknown>>,
  valueLabels?: Record<string, Record<string, string | null> | null> | null,
) {
  const seen = new Map<string, { label: string; matches: boolean }>();
  for (const row of rows) {
    const raw = row[comparison.key];
    if (raw === null || raw === undefined || raw === "") continue;
    const rawText = String(raw).trim();
    if (!rawText) continue;
    const label = formatDisplayValue(comparison.key, rawText, valueLabels).display;
    const matches = comparisonMatches(comparison, rawText, valueLabels);
    const id = `${rawText}|${matches}`;
    if (!seen.has(id)) {
      seen.set(id, { label, matches });
    }
  }
  return Array.from(seen.values());
}

function comparisonMatches(
  comparison: RouteComparison,
  rawValue: string,
  valueLabels?: Record<string, Record<string, string | null> | null> | null,
): boolean {
  const observed = rawValue.trim();
  const expected = comparison.expectedRaw.trim();
  if (comparison.op === "==" || comparison.op === "!=") {
    const tokens = observed.split(/\s+/).filter(Boolean);
    const observedDisplay = formatDisplayValue(comparison.key, observed, valueLabels).display.trim();
    const expectedDisplay = comparison.expectedDisplay.trim();
    const equal =
      observed === expected ||
      tokens.includes(expected) ||
      Boolean(observedDisplay && expectedDisplay && observedDisplay === expectedDisplay);
    return comparison.op === "==" ? equal : !equal;
  }
  const observedNum = Number(observed);
  const expectedNum = Number(expected);
  if (!Number.isFinite(observedNum) || !Number.isFinite(expectedNum)) return true;
  switch (comparison.op) {
    case "<":
      return observedNum < expectedNum;
    case ">":
      return observedNum > expectedNum;
    case "<=":
      return observedNum <= expectedNum;
    case ">=":
      return observedNum >= expectedNum;
    default:
      return true;
  }
}

function humanList(values: string[]): string {
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} y ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} y ${values.at(-1)}`;
}

function cleanSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildExpectationHeadline(regla: ReglaInstrumento, targetDisplay: string): string {
  const tipo = (regla.tipo_observacion ?? "").toLowerCase();
  const subtipo = (regla.presentation?.subtipo_semantico ?? "").toLowerCase();
  if (subtipo === "nodebe") {
    return `${targetDisplay} no deberia tener respuesta cuando la condicion no aplica.`;
  }
  if (subtipo === "debe") {
    return `Si se cumple la condicion, ${targetDisplay} debe registrarse.`;
  }
  if (subtipo === "req" || tipo.includes("required")) {
    return `${targetDisplay} debe responderse cuando corresponde.`;
  }
  if (tipo.includes("constraint")) {
    return `${targetDisplay} debe cumplir la condicion de consistencia definida.`;
  }
  if (tipo.includes("calculate")) {
    return `${targetDisplay} debe derivarse correctamente a partir de otras respuestas.`;
  }
  if (tipo.includes("choice")) {
    return `${targetDisplay} solo deberia mostrar opciones validas.`;
  }
  return `${targetDisplay} debe comportarse como espera el instrumento.`;
}

function buildPlainRuleReading(
  regla: ReglaInstrumento,
  targetDisplay: string,
  targetItem: RoleItem | null,
  activationSections: RoleSection[],
  compareSection: RoleSection | null,
): PlainRuleReading {
  const tipo = (regla.tipo_observacion ?? "").toLowerCase();
  const subtipo = (regla.presentation?.subtipo_semantico ?? "").toLowerCase();
  const isOtherText = isSyntheticOtherTarget(targetItem);
  const otherChoice = choiceLabelForSyntheticOther(regla, targetItem);
  const parentLabel = parentLabelForSyntheticOther(regla, targetItem, activationSections);
  const otherChoiceDisplay = otherChoice ? `«${shortRuleLabel(otherChoice, 58)}»` : "la opcion Otro/Other";
  const otherParentDisplay = parentLabel ? ` en «${shortRuleLabel(parentLabel, 82)}»` : " en su pregunta principal";
  const hasRouteVariables = activationSections.some((section) => section.items.length > 0) ||
    Boolean(compareSection?.items.length);

  if (subtipo === "nodebe") {
    return {
      headline: isOtherText
        ? `${targetDisplay} solo debe tener texto cuando se eligio ${otherChoiceDisplay}${otherParentDisplay}.`
        : `${targetDisplay} no deberia tener respuesta si la pregunta no correspondia.`,
      found: `Hay una respuesta guardada en ${targetDisplay}.`,
      expected: isOtherText
        ? `${targetDisplay} debe quedar vacio si no se eligio ${otherChoiceDisplay}${otherParentDisplay} o si el salto ocultaba esa pregunta.`
        : `Si el salto del formulario no llevaba a esta pregunta, ${targetDisplay} debia quedar vacio.`,
      reason: hasRouteVariables
        ? "La ruta esperada del formulario no activaba esta pregunta para ese caso. Las preguntas usadas para decidirlo aparecen abajo."
        : "La ruta esperada del formulario no activaba esta pregunta para ese caso.",
    };
  }

  if (subtipo === "debe" || subtipo === "req" || tipo.includes("required")) {
    return {
      headline: `${targetDisplay} debia responderse y quedo vacio.`,
      found: `No hay respuesta registrada en ${targetDisplay}.`,
      expected: `Cuando la ruta del formulario llega a esta pregunta, ${targetDisplay} debe tener respuesta.`,
      reason: hasRouteVariables
        ? "La pregunta correspondia para ese caso. Las preguntas usadas para decidirlo aparecen abajo."
        : "La pregunta correspondia para ese caso.",
    };
  }

  if (tipo.includes("constraint")) {
    return {
      headline: `${targetDisplay} no cumple una condicion de consistencia.`,
      found: `La respuesta registrada en ${targetDisplay} existe, pero no pasa la regla del instrumento.`,
      expected: `${targetDisplay} debe respetar la condicion definida en el XLSForm.`,
      reason: "El valor observado queda fuera de lo que el formulario considera valido.",
    };
  }

  if (tipo.includes("choice")) {
    return {
      headline: `${targetDisplay} usa una opcion que no coincide con el catalogo esperado.`,
      found: `Hay un valor en ${targetDisplay} que no calza con sus opciones permitidas.`,
      expected: `${targetDisplay} debe usar los codigos y etiquetas del XLSForm.`,
      reason: "El dato no coincide con el catalogo final del instrumento.",
    };
  }

  return {
    headline: `${targetDisplay} debe comportarse como espera el instrumento.`,
    found: `Se encontró un caso llamativo en ${targetDisplay}.`,
    expected: "La respuesta debe coincidir con la regla definida en el formulario.",
    reason: "El dato no coincide con la condicion esperada por el instrumento.",
  };
}

function isSyntheticOtherTarget(item: RoleItem | null): boolean {
  const key = (item?.key ?? "").toLowerCase();
  const label = (item?.label ?? "").toLowerCase();
  return /(^|[_./-])other$/.test(key) || /\b(other|otro|otros|especificar)\b/.test(label);
}

function choiceLabelForSyntheticOther(regla: ReglaInstrumento, item: RoleItem | null): string | null {
  const fromContext = regla.other_context?.choice_label?.trim();
  if (fromContext) return stripTrailingPunctuation(fromContext);
  const label = item?.label?.trim();
  return label ? stripTrailingPunctuation(label) : null;
}

function parentLabelForSyntheticOther(
  regla: ReglaInstrumento,
  item: RoleItem | null,
  sections: RoleSection[],
): string | null {
  const fromContext = regla.other_context?.parent_label?.trim();
  if (fromContext) return fromContext;
  const key = item?.key ?? "";
  const parentKey = key.replace(/([_./-])other$/i, "");
  if (!parentKey || parentKey === key) return null;
  for (const section of sections) {
    const match = section.items.find((candidate) => candidate.key === parentKey);
    if (match) return match.label ?? match.key;
  }
  return null;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[:：;,.]+$/g, "").trim();
}

function shortRuleLabel(label: string, max = 92): string {
  const clean = label.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}...`;
}

function findRoleLabel(sections: RoleSection[], key: string): string | null {
  for (const section of sections) {
    const match = section.items.find((item) => item.key === key);
    if (match) return match.label ?? null;
  }
  return null;
}
