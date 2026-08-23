// cadenaOperativa.ts — el orden en que se recorre un operativo de aulas.
//
// Gonzalo, sobre la tabla del plan: «no estaría en orden del primer curso-horario
// al último y los reemplazos así como los extras deberían estar en ese orden de
// importancia […] no lo siento coherente con la intuitividad que ya ofrece
// cálculo de cursos-horario y la cadena operativa».
//
// **Vive aquí y no en cada pantalla a propósito.** El defecto que más se ha
// repetido en este dominio es que una regla del operativo —«el banco no se
// agenda», «la cadena va junta»— se implemente en cada consumidor por separado:
// basta que uno se olvide para que salga mal, y salió mal en el libro de campo
// (2 121 filas donde debían ser 191), en la agenda por día y en el plan de
// recolección. Una sola definición, dos consumidores.
//
// El orden: las cadenas por su número y, dentro de cada una, el titular antes que
// sus reservas; el banco al final.

/** Lo que hace falta saber de una unidad para situarla en el operativo. */
export type SenasDeCadena = {
  /** `titular`, `chain_reserve`, `extra_reserve_pool`… */
  rol?: string | null;
  /** Número de cadena declarado por el sorteo (`operational_sequence`). */
  secuencia?: unknown;
  /** Lugar dentro de la cadena (`replacement_order`). */
  orden?: unknown;
  /** Código operativo propio: `CH 1`, `R 1.2`, `AULA 12`, `EXTRA 7`. */
  codigo?: string | null;
  /** Código del titular al que reemplaza, si lo declara. */
  reemplazaA?: string | null;
};

const INF = Number.POSITIVE_INFINITY;

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : INF;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const rolNormalizado = (rol: unknown): string =>
  texto(rol).toLowerCase().replace(/[ -]+/g, "_");

/**
 * La cadena y el lugar que declara el propio código.
 *
 * `AULA 12` es la cadena 12; `R1.6` es la sexta reserva de la 1. Es el último
 * respaldo y el que salva a los planes anteriores a que viajaran
 * `operational_sequence` y `replacement_for` — el del estudio real, sin ir más
 * lejos.
 */
export function cadenaDesdeCodigo(codigo: unknown): { cadena: number; dentro: number } {
  const m = /^[A-Za-zÁÉÍÓÚÑ]+\s*(\d+)(?:\.(\d+))?/.exec(texto(codigo));
  if (!m) return { cadena: INF, dentro: 0 };
  return { cadena: Number(m[1]), dentro: m[2] === undefined ? 0 : Number(m[2]) };
}

/**
 * Ordena las unidades como se recorre el operativo.
 *
 * `leer` traduce cada elemento a sus señas: las dos superficies que usan esto
 * guardan los mismos datos con formas distintas —planas en Monitoreo, dentro de
 * `dimensions` en Recopiladores— y la regla no tiene por qué saberlo.
 */
export function ordenarPorCadenaOperativa<T>(
  items: ReadonlyArray<T>,
  leer: (item: T) => SenasDeCadena,
): T[] {
  // Dónde aparece cada titular, para las reservas que declaran a quién
  // reemplazan pero no traen número de cadena.
  const rangoDelTitular = new Map<string, number>();
  items.forEach((item, i) => {
    const s = leer(item);
    if (rolNormalizado(s.rol) !== "titular") return;
    const code = texto(s.codigo);
    if (code && !rangoDelTitular.has(code)) rangoDelTitular.set(code, i);
  });

  return items
    .map((item, entrada) => {
      const s = leer(item);
      const rol = rolNormalizado(s.rol);
      const declarada = numero(s.secuencia);
      const porCodigo = cadenaDesdeCodigo(s.codigo);
      const cabeza = rol === "titular" ? texto(s.codigo) : texto(s.reemplazaA);
      const porTitular = rangoDelTitular.has(cabeza)
        ? (rangoDelTitular.get(cabeza) as number)
        : INF;
      const ordenDeclarado = numero(s.orden);
      return {
        item,
        entrada,
        banco: rol === "extra_reserve_pool" ? 1 : 0,
        // **Prioridad, y el orden entre las tres importa**: son escalas
        // distintas —el rango del titular empieza en 0 y el número del código en
        // 1— y mezclarlas colaba «AULA 2» entre «AULA 1» y sus «R1.x». Que todas
        // las filas usen la misma es la condición para que el orden signifique
        // algo.
        // El rango del titular sólo salva a las RESERVAS que declaran de quién
        // son: es su caso legítimo. Para un titular que no trae ni secuencia ni
        // número en el código, el rango es su propia posición, y usarlo lo
        // colaba en medio de cadenas numeradas —«RARO» entre «CH 1» y «CH 2»—.
        // Lo que no se puede situar va al final, no en medio.
        cadena: declarada !== INF ? declarada
          : porCodigo.cadena !== INF ? porCodigo.cadena
          : rol === "titular" ? INF : porTitular,
        // El titular no trae orden de reemplazo: va delante de sus reservas.
        dentro: ordenDeclarado !== INF ? ordenDeclarado : porCodigo.dentro,
      };
    })
    .sort((a, b) =>
      a.banco - b.banco || a.cadena - b.cadena || a.dentro - b.dentro || a.entrada - b.entrada)
    .map((x) => x.item);
}
