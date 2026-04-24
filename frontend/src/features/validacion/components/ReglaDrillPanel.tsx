import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
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
import DrilldownTable from "./DrilldownTable";

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
  const targetDisplay = targetLabel ? `«${targetLabel}»` : "esta respuesta";
  const gateHumano = cleanSentence(regla.presentation?.gate_humano ?? "");
  const detalleCondicion = cleanSentence(regla.presentation?.detalle_condicion ?? "");
  const heroText = buildExpectationHeadline(regla, targetDisplay);
  const objectiveText = cleanSentence(regla.objetivo ?? "") || heroText;
  const activationSummary =
    gateHumano ||
    buildActivationSummary(activationSections) ||
    "Esta revision aplica cada vez que la pregunta entra en juego.";
  const compareSummary =
    detalleCondicion ||
    buildCompareSummary(compareSection) ||
    "La respuesta se revisa contra una condicion adicional del instrumento.";
  const showCompareBlock = Boolean((compareSection?.items.length ?? 0) > 0 || detalleCondicion);
  const compareBlockTitle =
    (regla.presentation?.subtipo_semantico ?? "").toLowerCase() === "nodebe"
      ? "Y NO DEBERIA PASAR"
      : "SE CONTRASTA CON";
  const technicalVariables = orderedAllVariables.length ? orderedAllVariables : uniqueStrings(regla.variables);

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
            animation: pulsoRuleStepIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
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
          }
          .pulso-variable-block:hover,
          .pulso-variable-block:focus-visible {
            transform: translateY(-1px);
            box-shadow: var(--pulso-shadow-low);
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
          title="Que valida esta regla"
          subtitle="Una lectura corta para entender que espera el instrumento antes de mirar el detalle."
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

          {detalleCondicion && detalleCondicion !== objectiveText && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--pulso-border)",
                background: "white",
                fontSize: 12,
                color: "var(--pulso-text-soft)",
                lineHeight: 1.5,
                maxWidth: 980,
              }}
            >
              <Info size={13} />
              <span>{detalleCondicion}</span>
            </div>
          )}

          <div style={{ fontSize: 13, color: "var(--pulso-text)", lineHeight: 1.6, maxWidth: 980 }}>
            {objectiveText || <em style={{ color: "var(--pulso-text-soft)" }}>Sin explicacion narrativa definida.</em>}
          </div>

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
          title="Como funciona"
          subtitle="Primero miramos cuando aplica la regla y despues que respuesta espera encontrar."
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
          <LogicCard
            title={activationSections.length > 0 || gateHumano ? "SI" : "SIEMPRE"}
            summary={activationSummary}
            tone={activationSections.length > 0 || gateHumano ? "drivers" : "gate"}
            delay={0}
          >
            {activationSections.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {activationSections.map((section) => (
                  <RoleInlineGroup
                    key={section.key}
                    section={section}
                    focusedVariable={focusedVariable}
                    onFocusVariable={handleVariableFocus}
                  />
                ))}
              </div>
            ) : (
              <EmptyFlowText text="No hay condiciones previas visibles: esta revision se entiende como parte natural del flujo del formulario." />
            )}
          </LogicCard>

          <FlowConnector label="entonces" delay={90} />

          <LogicCard title="ENTONCES" summary={heroText} tone="target" delay={150}>
            {targetSection?.items.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {targetSection.items.map((item) => (
                  <VariableBlock
                    key={`target-${item.key}`}
                    item={item}
                    tone="target"
                    active={focusedVariable === item.key}
                    onClick={() => handleVariableFocus(item.key)}
                  />
                ))}
              </div>
            ) : (
              <EmptyFlowText text="No hay variable objetivo mapeada en el detalle tecnico de esta regla." />
            )}
          </LogicCard>

          {showCompareBlock && (
            <>
              <FlowConnector label="y se verifica" delay={210} />
              <LogicCard title={compareBlockTitle} summary={compareSummary} tone="compare" delay={270}>
                {compareSection?.items.length ? (
                  <RoleInlineGroup
                    section={compareSection}
                    focusedVariable={focusedVariable}
                    onFocusVariable={handleVariableFocus}
                    compact
                  />
                ) : (
                  <EmptyFlowText text={compareSummary} />
                )}
              </LogicCard>
            </>
          )}
        </div>

        {objectiveText && objectiveText !== heroText && (
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--pulso-text-soft)",
              maxWidth: 980,
            }}
          >
            {objectiveText}
          </div>
        )}

        {roleSections.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={sectionMiniTitleStyle}>Variables que intervienen</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
                marginTop: 8,
              }}
            >
              {roleSections.map((section) => (
                <RolePanel
                  key={section.key}
                  section={section}
                  focusedVariable={focusedVariable}
                  onFocusVariable={handleVariableFocus}
                />
              ))}
            </div>
          </div>
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
                    title={value}
                  >
                    {value}
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
                          title={value}
                        >
                          {value}
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

