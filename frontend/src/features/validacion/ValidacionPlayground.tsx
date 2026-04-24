// =============================================================================
// ValidacionPlayground.tsx — preview aislado de los componentes Fase 1
// =============================================================================
// Ruta temporal para probar los 5 componentes del revamp UX sin tocar aún
// ningún tab real. Accesible en dev con `/validacion/playground` (cuando
// se monte el route) o importable ad-hoc.
//
// Cuando termine el revamp completo, este archivo se puede borrar.
// =============================================================================

import { useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import {
  VariableChip,
  RuleNarrative,
  StatCard,
  ContextLens,
  DecisionStorageBar,
} from "./components/v2";
import type {
  DecisionCounts,
  DecisionKind,
  ReglaLike,
} from "./components/v2";

// -----------------------------------------------------------------------------
// Mock data
// -----------------------------------------------------------------------------

const MOCK_RULES: ReglaLike[] = [
  {
    id: "VR_required_001",
    nombre: "[p10_ule] «10. ¿Ha recibido servicios?» debe responderse",
    tipo_regla: "required",
    tipo_variable: "select_multiple",
    fuente: "instrumento",
    severidad: "error",
    categoria_ux: "completitud",
    objetivo:
      "Si se cumple la condición, «p10_ule» debe registrarse porque la pregunta corresponde al servicio ULE.",
    variables: ["p10_ule", "consent", "filtro"],
    variable_roles: {
      target: "p10_ule",
      drivers: ["consent"],
      gate: ["filtro"],
    },
    presentation: {
      subtipo_semantico: "debe",
      gate_humano: "Aplica cuando el consentimiento está dado y el filtro activo es ULE.",
      detalle_condicion: "",
    },
    n_casos: 1274,
    porcentaje: 0.765,
  },
  {
    id: "CR_range_edad",
    nombre: "[edad] dentro de [0, 120]",
    tipo_regla: "range",
    tipo_variable: "integer",
    fuente: "custom",
    severidad: "advertencia",
    categoria_ux: "rangos",
    objetivo: "«edad» debe estar dentro del rango permitido [0, 120].",
    variables: ["edad"],
    variable_roles: { target: "edad" },
    n_casos: 14,
    porcentaje: 0.008,
  },
  {
    id: "VR_skip_p29",
    nombre: "[p29] Salto · «¿El local cuenta con facilidades?» — debe responderse",
    tipo_regla: "skip",
    tipo_variable: "select_one",
    fuente: "instrumento",
    severidad: "error",
    categoria_ux: "saltos",
    objetivo: "Si p28 indica acceso, «p29» debe registrarse con la valoración.",
    variables: ["p29", "p28"],
    variable_roles: { target: "p29", drivers: ["p28"] },
    presentation: {
      subtipo_semantico: "debe",
      gate_humano: "Aplica cuando «p28» es afirmativa.",
    },
    n_casos: 0,
    porcentaje: 0,
  },
];

const MOCK_DECISIONS: DecisionCounts = {
  ignore: 6847,
  exclude: 342,
  replace: 124,
  normalize: 52,
  impute: 18,
  pending: 123,
};

const MOCK_LABELS: Record<string, string> = {
  p10_ule: "10. ¿Ha recibido servicios de la Unidad Local de Empadronamiento (ULE) en los últimos 12 meses?",
  consent: "¿Acepta participar en esta encuesta?",
  filtro: "Servicio del participante",
  edad: "Edad del participante (en años)",
  p29: "¿El local cuenta con facilidades de acceso?",
  p28: "¿La atención fue presencial?",
};

// -----------------------------------------------------------------------------
// Playground
// -----------------------------------------------------------------------------

export default function ValidacionPlayground() {
  const [lensOpen, setLensOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<DecisionKind | null>(null);

  const selectedRule = MOCK_RULES.find((r) => r.id === selectedRuleId) ?? MOCK_RULES[0];

  const labelLookup = (varName: string) => MOCK_LABELS[varName] ?? null;

  const hoverLookup = (varName: string) => ({
    label: MOCK_LABELS[varName],
    seccion: varName.startsWith("p10") ? "uso_servicio" : "datos_generales",
    grupo: varName.startsWith("p10") ? "uso_servicio" : "apoderado",
    grupo_relevant: "${consent} = '1' and ${filtro} = '1'",
    stats: {
      n_total: 1665,
      n_validos: varName === "edad" ? 1651 : 391,
      missing_pct: varName === "edad" ? 0.8 : 76.5,
      top_valores: varName.startsWith("p10")
        ? [
            { label: "ULE · sí", n: 391 },
            { label: "ULE · no", n: 0 },
          ]
        : [
            { label: "25-34", n: 412 },
            { label: "35-44", n: 398 },
            { label: "45-54", n: 310 },
            { label: "18-24", n: 287 },
            { label: "55+", n: 244 },
          ],
      ...(varName === "edad" ? { min: 18, max: 89, media: 38.7 } : {}),
    },
  });

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <Header />

      {/* 1. StatCards */}
      <Section title="1. StatCards — KPIs con interpretación">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <StatCard
            eyebrow="Total de casos"
            value={1665}
            interpretation="Encuestas completas en la base"
            tone="neutral"
          />
          <StatCard
            eyebrow="Inconsistencias"
            value={7488}
            interpretation="Detectadas por el motor de validación"
            tone="warn"
            delta={{ value: -87.8, label: "vs legacy" }}
            icon={<AlertTriangle size={18} />}
          />
          <StatCard
            eyebrow="Decididas"
            value="98.4%"
            interpretation="7,365 de 7,488 inconsistencias resueltas"
            tone="success"
          />
          <StatCard
            eyebrow="Residual esperado"
            value={3}
            interpretation="Reglas con casos después de aplicar decisiones"
            tone="primary"
            cta={{ label: "Ver residual", onClick: () => alert("Abrir residual") }}
          />
        </div>
      </Section>

      {/* 2. DecisionStorageBar */}
      <Section title="2. DecisionStorageBar — distribución de decisiones">
        <DecisionStorageBar
          counts={MOCK_DECISIONS}
          activeKind={activeKind}
          onSelectKind={(k) => setActiveKind(activeKind === k ? null : k)}
        />
      </Section>

      {/* 3. VariableChip (distintas variantes) */}
      <Section title="3. VariableChip — default / inline (hover sostenido 500ms para ver detalle)">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <VariableChip
            name="p10_ule"
            type="select_multiple"
            hoverData={hoverLookup("p10_ule")}
            onOpenInExplorar={() => alert("Abrir p10_ule en Explorar")}
          />
          <VariableChip
            name="edad"
            type="integer"
            hoverData={hoverLookup("edad")}
            onOpenInExplorar={() => alert("Abrir edad en Explorar")}
          />
          <VariableChip
            name="consent"
            type="select_one"
            hoverData={hoverLookup("consent")}
          />
          <VariableChip name="raw_text" type="text" disableHover />
          <div
            style={{
              fontSize: 14,
              color: "var(--pulso-text)",
              padding: "8px 12px",
              background: "var(--pulso-surface-2)",
              borderRadius: 8,
            }}
          >
            Variante inline dentro de texto:{" "}
            <VariableChip
              name="p10_ule"
              type="select_multiple"
              hoverData={hoverLookup("p10_ule")}
              variant="inline"
              style={{ background: "var(--pulso-primary-soft)", color: "var(--pulso-primary)" }}
            />{" "}
            debe responderse cuando{" "}
            <VariableChip
              name="consent"
              type="select_one"
              hoverData={hoverLookup("consent")}
              variant="inline"
              style={{ background: "var(--pulso-primary-soft)", color: "var(--pulso-primary)" }}
            />{" "}
            es afirmativo.
          </div>
        </div>
      </Section>

      {/* 4. RuleNarrative — compact */}
      <Section title="4a. RuleNarrative compact — grid de reglas (clickeable)">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 12,
          }}
        >
          {MOCK_RULES.map((rule) => (
            <RuleNarrative
              key={rule.id}
              rule={rule}
              variant="compact"
              labelLookup={labelLookup}
              variableHoverLookup={hoverLookup}
              nCasos={rule.n_casos}
              porcentaje={rule.porcentaje}
              status={(rule.n_casos ?? 0) > 0 ? "pending" : "ready"}
              selected={selectedRuleId === rule.id}
              onClick={() => setSelectedRuleId(rule.id ?? null)}
              onOpenDetail={() => {
                setSelectedRuleId(rule.id ?? null);
                setLensOpen(true);
              }}
              onOpenVariableInExplorar={(v) => alert(`Abrir ${v} en Explorar`)}
            />
          ))}
        </div>
      </Section>

      {/* 5. RuleNarrative — hero */}
      <Section title="4b. RuleNarrative hero — header destacado">
        <RuleNarrative
          rule={selectedRule}
          variant="hero"
          labelLookup={labelLookup}
          variableHoverLookup={hoverLookup}
          nCasos={selectedRule.n_casos}
          porcentaje={selectedRule.porcentaje}
          onOpenVariableInExplorar={(v) => alert(`Abrir ${v} en Explorar`)}
        />
      </Section>

      {/* 6. ContextLens */}
      <Section title="5. ContextLens — panel lateral deslizable">
        <button
          type="button"
          onClick={() => setLensOpen(true)}
          style={{
            padding: "8px 14px",
            background: "var(--pulso-primary)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Abrir ContextLens (con tabs)
        </button>
      </Section>

      <ContextLens
        open={lensOpen}
        onClose={() => setLensOpen(false)}
        title={selectedRule.nombre}
        subtitle={`${selectedRule.n_casos ?? 0} casos · ${selectedRule.categoria_ux}`}
        variant="wide"
        tabs={[
          {
            id: "narrative",
            label: "Narrativa",
            icon: <FileText size={12} />,
            content: (
              <RuleNarrative
                rule={selectedRule}
                variant="hero"
                labelLookup={labelLookup}
                variableHoverLookup={hoverLookup}
                nCasos={selectedRule.n_casos}
                porcentaje={selectedRule.porcentaje}
                onOpenVariableInExplorar={(v) => alert(`Abrir ${v} en Explorar`)}
              />
            ),
          },
          {
            id: "casos",
            label: "Casos",
            badge: selectedRule.n_casos ?? 0,
            content: (
              <div style={{ color: "var(--pulso-text-soft)" }}>
                Tabla de casos iría aquí (mock — sustituir por DrilldownTable).
              </div>
            ),
          },
          {
            id: "evidencia",
            label: "Evidencia",
            content: <div style={{ color: "var(--pulso-text-soft)" }}>Charts ilustrativos (placeholder).</div>,
          },
        ]}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers visuales del playground
// -----------------------------------------------------------------------------

function Header() {
  return (
    <header style={{ borderBottom: "1px solid var(--pulso-border)", paddingBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "var(--pulso-primary)",
          marginBottom: 4,
        }}
      >
        Dev Playground · Fase 1
      </div>
      <h1 style={{ fontSize: 22, margin: 0, color: "var(--pulso-text)" }}>
        Revamp Validación — componentes nuevos
      </h1>
      <p style={{ fontSize: 13, color: "var(--pulso-text-soft)", marginTop: 4 }}>
        Preview aislado. Mantén el mouse sobre una variable 500ms para ver el hovercard rico. Click sobre
        los segmentos de la barra de decisiones para filtrar. Click en una card de regla para abrir el ContextLens.
      </p>
    </header>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        style={{
          fontSize: 14,
          color: "var(--pulso-primary)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          margin: "0 0 10px 0",
          fontWeight: 800,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
