import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * **Cómo va la agendación**, que es lo que decide a qué aulas se va a ir.
 *
 * Gonzalo: «es muy importante tener en Resumen cómo va la agendación de aulas,
 * porque es lo que nos permite decir a estas aulas vamos a ir a aplicar, y eso
 * está en el Sheets».
 *
 * **No es el mismo dato que «Estado de aplicación».** Aquel reparte los
 * titulares por su punto del circuito —aplicados, agendados, sin agendar— y
 * contesta dónde está cada uno HOY. Éste contesta si el trabajo de agendar va a
 * un ritmo que alcance: cuántos quedan sin fecha, a qué velocidad se les está
 * poniendo fecha y hasta qué día llega lo que ya tiene.
 *
 * **La fecha de agendar no es la de aplicar.** `contact_date` es cuándo se
 * habló con el docente y `scheduled_date` cuándo se va al aula; mezclarlas
 * daría un ritmo de agendación que en realidad es el calendario de visitas.
 *
 * **Y no se proyecta.** Él descartó el pronóstico lineal para las aplicaciones y
 * aquí valdría lo mismo: se publican los días medidos y lo que falta, y quien
 * lee saca la cuenta con su propio criterio sobre cuántos días quedan.
 *
 * **Tres cosas distintas viven en la palabra «agendación»**, y él las separó el
 * 2026-09-10: «falta tomar en cuenta agendación que son reemplazos,
 * agendaciones de titulares, y cuántos en contacto se tiene que aún no
 * recibimos respuesta». La primera versión de este módulo las fundía: filtraba
 * a los titulares —los reemplazos ya activados desaparecían del parte— y metía
 * en el mismo «sin fecha» al docente al que nadie ha llamado y al que lleva
 * cuatro intentos sin contestar. Son tres trabajos distintos: agendar, insistir
 * y activar una reserva.
 */

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();
const fecha = (v: unknown) => texto(v).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

/** Los que el sorteo pide visitar; las reservas sólo entran si se las activa. */
const esTitular = (f: MonitoreoRow) => texto(f.sample_role).toLowerCase() === "titular";

/**
 * Una reserva **con trabajo encima**: se la contactó o ya tiene fecha.
 *
 * Las 1 173 reservas de la cadena que nadie ha tocado no son agendación
 * pendiente —no se agendan hasta que hacen falta— y contarlas ahogaría el
 * panel. Las cuatro que sí tienen contacto o fecha son trabajo real y hasta
 * ahora no aparecían en ninguna parte.
 */
const esReemplazoEnJuego = (f: MonitoreoRow) =>
  !esTitular(f) && Boolean(fecha(f.contact_date) || fecha(f.scheduled_date));

/** El reparto de un rol entre los cuatro puntos del trabajo de agendar. */
export type ReparteDeAgendacion = {
  /** Cuántos hay en total con trabajo de agendación encima. */
  total: number;
  /** Ya tienen fecha de visita, se hayan aplicado o no. */
  conFecha: number;
  /** Se les habló y todavía no hay respuesta: el trabajo es insistir. */
  enContacto: number;
  /** Nadie los ha llamado aún: el trabajo es empezar. */
  sinContactar: number;
  /** Dijeron que no. No están pendientes: su desenlace ya ocurrió. */
  rechazos: number;
};

/** Qué reemplazos hay en juego y de qué tipo, para el ítem 5 del dictado. */
export type ReemplazosActivados = {
  /** Cuántos ya tienen parte de campo: el «cuántos se aplicaron» de la pregunta. */
  aplicados: number;
  /** Por nivel de equivalencia, del más parecido al titular al menos. */
  porEquivalencia: Array<{ nivel: string; palabras: string; aulas: number }>;
  /** A qué titulares cubren, por su código operativo. */
  cubren: string[];
  /**
   * Cuántos NO declaran motivo (`replacement_reason` vacío).
   *
   * En el corte del 2026-09-10 son los cuatro: el porqué de cada relevo está en
   * la nota de campo, en prosa, y el campo que lo codifica va vacío. Se publica
   * en vez de callarse: sin motivo, dentro de un mes nadie sabrá por qué se
   * activó esta reserva y no otra.
   */
  sinMotivo: number;
};

