import type {
  MonitoreoAulasAvanceTabla,
  MonitoreoAulasConfig,
  MonitoreoLastSheetsPublication,
} from "../../../../../api/monitoreo";
import { fmt, pctPerfil } from "../kpisDeAulas";
import { readinessDeAulas } from "../navegacion/readinessDeAulas";
import type { Vacio } from "./porFacultadModelo";

/**
 * Avance › Salidas (ficha A5 de `docs/qa/revamp-monitoreo/aulas.md`), listo
 * para pintar. ¿Qué sale de este corte y qué toca cada salida?
 *
 * P2 respondida: las hojas de la app se publican A MANO desde aquí, con
 * «Revisar cambios» antes; Actualizar no escribe hacia afuera.
 *
 * - «Salidas del corte»: el libro del operativo (destino `libro_sheets` y
 *   sello `libro_publicado`), el PDF de avance, el Sheets del cliente
 *   (`publication.client_last_sheets`) y el libro en Excel.
 * - «Así se verá «Avance de campo»»: la tabla `facultad` de
 *   `/monitoreo/aulas/avance-tablas`, la MISMA que escribe la hoja.
 * - «Qué toca Publicar en el libro»: el detalle por hoja de la última
 *   publicación (`libro_publicado.detalle`), con la acción que declaró el motor.
 *
 * Un dato que no llega se dice con su causa, nunca como un 0 que parezca medido.
 */

export const MARCA_SALIDAS_AULAS = readinessDeAulas("avance", "salidas");

export type TonoDeSalida = "ok" | "aviso" | "neutro" | "info";

export type AccionDeSalida = "revisar" | "publicar" | "pdf" | "conectar" | "excel";

export type Salida = {
  clave: "libro" | "pdf" | "cliente" | "excel";
  titulo: string;
  estado: string;
  tono: TonoDeSalida;
  detalle: string;
  acciones: Array<{ accion: AccionDeSalida; rotulo: string; principal?: boolean; deshabilitada?: string }>;
};

export type FilaDeHoja = {
  hoja: string;
  /** Sólo existe si el estudio la activa (regla declarada, sin recibo). */
  condicional?: boolean;
  regla: string;
  tono: "escribe" | "agrega" | "nunca" | "igual";
  titulo: string;
};

export type QueTocaPublicar =
  | { tipo: "hojas"; sub: string; app: FilaDeHoja[]; equipo: FilaDeHoja[] }
  | { tipo: "vacio"; vacio: Vacio };

export type VistaPrevia =
  | { tipo: "tabla"; sub: string; cabecera: string[]; numericas: boolean[]; filas: string[][]; total: string[] | null }
  | { tipo: "cargando" }
  | { tipo: "vacio"; vacio: Vacio };

export type ModeloSalidas = {
  salidas: Salida[];
  queToca: QueTocaPublicar;
  vistaPrevia: VistaPrevia;
};

export type EntradaDeSalidas = {
  config: MonitoreoAulasConfig | null | undefined;
  /** Corte vigente del estado (`synced_at`). */
  corte: string;
  clientSheets: MonitoreoLastSheetsPublication | null | undefined;
  /** `null` mientras se piden las tablas; `[]` si no llegaron. */
  tablas: MonitoreoAulasAvanceTabla[] | null;
  errorTablas: string;
};

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return "";
}

/** «01/10 a las 15:03», en la hora de Lima como el resto del perfil. */
export function momentoCorto(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  // A dos dígitos a mano: sin ICU completo (vitest, algunos Node) «2-digit»
  // sale a un dígito.
  const v = (t: string) => (partes.find((p) => p.type === t)?.value ?? "").padStart(2, "0");
  return `${v("day")}/${v("month")} a las ${v("hour")}:${v("minute")}`;
}

function salidaDelLibro(config: EntradaDeSalidas["config"], corte: string): Salida {
  const destino = texto(config?.libro_sheets?.spreadsheet_id);
  const sello = config?.libro_publicado ?? null;
  const publicado = texto(sello?.publicado_en);
  const hojas = Number(sello?.hojas ?? 0);
  const revisar = { accion: "revisar" as const, rotulo: "Revisar cambios" };
  if (!destino) {
    return {
      clave: "libro", titulo: "Libro del operativo", estado: "Sin destino", tono: "neutro",
      detalle: "El Sheets del equipo no está conectado. Se conecta en Insumos › Fuentes.",
      acciones: [revisar, { accion: "publicar", rotulo: "Publicar", principal: true, deshabilitada: "Falta conectar el Sheets del equipo." }],
    };
  }
  if (!publicado) {
    return {
      clave: "libro", titulo: "Libro del operativo", estado: "Sin publicar", tono: "aviso",
      detalle: "Conectado, pero la app todavía no publicó sus hojas en él.",
      acciones: [revisar, { accion: "publicar", rotulo: "Publicar", principal: true }],
    };
  }
  const alDia = Boolean(corte) && texto(sello?.synced_at) === corte;
  return {
    clave: "libro", titulo: "Libro del operativo",
    estado: alDia ? "Al día con el corte" : "Anterior al corte",
    tono: alDia ? "ok" : "aviso",
    detalle: `${fmt(hojas)} ${hojas === 1 ? "hoja" : "hojas"} en el Sheets del equipo. Publicado el ${momentoCorto(publicado)}.`,
    acciones: [revisar, { accion: "publicar", rotulo: "Publicar", principal: true }],
  };
}

