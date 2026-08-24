import { fmt } from "./kpisDeAulas";

/**
 * El avance por celda facultad × sexo, ordenado por lo que hay que hacer.
 *
 * Es la lectura que faltaba. La tabla de cuotas dice **dónde estás**; ésta dice
 * **si vas a llegar** y **si el campo se está comportando como el modelo**. Las
 * dos conviven a propósito: en 2025 la única celda incumplida fue EE.GG. Letras
 * hombres, y para cuando «ya no llegaste» es visible, no queda nada que hacer.
 *
 * Las frases vienen del motor (`etiqueta`, `etiqueta_calibracion`): aquí no se
 * redacta nada. Con dos redacciones vivas del mismo estado, la pantalla acaba
 * diciendo dos cosas y ningún test lo ve.
 */

/** Una celda tal como la publica el motor. */
export type CeldaAvance = {
  faculty?: unknown;
  sex?: unknown;
  cuota?: unknown;
  logrado?: unknown;
  previsto?: unknown;
  aporte_pendiente?: unknown;
  proyeccion?: unknown;
  brecha?: unknown;
  calibracion?: unknown;
  estado?: unknown;
  previsto_origen?: unknown;
  etiqueta?: unknown;
  etiqueta_calibracion?: unknown;
};

export type FilaAvance = {
  clave: string;
  facultad: string;
  sexo: string;
  cuota: number;
  logrado: number;
  proyeccion: number;
  brecha: number;
  estado: string;
  etiqueta: string;
  etiquetaCalibracion: string;
  /** La causa en una frase, no sólo el hecho. Vacía cuando no aporta nada. */
  porque: string;
  /** El origen del previsto; `""` cuando el motor no lo declara. */
  origen: string;
};

/**
 * Orden de urgencia. Primero lo que exige una decisión hoy y al final lo que no
 * se consulta: una lista que abre por lo que está bien obliga a buscar el
 * problema, que es justo lo que una pantalla de campo no puede pedir.
 */
const ORDEN: Record<string, number> = {
  deficit_no_subsanable: 0,
  deficit_proyectado: 1,
  ajustada: 2,
  asegurada: 3,
  sin_cuota: 4,
};

const num = (v: unknown, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * La causa del estado, en las cifras que el motor ya publica.
 *
 * «Derecho mujeres en déficit» no manda a nadie a ningún sitio; «faltan 24 y
 * las 4 aulas pendientes aportan 21» sí. Se compone sólo cuando hay algo que
 * explicar: repetir el titular con otras palabras es ruido.
 */
export function porqueDeLaCelda(c: CeldaAvance): string {
  const estado = txt(c.estado);
  if (estado !== "deficit_proyectado" && estado !== "deficit_no_subsanable") return "";
  const cuota = num(c.cuota);
  const logrado = num(c.logrado);
  const pendiente = num(c.aporte_pendiente);
  if (cuota <= 0) return "";
  const falta = Math.max(0, cuota - logrado);
  const p = pendiente > 0
    ? `las aulas que faltan por aplicar aportan ${fmt(pendiente)}`
    : "no quedan aulas por aplicar";
  return `Lleva ${fmt(logrado)} de ${fmt(cuota)}: faltan ${fmt(falta)} y ${p}.`;
}

/** Normaliza y ordena las celdas del motor. */
export function avanceProyectado(celdas: ReadonlyArray<CeldaAvance> | null | undefined): FilaAvance[] {
  if (!celdas?.length) return [];
  const filas = celdas.map((c) => {
    const facultad = txt(c.faculty) || "Sin facultad";
    const sexo = txt(c.sex).toUpperCase();
    return {
      clave: `${facultad}|${sexo}`,
      facultad,
      sexo: sexo === "F" ? "Mujeres" : sexo === "M" ? "Hombres" : sexo || "Sin sexo",
      cuota: num(c.cuota),
      logrado: num(c.logrado),
      proyeccion: num(c.proyeccion),
      brecha: num(c.brecha),
      estado: txt(c.estado) || "sin_estado",
      // **Nunca se redacta aquí.** Sin frase del motor la celda lo dice, en vez
      // de que la pantalla se invente una que suene bien.
      etiqueta: txt(c.etiqueta) || "Sin estado",
      etiquetaCalibracion: txt(c.etiqueta_calibracion),
      porque: porqueDeLaCelda(c),
      origen: txt(c.previsto_origen),
    };
  });
  return filas.sort((a, b) => {
    const oa = ORDEN[a.estado] ?? 9;
    const ob = ORDEN[b.estado] ?? 9;
    if (oa !== ob) return oa - ob;
    // Dentro del mismo estado manda la brecha: la celda que más pide primero.
    if (b.brecha !== a.brecha) return b.brecha - a.brecha;
    return a.clave.localeCompare(b.clave, "es");
  });
}

/** Cuántas celdas exigen una decisión. Cero es cero, no «todo bien». */
export function celdasQuePidenAccion(filas: ReadonlyArray<FilaAvance>): number {
  return filas.filter((f) => f.estado === "deficit_proyectado" || f.estado === "deficit_no_subsanable").length;
}
