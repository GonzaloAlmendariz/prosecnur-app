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
import { fmt } from "./kpisDeAulas";

/** Las cifras del tablero que este embudo necesita. */
export type CifrasDelOperativo = {
  aulas_titulares?: number;
  aulas_aplicadas?: number;
  respuestas_total?: number;
  respuestas_validas?: number;
  respuestas_fuera_del_operativo?: number;
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
/**
 * **`reemplazos_usados` no cuenta reemplazos.**
 *
 * El motor lo define como reservas cuyo `operational_status` ya salió del estado
 * inicial —`agendada`, `en_campo`, `aplicada`, `cerrada` o `parcial`
 * (`monitoreo_aulas_universitarias.R:2330`)—, o sea **reservas en juego**, no
 * titulares que se cayeron y fueron sustituidos.
 *
 * El repo ya lo sabía: `kpisDeAulas.ts` lo retiró de un KPI con esta nota —«el
 * KPI `reemplazos_usados` del motor NO sirve aquí… con el registro vacío decía
 * "0" mientras el panel de al lado decía "3 cerraron con un reemplazo"»— y esta
 * superficie se quedó con él. Medido sobre `campo_malo`: el embudo decía «174
 * con reemplazo activado» y «ya han entrado 174» mientras Consultas contaba
 * «Cerraron con reemplazo 3».
 *
 * Se recibe en su lugar el conteo del tramo `reemplazada`, que es el estado del
 * **titular sustituido** y por tanto lo que la frase promete. No se recalcula
 * aquí: lo pasa quien ya lo tiene de `estadoDeAplicacion()`, para no crear una
 * segunda regla de lo mismo.
 */
export function embudoDelOperativo(
  cifras: CifrasDelOperativo | null | undefined,
  titularesReemplazados?: number | null,
): FlujoEtapa[] {
  const c = cifras ?? {};
  const titulares = entero(c.aulas_titulares);
  if (!titulares) return [];

  const aplicadas = entero(c.aulas_aplicadas);
  const recibidas = entero(c.respuestas_total);
  const validas = entero(c.respuestas_validas);
  // **La merma de una etapa es la diferencia con la siguiente, no otra cuenta.**
  //
  // Se leía de `filter_rejected`, que el motor calcula con
  // `.monitoreo_aulas_filter_passed()` — y esa función **no mira la cadena de
  // filtros declarada**: busca en la base una columna llamada `filter_passed`,
  // `apto`, `elegible`, `consent` o `consentimiento`, y si la encuentra cuenta
  // sobre ella. Como el instrumento de este estudio abre con la pregunta de
  // consentimiento, la columna se llama exactamente así, y la merma pasó a ser
  // la caída de ESE filtro en vez de la de los dos declarados.
  //
  // Medido en pantalla: «1 811 recibidas · −67 descartadas» sobre «1 637 que
  // cuentan», y 1 811 − 1 637 = **174**. Dos etapas contiguas del mismo embudo
  // contando con criterios distintos.
  //
  // Restar las dos etapas hace la merma **cierta por construcción**: es lo que
  // se pierde entre este escalón y el de abajo, que es lo que un embudo dice.
  // La heurística del motor sigue sirviendo donde nació —estudios que no
  // declaran criterio— y ahí las dos cuentas coinciden.
  const rechazadas = Math.max(0, recibidas - validas);
  // **Y de esa merma, cuánta no era del estudio.** «60 descartadas por el
  // filtro» mete en la misma bolsa dos noticias que piden cosas distintas: las
  // que llegaron por el QR de capacitación o de prueba —no son del operativo y
  // no hay nada que arreglar— y las que sí salieron de un curso-horario pero no
  // pasan el criterio, que es lo único sobre lo que el campo puede actuar. El
  // primer día de HSVG2026 eran 36 y 24, y el aviso decía 60 a secas.
  const fueraDelOperativo = Math.min(rechazadas, entero(c.respuestas_fuera_del_operativo));
  const noPasanElCriterio = Math.max(0, rechazadas - fueraDelOperativo);
  const reemplazos = entero(titularesReemplazados);

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
      label: "Aplicados en campo",
      valor: fmt(aplicadas),
      // **El detalle dice las TRES vías desde el 2026-09-07.**
      //
      // Decía «registradas en esta app» porque `aulas_aplicadas` sólo contaba
      // `operational_status`, que escribe el registro de la app. Ese día el
      // predicado pasó a incluir el parte y las respuestas —ocho aulas
      // produciendo encuestas y la etapa decía UNA—, así que este renglón se
      // corrige con él.
      //
      // Ya pasó una vez que la prosa de más abajo se arregló y este renglón se
      // quedó atrás, en el MISMO archivo: es como vuelve un defecto reparado.
      detalle: "registrados, con parte o ya recibiendo respuestas",
      estado: aplicadas ? "ready" : "pending",
    },
  ];

  // Las respuestas sólo entran si la plataforma ya trajo algo: sin fuentes
  // conectadas, dos escalones en cero dirían que se perdió todo.
  if (recibidas) {
    etapas.push({
      id: "recibidas",
      // «Respuestas leídas», el mismo rótulo que el KPI de Fuentes: los dos
      // salen de la MISMA clave (`kpis.respuestas_total`, todas las filas de la
      // base) y «recibidas» era un cuarto nombre para esa cifra.
      label: "Respuestas leídas",
      valor: fmt(recibidas),
      // **Aquí cambia lo que se cuenta, y por eso la cifra sube.** Con datos
      // reales el flujo va 174 → 152 → 2.817 → 2.668: un embudo que se
      // multiplica por 18 en el tercer peldaño. No es un error de cálculo, es
      // que los dos primeros cuentan cursos-horario y los dos últimos cuentan
      // respuestas. Los rótulos ya lo decían por separado —«Aplicados en campo»
      // y «Respuestas leídas»— pero nadie enunciaba el salto, y la arista
      // entre ambos va vacía a propósito: entre unidades distintas no hay merma
      // que restar. Quien lee de arriba abajo veía crecer un embudo.
      detalle: "respuestas, ya no cursos-horario: por eso sube",
      estado: "ready",
      merma: rechazadas
        ? {
            n: rechazadas,
            label: fueraDelOperativo
              ? `no cuentan: ${fmt(fueraDelOperativo)} fuera del operativo · `
                + `${fmt(noPasanElCriterio)} no pasan el criterio`
              : "no pasan el criterio de efectividad",
          }
        : undefined,
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
/** Misma corrección que `embudoDelOperativo`: la frase de las reservas hablaba
 *  con `reemplazos_usados`, que cuenta reservas en juego y no titulares
 *  sustituidos. */
export function explicacionDelEmbudo(
  cifras: CifrasDelOperativo | null | undefined,
  titularesReemplazados?: number | null,
): string[] {
  const c = cifras ?? {};
  const titulares = entero(c.aulas_titulares);
  if (!titulares) return [];

  const frases = [
    // **Los tres caminos, y desde el 2026-09-07 los tres cuentan.**
    //
    // Esta frase decía que sólo el registro de la app movía la cifra, y era
    // cierto: `aulas_aplicadas` miraba `operational_status`, que el libro no
    // mueve a «aplicada» nunca. El primer día de campo eso dio **una** aula
    // aplicada con ocho produciendo encuestas —«hay aulas que se están
    // aplicando ahora, pero no tengo nada en la base de control»—, así que la
    // definición pasó a incluir el parte y las respuestas
    // (`monitoreo_aulas_aula_aplicada.R`).
    //
    // La frase se corrige con el motor: una explicación que sobrevive al cambio
    // que describe deja de explicar y pasa a desmentir la cifra que tiene
    // encima.
    "Un curso-horario cuenta como aplicado por tres caminos, y basta con uno: "
    + "alguien lo registra en esta app, su parte de campo lo declara aplicado, o ya "
    + "están llegando sus respuestas por la plataforma. El parte se rinde al cerrar "
    + "la aplicación y a veces tarda; las respuestas llegan solas, así que un "
    + "curso-horario que ya está recogiendo se ve aquí aunque nadie haya escrito "
    + "nada todavía.",
  ];

  // Las reservas sólo se explican si las hay: sin cadena, la frase sobra.
  const reemplazos = entero(titularesReemplazados);
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
