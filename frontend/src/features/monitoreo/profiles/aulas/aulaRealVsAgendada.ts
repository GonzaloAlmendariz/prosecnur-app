import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Qué aulas se aplicaron en un salón distinto del agendado.
 *
 * P17. El equipo anota el salón real en el parte y el plan trae el agendado, y
 * nadie los cruzaba: un aula aplicada en otro sitio no se sabía.
 *
 * **La trampa está en el formato.** El plan guarda un texto DESCRIPTIVO —«MAR
 * 08:00-10:00 C L321»— y el parte, en el libro real, sólo el salón —«L321»—.
 * Comparar las cadenas enteras daría 100 % de discrepancia. Se compara el CÓDIGO
 * DE SALÓN extraído de cada uno, y si de alguno no se puede extraer, la fila se
 * declara «sin comparar» en vez de contarla como distinta: no saber no es lo
 * mismo que cambiar.
 */

export type CambioDeAula = {
  codigo: string;
  facultad: string;
  agendada: string;
  real: string;
};

export type AulaRealVsAgendada = {
  comparadas: number;
  cambios: CambioDeAula[];
  /** Filas donde alguno de los dos no trae salón reconocible. */
  sinComparar: number;
  /** De las que no se pudieron comparar, cuántas fue porque el PARTE no trae
      salón reconocible. */
  sinSalonReal: number;
  /** …y cuántas porque el PLAN no lo trae para ese curso-horario. */
  sinSalonAgendado: number;
  /** Cursos-horario del plan con salón reconocible. En cero, el panel no está
      mirando un libro de campo incompleto: está mirando la falta del plan, y
      decir «sin salón reconocible en una de las dos hojas» mandaría a revisar
      la hoja equivocada. */
  planConSalon: number;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

/**
 * El código de salón dentro de un texto: una letra y dos o más dígitos, al
 * final o suelto —«L321», «MAR 08:00-10:00 C L321», «D102»—.
 *
 * Se toma el ÚLTIMO que aparezca: el texto del plan lleva antes la hora
 * («08:00-10:00») y un pabellón suelto, y quedarse con el primero cogería
 * basura.
 */
export function salonDe(valor: unknown): string {
  const t = texto(valor).toUpperCase();
  const encontrados = t.match(/\b[A-Z]\d{2,4}\b/g);
  return encontrados?.length ? encontrados[encontrados.length - 1] : "";
}

/**
 * @param partes filas del parte YA unidas a su facultad.
 * @param plan el plan, para el salón agendado (`label`).
 */
export function aulaRealVsAgendada(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow>,
): AulaRealVsAgendada {
  const agendadaPorCodigo = new Map<string, string>();
  for (const fila of plan) {
    const codigo = texto(fila.operational_code);
    if (codigo && !agendadaPorCodigo.has(codigo)) agendadaPorCodigo.set(codigo, texto(fila.label));
  }

  let planConSalon = 0;
  for (const agendadaTexto of agendadaPorCodigo.values()) {
    if (salonDe(agendadaTexto)) planConSalon += 1;
  }

  const cambios: CambioDeAula[] = [];
  let comparadas = 0;
  let sinComparar = 0;
  let sinSalonReal = 0;
  let sinSalonAgendado = 0;

  for (const fila of partes) {
    const codigo = texto(fila.operational_code);
    const real = salonDe(fila.actual_room);
    const agendadaTexto = agendadaPorCodigo.get(codigo) ?? "";
    const agendada = salonDe(agendadaTexto);
    if (!real || !agendada) {
      sinComparar += 1;
      // Se cuentan las dos causas por separado, y una fila a la que le faltan
      // las dos suma en ambas: el panel necesita saber cuál PREDOMINA para
      // nombrar la hoja que hay que ir a mirar.
      if (!real) sinSalonReal += 1;
      if (!agendada) sinSalonAgendado += 1;
      continue;
    }
    comparadas += 1;
    if (real !== agendada) {
      cambios.push({
        codigo,
        facultad: texto(fila.faculty) || "Sin facultad",
        agendada,
        real,
      });
    }
  }

  cambios.sort((a, b) => a.facultad.localeCompare(b.facultad, "es")
    || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  return { comparadas, cambios, sinComparar, sinSalonReal, sinSalonAgendado, planConSalon };
}
