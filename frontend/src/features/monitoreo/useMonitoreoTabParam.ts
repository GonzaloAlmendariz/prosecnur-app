import { useEffect } from "react";
import type { WorkbenchView } from "./core/monitoreoRegistry";

const VIEW_VALUES: readonly WorkbenchView[] = [
  "avance",
  "ocurrencias",
  "consultas",
  "modelo",
  "fuentes",
  "telefonico",
  "calidad",
];

const TAB_ALIASES: Record<string, WorkbenchView> = {
  fuente: "fuentes",
  agenda: "modelo",
  "agenda de aulas": "modelo",
  umps: "modelo",
  ump: "modelo",
  "modelo operativo": "modelo",
  validacion: "calidad",
  consulta: "consultas",
  "consultas internas": "consultas",
  "avance territorial": "avance",
  "ocurrencias de campo": "ocurrencias",
  ocurrencia: "ocurrencias",
  "monitoreo telefonico": "telefonico",
  telefono: "telefonico",
  phone: "telefonico",
};

function normalizeTabToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function monitoreoViewFromTabParam(search: string): WorkbenchView | null {
  const raw = new URLSearchParams(search).get("tab");
  if (!raw) return null;
  const token = normalizeTabToken(raw);
  if ((VIEW_VALUES as readonly string[]).includes(token)) {
    return token as WorkbenchView;
  }
  return TAB_ALIASES[token] ?? null;
}

/**
 * Resuelve la vista inicial del workbench: si `?tab=` trae una vista válida
 * (y presente en el catálogo de vistas del perfil, si se pasa), la usa;
 * si no, cae al default del perfil.
 */
export function initialMonitoreoView(
  defaultView: WorkbenchView,
  views?: ReadonlyArray<{ key: WorkbenchView }>,
): WorkbenchView {
  if (typeof window === "undefined") return defaultView;
  const requested = monitoreoViewFromTabParam(window.location.search);
  if (!requested) return defaultView;
  if (views && !views.some((view) => view.key === requested)) return defaultView;
  return requested;
}

/**
 * Sincroniza la sección activa del workbench de Monitoreo con el query param
 * `?tab=` (replaceState, sin ensuciar el historial). Vive en archivo propio
 * porque MonitoreoPage.tsx está congelado a crecimiento. El deep-link de dev
 * (/ver-ui, `?pulso=` + ruta) consume este param para aterrizar en la pestaña
 * exacta.
 */
export function useMonitoreoTabParam(activeView: WorkbenchView): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === activeView) return;
    url.searchParams.set("tab", activeView);
    window.history.replaceState(window.history.state, "", url);
  }, [activeView]);
}
