/** Reglas del resultado agrupadas por lo que les pasó. Salieron de `tabs/InstrumentoTab.tsx`. */
import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "../../../vendor/lucide-react";
import { RuleNarrative } from "../components/v2";
import RelationalRuleFamily, { type RelationalRuleView } from "../components/RelationalRuleFamily";
import type { RelationalSummary } from "../relationalPlan";
import { type CompactRuleRow, type Groups, buildRowHoverLookup, compactRowToRule, describeRuleReason, isPullDataRow } from "./modeloInstrumento";

export function NarrativeRuleCard({
  row,
  selected,
  onClick,
}: {
  row: CompactRuleRow;
  selected: boolean;
  onClick: () => void;
}) {
  const rule = useMemo(() => compactRowToRule(row), [row]);
  const hoverLookup = useMemo(() => buildRowHoverLookup(row), [row]);
  return (
    <RuleNarrative
      rule={rule}
      variant="compact"
      selected={selected}
      onClick={onClick}
      nCasos={row.nInconsistencias ?? null}
      porcentaje={row.porcentaje ?? null}
      variableHoverLookup={hoverLookup}
      labelLookup={(v) => row.variables.find((x) => x.key === v)?.label ?? null}
      // Hovercards desactivados en la grid: con muchas reglas, cada chip
      // de variable agregaba un portal + listeners de scroll/resize que
      // acumulaban en un solo viewport, llegando a tumbar la app. El
      // detalle por variable se ve en el ContextLens (al click) que ya
      // tiene la info completa.
      disableVariableHover
    />
  );
}

export function RuleGroupsSection({
  groups,
  relationalSummary,
  relationalRows,
  selectedRuleId,
  onSelect,
}: {
  groups: Groups;
  relationalSummary: RelationalSummary | null;
  relationalRows: RelationalRuleView[];
  selectedRuleId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    // Vive dentro del paso 3 (un Panel): sin caja propia, para no anidar una tarjeta en otra.
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* Panel de la familia relacional (naranja): primero, porque presenta el
          instrumento con su base relacionada. Se auto-oculta si no hay repeat. */}
      <RelationalRuleFamily
        summary={relationalSummary}
        rows={relationalRows}
        selectedRuleId={selectedRuleId}
        onSelect={onSelect}
      />
      {groups.desalineadas.length > 0 && (
        <RuleSubGroup
          title="Reglas desalineadas con los datos"
          hint="Estas reglas comparan una variable contra un valor que no existe en tu base (por ejemplo, consent='OK' cuando los datos usan 1/0). Es la firma de un desfase entre la versión del instrumento con la que se armó el plan y la versión con la que se levantaron los datos. No se contabilizan como inconsistencias para evitar falsos positivos masivos: revisa que el instrumento de validación coincida con el desplegado."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.desalineadas}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="warn"
        />
      )}
      <RuleSubGroup
        title="Reglas con inconsistencias"
        hint="Cada tarjeta abre la regla con sus casos."
        countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
        rows={groups.conCasos}
        selectedRuleId={selectedRuleId}
        onSelect={onSelect}
        clickable
        emptyHint="Sin inconsistencias detectadas en esta corrida."
      />
      {groups.noAplicables.length > 0 && (
        <RuleSubGroup
          title="Reglas no aplicables a esta base"
          hint="La data no contiene la columna que la regla evalúa. Típico de preguntas select_multiple (la opción se desplegó en columnas dummy q*_NNNN), preguntas dentro de grupos no exportados, o ramas condicionales que ningún caso activó."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.noAplicables}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="muted"
        />
      )}
      {groups.noEvaluadas.length > 0 && (
        <RuleSubGroup
          title="No evaluadas automáticamente"
          hint="El evaluador no pudo correrlas: sintaxis ODK que aún no traduce o falta la fecha de captura. Revísalas a mano."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.noEvaluadas}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="warn"
        />
      )}
      {groups.pullData.length > 0 && (
        <RuleSubGroup
          title="Campos pull data"
          hint="Se pre-llenan desde un listado externo con pulldata(); sin ese listado no hay contra qué validarlos. No es un error del instrumento."
          countLabel={(n) => `${n} ${n === 1 ? "campo" : "campos"}`}
          rows={groups.pullData}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="muted"
        />
      )}
      {groups.okSinCasos.length > 0 && (
        <RuleSubGroup
          title="Validaciones que pasaron sin inconsistencias"
          hint="Corrieron sobre la base y no encontraron casos. Despliega para abrir el diagrama de cualquiera."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.okSinCasos}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable
          tone="muted"
          collapsible
          defaultCollapsed
        />
      )}
    </section>
  );
}

