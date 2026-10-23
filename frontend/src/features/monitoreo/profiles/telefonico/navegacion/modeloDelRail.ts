import type { MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { MONITOREO_PESTANAS } from "../../../../../lib/navegacion/catalogos/monitoreo";
import {
  vistaPrincipal,
  type SeccionInterna,
  type SeccionTelefonica,
} from "./direccionTelefonica";

/** Las pestañas públicas que lleva el rail de una sección del telefónico. */
export function catalogoDeSeccion(seccion: SeccionTelefonica) {
  return MONITOREO_PESTANAS.telefonico[seccion];
}

/**
 * El rail de una sección pública.
 *
 * Nombre, detalle e ícono salen del catálogo público; la insignia y el estado,
 * de la vista interna que la pestaña monta, que es la que sabe cuántos casos
 * hay y si está lista. Así el rail no inventa una segunda cuenta.
 */
export function pestanasDelRail(
  seccion: SeccionTelefonica,
  internas: (seccion: SeccionInterna) => readonly MonitoreoWorkbenchRailTab[],
): MonitoreoWorkbenchRailTab[] {
  const cache = new Map<SeccionInterna, readonly MonitoreoWorkbenchRailTab[]>();
  const deSeccion = (interna: SeccionInterna) => {
    const previa = cache.get(interna);
    if (previa) return previa;
    const nuevas = internas(interna);
    cache.set(interna, nuevas);
    return nuevas;
  };
  return catalogoDeSeccion(seccion).map((tab) => {
    const vista = vistaPrincipal(seccion, tab.key);
    const fuente = vista ? deSeccion(vista.seccion).find((item) => item.key === vista.pestana) : undefined;
    return {
      key: tab.key,
      label: tab.label,
      detail: tab.detail,
      icon: tab.icon,
      badge: fuente?.badge,
      estado: fuente?.estado,
    };
  });
}

/**
 * Antetítulo de la cabecera de pestaña: «SECCIÓN · GRUPO» (estándar §2b). En
 * Control, las pestañas de la operación de llamadas forman un grupo y las que
 * revisan casos, otro; el resto lleva sólo la sección.
 */
const GRUPOS_DE_CONTROL: Record<string, string> = {
  barrido: "Llamadas",
  insistencia: "Llamadas",
  equipo: "Llamadas",
  discrepancias: "Casos",
  respuestas: "Casos",
  supervision: "Casos",
  avisos: "Casos",
};

const NOMBRE_DE_SECCION: Record<SeccionTelefonica, string> = {
  insumos: "Insumos",
  modelo: "Modelo",
  control: "Control",
  avance: "Avance",
};

export function antetituloDePestana(seccion: SeccionTelefonica, pestana: string): string {
  const grupo = seccion === "control" ? GRUPOS_DE_CONTROL[pestana] : undefined;
  return grupo ? `${NOMBRE_DE_SECCION[seccion]} · ${grupo}` : NOMBRE_DE_SECCION[seccion];
}
