export const PULSO_DASHBOARD_SEQUENTIAL = [
  "#DBE8FF",
  "#7AA2F8",
  "#2457D6",
  "#002457",
] as const;

export function dashboardSeriesColor(
  index: number,
  label: string,
  customPalette?: Readonly<Record<string, string>>,
  apiColor?: string | null,
): string {
  const customColor = customPalette?.[label];
  if (customColor) return customColor;
  if (apiColor) return apiColor;

  const paletteIndex =
    ((index % PULSO_DASHBOARD_SEQUENTIAL.length) +
      PULSO_DASHBOARD_SEQUENTIAL.length) %
    PULSO_DASHBOARD_SEQUENTIAL.length;
  return PULSO_DASHBOARD_SEQUENTIAL[paletteIndex];
}