function salidaDelCliente(cliente: EntradaDeSalidas["clientSheets"]): Salida {
  const id = texto(cliente?.spreadsheet_id);
  if (!id) {
    return {
      clave: "cliente", titulo: "Sheets del cliente", estado: "Sin destino", tono: "neutro",
      detalle: "Avance por facultad para el cliente. Sin conectar.",
      acciones: [{ accion: "conectar", rotulo: "Conectar" }],
    };
  }
  const cuando = momentoCorto(texto(cliente?.updated_at));
  return {
    clave: "cliente", titulo: "Sheets del cliente", estado: "Conectado", tono: "info",
    detalle: cuando ? `Avance por facultad para el cliente. Publicado el ${cuando}.` : "Avance por facultad para el cliente.",
    acciones: [{ accion: "conectar", rotulo: "Publicar al cliente" }],
  };
}

const SALIDA_PDF: Salida = {
  clave: "pdf", titulo: "PDF de avance", estado: "Bajo pedido", tono: "neutro",
  detalle: "Avance por facultad y sexo, sin metas. Se genera con el corte vigente.",
  acciones: [{ accion: "pdf", rotulo: "Generar PDF" }],
};

const SALIDA_EXCEL: Salida = {
  clave: "excel", titulo: "Libro en Excel", estado: "Bajo pedido", tono: "neutro",
  detalle: "Las hojas del equipo, en un archivo local, con lo ya registrado.",
  acciones: [{ accion: "excel", rotulo: "Generar libro" }],
};

/** Hojas que llena el equipo: la app las siembra si faltan y nunca las reescribe. */
const HOJAS_DEL_EQUIPO = ["Aulas Agendadas", "Aulas Agendadas (Extra)", "Aulas Aplicadas (Campo)", "Aulas Aplicadas (Extra)"];

function filaDeHoja(hoja: string, accion: string, filas: number): FilaDeHoja {
  const conFilas = filas > 0 ? ` La última vez: ${fmt(filas)} ${filas === 1 ? "fila" : "filas"}.` : "";
  if (accion === "respetada" || HOJAS_DEL_EQUIPO.includes(hoja)) {
    return { hoja, regla: "Nunca se escribe", tono: "nunca", titulo: `Es del equipo: sólo se siembra si la pestaña no existe.${conFilas}` };
  }
  if (hoja === "Asignación de aplicadores") {
    return {
      hoja, regla: "Solo agrega filas nuevas", tono: "agrega",
      titulo: `Respeta los cambios manuales del coordinador; si no puede leerlos, no la toca.${conFilas}`,
    };
  }
  if (accion === "sin_cambios") {
    return { hoja, regla: "Se reescribe", tono: "igual", titulo: `La última vez no tenía cambios.${conFilas}` };
  }
  return { hoja, regla: "Se reescribe", tono: "escribe", titulo: `La reescribe la app con el corte.${conFilas}`.trim() };
}

/**
 * Las reglas de dueño por hoja, como las declara el publicador
 * (`monitoreo_aulas_publicar_libro.R`): sirven antes de la primera publicación
 * con recibo por hoja. Las condicionales sólo existen si el estudio las activa.
 */
const REGLAS_DECLARADAS: Array<{ hoja: string; condicional?: string }> = [
  { hoja: "Base de control" },
  { hoja: "Plan del día" },
  { hoja: "Avance de campo" },
  { hoja: "Avance de agendación" },
  { hoja: "Asignación de aplicadores", condicional: "si hay disponibilidad cargada" },
  { hoja: "Disponibilidad de aplicadores", condicional: "si hay disponibilidad cargada" },
  { hoja: "Producción de aplicadores", condicional: "si ya hay partes" },
  { hoja: "Control de facultad", condicional: "si el estudio declara su facultad" },
  { hoja: "Facultades en riesgo", condicional: "si hay cuotas por facultad" },
  { hoja: "Control de nivel", condicional: "si hay padrón y nivel declarados" },
  { hoja: "Aulas Agendadas" },
  { hoja: "Aulas Agendadas (Extra)", condicional: "si hay banco de extras" },
  { hoja: "Aulas Aplicadas (Campo)" },
  { hoja: "Aulas Aplicadas (Extra)", condicional: "si hay banco de extras" },
];

