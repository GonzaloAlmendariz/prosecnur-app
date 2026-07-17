export type DerivedReportVariableDefinition = {
  name: string;
  label: string;
  origin: string;
};

const DERIVED_REPORT_VARIABLES: Record<string, DerivedReportVariableDefinition> = {
  __age_group: {
    name: "__age_group",
    label: "Grupo de edad",
    origin: "Calculada por el informe a partir de la edad",
  },
  __territory_pair: {
    name: "__territory_pair",
    label: "Ámbito territorial",
    origin: "Calculada por el informe a partir del distrito",
  },
  __district: {
    name: "__district",
    label: "Distrito",
    origin: "Calculada por el informe a partir de la ubicación",
  },
};

export function derivedReportVariableName(ref: unknown): string {
  if (typeof ref !== "string") return "";
  const trimmed = ref.trim();
  if (!trimmed) return "";
  const separator = trimmed.lastIndexOf("$");
  return separator >= 0 ? trimmed.slice(separator + 1) : trimmed;
}

export function getDerivedReportVariable(ref: unknown): DerivedReportVariableDefinition | null {
  const name = derivedReportVariableName(ref);
  return DERIVED_REPORT_VARIABLES[name] ?? null;
}

export function isDerivedReportVariableRef(ref: unknown): boolean {
  return getDerivedReportVariable(ref) !== null;
}

