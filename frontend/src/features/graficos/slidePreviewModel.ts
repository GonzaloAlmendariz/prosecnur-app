type DataArgs = Record<string, unknown>;

function isRecord(value: unknown): value is DataArgs {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isConfiguredRef(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasConfiguredVars(value: unknown): boolean {
  if (isConfiguredRef(value)) return true;

  if (Array.isArray(value)) {
    return value.some(isConfiguredRef);
  }

  if (!isRecord(value)) return false;
  const groups = Object.entries(value);
  return groups.length > 0 && groups.every(([name, refs]) => (
    name.trim().length > 0
    && (isConfiguredRef(refs) || (Array.isArray(refs) && refs.some(isConfiguredRef)))
  ));
}

function hasConfiguredDirectDataArgs(args: DataArgs): boolean {
  return isConfiguredRef(args.var) || hasConfiguredVars(args.vars);
}

export function hasConfiguredChartDataArgs(value: unknown): boolean {
  if (!isRecord(value)) return false;

  if (value.modo !== "multilista") {
    return hasConfiguredDirectDataArgs(value);
  }

  if (!Array.isArray(value.bloques) || value.bloques.length === 0) return false;

  return value.bloques.every((block) => (
    isRecord(block)
    && block.modo !== "multilista"
    && hasConfiguredDirectDataArgs(block)
  ));
}