function queTocaDe(config: EntradaDeSalidas["config"]): QueTocaPublicar {
  const detalle = config?.libro_publicado?.detalle;
  if (!Array.isArray(detalle) || !detalle.length) {
    const filas = REGLAS_DECLARADAS.map((r) => {
      const f = filaDeHoja(r.hoja, "", 0);
      return r.condicional ? { ...f, titulo: `${f.titulo} Sólo ${r.condicional}.`, condicional: true } : f;
    });
    const publicado = texto(config?.libro_publicado?.publicado_en);
    return {
      tipo: "hojas",
      sub: publicado
        ? "las reglas de cada hoja; la próxima publicación deja aquí qué pasó con cada una"
        : "las reglas de cada hoja; el libro aún no se publica desde la app",
      app: filas.filter((f) => f.tono !== "nunca"),
      equipo: filas.filter((f) => f.tono === "nunca"),
    };
  }
  const filas = detalle
    .map((d) => ({ hoja: texto(d?.hoja), accion: texto(d?.accion), filas: Number(d?.filas ?? 0) || 0 }))
    .filter((d) => d.hoja)
    .map((d) => filaDeHoja(d.hoja, d.accion, d.filas));
  const app = filas.filter((f) => f.tono !== "nunca");
  const equipo = filas.filter((f) => f.tono === "nunca");
  return {
    tipo: "hojas",
    sub: `${fmt(app.length)} de la app y ${fmt(equipo.length)} del equipo, según la última publicación`,
    app,
    equipo,
  };
}

function celda(valor: string | number | null | undefined, tipo: string | undefined): string {
  if (valor == null || valor === "") return "—";
  if (tipo === "porcentaje" && typeof valor === "number") return pctPerfil(valor * 100);
  if (tipo === "numero" && typeof valor === "number") return fmt(valor);
  return String(valor);
}

/** Las columnas de la ficha A5, por su rótulo en la hoja «Avance de campo». */
const COLUMNAS_DE_LA_VISTA = [
  "Aulas planificadas originalmente", "Aulas aplicadas", "Muestra", "Efectivas", "Avance muestra",
];

function vistaPreviaDe(tablas: EntradaDeSalidas["tablas"], error: string): VistaPrevia {
  if (tablas == null) return { tipo: "cargando" };
  if (error) return { tipo: "vacio", vacio: { clase: "desconexion", causa: `No se pudo armar la vista previa: ${error}` } };
  const tabla = tablas.find((t) => t.clave === "facultad");
  if (!tabla) return { tipo: "vacio", vacio: { clase: "desconexion", causa: "El corte no trae la tabla por facultad de «Avance de campo»." } };
  if (!tabla.filas.length) {
    return { tipo: "vacio", vacio: { clase: "legitimo", causa: texto(tabla.vacio) || "Todavía no hay filas por facultad." } };
  }
  const tipos = tabla.tipos ?? [];
  // La hoja trae hasta 23 columnas; la vista previa enseña las de la ficha,
  // buscadas por rótulo (nunca por posición: el juego cambia por estudio).
  // La primera columna es el grupo de la hoja (facultad, nivel o carrera,
  // según el eje del estudio): va siempre, se llame como se llame.
  const porRotulo = [0, ...COLUMNAS_DE_LA_VISTA
    .map((r) => tabla.cabecera.indexOf(r))
    .filter((i) => i > 0)];
  const cols = porRotulo.length >= 3 ? porRotulo : tabla.cabecera.map((_, i) => i).slice(0, 6);
  const quedan = tabla.cabecera.length - cols.length;
  return {
    tipo: "tabla",
    sub: quedan > 0
      ? `vista previa con el corte actual, ${fmt(cols.length)} de ${fmt(tabla.cabecera.length)} columnas`
      : "vista previa con el corte actual",
    cabecera: cols.map((i) => tabla.cabecera[i]),
    numericas: cols.map((i) => tipos[i] === "numero" || tipos[i] === "porcentaje"),
    filas: tabla.filas.map((fila) => cols.map((i) => celda(fila[i], tipos[i]))),
    total: tabla.total ? cols.map((i) => celda(tabla.total![i], tipos[i])) : null,
  };
}

export function construirSalidas(entrada: EntradaDeSalidas): ModeloSalidas {
  return {
    salidas: [salidaDelLibro(entrada.config, entrada.corte), SALIDA_PDF, salidaDelCliente(entrada.clientSheets), SALIDA_EXCEL],
    queToca: queTocaDe(entrada.config),
    vistaPrevia: vistaPreviaDe(entrada.tablas, entrada.errorTablas),
  };
}

/** La marca: `false` mientras la vista previa se pide; la dirección cuando pintó. */
export function readinessDeSalidas(modelo: ModeloSalidas): string {
  return modelo.vistaPrevia.tipo === "cargando" ? "false" : MARCA_SALIDAS_AULAS;
}
