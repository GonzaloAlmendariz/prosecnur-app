import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import type { MonitoreoWorkbenchRailTab } from "../../components";
import { MONITOREO_PESTANAS } from "../../../../lib/navegacion/catalogos/monitoreo";

/**
 * Las pestañas de aulas, como rail lateral.
 *
 * Estaban como píldoras arriba (`GlidingTabList`) y el patrón de la casa es un
 * rail con íconos: lo usan telefónico y acreditación, y es criterio de toda la
 * aplicación. El error fue implementar la **gramática** —módulo → modo → sección
 * → pestaña— sin el patrón visual que la acompaña.
 *
 * El catálogo de navegación ya trae `key`, `label`, `detail` e `icon` de cada
 * pestaña, así que aquí sólo se les añade lo que depende de los datos: el
 * **contador** y el **estado** de readiness. Duplicar los rótulos sería crear una
 * segunda verdad de algo que ya está declarado.
 */

const PESTANAS = MONITOREO_PESTANAS.aulas as Record<
  string,
  ReadonlyArray<{ key: string; label: string; detail: string; icon: MonitoreoWorkbenchRailTab["icon"] }>
>;

/**
 * Lo PENDIENTE de cada pestaña y su estado.
 *
 * El `badge` del rail compartido significa «casos pendientes, alertas» —así lo
 * documenta `ContextTabRail` y así lo lee en voz alta: «N pendientes»—. Poner
 * ahí el total de filas producía «196 pendientes» en una pestaña donde no falta
 * nada: el contador decía el tamaño de la tabla, no el trabajo que queda.
 */
function medidaDePestana(
  seccion: string,
  key: string,
  dashboard: MonitoreoAulasDashboard | null,
): { badge?: string; estado?: MonitoreoWorkbenchRailTab["estado"] } {
  const n = (xs: unknown) => (Array.isArray(xs) ? xs.length : 0);
  const kpis = dashboard?.kpis ?? null;
  const cuenta = (v: number) => (v > 0 ? String(v) : undefined);

  if (seccion === "modelo" && key === "agenda") {
    // Pendiente = lo que aún no tiene STATUS MUESTRA resuelto.
    const filas = n(dashboard?.agenda);
    return { estado: filas ? "listo" : "parcial" };
  }
  if (seccion === "modelo" && key === "registro") {
    // Pendiente = aulas sin parte de campo. Nunca «listo»: siempre puede entrar
    // otra aplicación.
    const total = Number(kpis?.total_aulas ?? 0);
    const aplicadas = Number(kpis?.aulas_aplicadas ?? 0);
    return { badge: cuenta(Math.max(0, total - aplicadas)), estado: "parcial" };
  }
  if (seccion === "avance" && key === "resumen") {
    // Pendiente = cursos-horario por debajo de su meta.
    const brechas = Number(kpis?.brechas ?? 0);
    return { badge: cuenta(brechas), estado: brechas ? "parcial" : "listo" };
  }
  if (seccion === "avance" && key === "estratos") {
    const conBrecha = (dashboard?.avance_por_estrato ?? []).filter(
      (fila) => Number((fila as Record<string, unknown>).brecha ?? 0) > 0,
    ).length;
    return { badge: cuenta(conBrecha), estado: conBrecha ? "parcial" : "listo" };
  }
  if (seccion === "avance" && key === "cuotas") {
    const total = Number(kpis?.quota_cells ?? 0);
    const ok = Number(kpis?.quota_cells_ok ?? 0);
    if (!total) return { estado: "parcial" };
    const faltan = Math.max(0, total - ok);
    // `bloqueado` cuando ninguna celda llegó: la cuota está en riesgo, no sin
    // configurar.
    return { badge: cuenta(faltan), estado: ok === total ? "listo" : ok === 0 ? "bloqueado" : "parcial" };
  }
  if (seccion === "consultas" && key === "reemplazos") {
    // Pendiente = cadenas movidas; sin ninguna, no hay nada que revisar.
    const filas = n(dashboard?.reemplazos);
    return { badge: cuenta(filas), estado: filas ? "parcial" : "listo" };
  }
  if (seccion === "consultas" && key === "brechas") {
    const filas = n(dashboard?.brechas);
    return { badge: cuenta(filas), estado: filas ? "bloqueado" : "listo" };
  }
  return {};
}

/**
 * Construye el rail de la sección activa.
 *
 * @returns vacío cuando la sección no tiene pestañas —Fuentes y Validación son
 *   hojas del árbol—, y el shell dibuja el rail sin lista.
 */
export function railDeAulas(
  seccion: string,
  dashboard: MonitoreoAulasDashboard | null,
): MonitoreoWorkbenchRailTab[] {
  return (PESTANAS[seccion] ?? []).map((pestana) => ({
    key: pestana.key,
    label: pestana.label,
    detail: pestana.detail,
    icon: pestana.icon,
    ...medidaDePestana(seccion, pestana.key, dashboard),
  }));
}
