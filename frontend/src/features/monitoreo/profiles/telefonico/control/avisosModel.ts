/**
 * Control › Avisos del telefónico (ficha «Control, Avisos»): qué hay que
 * corregir, agrupado por causa, con su nivel, cuántos casos toca, el detalle y
 * dónde se corrige.
 *
 * La lectura de las alertas reales es la de `TelefonicoPhoneAlerts.ts`, la misma
 * de la vista anterior. Los avisos fuertes del telefónico que agregó «ACNUR
 * RMS» (`cruce_llave_bajo`, `filtro_columna_no_encontrada`,
 * `status_desconocido`) se agregan si el bloque los trae y el filtro de
 * alertas telefónicas los dejó fuera; si no vienen, no se dibujan.
 *
 * «Casos sin asignar» va aparte y en gris: un caso sin responsable no es
 * atraso de nadie (procedimientos respondidos).
 */

import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { buildAcreditacionPhoneRealAlertModel, type AcreditacionQualityAlertItem } from "../TelefonicoPhoneAlerts";
import { filasDeBloque, filasDeHoja } from "../navegacion/bloques";
import { llamadosPorFecha } from "./barridoModel";
import { construirRespuestas, duracionLegible } from "./respuestasModel";

type Fila = Record<string, unknown>;

export type NivelDeAviso = "alta" | "media" | "baja";

export type DestinoDeAviso = {
  etiqueta: string;
  /** Dirección pública de la pestaña donde se corrige; sin ella, se corrige fuera de la app. */
  direccion: { seccion: string; pestana: string } | null;
};

export type Aviso = {
  id: string;
  nivel: NivelDeAviso;
  titulo: string;
  detalle: string;
  casos: number | null;
  /** Qué cuenta la cifra: casos, o responsables cuando el aviso es por persona. */
  unidad: "casos" | "responsables";
  codigo: string;
  destino: DestinoDeAviso;
  donde: string;
  fuente: string;
  /** Una línea por persona o lugar cuando el aviso agrupa varios. */
  desglose: Array<{ etiqueta: string; valor: number | null }>;
  /** Los casos que toca, cuando el corte los nombra. */
  afectados: CasoAfectado[];
};

export type CasoAfectado = { codigo: string; responsable: string; fecha: string; nota: string };

export type Avisos = {
  avisos: Aviso[];
  sinAsignar: { casos: number; detalle: string } | null;
  porNivel: Record<NivelDeAviso, number>;
};

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function normal(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_\s]+/g, " ").trim();
}

