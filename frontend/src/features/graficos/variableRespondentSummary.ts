import type { VarWithSource } from "./useVariables";

export type VariableRespondentStatus = "exact" | "range" | "partial" | "unknown";

export type VariableRespondentGroup = {
  source: string;
  variableCount: number;
  knownCount: number;
  status: VariableRespondentStatus;
  minN: number | null;
  maxN: number | null;
};

export type VariableRespondentSummaryModel = {
  groups: VariableRespondentGroup[];
  selectedVariableCount: number;
  unresolvedRefCount: number;
};

type RespondentVariable = Pick<VarWithSource, "name" | "source" | "n_non_empty">;

type MutableGroup = {
  source: string;
  variableCount: number;
  values: number[];
};

export function buildVariableRespondentSummary(
  refs: readonly string[],
  variables: readonly RespondentVariable[],
  multi: boolean,
): VariableRespondentSummaryModel {
  const groups = new Map<string, MutableGroup>();
  const seenVariables = new Set<string>();
  const seenUnresolvedRefs = new Set<string>();

  for (const rawRef of refs) {
    const ref = rawRef.trim();
    if (!ref) continue;
    const variable = findVariable(ref, variables, multi);
    if (!variable) {
      seenUnresolvedRefs.add(ref);
      continue;
    }

    const source = variable.source.trim() || "Base activa";
    const variableKey = `${source}\u001f${variable.name}`;
    if (seenVariables.has(variableKey)) continue;
    seenVariables.add(variableKey);

    const group = groups.get(source) ?? { source, variableCount: 0, values: [] };
    group.variableCount += 1;
    const n = finiteNonNegativeInteger(variable.n_non_empty);
    if (n !== null) group.values.push(n);
    groups.set(source, group);
  }

  return {
    groups: Array.from(groups.values()).map(finalizeGroup),
    selectedVariableCount: seenVariables.size,
    unresolvedRefCount: seenUnresolvedRefs.size,
  };
}

export function formatRespondentSourceLabel(source: string): string {
  const words = source
    .replaceAll(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "Base activa";
  return words
    .map((word) => {
      const normalized = word.toLocaleLowerCase("es-PE");
      return normalized.charAt(0).toLocaleUpperCase("es-PE") + normalized.slice(1);
    })
    .join(" ");
}

function finalizeGroup(group: MutableGroup): VariableRespondentGroup {
  const knownCount = group.values.length;
  const minN = knownCount ? Math.min(...group.values) : null;
  const maxN = knownCount ? Math.max(...group.values) : null;
  let status: VariableRespondentStatus;
  if (knownCount === 0) status = "unknown";
  else if (knownCount < group.variableCount) status = "partial";
  else if (minN !== maxN) status = "range";
  else status = "exact";

  return {
    source: group.source,
    variableCount: group.variableCount,
    knownCount,
    status,
    minN,
    maxN,
  };
}

function findVariable(
  ref: string,
  variables: readonly RespondentVariable[],
  multi: boolean,
): RespondentVariable | undefined {
  const separator = ref.indexOf("$");
  const refSource = separator >= 0 ? ref.slice(0, separator) : null;
  const refName = separator >= 0 ? ref.slice(separator + 1) : ref;
  if (multi) {
    if (refSource) {
      return variables.find((variable) => variable.source === refSource && variable.name === refName);
    }
    return variables.find((variable) => variable.name === refName);
  }
  return variables.find((variable) =>
    variable.name === refName || `${variable.source}$${variable.name}` === ref,
  );
}

function finiteNonNegativeInteger(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
}
