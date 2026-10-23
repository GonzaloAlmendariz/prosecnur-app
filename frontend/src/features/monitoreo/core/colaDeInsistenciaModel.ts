/**
 * Modelo común de la cola de insistencia (Telefónico › Control › Insistencia;
 * Acreditación la montará en su barrido). Puro: filtros, orden, escala de
 * intentos y lista de responsables.
 *
 * Realismo operativo (procedimientos respondidos): la hoja guarda una fila por
 * caso que se sobrescribe —status, intentos acumulados, fecha del último
 * intento y una observación—. No hay historia de llamadas, próximo intento,
 * número marcado ni regla de agotado: decide el supervisor. Nada aquí los
 * deduce.
 */

export type CasoDeCola = {
  codigo: string;
  responsable: string;
  sinAsignar: boolean;
  status: string;
  intentos: number | null;
  /** Fecha del último intento, ISO (`2026-07-02`) o `null`. */
  fecha: string | null;
  observacion: string;
  variableCuota: string;
  cuota: string;
  efectivaKobo: boolean;
  diasSinRegistro: number | null;
  criterio: string;
  /** Columnas propias de algunos estudios (Medios de Vida 2026). */
  ordenTelefono: number | null;
  numTelefonos: number | null;
  telefonosIntentados: string | null;
  origen: string | null;
};

export type ResponsableDeCola = {
  nombre: string;
  sinAsignar: boolean;
  enCola: number;
  yaEfectivas: number;
  promedio: number | null;
  sinDato: number;
  porLlamar: number;
  /** Intentos por caso frente a la mediana del equipo. */
  intensidad: "sobre" | "en" | "bajo" | null;
};

export type OrdenDeCola = "intentos" | "resultado" | "fecha";

/** P12 sigue abierta: el orden por defecto es el del diseño y se puede cambiar. */
export const ORDENES_DE_COLA: ReadonlyArray<{ id: OrdenDeCola; etiqueta: string }> = [
  { id: "intentos", etiqueta: "Más intentos primero" },
  { id: "resultado", etiqueta: "Por último resultado" },
  { id: "fecha", etiqueta: "Último intento más antiguo" },
];

export type FiltroDeIntentos = "todos" | "1" | "2" | "3" | "4" | "5+" | "sin-dato";

export const FILTROS_DE_INTENTOS: ReadonlyArray<{ id: FiltroDeIntentos; etiqueta: string }> = [
  { id: "todos", etiqueta: "Todos" },
  { id: "1", etiqueta: "1" },
  { id: "2", etiqueta: "2" },
  { id: "3", etiqueta: "3" },
  { id: "4", etiqueta: "4" },
  { id: "5+", etiqueta: "5 o más" },
  { id: "sin-dato", etiqueta: "Sin dato" },
];

export type FiltrosDeCola = {
  busqueda: string;
  responsable: string | null;
  resultado: string | null;
  intentos: FiltroDeIntentos;
  cuota: string | null;
  ocultarEfectivas: boolean;
  orden: OrdenDeCola;
};

export const FILTROS_INICIALES: FiltrosDeCola = {
  busqueda: "",
  responsable: null,
  resultado: null,
  intentos: "todos",
  cuota: null,
  ocultarEfectivas: false,
  orden: "intentos",
};

