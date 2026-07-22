import { createContext, createElement, useContext, type ReactNode } from "react";

export type GraficosReportScope = "active" | "consolidated";

const GraficosReportScopeContext = createContext<GraficosReportScope | null>(null);

export function parseGraficosReportScope(search: string): GraficosReportScope {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("scope") === "consolidado" ? "consolidated" : "active";
}

export function GraficosReportScopeProvider({
  scope,
  children,
}: {
  scope: GraficosReportScope;
  children: ReactNode;
}) {
  return createElement(GraficosReportScopeContext.Provider, { value: scope }, children);
}

export function useGraficosReportScope(search: string): GraficosReportScope {
  return useContext(GraficosReportScopeContext) ?? parseGraficosReportScope(search);
}
