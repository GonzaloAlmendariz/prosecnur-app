// sugerenciaDeModo.ts — qué modo de Monitoreo corresponde a lo que el proyecto
// YA tiene.
//
// El contrato de navegación v3 dice que el modo «lo determina el estudio, no un
// click», y Monitoreo lo pregunta desde cero. La pregunta no sobra —un estudio
// de aulas puede monitorearse por teléfono, y elegir el propósito es una
// decisión legítima del analista—, pero preguntarla IGNORANDO lo que el
// proyecto ya declara sí es un defecto: la app tiene la selección de aulas
// delante y no la usa.
//
// De ahí que esto SUGIERA y nunca imponga: marca una tarjeta con el motivo
// concreto y deja las demás igual de elegibles.
//
// Dos reglas que vienen de haber medido este mismo error en otros sitios:
//
//   1. Una señal se declara sólo donde tiene algo que decir. Un proyecto sin
//      selección de aulas y sin territorios no recibe sugerencia: una tarjeta
//      marcada «por si acaso» es peor que ninguna, porque enseña a ignorar la
//      marca.
//   2. Con dos señales fuertes a la vez NO se sugiere. Un proyecto que tiene
//      aulas Y hojas de ruta es justo aquel donde la elección del analista
//      importa, y adivinar por él es donde una sugerencia se vuelve una
//      imposición encubierta.
import type { MonitoreoModo } from "./monitoreoRegistry";

/** Lo mínimo del overview que la sugerencia necesita. Recibir el objeto entero
    acoplaría este helper al esquema completo de `project_overview_v1`. */
export type SenalesDeProyecto = {
  calc?: { mode?: string; aulas_titulares?: number } | null;
  hojas?: { districts_count?: number } | null;
};

export type SugerenciaDeModo = {
  family: MonitoreoModo;
  /** Por qué se sugiere, con la cifra que lo sostiene. Se muestra al lado de la
      tarjeta: un motivo sin cifra es una corazonada. */
  motivo: string;
};

const entero = (valor: unknown): number =>
  typeof valor === "number" && Number.isFinite(valor) ? Math.trunc(valor) : 0;

export function sugerirModoDeMonitoreo(
  senales: SenalesDeProyecto | null | undefined,
): SugerenciaDeModo | null {
  if (!senales) return null;

  const titulares = entero(senales.calc?.aulas_titulares);
  const hayAulas = senales.calc?.mode === "aulas" && titulares > 0;

  const distritos = entero(senales.hojas?.districts_count);
  const hayTerritorio = senales.calc?.mode === "territorial" || distritos > 0;

  // Regla 2: dos señales fuertes no se desempatan solas.
  if (hayAulas && hayTerritorio) return null;

  if (hayAulas) {
    return {
      family: "aulas_universitarias",
      motivo: `Tu cálculo de muestra ya tiene ${titulares} cursos-horario sorteados.`,
    };
  }

  if (hayTerritorio) {
    return {
      family: "territorial",
      motivo:
        distritos > 0
          ? `Hojas de ruta ya tiene ${distritos} ${distritos === 1 ? "distrito" : "distritos"} declarados.`
          : "El cálculo de muestra de este proyecto es territorial.",
    };
  }

  // Regla 1: sin señal, sin marca.
  return null;
}