/**
 * De qué tipo es un reemplazo, en palabras.
 *
 * `equivalence_level` lo escribe el sorteo y dice CUÁNTO se parece la reserva al
 * titular que cubre; es lo que decide si el reemplazo conserva la
 * representatividad de la celda o la degrada. Gonzalo: «tampoco me estás
 * diciendo cuántos reemplazos ya se aplicaron y qué tipo de reemplazos».
 *
 * Una lista cerrada que se traga lo que no conoce deja el nivel sin nombre y
 * nadie se entera, así que lo desconocido se devuelve tal cual.
 *
 * **No se dice «celda»**, aunque sea el nombre del campo: el perfil retiró esa
 * palabra de la pantalla y tiene su propio guard (`cifrasConFormato`). Aquí
 * además sobra: lo que decide es si la reserva se PARECE al titular que releva,
 * y eso se dice con «perfil».
 */
const EQUIVALENCIA: Record<string, string> = {
  misma_celda: "del mismo perfil que el titular",
  celda_equivalente: "de un perfil equivalente",
  misma_facultad: "de la misma facultad, otro perfil",
  reserva_extra: "del banco de extras",
};

export function equivalenciaEnPalabras(nivel: unknown): string {
  const clave = texto(nivel).toLowerCase();
  return EQUIVALENCIA[clave] ?? (clave || "sin nivel declarado");
}

export type AgendacionDeAulas = {
  titulares: number;
  /** Ya tienen fecha de visita, se hayan aplicado o no. */
  conFecha: number;
  /** Ni fecha ni desenlace: son el trabajo que queda. */
  sinFecha: number;
  /** Los titulares del sorteo, repartidos por punto del trabajo. */
  reparto: ReparteDeAgendacion;
  /** Las reservas que ya se están agendando, repartidas igual. */
  reemplazos: ReparteDeAgendacion;
  /** Y de qué tipo son esas reservas, y a quién cubren. */
  activados: ReemplazosActivados;
  /**
   * Agendados **sin fecha de contacto registrada**: tienen día de visita pero
   * no dejaron cuándo se habló, así que no entran en ninguna barra. Si esto
   * crece, el ritmo que dibuja el gráfico va por debajo del real.
   */
  sinDiaDeContacto: number;
  /** Cuántos de los que quedan pertenecen a cada facultad, de mayor a menor. */
  faltanPorFacultad: Array<{ facultad: string; aulas: number }>;
  /** Agendados por día, del más viejo al más nuevo, partidos por rol. */
  porDia: Array<{ fecha: string; aulas: number; titulares: number; reemplazos: number }>;
  /** Lo agendado en los últimos días con actividad, para leer el ritmo actual. */
  ultimosDias: number;
  ultimosAulas: number;
  /** El último día con visita agendada: hasta ahí llega el plan de campo. */
  hasta: string;
};

/** Su desenlace ya no es agendarse. */
const FUERA = new Set(["reemplazada", "rechazo", "rechazada", "retirada", "cancelada"]);

