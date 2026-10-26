// Por qué una lámina no se dibuja, en lenguaje llano. El motor rechaza el gráfico con un mensaje de validación
// («`titulos_grupo` debe ser NULL o character() no vacio», reporte_plan_slides.R); el aviso decía dónde fallaba pero no
// por qué (Gonzalo, 2026-10-25, Arte_v1-4 lámina 8). Aquí se lee la forma del mensaje —valor que no se acepta, ajuste que
// no corresponde, campo vacío— y el campo se nombra como lo ve el analista. Un campo sin nombre conocido no se muestra.

/** Nombre visible del ajuste, con su artículo; el género del sustantivo decide «quedó/quedaron vacío/a». */
type Ajuste = { nombre: string; suelto: string; plural?: boolean; femenino?: boolean };

const AJUSTES: Record<string, Ajuste> = {
  var: { nombre: "Variable", suelto: "la variable", femenino: true },
  vars: { nombre: "Preguntas", suelto: "las preguntas", plural: true, femenino: true },
  cruce: { nombre: "Cruce", suelto: "el cruce" },
  cruces: { nombre: "Cruce", suelto: "el cruce" },
  titulo: { nombre: "Título", suelto: "el título" },
  titulos_grupo: { nombre: "Títulos por bloque", suelto: "los títulos por bloque", plural: true },
  filtros: { nombre: "Filtros", suelto: "los filtros", plural: true },
  base: { nombre: "Base", suelto: "la base", femenino: true },
  objetivo: { nombre: "Variable objetivo", suelto: "la variable objetivo", femenino: true },
  top2box_labels: { nombre: "Categorías del Top Two Box", suelto: "las categorías del Top Two Box", plural: true, femenino: true },
  filas: { nombre: "Filas", suelto: "las filas", plural: true, femenino: true },
  bloques: { nombre: "Bloques", suelto: "los bloques", plural: true },
};

/** «una variable suelta» y no «la variable»: «no usar `var`» se dice de un gráfico que trabaja con varias preguntas. */
const NO_USA: Record<string, string> = {
  var: "una variable suelta",
  vars: "una lista de preguntas",
};

function vacio(a: Ajuste): string {
  const v = a.femenino ? "vacía" : "vacío";
  return a.plural ? `${a.suelto} quedaron ${v}s` : `${a.suelto} quedó ${v}`;
}

/**
 * La causa del rechazo, para completar «su gráfico no se puede dibujar porque …». `null` si el mensaje no tiene una forma
 * reconocible: mejor no explicar que explicar mal.
 */
export function causaLlana(msg: string): string | null {
  const noUsar = /no usar `(\w+)`/.exec(msg);
  if (noUsar) {
    const que = NO_USA[noUsar[1]] ?? (AJUSTES[noUsar[1]] ? `el ajuste «${AJUSTES[noUsar[1]].nombre}»` : "un ajuste");
    return `lleva ${que}, que este tipo de gráfico no usa`;
  }
  const quedoVacio = /`(\w+)` qued[oó] vac[ií]o/.exec(msg);
  if (quedoVacio) {
    const a = AJUSTES[quedoVacio[1]];
    return a ? vacio(a) : "uno de sus ajustes quedó vacío";
  }
  const valor = /`(\w+)` debe (?:ser|tener|contener)\b/.exec(msg);
  if (valor) {
    const a = AJUSTES[valor[1]];
    return a
      ? `el ajuste «${a.nombre}» tiene un valor que este gráfico no acepta`
      : "uno de sus ajustes tiene un valor que este gráfico no acepta";
  }
  return null;
}
