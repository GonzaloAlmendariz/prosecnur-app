import type { CollectionUnit } from "../../api/recopiladores";

/**
 * La forma del operativo: cuántas visitas, cuánto respaldo y de qué hondura.
 *
 * El panel que abre el plan enseñaba «Tipo», «Método» y «Revisión». «Tipo:
 * Cursos-horario» ya está repetido en la barra del módulo dos centímetros más
 * arriba; «Método: Aulas (compatibilidad)» es el nombre del adaptador; y la
 * revisión es un contador. Ninguno contesta la pregunta con la que un jefe de
 * campo abre esta pantalla: **si se me cae un aula, ¿tengo con qué?**
 *
 * Medido en HSVG2026 el 2026-08-23 sobre el sorteo del 22: 193 titulares, 507
 * reservas repartidas en cadenas de 2, 3 y 4 —107, 51 y 35 cadenas—, ninguna
 * cadena sin reserva, y 1.916 extras en banco. Todo eso viajaba en el plan y no
 * se leía en ninguna parte.
 */

export type FormaDelOperativo = {
  /** Aulas que se van a visitar. */
  titulares: number;
  /** Reservas encadenadas a una titular concreta. */
  reservas: number;
  /** Capacidad sin asignar: no es el siguiente turno de nadie. */
  banco: number;
  /** La cadena más corta y la más honda, en número de reservas. */
  minReservas: number;
  maxReservas: number;
  /** Titulares sin ninguna reserva detrás. Es el riesgo que hay que declarar. */
  sinReserva: number;
};

const rol = (unit: CollectionUnit): string =>
  (unit.role ?? "").toLowerCase().replace(/[ -]+/g, "_");

const cadenaDe = (unit: CollectionUnit): string => {
  const bruto = unit.dimensions?.operational_sequence;
  if (typeof bruto === "number" && Number.isFinite(bruto)) return String(bruto);
  return typeof bruto === "string" ? bruto.trim() : "";
};

export function formaDelOperativo(unidades: CollectionUnit[]): FormaDelOperativo {
  const porCadena = new Map<string, number>();
  let titulares = 0;
  let reservas = 0;
  let banco = 0;
  let titularesSinCadena = 0;

  for (const unit of unidades) {
    const papel = rol(unit);
    if (papel === "extra_reserve_pool") { banco += 1; continue; }
    const cadena = cadenaDe(unit);
    if (papel === "titular") {
      titulares += 1;
      // Un titular sin número de cadena no puede emparejarse con sus reservas,
      // así que no se cuenta como «sin reserva»: se sabría falso. Se declara
      // aparte para que la pantalla no prometa una cobertura que no midió.
      if (cadena) porCadena.set(cadena, porCadena.get(cadena) ?? 0);
      else titularesSinCadena += 1;
      continue;
    }
    reservas += 1;
    if (cadena) porCadena.set(cadena, (porCadena.get(cadena) ?? 0) + 1);
  }

  const hondura = [...porCadena.values()];
  return {
    titulares,
    reservas,
    banco,
    minReservas: hondura.length ? Math.min(...hondura) : 0,
    maxReservas: hondura.length ? Math.max(...hondura) : 0,
    sinReserva: hondura.filter((n) => n === 0).length + titularesSinCadena,
  };
}