export function RuleSubGroup({
  title,
  hint,
  rows,
  selectedRuleId,
  onSelect,
  clickable,
  countLabel,
  tone = "default",
  emptyHint,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string;
  hint: string;
  rows: CompactRuleRow[];
  selectedRuleId: string | null;
  onSelect: (id: string) => void;
  clickable: boolean;
  countLabel: (n: number) => string;
  tone?: "default" | "muted" | "warn";
  emptyHint?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
  const headerColor =
    tone === "warn"
      ? "var(--pulso-warn-fg, #b45309)"
      : tone === "muted"
        ? "var(--pulso-text-soft)"
        : "var(--pulso-text)";
  const countBadge = (
    <span
      style={{
        fontSize: "var(--pulso-type-caption-size)",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--pulso-surface-2, rgba(0,0,0,0.05))",
        color: "var(--pulso-text-soft)",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {countLabel(rows.length)}
    </span>
  );
  const titleRow = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-expanded={!collapsed}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--pulso-type-subtitle-size)",
        fontWeight: 700,
        color: headerColor,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
      {title}
      {countBadge}
    </button>
  ) : (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--pulso-type-subtitle-size)",
        fontWeight: 700,
        color: headerColor,
      }}
    >
      {title}
      {countBadge}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        {titleRow}
        <div
          style={{
            fontSize: "var(--pulso-type-caption-size)",
            color: "var(--pulso-text-soft)",
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      </div>

      {collapsed ? null : rows.length === 0 ? (
        <div
          style={{
            fontSize: "var(--pulso-type-body-size)",
            color: "var(--pulso-text-soft)",
            padding: "10px 12px",
            background: "var(--pulso-surface)",
            borderRadius: 6,
            border: "1px dashed var(--pulso-border)",
          }}
        >
          {emptyHint ?? "—"}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 10,
            maxHeight: 480,
            overflow: "auto",
            paddingRight: 4,
          }}
        >
          {/* El motor puede repetir un `id_regla` en el resumen (p. ej. `VR_skip_[documento]` en un
              estudio real): la clave suma el número de aparición para que cada tarjeta sea única. */}
          {clavesUnicas(rows).map(([clave, row]) =>
            clickable ? (
              <NarrativeRuleCard
                key={clave}
                row={row}
                selected={row.id === selectedRuleId}
                onClick={() => onSelect(row.id)}
              />
            ) : (
              <UnevaluableRuleCard
                key={clave}
                row={row}
                tone={tone === "warn" ? "warn" : "muted"}
                selected={row.id === selectedRuleId}
                onClick={() => onSelect(row.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Cada fila con una clave única: el id, y desde la segunda aparición del mismo id, su número. */
export function clavesUnicas<T extends { id: string }>(rows: readonly T[]): Array<[string, T]> {
  const vistas = new Map<string, number>();
  return rows.map((row) => {
    const n = (vistas.get(row.id) ?? 0) + 1;
    vistas.set(row.id, n);
    return [n === 1 ? row.id : `${row.id}#${n}`, row];
  });
}

export function UnevaluableRuleCard({
  row,
  tone,
  selected = false,
  onClick,
}: {
  row: CompactRuleRow;
  tone: "muted" | "warn";
  selected?: boolean;
  onClick?: () => void;
}) {
  const reason = describeRuleReason(row);
  // Los campos pull data se superficializan internamente como `odk_raw`, pero
  // NO son modo experto: no mostramos ese tag técnico (leería como "experto").
  const showTipoTag = !!row.tipo && !isPullDataRow(row);
  const borderColor = selected
    ? "var(--pulso-primary-border)"
    : tone === "warn"
      ? "var(--pulso-warn-border, #fde68a)"
      : "var(--pulso-border)";
  const badgeBg =
    tone === "warn" ? "var(--pulso-warn-bg, #fffbeb)" : "var(--pulso-surface)";
  const badgeFg =
    tone === "warn" ? "var(--pulso-warn-fg, #b45309)" : "var(--pulso-text-soft)";
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: selected ? "var(--pulso-primary-soft)" : "white",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: 0.95,
        cursor: onClick ? "pointer" : "default",
        boxShadow: selected ? "var(--pulso-shadow-soft)" : undefined,
        transition: "border-color 120ms ease, background 120ms ease",
      }}
      title={row.detalle ?? undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: "var(--pulso-type-micro-size)",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: badgeBg,
            color: badgeFg,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {reason.badge}
        </span>
        {showTipoTag && (
          <span
            style={{
              fontSize: "var(--pulso-type-micro-size)",
              color: "var(--pulso-text-soft)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {row.tipo}
          </span>
        )}
      </div>
      <div style={{ fontSize: "var(--pulso-type-body-size)", color: "var(--pulso-text)", lineHeight: 1.4 }}>
        {row.displayName}
      </div>
      <div style={{ fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
        {reason.explanation}
      </div>
    </div>
  );
}
