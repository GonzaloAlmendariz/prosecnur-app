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