function normal(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function pasaIntentos(caso: CasoDeCola, filtro: FiltroDeIntentos) {
  if (filtro === "todos") return true;
  if (filtro === "sin-dato") return caso.intentos == null;
  if (caso.intentos == null) return false;
  if (filtro === "5+") return caso.intentos >= 5;
  return caso.intentos === Number(filtro);
}

export function filtrarCola(casos: readonly CasoDeCola[], filtros: FiltrosDeCola): CasoDeCola[] {
  const busqueda = normal(filtros.busqueda);
  const filtrados = casos.filter((caso) => (
    (!busqueda || normal(caso.codigo).includes(busqueda))
    && (filtros.responsable == null || caso.responsable === filtros.responsable)
    && (filtros.resultado == null || caso.status === filtros.resultado)
    && (filtros.cuota == null || caso.cuota === filtros.cuota)
    && (!filtros.ocultarEfectivas || !caso.efectivaKobo)
    && pasaIntentos(caso, filtros.intentos)
  ));
  return ordenarCola(filtrados, filtros.orden);
}

export function ordenarCola(casos: readonly CasoDeCola[], orden: OrdenDeCola): CasoDeCola[] {
  const intentos = (caso: CasoDeCola) => caso.intentos ?? -1;
  const porCodigo = (a: CasoDeCola, b: CasoDeCola) => a.codigo.localeCompare(b.codigo, "es", { numeric: true });
  return [...casos].sort((a, b) => {
    if (orden === "resultado") {
      return a.status.localeCompare(b.status, "es") || intentos(b) - intentos(a) || porCodigo(a, b);
    }
    if (orden === "fecha") {
      // Sin fecha va al final: no se sabe cuándo fue, no que sea lo más viejo.
      if (a.fecha !== b.fecha) {
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return a.fecha.localeCompare(b.fecha);
      }
      return intentos(b) - intentos(a) || porCodigo(a, b);
    }
    return intentos(b) - intentos(a) || porCodigo(a, b);
  });
}

function plural(n: number, uno: string, varios: string) {
  return `${n.toLocaleString("es-PE")} ${n === 1 ? uno : varios}`;
}

function enumerar(partes: string[]) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/**
 * La escala de intentos de una cola, en una frase: «36 casos: 6 con 3
 * intentos, 17 con 2, 12 con 1 y 1 sin dato». Con colas de muchos intentos
 * (hasta 18 en Medios de Vida) se agrupa en 10 o más, 5 a 9 y 1 a 4.
 */
export function escalaDeIntentos(casos: readonly CasoDeCola[]): string {
  const total = plural(casos.length, "caso", "casos");
  if (!casos.length) return total;
  const conDato = casos.filter((caso) => caso.intentos != null).map((caso) => caso.intentos as number);
  const sinDato = casos.length - conDato.length;
  const maximo = conDato.length ? Math.max(...conDato) : 0;
  const partes: string[] = [];
  if (maximo >= 5) {
    const tramos: Array<[string, (n: number) => boolean]> = [
      ["10 intentos o más", (n) => n >= 10],
      ["5 a 9", (n) => n >= 5 && n <= 9],
      ["1 a 4", (n) => n >= 1 && n <= 4],
      ["0 intentos", (n) => n === 0],
    ];
    for (const [rotulo, cumple] of tramos) {
      const n = conDato.filter(cumple).length;
      if (n) partes.push(`${n.toLocaleString("es-PE")} con ${rotulo}`);
    }
  } else {
    const valores = [...new Set(conDato)].sort((a, b) => b - a);
    valores.forEach((valor, i) => {
      const n = conDato.filter((x) => x === valor).length;
      partes.push(`${n.toLocaleString("es-PE")} con ${valor.toLocaleString("es-PE")}${i === 0 ? ` ${valor === 1 ? "intento" : "intentos"}` : ""}`);
    });
  }
  if (sinDato) partes.push(`${sinDato.toLocaleString("es-PE")} sin dato`);
  return `${total}: ${enumerar(partes)}`;
}

function mediana(valores: number[]) {
  const orden = [...valores].sort((a, b) => a - b);
  if (!orden.length) return null;
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

/**
 * Intensidad frente a la mediana del equipo, con los mismos umbrales que la
 * vista anterior (25 % por encima o por debajo): la insistencia se califica
 * contra el propio equipo, no contra un umbral absoluto.
 */
export function conIntensidad(responsables: ReadonlyArray<Omit<ResponsableDeCola, "intensidad">>): ResponsableDeCola[] {
  const referencia = mediana(responsables
    .filter((item) => !item.sinAsignar && item.promedio != null)
    .map((item) => item.promedio as number));
  return responsables.map((item) => {
    if (item.sinAsignar || item.promedio == null || referencia == null || referencia <= 0) return { ...item, intensidad: null };
    const razon = item.promedio / referencia;
    return { ...item, intensidad: razon >= 1.25 ? "sobre" : razon <= 0.75 ? "bajo" : "en" };
  });
}

export function medianaDeIntentos(responsables: readonly ResponsableDeCola[]): number | null {
  return mediana(responsables
    .filter((item) => !item.sinAsignar && item.promedio != null)
    .map((item) => item.promedio as number));
}

/** «hace 25 días»; el mismo día del corte o después, dicho sin restar mal. */
export function diasDesde(dias: number | null): string {
  if (dias == null) return "";
  if (dias < 0) return "después del corte";
  if (dias === 0) return "el día del corte";
  return dias === 1 ? "hace 1 día" : `hace ${dias.toLocaleString("es-PE")} días`;
}

/** «2026-07-02» a «02/07». */
export function fechaDeCola(fecha: string | null): string {
  const partes = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return partes ? `${partes[3]}/${partes[2]}` : fecha ?? "";
}

/** Distribución de los casos de la cola por cuántos teléfonos tiene el caso. */
export function telefonosPorCaso(casos: readonly CasoDeCola[]): Array<{ telefonos: number; casos: number }> {
  const cuenta = new Map<number, number>();
  for (const caso of casos) {
    if (caso.numTelefonos == null || caso.numTelefonos <= 0) continue;
    cuenta.set(caso.numTelefonos, (cuenta.get(caso.numTelefonos) ?? 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => a[0] - b[0]).map(([telefonos, n]) => ({ telefonos, casos: n }));
}

/**
 * Días sin registro contados contra el CORTE (la fecha de la última
 * sincronización), no contra el día en que el motor armó el reporte: con un
 * proyecto abierto semanas después, la resta del motor da 113 días donde la
 * hoja lleva 25 sin tocarse. Sin fecha de corte, se deja lo que trae el bloque.
 */
export function conDiasAlCorte(casos: readonly CasoDeCola[], corteIso: string | null | undefined): CasoDeCola[] {
  const corte = corteIso ? new Date(corteIso) : null;
  if (!corte || Number.isNaN(corte.getTime())) return [...casos];
  const diaDelCorte = Date.UTC(corte.getFullYear(), corte.getMonth(), corte.getDate());
  return casos.map((caso) => {
    const partes = caso.fecha?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!partes) return { ...caso, diasSinRegistro: null };
    const dia = Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
    return { ...caso, diasSinRegistro: Math.round((diaDelCorte - dia) / 86_400_000) };
  });
}
