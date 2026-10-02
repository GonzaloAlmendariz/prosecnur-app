/**
 * Vista previa de otro tipo de estudio, sin tocar el actual.
 *
 * Gonzalo (2026-10-02): «poder regresar a otro tipo; debería advertirte que
 * vas a perder tu progreso, pero deberías poder ver cuáles son sus elementos
 * sin perder el tuyo; al seleccionarlo, el cambio sí es definitivo». Antes, el
 * clic en otra tarjeta saltaba directo al aviso de reinicio: para saber qué
 * traía un tipo había que perder el estudio.
 *
 * Lo que se muestra sale del manifiesto de navegación (`lib/modules.ts`), el
 * mismo que pinta el rail: si una sección o pestaña cambia, la vista previa
 * cambia con ella y no puede prometer un paso que el tipo no tiene.
 */
import type { CalcMuestraComponente } from "../../api/calcMuestra";
import { PROSECNUR_MODULES } from "../../lib/modules";
import { modoDeDesk } from "./navegacion";
import type { ActiveDesk } from "./sharedCore";

export type PasoDelTipo = { id: string; label: string; detalle: string | null };
export type SeccionDelTipo = { id: string; label: string; pasos: PasoDelTipo[] };

/** Secciones y pestañas que trae un tipo, en el orden del rail. */
export function seccionesDelTipo(desk: ActiveDesk): SeccionDelTipo[] {
  const modulo = PROSECNUR_MODULES.find((m) => m.slug === "calc-muestra");
  const modo = modulo?.modos?.find((m) => m.id === modoDeDesk(desk));
  if (!modo) return [];
  return modo.sections.map((seccion) => ({
    id: seccion.id,
    label: seccion.label,
    pasos: (seccion.tabs ?? []).map((tab) => ({
      id: tab.id,
      label: tab.label,
      // Las pestañas de los catálogos de Cálculo de muestra traen la pregunta
      // que contestan; el tipo genérico del manifiesto no la declara.
      detalle: "detail" in tab && typeof tab.detail === "string" ? tab.detail : null,
    })),
  }));
}

/** Ir a Hojas de ruta no reinicia nada: sólo navega. Los demás tipos sí. */
export function cambiarReinicia(destino: ActiveDesk): boolean {
  return destino !== "territorial_handoff";
}

/**
 * Lo que se pierde al reiniciar, dicho con lo que el estudio tiene hoy. Un
 * aviso genérico («se perderá el progreso») no deja decidir: el usuario tiene
 * que ver qué está en juego.
 */
export function loQueSePierde({
  titulo,
  componentes,
  tieneEstadoAulas,
}: {
  titulo: string;
  componentes: readonly CalcMuestraComponente[];
  tieneEstadoAulas: boolean;
}): string[] {
  const items: string[] = [];
  const nombre = titulo.trim();
  if (nombre) items.push(`La ficha del estudio «${nombre}»`);
  const conMarco = componentes.filter((c) => (c.marco?.marco_validado ?? 0) > 0).length;
  if (componentes.length > 0) {
    const grupos = componentes.length === 1 ? "1 grupo" : `${componentes.length} grupos`;
    items.push(
      conMarco > 0
        ? `${grupos} con su marco, técnica y parámetros (${conMarco} con N declarado)`
        : `${grupos} con su técnica y parámetros`,
    );
  }
  const calculados = componentes.filter((c) => c.resultado != null).length;
  if (calculados > 0) {
    items.push(calculados === 1 ? "El tamaño de muestra calculado" : `Los tamaños de muestra calculados (${calculados})`);
  }
  if (tieneEstadoAulas) items.push("Las bases cargadas, el marco de cursos-horario y la selección de aulas");
  return items;
}