export function agendacionDeAulas(
  agenda: ReadonlyArray<MonitoreoRow> | null | undefined,
  { ultimos = 3 }: { ultimos?: number } = {},
): AgendacionDeAulas {
  const cero = (): ReparteDeAgendacion => ({
    total: 0, conFecha: 0, enContacto: 0, sinContactar: 0, rechazos: 0,
  });
  const vacio: AgendacionDeAulas = {
    titulares: 0, conFecha: 0, sinFecha: 0, reparto: cero(), reemplazos: cero(),
    activados: { aplicados: 0, porEquivalencia: [], cubren: [], sinMotivo: 0 },
    sinDiaDeContacto: 0, faltanPorFacultad: [],
    porDia: [], ultimosDias: 0, ultimosAulas: 0, hasta: "",
  };
  const titulares = (agenda ?? []).filter(esTitular);
  const reservas = (agenda ?? []).filter(esReemplazoEnJuego);
  if (!titulares.length && !reservas.length) return vacio;

  type Dia = { titulares: number; reemplazos: number };
  const porDia = new Map<string, Dia>();
  const faltan = new Map<string, number>();
  const reparto = cero();
  const reemplazos = cero();
  let sinDiaDeContacto = 0;
  let hasta = "";

  const anotar = (fila: MonitoreoRow, donde: ReparteDeAgendacion, esTit: boolean) => {
    donde.total += 1;
    const cuandoSeAgendo = fecha(fila.contact_date);
    if (cuandoSeAgendo) {
      const dia = porDia.get(cuandoSeAgendo) ?? { titulares: 0, reemplazos: 0 };
      if (esTit) dia.titulares += 1; else dia.reemplazos += 1;
      porDia.set(cuandoSeAgendo, dia);
    }

    const cuandoSeVisita = fecha(fila.scheduled_date);
    if (cuandoSeVisita) {
      donde.conFecha += 1;
      if (cuandoSeVisita > hasta) hasta = cuandoSeVisita;
      // Tiene día de visita y nadie apuntó cuándo se habló: esta agendación no
      // sale en ninguna barra, y el ritmo dibujado va por debajo del real.
      if (!cuandoSeAgendo) sinDiaDeContacto += 1;
      return;
    }
    // **Un rechazo no está pendiente de agendar**: su desenlace ya ocurrió y
    // contarlo entre lo que falta pediría un trabajo que nadie va a hacer.
    const estado = texto(fila.application_state).toLowerCase()
      || texto(fila.sample_status).toLowerCase();
    if (FUERA.has(estado)) { donde.rechazos += 1; return; }
    // **Contactado sin respuesta no es lo mismo que sin contactar.** Uno pide
    // insistir y el otro pide empezar, y hasta el 2026-09-10 los dos caían en
    // el mismo montón de «sin fecha».
    if (cuandoSeAgendo) donde.enContacto += 1; else donde.sinContactar += 1;
    if (!esTit) return;
    const fac = texto(fila.faculty) || texto(fila.stratum) || "Sin facultad";
    faltan.set(fac, (faltan.get(fac) ?? 0) + 1);
  };

  for (const f of titulares) anotar(f, reparto, true);
  for (const f of reservas) anotar(f, reemplazos, false);

  /**
   * **De qué tipo es cada relevo que ya está en juego.**
   *
   * Gonzalo: «tampoco me estás diciendo cuántos reemplazos ya se aplicaron y qué
   * tipo de reemplazos». El tipo es `equivalence_level`, que escribe el sorteo y
   * dice cuánto se parece la reserva al titular que cubre: de eso depende que el
   * relevo conserve la celda o la degrade.
   *
   * «Aplicados» se mide por el parte —`applied_surveys` o `applied_at`— y no por
   * tener fecha: agendar una reserva no es haber ido.
   */
  const porNivel = new Map<string, number>();
  const cubren: string[] = [];
  let aplicados = 0;
  let sinMotivo = 0;
  for (const f of reservas) {
    const nivel = texto(f.equivalence_level).toLowerCase() || "sin_nivel";
    porNivel.set(nivel, (porNivel.get(nivel) ?? 0) + 1);
    const titular = texto(f.titular_operational_code) || texto(f.replacement_for);
    if (titular) cubren.push(titular);
    if (texto(f.applied_surveys) || texto(f.applied_at)) aplicados += 1;
    if (!texto(f.replacement_reason)) sinMotivo += 1;
  }
  // El orden es el del sorteo —del relevo más parecido al menos—, no el de
  // frecuencia: es la escala que dice cuánto se degrada la celda.
  const ORDEN = ["misma_celda", "celda_equivalente", "misma_facultad", "reserva_extra"];
  const activados: ReemplazosActivados = {
    aplicados,
    porEquivalencia: [...porNivel.entries()]
      .map(([nivel, aulas]) => ({ nivel, palabras: equivalenciaEnPalabras(nivel), aulas }))
      .sort((a, b) => {
        const ia = ORDEN.indexOf(a.nivel);
        const ib = ORDEN.indexOf(b.nivel);
        return (ia < 0 ? ORDEN.length : ia) - (ib < 0 ? ORDEN.length : ib);
      }),
    cubren: [...new Set(cubren)].sort(),
    sinMotivo,
  };

  const dias = [...porDia.entries()]
    .map(([f, d]) => ({ fecha: f, aulas: d.titulares + d.reemplazos, ...d }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  // Los últimos días CON actividad, no los últimos del calendario: un fin de
  // semana sin agendar hundiría el ritmo con ceros que nadie trabajó.
  const cola = dias.slice(-ultimos);

  return {
    titulares: titulares.length,
    conFecha: reparto.conFecha,
    sinFecha: reparto.enContacto + reparto.sinContactar,
    reparto,
    reemplazos,
    activados,
    sinDiaDeContacto,
    faltanPorFacultad: [...faltan.entries()]
      .map(([facultad, aulas]) => ({ facultad, aulas }))
      .sort((a, b) => b.aulas - a.aulas || a.facultad.localeCompare(b.facultad)),
    porDia: dias,
    ultimosDias: cola.length,
    ultimosAulas: cola.reduce((n, d) => n + d.aulas, 0),
    hasta,
  };
}
