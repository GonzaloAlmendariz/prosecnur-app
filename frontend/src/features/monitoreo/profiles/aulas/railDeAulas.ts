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
  // **La sección es `calidad`, no `modelo`.** La pestaña se declara en el
  // catálogo como `pestana("aulas", "calidad", "registro", "Registro de campo",
  // …)`, así que esta rama no casaba nunca: la medida estaba escrita, con su
  // comentario y su intención, y «Registro de campo» salía sin badge. Es la
  // única de las siete ramas del rail que apuntaba a una pestaña inexistente.
  if (seccion === "calidad" && key === "registro") {
    /**
     * Pendiente = cursos-horario sin parte de campo. Nunca «listo»: siempre
     * puede entrar otra aplicación.
     *
     * **El universo son los titulares, no el plan sin la reserva adicional.**
     * `total_aulas`
     * cuenta 1.347 sobre HSVG2026 «como 2025» —174 titulares más 1.173 reservas
     * encadenadas— y una reserva dormida no espera ningún parte: sólo sale a
     * campo si cae su titular. El badge decía **1.195** donde faltan **22**.
     *
     * Es la tercera superficie con este universo: ya pasó en el pronóstico de
     * cierre y en el resumen que va al cliente. `aulas_titulares` es la cifra
     * que el motor ya publica para esto; el respaldo a `total_aulas` cubre un
     * payload anterior a que existiera.
     */
    const total = Number(kpis?.aulas_titulares ?? kpis?.total_aulas ?? 0);
    const aplicadas = Number(kpis?.aulas_aplicadas ?? 0);
    return { badge: cuenta(Math.max(0, total - aplicadas)), estado: "parcial" };
  }
  if (seccion === "avance" && key === "resumen") {
    // Pendiente = cursos-horario por debajo de su meta.
    const brechas = Number(kpis?.brechas ?? 0);
    return { badge: cuenta(brechas), estado: brechas ? "parcial" : "listo" };
  }
  // La rama de «estratos» se fue con su pestaña el 2026-09-09: Gonzalo no
  // conceptualiza el avance por mayoría de sexo del aula, así que el rail no
  // tiene por qué contar brechas de un eje que nadie mira.
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
    /**
     * **Cadenas MOVIDAS, no filas de la lista.**
     *
     * La intención estaba escrita —«Pendiente = cadenas movidas»— y la cuenta
     * era `dashboard.reemplazos.length`, que trae **el plan entero sin la
     * reserva adicional**:
     * titulares y sus reservas, movidas o no. Medido sobre HSVG2026 «como
     * 2025», el badge decía **1.347** y los reemplazos que de verdad ocurrieron
     * son **18** —cifra en la que coinciden tres fuentes: las filas con
     * `replaced_at`, las que están en estado `reemplazada`, y el reparto
     * `course_status_estados` del motor—.
     *
     * Un badge es un número desnudo al lado de una etiqueta: si dice 1.347
     * junto a «Reemplazos», lo que el lector entiende es que hubo mil
     * trescientos reemplazos.
     */
    const filas = (dashboard?.reemplazos ?? []) as Array<Record<string, unknown>>;
    const movidas = filas.filter((fila) => (
      String(fila.sample_status ?? "").trim().toLowerCase().startsWith("reemplazada")
    )).length;
    return { badge: cuenta(movidas), estado: movidas ? "parcial" : "listo" };
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
/**
 * **Qué pestañas existen en ESTE estudio, que no es lo mismo que en el perfil.**
 *
 * El catálogo declara las del perfil de aulas; algunas sólo tienen sentido con
 * cierta forma de estudio. «Cruce de alumnos» es la primera: vive del código
 * identificador que piden las encuestas CONFIDENCIALES, y en una anónima no hay
 * a quién cruzar (Gonzalo, 2026-09-22). El motor lo declara en
 * `cruce_por_carrera.aplica`, así que la condición se lee, no se adivina aquí.
 *
 * Un payload anterior no trae el bloque: entonces la pestaña se retira, que es
 * el estado en el que estaban todos los estudios hasta hoy.
 */
function existeEnEsteEstudio(
  seccion: string,
  key: string,
  dashboard: MonitoreoAulasDashboard | null,
): boolean {
  if (seccion === "calidad" && key === "alumnos") {
    return Boolean(dashboard?.cruce_por_carrera?.aplica);
  }
  return true;
}

export function railDeAulas(
  seccion: string,
  dashboard: MonitoreoAulasDashboard | null,
): MonitoreoWorkbenchRailTab[] {
  return (PESTANAS[seccion] ?? [])
    .filter((pestana) => existeEnEsteEstudio(seccion, pestana.key, dashboard))
    .map((pestana) => ({
    key: pestana.key,
    label: pestana.label,
    detail: pestana.detail,
    icon: pestana.icon,
    ...medidaDePestana(seccion, pestana.key, dashboard),
  }));
}
