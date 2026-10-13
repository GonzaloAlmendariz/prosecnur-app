import type { GraficosReportInputs } from "../../api/client";

type SuggestedPlanRecipeContext = {
  acnurMode?: string;
  profileLabel?: string;
};

function clean(value: unknown, fallback = "No indicado"): string {
  if (value == null) return fallback;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function cell(value: unknown): string {
  return clean(value).replaceAll("|", "\\|");
}

function yesNo(value: boolean): string {
  return value ? "Sí" : "No";
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    manual: "Definido manualmente",
    observed: "Calculado desde la base",
    data: "Calculado desde la base",
    metadata: "Metadatos del proyecto",
    project: "Configuración del proyecto",
  };
  return labels[source] ?? clean(source);
}

export function buildSuggestedPlanRecipeMarkdown(
  inputs: GraficosReportInputs,
  context: SuggestedPlanRecipeContext = {},
): string {
  const technicalRows = inputs.technical_rows ?? [];
  const derivedVariables = inputs.derived_variables ?? [];
  const profile = inputs.profile;
  const mode = context.acnurMode === "territorial" ? "Territorial" : "General";
  const profileLabel = context.profileLabel ?? "ACNUR azul";

  const lines = [
    "# Guía del informe ACNUR",
    "",
    "## Configuración aplicada",
    "",
    `- Perfil: ${clean(profileLabel)}`,
    `- Modalidad: ${mode}`,
    `- Periodo: ${clean(inputs.period)}`,
    `- Origen del periodo: ${sourceLabel(inputs.period_source)}`,
    `- Mapa territorial: ${yesNo(inputs.map_included)}`,
    `- Comparación: ${clean(inputs.comparison_mode, "Sin comparación")}`,
    "",
    "## Ficha técnica",
    "",
    "| Criterio | Detalle |",
    "| --- | --- |",
    ...technicalRows.map((row) => `| ${cell(row.criterio)} | ${cell(row.detalle)} |`),
    ...(technicalRows.length ? [] : ["| Sin filas definidas | Revisa la ficha antes de exportar |"]),
    "",
    "## Perfil de personas encuestadas",
    "",
    `- Incluido: ${yesNo(profile?.available === true)}`,
    `- Variable de sexo: ${clean(profile?.sex_variable)}`,
    `- Variable de edad: ${clean(profile?.age_variable)}`,
    "",
    "## Variables calculadas para el informe",
    "",
    "| Variable | Etiqueta | Origen | Fuente |",
    "| --- | --- | --- | --- |",
    ...derivedVariables.map((variable) => (
      `| ${cell(variable.name)} | ${cell(variable.label)} | ${cell(variable.origin)} | ${cell(variable.source) } |`
    )),
    ...(derivedVariables.length ? [] : ["| Ninguna | — | — | — |"]),
    "",
    "## Cómo volver a generar el informe",
    "",
    "1. Abre el proyecto en Prosecnur y prepara las bases en Analítica.",
    "2. Entra a Procesamiento > Gráficos y pulsa **Armar desde…** > **Armar desde un plan sugerido**.",
    `3. Elige **${profileLabel}** y la modalidad **${mode}**.`,
    "4. Revisa los datos que usará el informe y aplica la propuesta.",
    "5. Revisa la ficha técnica y las preguntas de cada gráfico.",
    "6. Exporta el informe a PowerPoint.",
    "",
    "Esta guía describe los insumos de la propuesta mostrada en la interfaz. Si cambia la base o la configuración, vuelve a armar la propuesta antes de exportar.",
    "",
  ];

  return lines.join("\n");
}