function LogicCard({
  title,
  summary,
  tone,
  delay,
  children,
}: {
  title: string;
  summary: string;
  tone: RoleTone;
  delay: number;
  children: React.ReactNode;
}) {
  const colors = ROLE_TONES[tone];
  return (
    <div
      className="pulso-rule-flow-item"
      style={{
        flex: "1 1 250px",
        minWidth: 240,
        padding: "12px 13px",
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        display: "grid",
        gap: 10,
        alignContent: "start",
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: colors.fg,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pulso-text)", lineHeight: 1.5 }}>
          {summary}
        </div>
      </div>
      {children}
    </div>
  );
}

function FlowConnector({ label, delay }: { label: string; delay: number }) {
  return (
    <div
      className="pulso-rule-flow-item"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minWidth: 66,
        color: "var(--pulso-text-soft)",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.3,
        animationDelay: `${delay}ms`,
      }}
    >
      <ArrowRight size={15} />
      <span>{label}</span>
    </div>
  );
}

function EmptyFlowText({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--pulso-text-soft)" }}>
      {text}
    </div>
  );
}

function RoleInlineGroup({
  section,
  focusedVariable,
  onFocusVariable,
  compact = false,
}: {
  section: RoleSection;
  focusedVariable: string | null;
  onFocusVariable: (key: string) => void;
  compact?: boolean;
}) {
  const { Icon } = section;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Icon size={12} color={ROLE_TONES[section.tone].fg} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text)" }}>{section.title}</span>
        <InfoHint text={section.hint} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 6 : 8 }}>
        {section.items.map((item) => (
          <VariableBlock
            key={`${section.key}-${item.key}`}
            item={item}
            tone={section.tone}
            active={focusedVariable === item.key}
            onClick={() => onFocusVariable(item.key)}
          />
        ))}
      </div>
    </div>
  );
}

function RolePanel({
  section,
  focusedVariable,
  onFocusVariable,
}: {
  section: RoleSection;
  focusedVariable: string | null;
  onFocusVariable: (key: string) => void;
}) {
  const colors = ROLE_TONES[section.tone];
  const { Icon } = section;
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        padding: "12px 13px",
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: "white",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <Icon size={13} color={colors.fg} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text)" }}>{section.title}</span>
          <InfoHint text={section.hint} />
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>{section.description}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {section.items.map((item) => (
          <VariableBlock
            key={`${section.key}-panel-${item.key}`}
            item={item}
            tone={section.tone}
            active={focusedVariable === item.key}
            onClick={() => onFocusVariable(item.key)}
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
}: {
  item: RoleItem;
  tone: RoleTone;
  active: boolean;
  onClick: () => void;
}) {
  const colors = ROLE_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="pulso-variable-block"
      style={{
        display: "inline-grid",
        gap: 3,
        padding: "8px 10px",
        minWidth: 116,
        textAlign: "left",
        borderRadius: 8,
        border: `1px solid ${active ? colors.fg : colors.border}`,
        background: active ? "white" : colors.bg,
        color: "var(--pulso-text)",
        cursor: "pointer",
      }}
      title={item.label ? `${item.key} - ${item.label}` : item.key}
      aria-pressed={active}
    >
      <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: colors.fg }}>
        {item.key}
      </code>
      {item.label && (
        <span style={{ fontSize: 11, lineHeight: 1.35, color: "var(--pulso-text-soft)" }}>
          {item.label}
        </span>
      )}
      {item.table && item.table !== "principal" && (
        <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>Tabla {item.table}</span>
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

function buildActivationSummary(sections: RoleSection[]): string {
  const labels = uniqueStrings(
    sections.flatMap((section) => section.items.map((item) => item.label ?? item.key)),
  );
  if (!labels.length) return "";
  return `La regla se activa cuando ya se registraron ${humanList(labels.map((value) => `«${value}»`))}.`;
}

function buildCompareSummary(section: RoleSection | null): string {
  const labels = uniqueStrings(section?.items.map((item) => item.label ?? item.key) ?? []);
  if (!labels.length) return "";
  return `La respuesta se contrasta con ${humanList(labels.map((value) => `«${value}»`))}.`;
}

function findRoleLabel(sections: RoleSection[], key: string): string | null {
  for (const section of sections) {
    const match = section.items.find((item) => item.key === key);
    if (match) return match.label ?? null;
  }
  return null;
}
