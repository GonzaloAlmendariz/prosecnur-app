import type { MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { MONITOREO_PESTANAS } from "../../../../../lib/navegacion/catalogos/monitoreo";
import type { Disponible } from "../../../core/tablaDeDirecciones";
import {
  PESTANAS_DE_CONTACTO,
  vistaPrincipal,
  type SeccionAcreditacion,
  type SeccionInterna,
  type VistaInterna,
} from "./direccionAcreditacion";

export function catalogoDeSeccion(seccion: SeccionAcreditacion) {
  return MONITOREO_PESTANAS.acreditacion[seccion];
}

export const NOMBRE_DE_SECCION: Record<SeccionAcreditacion, string> = {
  insumos: "Insumos",
  modelo: "Modelo",
  control: "Control",
  avance: "Avance",
};

/** Grupo de una pestaña de Control: Contacto (condicional) o Casos. */
export function grupoDeControl(pestana: string): "Contacto" | "Casos" {
  return PESTANAS_DE_CONTACTO.includes(pestana) ? "Contacto" : "Casos";
}

/** Antetítulo de la cabecera: «Sección» o, en Control, «Sección · Grupo» (G1). */
export function antetituloDePestana(seccion: SeccionAcreditacion, pestana: string): string {
  return seccion === "control"
    ? `${NOMBRE_DE_SECCION[seccion]} · ${grupoDeControl(pestana)}`
    : NOMBRE_DE_SECCION[seccion];
}

/** Lo que el estudio declara: cada capacidad es `null` mientras no se sabe. */
export type CapacidadesDelEstudio = {
  correo: boolean | null;
  barrido: boolean | null;
};

/**
 * ¿Existe la pestaña en este estudio? Correo solo con audiencia de Mailchimp;
 * Barrido, Reintentos y Equipo solo si algún público declara canal telefónico.
 * Mientras la capacidad no se conoce la pestaña se ofrece: esconderla y
 * mostrarla un segundo después movería el rail bajo el cursor.
 */
export function disponibilidad(capacidades: CapacidadesDelEstudio): Disponible {
  return (seccion, pestana) => {
    if (seccion !== "control") return true;
    if (pestana === "correo") return capacidades.correo !== false;
    if (PESTANAS_DE_CONTACTO.includes(pestana)) return capacidades.barrido !== false;
    return true;
  };
}

/**
 * El rail de una sección pública: nombre, detalle e ícono del catálogo;
 * insignia y estado de la vista que la pestaña monta, que es la que sabe
 * cuántos casos hay. En Control, el `title` dice «Grupo · Pestaña» (G2).
 */
export function pestanasDelRail(
  seccion: SeccionAcreditacion,
  internas: (seccion: SeccionInterna) => readonly MonitoreoWorkbenchRailTab[],
  disponible: Disponible,
): MonitoreoWorkbenchRailTab[] {
  const cache = new Map<string, readonly MonitoreoWorkbenchRailTab[]>();
  const deSeccion = (vista: VistaInterna) => {
    const clave = vista.seccion as SeccionInterna;
    const previa = cache.get(clave);
    if (previa) return previa;
    const nuevas = internas(clave);
    cache.set(clave, nuevas);
    return nuevas;
  };
  return catalogoDeSeccion(seccion)
    .filter((tab) => disponible(seccion, tab.key))
    .map((tab) => {
      const vista = vistaPrincipal(seccion, tab.key);
      const fuente = vista ? deSeccion(vista).find((item) => item.key === vista.pestana) : undefined;
      return {
        key: tab.key,
        label: seccion === "control" ? `${grupoDeControl(tab.key)} · ${tab.label}` : tab.label,
        detail: tab.detail,
        icon: tab.icon,
        badge: fuente?.badge,
        estado: fuente?.estado,
      };
    });
}

/** Nombre de la pestaña para la cabecera, sin el grupo. */
export function nombreDePestana(seccion: SeccionAcreditacion, pestana: string): string {
  return catalogoDeSeccion(seccion).find((tab) => tab.key === pestana)?.label ?? NOMBRE_DE_SECCION[seccion];
}
