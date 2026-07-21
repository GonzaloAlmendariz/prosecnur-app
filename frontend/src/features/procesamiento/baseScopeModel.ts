export type ProcessingBaseScope = "empty" | "single" | "independent" | "combined";

export type ProcessingBaseScopePresentation = {
  scope: ProcessingBaseScope;
  showBasePicker: boolean;
  showSharedReports: boolean;
  summaryLabel: string;
};

export function processingBaseScopePresentation(
  processingMode: string | null | undefined,
  baseCount: number | null | undefined,
): ProcessingBaseScopePresentation {
  const count = Math.max(0, Number.isFinite(baseCount) ? Number(baseCount) : 0);
  if (count === 0) {
    return {
      scope: "empty",
      showBasePicker: false,
      showSharedReports: false,
      summaryLabel: "Sin bases",
    };
  }
  if (count === 1) {
    return {
      scope: "single",
      showBasePicker: false,
      showSharedReports: false,
      summaryLabel: "Base única",
    };
  }
  if (processingMode === "independent_siblings") {
    return {
      scope: "independent",
      showBasePicker: true,
      showSharedReports: true,
      summaryLabel: "Bases independientes",
    };
  }
  return {
    scope: "combined",
    showBasePicker: false,
    showSharedReports: false,
    summaryLabel: "Bases combinadas",
  };
}
