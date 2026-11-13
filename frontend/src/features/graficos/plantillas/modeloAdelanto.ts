// Adelanto de una plantilla en la pestaña Plantillas (corrección de Gonzalo, 2026-11-12): elegir una plantilla muestra
// cómo se verá el informe con lo que la plantilla ya declara en el front (estilo, formato, láminas tipo), sin leer el
// cuestionario. La lectura del cuestionario y la creación de las láminas sólo ocurren cuando el analista lo pide. Puro.

import type { PlantillaInforme } from "./catalogoPlantillas";
import { nombreDeEstilo } from "./identidadDePlantilla";

export type TipoLaminaEjemplo = "portada" | "indice" | "seccion" | "pregunta" | "mapa";

export type LaminaEjemplo = { tipo: TipoLaminaEjemplo; rotulo: string };

export type RasgoPlantilla = { clave: string; rotulo: string; valor: string };

/** Las láminas tipo que arma la plantilla, en el orden en que aparecen en el informe. */
export function laminasDeEjemplo(p: PlantillaInforme): LaminaEjemplo[] {
  const fijas: LaminaEjemplo[] = [
    { tipo: "portada", rotulo: "Portada" },
    { tipo: "indice", rotulo: "Índice" },
  ];
  if (p.enBlanco) return fijas;
  const mapas: LaminaEjemplo[] = p.config.include_coverage_maps === true ? [{ tipo: "mapa", rotulo: "Mapa de cobertura" }] : [];
  return [...fijas, ...mapas, { tipo: "seccion", rotulo: "Sección" }, { tipo: "pregunta", rotulo: "Pregunta" }];
}

/** Estilo, formato y contenido que declara la plantilla. */
export function rasgosDePlantilla(p: PlantillaInforme): RasgoPlantilla[] {
  const perfil = typeof p.config.profile_id === "string" ? p.config.profile_id : "";
  const formato = typeof p.config.template_id === "string" && p.config.template_id.endsWith("_16_9") ? "16:9" : "";
  const contenido = p.enBlanco
    ? "Portada e índice; las demás láminas se agregan en Láminas"
    : p.config.include_coverage_maps === true
      ? "Mapas de cobertura, comparación por distrito y una sección por bloque del cuestionario"
      : "Una sección por bloque del cuestionario, con el gráfico de cada pregunta";
  return [
    ...(p.enBlanco ? [] : [{ clave: "estilo", rotulo: "Estilo", valor: nombreDeEstilo(perfil) }]),
    ...(formato ? [{ clave: "formato", rotulo: "Formato", valor: formato }] : []),
    { clave: "contenido", rotulo: "Contenido", valor: contenido },
  ];
}

/** Lo que se sabe de la selección sin leer el cuestionario: cuántas preguntas quedaron fuera en `scope_rules`. */
export function seleccionSinLeer(fuera: number): string {
  if (fuera === 0) return "Entran todas las preguntas del cuestionario.";
  return fuera === 1 ? "1 pregunta queda fuera del informe." : `${fuera.toLocaleString("en-US")} preguntas quedan fuera del informe.`;
}

/**
 * El aviso junto a los botones de crear cuando el proyecto ya tiene láminas (ítem 48, 2026-11-13): dice cuántas son y
 * qué hace cada opción. Reemplazar el informe borra esas láminas; el informe aparte las deja y sale como otro archivo.
 */
export function avisoDeReemplazo(laminas: number): string {
  if (laminas <= 0) return "";
  const una = laminas === 1;
  const cuantas = una ? "1 lámina" : `${laminas.toLocaleString("en-US")} láminas`;
  return `El proyecto ya tiene un informe de ${cuantas}. Reemplazarlo ${una ? "la borra" : "las borra"}; el informe aparte sale `
    + `como un PowerPoint nuevo y ${una ? "la deja como está" : "las deja como están"}.`;
}
