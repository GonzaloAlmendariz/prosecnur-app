// embudoDelOperativo.ts — de dónde sale el avance.
//
// Patrón 4 del catálogo (`docs/qa/roles-del-operativo-de-aulas-2026-08-22.md`):
// Cálculo de cursos-horario tiene un «Mapa del recorrido» que va de las 137 919
// filas leídas a los 193 titulares, **con la merma en cada arista**, y contesta
// «¿de dónde salió este número?» sin salir de la pantalla.
//
// Monitoreo no tiene esa respuesta en ninguna vista: enseña KPIs sueltos —aulas
// aplicadas, respuestas válidas, brechas— y quien los mira no sabe cómo se
// encadenan ni dónde se pierde el camino.
//
// Este es el mismo recorrido para el operativo de campo: del plan a las
// encuestas que cuentan.
import type { FlujoEtapa } from "../../../calcMuestra/universidad/ui/FlujoVertical";

const fmt = (n: number) => n.toLocaleString("es-PE");

/** Las cifras del tablero que este embudo necesita. */
export type CifrasDelOperativo = {
  aulas_titulares?: number;
  aulas_aplicadas?: number;
  respuestas_total?: number;
  respuestas_validas?: number;
  filter_rejected?: number;
  reemplazos_usados?: number;
};

const entero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
};

/**
 * El recorrido del operativo, con su merma en cada paso.
 *
 * **Devuelve vacío si no hay plan.** Un embudo de ceros no explica nada y ocupa
 * el sitio de un vacío que sí podría decir qué falta — es la misma regla que el
 * resto del perfil aplica a sus paneles.
 */
export function embudoDelOperativo(cifras: CifrasDelOperativo | null | undefined): FlujoEtapa[] {
  const c = cifras ?? {};
  const titulares = entero(c.aulas_titulares);
  if (!titulares) return [];

  const aplicadas = entero(c.aulas_aplicadas);
  const recibidas = entero(c.respuestas_total);
  const validas = entero(c.respuestas_validas);
  const rechazadas = entero(c.filter_rejected);
  const reemplazos = entero(c.reemplazos_usados);

  const etapas: FlujoEtapa[] = [
    {
      id: "plan",
      label: "Cursos-horario del plan",
      valor: fmt(titulares),
      // La procedencia pegada a la cifra, patrón 1 del catálogo.
      detalle: reemplazos
        ? `titulares sorteados · ${fmt(reemplazos)} con reemplazo activado`
        : "titulares sorteados",
      estado: "ready",
      // Lo que todavía no se ha aplicado no es una pérdida: es trabajo por
      // hacer. Se declara como merma porque es lo que separa un paso del
      // siguiente, y el rótulo lo dice sin acusar a nadie.
      merma: aplicadas < titulares
        ? { n: titulares - aplicadas, label: "sin aplicar todavía" }
        : undefined,
    },
    {
      id: "aplicadas",
      label: "Aplicadas en campo",
      valor: fmt(aplicadas),
      detalle: "con parte de campo registrado",
      estado: aplicadas ? "ready" : "pending",
    },
  ];

  // Las respuestas sólo entran si la plataforma ya trajo algo: sin fuentes
  // conectadas, dos escalones en cero dirían que se perdió todo.
  if (recibidas) {
    etapas.push({
      id: "recibidas",
      label: "Respuestas recibidas",
      valor: fmt(recibidas),
      detalle: "filas que llegaron de la plataforma",
      estado: "ready",
      merma: rechazadas ? { n: rechazadas, label: "descartadas por el filtro" } : undefined,
    });
    etapas.push({
      id: "validas",
      label: "Encuestas que cuentan",
      valor: fmt(validas),
      detalle: "pasan el filtro de efectividad",
      estado: validas ? "ready" : "pending",
    });
  }

  return etapas;
}

/**
 * El recorrido explicado en prosa, debajo de sus cifras.
 *
 * Patrón 5 del catálogo. Cálculo de cursos-horario pone bajo su cadena de
 * conversión un párrafo que explica **por qué** el divisor son elegibles y no
 * matriculados, y por qué las reservas no cambian la muestra. Un analista que
 * abre eso entiende el cálculo. Ninguna pantalla de Monitoreo explicaba lo que
 * enseña.
 *
 * Cada frase se corresponde con una regla del motor, no con una intuición:
 *
 * - «aplicado» sale de `operational_status ∈ {aplicada, cerrada}`, que es un eje
 *   distinto del de las respuestas —`monitoreo_aulas_universitarias.R:1211` las
 *   combina con un OR, no con un AND—.
 * - los filtros de validez se exigen TODOS, y uno cuya columna no está en la
 *   base **no se aplica** y se declara aparte (`:974`).
 * - el banco no cuelga de ningún titular: es respaldo del estrato, no aulas que
 *   alguien vaya a visitar (`:1873`).
 */
export function explicacionDelEmbudo(cifras: CifrasDelOperativo | null | undefined): string[] {
  const c = cifras ?? {};
  const titulares = entero(c.aulas_titulares);
  if (!titulares) return [];

  const frases = [
    "Un curso-horario cuenta como aplicado cuando su parte de campo lo declara, "
    + "aunque todavía no haya llegado ninguna respuesta: el parte lo escribe quien "
    + "estuvo en el aula y las respuestas llegan por la plataforma, que es otro camino.",
  ];

  // Las reservas sólo se explican si las hay: sin cadena, la frase sobra.
  const reemplazos = entero(c.reemplazos_usados);
  frases.push(
    reemplazos
      ? `Las reservas no aparecen en este recorrido: entran sólo cuando su titular se cae, `
        + `y ya han entrado ${reemplazos}. Aun así el plan sigue teniendo ${titulares.toLocaleString("es-PE")} `
        + `cursos-horario que visitar — una reserva sustituye a su titular, no se suma a él.`
      : `Las reservas no aparecen en este recorrido: entran sólo cuando su titular se cae, `
        + `y entonces lo sustituyen — el plan sigue teniendo ${titulares.toLocaleString("es-PE")} `
        + `cursos-horario que visitar, no uno más.`,
  );

  if (entero(c.respuestas_total)) {
    frases.push(
      "De las respuestas que llegan cuentan las que pasan todos los filtros que el "
      + "estudio declaró. Un filtro cuya columna no está en la base no se aplica y se "
      + "avisa aparte: descartarlas todas por una columna ausente sería peor que contar de más.",
    );
  }

  return frases;
}