function slug(valor: string) {
  return normal(valor).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const AVISOS_FUERTES = ["cruce llave bajo", "filtro columna no encontrada", "status desconocido"];

const TITULO_FUERTE: Record<string, string> = {
  "cruce llave bajo": "Casi ninguna respuesta cruza con la hoja",
  "filtro columna no encontrada": "Un filtro apunta a una columna que no existe",
  "status desconocido": "Status sin regla de estado",
};

function nivelDe(tono: AcreditacionQualityAlertItem["tone"]): NivelDeAviso {
  return tono === "danger" ? "alta" : tono === "warning" ? "media" : "baja";
}

function nivelDeTexto(nivel: string): NivelDeAviso {
  const clave = normal(nivel);
  return clave.includes("alta") ? "alta" : clave.includes("media") ? "media" : "baja";
}

/** Dónde se corrige cada causa. Lo que se corrige en la hoja del equipo no tiene enlace. */
export function destinoDeAviso(tipo: string, senal: string): DestinoDeAviso {
  const clave = normal(tipo);
  if (clave.includes("status desconocido")) return { etiqueta: "Estados, en Insumos", direccion: { seccion: "insumos", pestana: "estados" } };
  if (clave.includes("filtro columna") || clave.includes("cruce llave") || clave.includes("llave")) {
    return { etiqueta: "Llave y filtros, en Insumos", direccion: { seccion: "insumos", pestana: "llave" } };
  }
  if (senal === "short_duration" || clave.includes("duracion")) return { etiqueta: "Respuestas, en Control", direccion: { seccion: "control", pestana: "respuestas" } };
  if (senal === "platform_gap" || clave.includes("codpulso") || clave.includes("kobo")) {
    return { etiqueta: "Discrepancias, en Control", direccion: { seccion: "control", pestana: "discrepancias" } };
  }
  if (senal === "sweep_gap" || clave.includes("barrido")) return { etiqueta: "Barrido, en Control", direccion: { seccion: "control", pestana: "barrido" } };
  return { etiqueta: "Hoja del equipo", direccion: null };
}

function esSinAsignar(alerta: AcreditacionQualityAlertItem) {
  const clave = normal(`${alerta.type} ${alerta.title}`);
  return clave.includes("sin responsable") || clave.includes("sin asignar");
}

/** El motor escribe a veces «codigo:MVH0006»; la ficha muestra el código. */
function codigoDeCaso(valor: unknown) {
  return texto(valor).replace(/^c[oó]digo\s*:\s*/i, "");
}

/** Quita el prefijo «codigo:» dondequiera que aparezca en un texto del motor. */
export function sinPrefijoDeCodigo(valor: string) {
  return valor.replace(/\bc[oó]digo\s*:\s*(?=\S)/gi, "");
}

/** Una línea por persona (o lugar), sumando sus alertas: nadie aparece dos veces. */
function desgloseDe(grupo: readonly AcreditacionQualityAlertItem[]): Aviso["desglose"] {
  const porEtiqueta = new Map<string, number | null>();
  grupo.forEach((alerta) => {
    const etiqueta = alerta.owner || alerta.where;
    const previo = porEtiqueta.get(etiqueta);
    const valor = alerta.count ?? 1;
    porEtiqueta.set(etiqueta, previo === undefined ? valor : (previo ?? 0) + valor);
  });
  return [...porEtiqueta.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0) || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/** Responsables empatados en la cifra más alta: cuántos y en qué cifra, sin repetir el total. */
export function detalleDeEmpate(personas: ReadonlyArray<{ etiqueta: string; valor: number | null }>) {
  const tope = personas[0]?.valor;
  const empatados = personas.filter((persona) => persona.valor === tope).length;
  const cifra = tope == null ? "" : ` (${tope.toLocaleString("es-PE")})`;
  if (empatados === personas.length) return `Todos con la misma cifra${cifra}.`;
  return `${empatados.toLocaleString("es-PE")} empatan en la cifra más alta${cifra}.`;
}

export function construirAvisos(reports: MonitoreoAcreditacionReports | null | undefined): Avisos {
  const filas = filasDeHoja(reports, "alertas", ["alertas"]);
  const modelo = buildAcreditacionPhoneRealAlertModel({ alertRows: filas });
  const avisos: Aviso[] = [];
  const alertaLibre = modelo.activeAlerts.find(esSinAsignar) ?? null;

  // La vista anterior traía una alerta por responsable («Responsable con casos
  // por iniciar», una por persona). Aquí se agrupan por causa: la cifra pasa a
  // ser cuántos responsables, y el detalle dice el caso más marcado.
  const porCausa = new Map<string, AcreditacionQualityAlertItem[]>();
  modelo.activeAlerts.forEach((alerta) => {
    if (esSinAsignar(alerta)) return;
    const llave = normal(alerta.type) || normal(alerta.title);
    porCausa.set(llave, [...(porCausa.get(llave) ?? []), alerta]);
  });
  const filasPorTipo = new Map<string, Fila[]>();
  filas.forEach((fila) => {
    const tipo = normal(fila["Tipo alerta"] ?? fila.tipo);
    filasPorTipo.set(tipo, [...(filasPorTipo.get(tipo) ?? []), fila]);
  });
  const afectadosDe = (tipo: string): CasoAfectado[] => (filasPorTipo.get(normal(tipo)) ?? [])
    .filter((fila) => codigoDeCaso(fila.CodPulso))
    .map((fila) => ({ codigo: codigoDeCaso(fila.CodPulso), responsable: texto(fila.Responsable), fecha: "", nota: texto(fila.Detalle) }));
  porCausa.forEach((grupo) => {
    const primera = grupo[0];
    const afectados = afectadosDe(primera.type);
    // Una alerta por persona sólo cuando la señal es de asignación, o cuando
    // cada alerta nombra a un responsable distinto y ninguna nombra un caso.
    // Tres alertas por caso de dos personas son tres casos, no «3 responsables».
    const duenos = grupo.map((alerta) => alerta.owner);
    const porPersona = primera.signal.kind === "assignment_gap"
      || (grupo.length > 1 && duenos.every(Boolean) && new Set(duenos).size === duenos.length && !afectados.length);
    // Por persona se cuentan personas distintas, no alertas: dos alertas de
    // asignación del mismo dueño son un responsable.
    const personas = desgloseDe(grupo);
    const varias = porPersona && personas.length > 1;
    const empate = personas.length > 1 && (personas[1].valor ?? 0) === (personas[0].valor ?? 0);
    const mayor = grupo.find((alerta) => (alerta.owner || alerta.where) === personas[0]?.etiqueta) ?? primera;
    const orden: Record<NivelDeAviso, number> = { alta: 0, media: 1, baja: 2 };
    const nivel = grupo.map((alerta) => nivelDe(alerta.tone)).sort((a, b) => orden[a] - orden[b])[0];
    const casosNombrados = new Set(afectados.map((caso) => caso.codigo)).size;
    avisos.push({
      id: slug(primera.type) || slug(primera.title) || primera.id,
      nivel,
      // El título es la causa; la cifra (columna «Cuántos» y ficha) ya dice
      // cuántos responsables. Antes «19 responsables» salía tres veces.
      titulo: primera.title,
      detalle: varias
        ? empate ? detalleDeEmpate(personas) : `El más marcado, ${mayor.owner}: ${mayor.detail}`
        : primera.detail,
      casos: varias
        ? personas.length
        // La cifra del motor manda; los casos nombrados sólo cuando no trae cifra
        // (PDM: el formato de CodPulso cuenta 287 y nombra 286 códigos distintos).
        : grupo.reduce((suma, alerta) => suma + (alerta.count ?? 0), 0) || casosNombrados || primera.count,
      unidad: varias ? "responsables" : "casos",
      codigo: primera.type,
      destino: porPersona && primera.signal.kind === "assignment_gap"
        ? { etiqueta: "Equipo, en Control", direccion: { seccion: "control", pestana: "equipo" } }
        : destinoDeAviso(primera.type, primera.signal.kind),
      donde: varias ? "" : primera.where,
      fuente: primera.source,
      desglose: grupo.length > 1 ? desgloseDe(grupo) : [],
      afectados: porPersona ? [] : afectados,
    });
  });

  // Los avisos fuertes del RMS que el filtro telefónico no reconoció.
  const presentes = new Set(modelo.activeAlerts.map((alerta) => normal(alerta.type)));
  const fuertes = new Map<string, Fila[]>();
  filas.forEach((fila) => {
    const tipo = normal(fila["Tipo alerta"] ?? fila.tipo);
    if (!AVISOS_FUERTES.includes(tipo) || presentes.has(tipo)) return;
    fuertes.set(tipo, [...(fuertes.get(tipo) ?? []), fila]);
  });
  fuertes.forEach((grupo, tipo) => {
    const primera = grupo[0];
    avisos.push({
      id: slug(tipo),
      nivel: nivelDeTexto(texto(primera.Nivel)),
      titulo: TITULO_FUERTE[tipo] ?? texto(primera["Tipo alerta"]),
      detalle: grupo.length > 1
        ? `${grupo.length.toLocaleString("es-PE")} avisos; el primero: ${texto(primera.Detalle ?? primera["Detalle del tipo de alerta"])}`
        : texto(primera.Detalle ?? primera["Detalle del tipo de alerta"]),
      casos: grupo.length,
      unidad: "casos",
      codigo: texto(primera["Tipo alerta"]),
      destino: destinoDeAviso(tipo, ""),
      donde: "",
      fuente: "",
      desglose: grupo.map((item) => ({ etiqueta: texto(item.Detalle ?? item["Detalle del tipo de alerta"]), valor: null })),
      afectados: [],
    });
  });

  const deLosBloques = avisosDeLosBloques(reports);
  // «Efectivo en la hoja sin Kobo» sale de Discrepancias, con todos sus casos.
  // La alerta vieja del motor con la misma causa contaba sólo los conciliados
  // (RMS ficticio: 1 en Avisos y 2 en Discrepancias); si está la nueva, sale.
  if (deLosBloques.some((aviso) => aviso.codigo === "efectivo_sin_kobo")) {
    for (let i = avisos.length - 1; i >= 0; i -= 1) {
      if (/efectiv\w*[ _]*(telefonic\w*)?[ _]*sin[ _]+(efectiv\w*[ _]+)?kobo|sin[_ ]kobo/i.test(`${avisos[i].codigo} ${avisos[i].titulo}`)) avisos.splice(i, 1);
    }
  }
  avisos.push(...deLosBloques);

  // El motor escribe «codigo:MVH9999» también dentro de los textos; en pantalla
  // va el código solo.
  avisos.forEach((aviso) => {
    aviso.titulo = sinPrefijoDeCodigo(aviso.titulo);
    aviso.detalle = sinPrefijoDeCodigo(aviso.detalle);
    aviso.desglose = aviso.desglose.map((linea) => ({ ...linea, etiqueta: sinPrefijoDeCodigo(linea.etiqueta) }));
    aviso.afectados = aviso.afectados.map((caso) => ({ ...caso, nota: sinPrefijoDeCodigo(caso.nota) }));
  });

  // Dos grupos pueden compartir causa y título (mismo tipo en dos fuentes): el
  // `foco` necesita un id único y estable.
  const vistos = new Map<string, number>();
  avisos.forEach((aviso) => {
    const veces = (vistos.get(aviso.id) ?? 0) + 1;
    vistos.set(aviso.id, veces);
    if (veces > 1) aviso.id = `${aviso.id}-${veces}`;
  });

  const orden: Record<NivelDeAviso, number> = { alta: 0, media: 1, baja: 2 };
  avisos.sort((a, b) => orden[a.nivel] - orden[b.nivel] || (b.casos ?? 0) - (a.casos ?? 0));

  const libres = filasDeBloque(reports, ["no_barridos_responsable"])
    .filter((fila) => ["sin responsable", "sin asignar", ""].includes(normal(fila.Responsable)))
    .reduce((suma, fila) => suma + (Number(fila["No barridos"]) || 0), 0);
  const sinAsignar = libres || alertaLibre
    ? {
      casos: libres || (alertaLibre?.count ?? 0),
      detalle: "Casos de la hoja sin responsable. No es atraso: todavía no se reparten.",
    }
    : null;

  return {
    avisos,
    sinAsignar,
    porNivel: {
      alta: avisos.filter((aviso) => aviso.nivel === "alta").length,
      media: avisos.filter((aviso) => aviso.nivel === "media").length,
      baja: avisos.filter((aviso) => aviso.nivel === "baja").length,
    },
  };
}

function siEsSi(valor: unknown) {
  return ["si", "sí", "true", "1", "yes"].includes(normal(valor));
}

/**
 * Avisos que el motor no emite como alerta pero que se leen de bloques que ya
 * viajan. No se inventa nada: cada cifra sale de un bloque, y si es cero no hay
 * aviso.
 */
export function avisosDeLosBloques(reports: MonitoreoAcreditacionReports | null | undefined): Aviso[] {
  const avisos: Aviso[] = [];
  const respuestas = construirRespuestas({ reports, segmento: "" });
  // El control de tiempo avisa de las CORTAS: pueden estar mal hechas o
  // inventadas. Una encuesta larga no es un problema y no genera aviso.
  const cortas = respuestas.envios.filter((envio) => envio.marcas.includes("corta"));
  if (cortas.length) {
    avisos.push({
      id: "duracion-menor-a-5-min",
      nivel: "alta",
      titulo: "Duración menor a 5 min",
      detalle: "Encuestas demasiado cortas para haberse hecho completas: revisa si están bien hechas.",
      casos: cortas.length,
      unidad: "casos",
      codigo: "duracion_menor_5min",
      destino: { etiqueta: "Respuestas, en Control", direccion: { seccion: "control", pestana: "respuestas" } },
      donde: "",
      fuente: "Duración de los envíos de Kobo",
      desglose: [],
      afectados: [...cortas].sort((a, b) => (a.segundos ?? 0) - (b.segundos ?? 0)).map((envio) => ({
        codigo: envio.codigo, responsable: envio.responsable, fecha: envio.fecha ?? "", nota: duracionLegible(envio.segundos),
      })),
    });
  }
  const repetidos = [...new Set(respuestas.envios.filter((envio) => envio.marcas.includes("repetida")).map((envio) => envio.codigo))];
  if (repetidos.length) {
    avisos.push({
      id: "codpulso-repetido-en-kobo",
      nivel: "media",
      titulo: "CodPulso repetido en Kobo",
      detalle: `${repetidos.slice(0, 4).join(", ")}${repetidos.length > 4 ? " y otros" : ""}: más de un envío efectivo para el mismo caso.`,
      casos: repetidos.length,
      unidad: "casos",
      codigo: "codpulso_repetido",
      destino: { etiqueta: "Respuestas, en Control", direccion: { seccion: "control", pestana: "respuestas" } },
      donde: "",
      fuente: "Duración de los envíos de Kobo",
      desglose: [],
      afectados: respuestas.envios.filter((envio) => envio.marcas.includes("repetida")).map((envio) => ({
        codigo: envio.codigo, responsable: envio.responsable, fecha: envio.fecha ?? "", nota: duracionLegible(envio.segundos),
      })),
    });
  }
  // P3: «la hoja dice Efectivo y Kobo no tiene envío» no se decide en
  // Discrepancias (no hay envío): se avisa aquí, con responsable y códigos.
  const efectivoSinKobo = filasDeBloque(reports, ["discrepancias_telefonicas"])
    .filter((fila) => (texto(fila.Destino) ? texto(fila.Destino) === "avisos" : texto(fila.Sentido) === "hoja_sin_kobo"));
  if (efectivoSinKobo.length) {
    const porResponsable = new Map<string, number>();
    efectivoSinKobo.forEach((fila) => {
      const quien = texto(fila.Responsable) || "Sin asignar";
      porResponsable.set(quien, (porResponsable.get(quien) ?? 0) + 1);
    });
    avisos.push({
      id: "efectivo-sin-kobo",
      nivel: "media",
      titulo: "La hoja dice «Efectivo» y Kobo no tiene envío",
      detalle: "No cuentan en el avance hasta que llegue el envío de Kobo o se corrija el status de la hoja.",
      casos: efectivoSinKobo.length,
      unidad: "casos",
      codigo: "efectivo_sin_kobo",
      destino: { etiqueta: "Hoja del equipo", direccion: null },
      donde: "",
      fuente: "Cruce de CodPulso entre la hoja y Kobo",
      desglose: [...porResponsable.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
        .map(([etiqueta, valor]) => ({ etiqueta, valor })),
      afectados: efectivoSinKobo.map((fila) => ({
        codigo: texto(fila.CodPulso),
        responsable: texto(fila.Responsable) || "Sin asignar",
        fecha: texto(fila["Fecha hoja"]),
        nota: texto(fila.proGres) ? `proGres ${texto(fila.proGres)}` : "",
      })),
    });
  }
  const sinRegistrar = filasDeBloque(reports, ["comparacion_codpulso", "campo_vs_plataforma_codpulso"])
    .filter((fila) => siEsSi(fila["Efectiva Kobo"]) && normal(fila["Estado telefónico"] ?? fila["Estado telefonico"]) === "no barrido");
  if (sinRegistrar.length) {
    avisos.push({
      id: "la-hoja-dejo-de-registrar",
      nivel: "alta",
      titulo: "Efectivas en Kobo cuyo caso sigue «No barrido»",
      detalle: "Kobo registra la entrevista y la hoja de barrido no la marcó: la hoja va atrasada respecto de Kobo.",
      casos: sinRegistrar.length,
      unidad: "casos",
      codigo: "barrido_desfasado",
      destino: { etiqueta: "Discrepancias, en Control", direccion: { seccion: "control", pestana: "discrepancias" } },
      donde: "",
      fuente: "Cruce de CodPulso entre Kobo y la hoja",
      desglose: [],
      afectados: sinRegistrar.map((fila) => ({
        codigo: texto(fila.CodPulso), responsable: texto(fila.Responsable), fecha: texto(fila["Fecha Kobo"]), nota: texto(fila.Sede ?? fila.Actor),
      })),
    });
  }
  const { otraFecha, otras } = llamadosPorFecha(filasDeBloque(reports, ["estatus_dia"]));
  if (otraFecha) {
    avisos.push({
      id: "fecha-de-la-hoja-irregular",
      nivel: "media",
      titulo: "Fecha de la hoja irregular",
      detalle: "Llamados sin fecha o con una fecha de otro año que el grueso de la hoja.",
      casos: otraFecha,
      unidad: "casos",
      codigo: "fecha_irregular",
      destino: { etiqueta: "Hoja del equipo", direccion: null },
      donde: "",
      fuente: "Status de la hoja por día",
      desglose: otras.map((item) => ({ etiqueta: item.etiqueta, valor: item.casos })),
      afectados: [],
    });
  }
  return avisos;
}

export type DestinoConCasos = {
  etiqueta: string;
  direccion: DestinoDeAviso["direccion"];
  avisos: number;
  casos: number;
  responsables: number;
};

/**
 * «Por dónde se corrige»: los avisos agrupados por la pestaña (o la hoja del
 * equipo) donde se corrigen, con cuántos casos y responsables reúnen. Los
 * casos sin asignar no entran: no son atraso de nadie.
 */
export function porDestino(avisos: readonly Aviso[]): DestinoConCasos[] {
  const grupos = new Map<string, DestinoConCasos>();
  avisos.forEach((aviso) => {
    const actual = grupos.get(aviso.destino.etiqueta)
      ?? { etiqueta: aviso.destino.etiqueta, direccion: aviso.destino.direccion, avisos: 0, casos: 0, responsables: 0 };
    actual.avisos += 1;
    if (aviso.unidad === "responsables") actual.responsables += aviso.casos ?? 0;
    else actual.casos += aviso.casos ?? 0;
    grupos.set(aviso.destino.etiqueta, actual);
  });
  // Primero lo que se corrige dentro de la app; la hoja del equipo al final.
  return [...grupos.values()].sort((a, b) => (
    Number(a.direccion === null) - Number(b.direccion === null) || b.casos - a.casos || a.etiqueta.localeCompare(b.etiqueta, "es")
  ));
}

export type CasoPorRevisar = CasoAfectado & { aviso: string; avisoId: string; nivel: NivelDeAviso; destino: string };

/**
 * «Casos por revisar»: todos los casos que los avisos nombran, en una sola
 * tabla, en el orden de los avisos (primero los de nivel alto). Un caso que
 * aparece en dos avisos sale dos veces, una por cada causa.
 */
export function casosPorRevisar(avisos: readonly Aviso[]): CasoPorRevisar[] {
  return avisos.flatMap((aviso) => aviso.afectados.map((caso) => ({
    ...caso,
    aviso: aviso.titulo,
    avisoId: aviso.id,
    nivel: aviso.nivel,
    destino: aviso.destino.etiqueta,
  })));
}
