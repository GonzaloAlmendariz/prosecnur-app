import type { CollectionUnit } from "../../api/recopiladores";

/**
 * La composición del plan por facultad.
 *
 * El plan decía «193 cursos-horario» y nada más. Pero el estudio se diseña, se
 * cuota y se defiende POR FACULTAD: quien reparte agendadores necesita saber
 * que Ciencias e Ingeniería lleva 34 aulas y Letras y Ciencias Humanas 2, y
 * quien analiza necesita los elegibles que hay detrás de cada una. Los dos
 * datos —`faculty` y `eligible_n`— ya viajaban en cada unidad; la pantalla
 * simplemente no los leía.
 *
 * El respaldo se cuenta por cadena, no por unidad suelta: lo que protege a una
 * titular son SUS reservas, y una facultad con 5 titulares y 15 reservas está
 * cubierta de forma muy distinta a una con 5 y 5.
 */

export type FilaDeFacultad = {
  facultad: string;
  titulares: number;
  reservas: number;
  elegibles: number;
  /** Reservas por titular. Es lo que dice si la facultad aguanta una caída. */
  respaldo: number;
};

export type ComposicionDelPlan = {
  filas: FilaDeFacultad[];
  titulares: number;
  reservas: number;
  elegibles: number;
  /** Titulares cuya facultad no viajó en el plan. Se declaran, no se reparten. */
  sinFacultad: number;
};

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const numero = (valor: unknown): number => {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const esTitular = (unit: CollectionUnit): boolean =>
  (unit.role ?? "").toLowerCase().replace(/[ -]+/g, "_") === "titular";

const esBanco = (unit: CollectionUnit): boolean =>
  (unit.role ?? "").toLowerCase().replace(/[ -]+/g, "_") === "extra_reserve_pool";

/**
 * @param unidades las unidades del plan, tal cual llegan del backend.
 *
 * El banco de extras queda FUERA del reparto: no está asignado a ninguna
 * facultad todavía —es capacidad, no plan— y sumarlo inflaría el respaldo de
 * quien no lo tiene. Se cuenta aparte quien lo necesite.
 */
export function composicionPorFacultad(unidades: CollectionUnit[]): ComposicionDelPlan {
  const acumulado = new Map<string, FilaDeFacultad>();
  let sinFacultad = 0;

  // Cada reserva se atribuye a la facultad de SU titular, que es con quien
  // comparte cadena. Atribuirla por su propio campo daría el mismo resultado
  // mientras la cadena no cruce facultades —hoy no lo hace— pero dejaría de
  // darlo el día que se permita, y en silencio.
  const facultadDeCadena = new Map<string, string>();
  for (const unit of unidades) {
    if (!esTitular(unit)) continue;
    const cadena = texto(unit.dimensions?.operational_sequence)
      || String(numero(unit.dimensions?.operational_sequence) || "");
    if (cadena) facultadDeCadena.set(cadena, texto(unit.dimensions?.faculty));
  }

  const anota = (facultad: string, campo: "titulares" | "reservas", elegibles: number) => {
    const fila = acumulado.get(facultad) ?? {
      facultad, titulares: 0, reservas: 0, elegibles: 0, respaldo: 0,
    };
    fila[campo] += 1;
    fila.elegibles += elegibles;
    acumulado.set(facultad, fila);
  };

  for (const unit of unidades) {
    if (esBanco(unit)) continue;
    const titular = esTitular(unit);
    const propia = texto(unit.dimensions?.faculty);
    const cadena = texto(unit.dimensions?.operational_sequence)
      || String(numero(unit.dimensions?.operational_sequence) || "");
    const facultad = propia || (cadena ? facultadDeCadena.get(cadena) ?? "" : "");
    if (!facultad) {
      if (titular) sinFacultad += 1;
      continue;
    }
    // Los elegibles son los del aula que se visita. Sumar también los de las
    // reservas contaría dos veces a la misma gente: la reserva sólo entra si la
    // titular cae, y entonces sustituye sus elegibles, no los añade.
    anota(facultad, titular ? "titulares" : "reservas", titular ? numero(unit.dimensions?.eligible_n) : 0);
  }

  const filas = [...acumulado.values()]
    .map((fila) => ({
      ...fila,
      respaldo: fila.titulares > 0 ? fila.reservas / fila.titulares : 0,
    }))
    .sort((a, b) => b.titulares - a.titulares || a.facultad.localeCompare(b.facultad, "es"));

  return {
    filas,
    titulares: filas.reduce((n, f) => n + f.titulares, 0),
    reservas: filas.reduce((n, f) => n + f.reservas, 0),
    elegibles: filas.reduce((n, f) => n + f.elegibles, 0),
    sinFacultad,
  };
}
