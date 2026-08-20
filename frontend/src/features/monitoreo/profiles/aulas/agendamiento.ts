/**
 * Cómo va el agendamiento, para quien llama a los docentes.
 *
 * Agendar y aplicar son dos trabajos distintos, y la pestaña de agenda enseñaba
 * las doce columnas del Excel sin resumir nada: para saber cuántas faltan por
 * agendar había que leer 196 filas. Encima presidía la banda de la sección, que
 * habla de aulas APLICADAS —el trabajo del que va al aula, no del que llama—.
 *
 * Gonzalo: «el registro de campo y la agenda no son lo mismo… lo que se registra
 * en campo tiene que verse diferente, son dos cosas diferentes».
 *
 * Lo que decide quien llama: cuántas quedan por cerrar, cuáles están costando
 * más de una gestión, y por qué medio se consigue.
 */

type Fila = Readonly<Record<string, unknown>>;

const txt = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => {
  const n = Number.parseFloat(txt(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type Agendamiento = {
  /** Filas que se van a visitar: sin el banco ni las ya reemplazadas. */
  enJuego: number;
  /** De ésas, con fecha y hora cerradas. */
  agendadas: number;
  /** Las que aún no tienen cita. */
  porAgendar: number;
  /** Cuántas necesitaron más de una gestión. */
  conInsistencia: number;
  /** Mediana de intentos entre las que registran alguno. */
  intentosMedianos: number | null;
  /** Por qué medio se contactó, de más a menos. */
  medios: Array<{ medio: string; aulas: number }>;
};

/** Un aula del banco o ya reemplazada no la va a agendar nadie. */
function seVaAAgendar(fila: Fila): boolean {
  const rol = txt(fila.sample_role).toLowerCase();
  if (rol === "extra_reserve_pool") return false;
  const estado = txt(fila.sample_status).toLowerCase();
  return estado !== "reemplazada";
}

export function agendamiento(filas: ReadonlyArray<Fila>): Agendamiento {
  const enJuego = filas.filter(seVaAAgendar);
  let agendadas = 0;
  let conInsistencia = 0;
  const intentos: number[] = [];
  const porMedio = new Map<string, number>();

  for (const fila of enJuego) {
    // Con FECHA, no por el estado: «agendada» es lo que dice la hoja y la fecha
    // es lo que se puede visitar. Cuando los dos discrepan manda el hecho.
    if (txt(fila.scheduled_date)) agendadas += 1;
    const n = num(fila.contact_attempts);
    if (n !== null && n > 0) {
      intentos.push(n);
      if (n > 1) conInsistencia += 1;
    }
    const medio = txt(fila.contact_medium);
    if (medio) porMedio.set(medio, (porMedio.get(medio) ?? 0) + 1);
  }

  intentos.sort((a, b) => a - b);
  const mediana = intentos.length
    ? intentos[Math.floor((intentos.length - 1) / 2)]
    : null;

  return {
    enJuego: enJuego.length,
    agendadas,
    porAgendar: enJuego.length - agendadas,
    conInsistencia,
    intentosMedianos: mediana,
    medios: [...porMedio.entries()]
      .map(([medio, aulas]) => ({ medio, aulas }))
      .sort((a, b) => b.aulas - a.aulas || a.medio.localeCompare(b.medio, "es")),
  };
}
