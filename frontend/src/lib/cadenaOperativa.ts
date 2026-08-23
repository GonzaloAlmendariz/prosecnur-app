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
  /**
   * Otro nombre por el que esta unidad puede ser reconocida.
   *
   * `replacement_for` no siempre apunta al código operativo: en los planes que
   * vienen del libro apunta al NOMBRE del aula. Sin este alias, sus reservas se
   * quedaban huérfanas —la titular estaba delante y no se reconocían—.
   */
  alias?: string | null;
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
  // La cadena YA RESUELTA de cada titular, para las reservas que declaran a
  // quién reemplazan pero no traen número de cadena.
  //
  // Se guarda el número de cadena del titular y no su POSICIÓN en la lista, que
  // es lo que se guardaba antes: si el titular «CH 4» declara cadena 4 y llega
  // en la fila 1, su reserva heredaba 1 y se ordenaba junto a la cadena 1 —lejos
  // del titular del que cuelga—. Son dos escalas distintas y mezclarlas separa
  // justo lo que esta función existe para juntar. La posición sigue sirviendo
  // como último recurso, cuando el titular tampoco se puede situar.
  const cadenaDelTitular = new Map<string, number>();
  items.forEach((item, i) => {
    const s = leer(item);
    if (rolNormalizado(s.rol) !== "titular") return;
    const code = texto(s.codigo);
    if (!code || cadenaDelTitular.has(code)) return;
    const declarada = numero(s.secuencia);
    const porCodigo = cadenaDesdeCodigo(s.codigo).cadena;
    cadenaDelTitular.set(code, declarada !== INF ? declarada : porCodigo !== INF ? porCodigo : i);
  });

  return items
    .map((item, entrada) => {
      const s = leer(item);
      const rol = rolNormalizado(s.rol);
      const declarada = numero(s.secuencia);
      const porCodigo = cadenaDesdeCodigo(s.codigo);
      const cabeza = rol === "titular" ? texto(s.codigo) : texto(s.reemplazaA);
      const porTitular = cadenaDelTitular.has(cabeza)
        ? (cadenaDelTitular.get(cabeza) as number)
        : INF;
      const ordenDeclarado = numero(s.orden);
      return {
        item,
        entrada,
        banco: rol === "extra_reserve_pool" ? 1 : 0,
        // **Prioridad, y el orden entre las tres importa**: todas las filas
        // tienen que medir la cadena en la MISMA escala, o el orden no
        // significa nada. Mezclarlas colaba «AULA 2» entre «AULA 1» y sus
        // «R1.x», y una reserva sin número de cadena acababa lejos del titular
        // del que cuelga.
        // `porTitular` es la cadena ya resuelta del titular —no su posición—,
        // así que hereda la escala de él. Sólo salva a las RESERVAS que
        // declaran de quién son: es su caso legítimo. Para un titular que no
        // trae ni secuencia ni número en el código, situarlo por su propia
        // posición lo colaba en medio de cadenas numeradas —«RARO» entre «CH 1»
        // y «CH 2»—. Lo que no se puede situar va al final, no en medio.
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

/** Un titular con las reservas que cuelgan de él. */
export type CadenaDeUnidades<T> = {
  titular: T | null;
  reservas: T[];
};

export type OperativoAgrupado<T> = {
  /** Las aulas que hay que visitar, cada una con su plan B detrás. */
  cadenas: CadenaDeUnidades<T>[];
  /** Reserva de capacidad, no trabajo pendiente. */
  banco: T[];
  /** Reservas cuyo titular no está en la lista. No se esconden. */
  huerfanas: T[];
};

/**
 * Agrupa el operativo como se trabaja: titulares primero, reservas colgando.
 *
 * Gonzalo: «primordialmente las aulas titulares, por favor; los reemplazos son
 * esos reemplazos que aparecen **en caso** que no se llegue a lo esperado en el
 * aula titular o la titular no haya podido ser efectiva».
 *
 * Las tablas listaban 193 titulares y 507 reservas al mismo nivel: 700 filas que
 * dicen «hay 700 aulas que atender». No las hay — hay 193, y 507 contingencias
 * que pueden no usarse nunca. El libro de Excel ya lo tenía bien (una fila por
 * titular con su cadena en columnas); la UI copió las filas sin la jerarquía.
 *
 * Las huérfanas —reserva cuyo titular no aparece— se devuelven aparte en vez de
 * descartarse: perder una fila en silencio es peor que enseñarla suelta.
 */
export function agruparEnCadenas<T>(
  items: ReadonlyArray<T>,
  leer: (item: T) => SenasDeCadena,
): OperativoAgrupado<T> {
  const enOrden = ordenarPorCadenaOperativa(items, leer);
  const cadenas: CadenaDeUnidades<T>[] = [];
  const banco: T[] = [];
  const huerfanas: T[] = [];
  const porCabeza = new Map<string, CadenaDeUnidades<T>>();

  for (const item of enOrden) {
    const s = leer(item);
    const rol = rolNormalizado(s.rol);
    if (rol === "extra_reserve_pool") { banco.push(item); continue; }
    if (rol === "titular") {
      const cadena: CadenaDeUnidades<T> = { titular: item, reservas: [] };
      cadenas.push(cadena);
      for (const nombre of [texto(s.codigo), texto(s.alias)]) {
        if (nombre && !porCabeza.has(nombre)) porCabeza.set(nombre, cadena);
      }
      // También por número de cadena: un plan viejo no declara `replacement_for`
      // y sus reservas sólo se reconocen por el código («R1.6» es de la 1).
      const num = cadenaDesdeCodigo(s.codigo).cadena;
      if (Number.isFinite(num)) porCabeza.set(`#${num}`, cadena);
      continue;
    }
    const deQuien = texto(s.reemplazaA);
    const porNumero = `#${cadenaDesdeCodigo(s.codigo).cadena}`;
    const cadena = (deQuien && porCabeza.get(deQuien)) || porCabeza.get(porNumero);
    if (cadena) cadena.reservas.push(item);
    else huerfanas.push(item);
  }

  return { cadenas, banco, huerfanas };
}
