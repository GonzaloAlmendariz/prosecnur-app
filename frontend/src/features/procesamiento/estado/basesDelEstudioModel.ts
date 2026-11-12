// Filas del panel "Bases del estudio". Todo sale de `GET /api/estudio`
// (`EstudioPayload`): nombre, origen, tamaño y el `status` que el motor calcula
// por base (`.estudio_base_status_payload`, api/R/router_estudio.R).
//
// Lo que ese `status` dice y lo que no. Son cinco booleanos y cada uno significa
// "esta base tiene trabajo de esa fase", no "la fase está terminada":
//   imported               tiene formulario y respuestas registrados
//   validacion             tiene auditoría, decisiones de limpieza o reglas propias
//   codificacion           tiene grupos de códigos o plantilla, o ya está adaptada
//   codificacion_adaptada  la base y el formulario adaptados ya existen
//   analitica              tiene datos preparados o algún reporte generado
//   graficos               tiene un informe en PowerPoint o en Word
// Sin otra fuente, el rótulo de cada celda es el literal de su booleano
// ("Iniciada", "Aplicada", "Con informe").
//
// Desde M8 el motor publica además `fases` por base (`estudioFases.ts`): si
// terminó, si quedó desactualizada y por qué, y la fecha del último cambio.
// Cuando llega, manda sobre los booleanos (`lecturaDelMotor`).

import type { EstudioBase, EstudioPayload } from "../../../api/estudio";
import { normalizarFasesDeBase, type EstadoDeFase, type FasesDeBaseMotor } from "../../../api/estudioFases";
import type { ChromeStatusTone } from "../../../components/ModuleCommandBar";
import type { Aprobaciones } from "./aprobacionesModel";
import { CAUSA_PENDIENTE, causasDeBase, type CausasDeBase } from "./causaDeFaseModel";
import { fechaCorta } from "./fechaDelEstudio";
import { NOMBRE_DE_SECCION, SECCIONES_EN_ORDEN, type SeccionId } from "./queSigueModel";

export type OrigenDeBase =
  | "SurveyMonkey"
  | "Kobo"
  | "Archivo"
  | "Grupo repetido"
  | "Monitoreo"
  | "Otro origen";

export type FaseDeBase = {
  fase: SeccionId;
  /** Nombre de la fase: "Validación". */
  nombre: string;
  /** Estado en una o dos palabras: "Iniciada". */
  estado: string;
  tono: ChromeStatusTone;
  /** Qué significa ese estado, para el `title` del chip. */
  detalle: string;
  /** Por qué la fase de ESTA base está así, si el motor lo publica (`causaDeFaseModel`). */
  causa: string | null;
  /** Sin causa: lo que falta pedir al motor para escribirla. */
  causaPendiente: string | null;
  /** El motor la declaró desactualizada (M8). */
  desactualizada: boolean;
};

export type FilaDeBase = {
  nombre: string;
  etiqueta: string;
  activa: boolean;
  origen: OrigenDeBase;
  filas: number | null;
  columnas: number | null;
  /** Etiqueta de la base madre cuando la fila es un grupo repetido. */
  madre: string | null;
  /** `null` si el motor no envió el estado de esta base. */
  fases: FaseDeBase[] | null;
};

export type BasesDelEstudio = {
  filas: FilaDeBase[];
  /** Bases del estudio: los grupos repetidos no cuentan como base. */
  nBases: number;
  nGruposRepetidos: number;
};

function texto(valor: unknown): string {
  const limpio = String(valor ?? "").trim();
  return limpio === "NA" ? "" : limpio;
}

function entero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export function etiquetaDeBase(base: EstudioBase): string {
  return texto(base.source_alias) || texto(base.source_title) || (base.nombre === "default" ? "Base única" : base.nombre);
}

export function esGrupoRepetido(base: EstudioBase): boolean {
  return texto(base.source_kind).toLowerCase().endsWith("_repeat") || Boolean(texto(base.parent_base));
}

/**
 * De dónde viene la base, con el nombre que ve el usuario. La lista es cerrada:
 * un `source_kind` que no se reconoce se dice ("Otro origen") en vez de pasar
 * por archivo.
 */
export function origenDeBase(base: EstudioBase): OrigenDeBase {
  if (esGrupoRepetido(base)) return "Grupo repetido";
  const tipo = texto(base.source_kind).toLowerCase();
  if (tipo.startsWith("surveymonkey")) return "SurveyMonkey";
  if (tipo.startsWith("kobo")) return "Kobo";
  if (tipo.startsWith("monitoreo")) return "Monitoreo";
  // Sin `source_kind` la base entró por el flujo de archivos, que no lo escribe.
  if (tipo === "" || tipo === "manual" || tipo === "existing_project") return "Archivo";
  return "Otro origen";
}

type Lectura = Pick<FaseDeBase, "estado" | "tono" | "detalle">;

const INICIADA: Pick<Lectura, "estado" | "tono"> = { estado: "Iniciada", tono: "info" };
const POR_INICIAR: Pick<Lectura, "estado" | "tono"> = { estado: "Por iniciar", tono: "neutral" };

function lecturaDeFase(fase: SeccionId, status: NonNullable<EstudioBase["status"]>): Lectura {
  if (fase === "carga") {
    return status.imported === true
      ? { estado: "Cargada", tono: "success", detalle: "Tiene formulario y respuestas." }
      : { estado: "Incompleta", tono: "warn", detalle: "Falta el formulario o las respuestas." };
  }
  if (fase === "validacion") {
    return status.validacion === true
      ? { ...INICIADA, detalle: "Tiene auditoría, decisiones de limpieza o reglas propias." }
      : { ...POR_INICIAR, detalle: "Sin auditoría, decisiones de limpieza ni reglas propias." };
  }
  if (fase === "codificacion") {
    if (status.codificacion_adaptada === true) {
      return { estado: "Aplicada", tono: "success", detalle: "La base y el formulario ya están codificados." };
    }
    return status.codificacion === true
      ? { ...INICIADA, detalle: "Tiene grupos de códigos o plantilla, todavía sin aplicar." }
      : { ...POR_INICIAR, detalle: "Sin grupos de códigos ni plantilla." };
  }
  if (fase === "analitica") {
    return status.analitica === true
      ? { ...INICIADA, detalle: "Tiene datos preparados o algún reporte generado." }
      : { ...POR_INICIAR, detalle: "Sin datos preparados ni reportes generados." };
  }
  return status.graficos === true
    ? { estado: "Con informe", tono: "success", detalle: "Tiene un informe generado en PowerPoint o en Word." }
    : { estado: "Sin informe", tono: "neutral", detalle: "Sin informe generado en PowerPoint ni en Word." };
}

const HECHA: Readonly<Record<SeccionId, Pick<Lectura, "estado" | "detalle">>> = {
  carga: { estado: "Cargada", detalle: "Tiene formulario y respuestas." },
  validacion: { estado: "Cerrada", detalle: "La limpieza está cerrada sobre las respuestas vigentes." },
  codificacion: { estado: "Aplicada", detalle: "La base y el formulario ya están codificados." },
  analitica: { estado: "Al día", detalle: "Los archivos salieron de la base vigente." },
  graficos: { estado: "Al día", detalle: "El informe salió de la base vigente." },
};

/** La lectura del motor (M8): terminó, en curso, por iniciar o desactualizada. */
function lecturaDelMotor(fase: SeccionId, f: EstadoDeFase): Lectura {
  const sinCausa = (texto: string) => f.causa ?? texto;
  if (f.estado === "desactualizada") {
    return { estado: "Desactualizada", tono: "warn", detalle: sinCausa("Cambió algo de lo que depende.") };
  }
  if (f.estado === "hecha") return { ...HECHA[fase], tono: "success" };
  if (fase === "carga") {
    return f.estado === "sin_iniciar"
      ? { estado: "Sin archivos", tono: "warn", detalle: sinCausa("Faltan el formulario y las respuestas.") }
      : { estado: "Incompleta", tono: "warn", detalle: sinCausa("Falta el formulario o las respuestas.") };
  }
  if (f.estado === "en_curso") {
    // Con archivos generados el motor no sabe sobre qué versión de la base salieron: se dice lo que hay.
    if (f.motivo === "sin_registro_de_version" && fase === "graficos") {
      return { estado: "Con informe", tono: "success", detalle: sinCausa("Tiene un informe generado.") };
    }
    if (f.motivo === "sin_registro_de_version") {
      return { estado: "Con archivos", tono: "info", detalle: sinCausa("Tiene archivos generados.") };
    }
    return { estado: "En curso", tono: "info", detalle: sinCausa("Tiene trabajo sin terminar.") };
  }
  return fase === "graficos"
    ? { estado: "Sin informe", tono: "neutral", detalle: sinCausa("Sin informe generado.") }
    : { ...POR_INICIAR, detalle: sinCausa("Todavía no tiene trabajo.") };
}

/** La línea bajo el chip cuando el motor publica la fase: su causa o, si terminó, su fecha. */
function datoDelMotor(fase: SeccionId, f: EstadoDeFase, causaLocal: string | null, hoy: Date): string | null {
  if (f.estado === "desactualizada") return f.causa;
  if (causaLocal) return causaLocal;
  const el = fechaCorta(f.actualizadoEn, hoy);
  if (!el) return f.estado === "en_curso" ? f.causa : null;
  if (f.estado === "hecha" && fase === "validacion") return `Cierre del ${el}`;
  if (f.estado === "hecha" && fase === "codificacion") return `Aplicada el ${el}`;
  if (f.estado === "hecha" && fase === "carga") return `Cargada el ${el}`;
  if (f.estado === "en_curso") return f.causa ?? `Último cambio el ${el}`;
  return null;
}

export function fasesDeBase(
  status: EstudioBase["status"],
  causas?: CausasDeBase,
  motor?: FasesDeBaseMotor | null,
  hoy: Date = new Date(),
): FaseDeBase[] | null {
  if (!status && !motor) return null;
  return SECCIONES_EN_ORDEN.map((fase) => {
    const delMotor = motor?.fases[fase] ?? null;
    // La lectura de Kobo la fecha el motor; la de SurveyMonkey ya la escribe `causaDeFaseModel`.
    const lecturaKobo = motor?.fuente.plataforma === "kobo" ? fechaCorta(motor.fuente.leidaEn, hoy) : null;
    const local = fase === "carga" && lecturaKobo ? `Última lectura el ${lecturaKobo}` : causas?.[fase] ?? null;
    const recibido = motor?.fueraDeLista[fase];
    const noReconocido = recibido ? `El motor publicó un estado que la app no reconoce: "${recibido}".` : null;
    if (delMotor) {
      return {
        fase,
        nombre: NOMBRE_DE_SECCION[fase],
        ...lecturaDelMotor(fase, delMotor),
        causa: datoDelMotor(fase, delMotor, local, hoy),
        causaPendiente: null,
        desactualizada: delMotor.estado === "desactualizada",
      };
    }
    if (!status) {
      return {
        fase,
        nombre: NOMBRE_DE_SECCION[fase],
        estado: "Sin dato",
        tono: "neutral",
        detalle: noReconocido ?? "El motor no publicó esta fase.",
        causa: null,
        causaPendiente: CAUSA_PENDIENTE[fase],
        desactualizada: false,
      };
    }
    const lectura = lecturaDeFase(fase, status);
    return {
      fase,
      nombre: NOMBRE_DE_SECCION[fase],
      ...lectura,
      // Un estado fuera de la lista no se traga: el chip cae a los indicadores y lo dice.
      detalle: noReconocido ? `${lectura.detalle} ${noReconocido}` : lectura.detalle,
      causa: local,
      causaPendiente: local ? null : CAUSA_PENDIENTE[fase],
      desactualizada: false,
    };
  });
}

/**
 * Las bases en el orden del estudio, con cada grupo repetido debajo de su
 * madre. Un grupo cuya madre no está en el estudio queda al final, sin anidar.
 */
export function basesDelEstudio(
  estudio: EstudioPayload,
  aprobaciones: Aprobaciones | null = null,
  hoy: Date = new Date(),
): BasesDelEstudio {
  const todas = Object.entries(estudio.bases ?? {}).map(([clave, base]) => ({
    ...base,
    nombre: base.nombre || clave,
  }));
  const porNombre = new Map(todas.map((base) => [base.nombre, base]));
  const activa = texto(estudio.active_base) || todas[0]?.nombre || "";

  const madres = todas.filter((base) => !esGrupoRepetido(base));
  const hijas = todas.filter((base) => esGrupoRepetido(base));
  const ordenadas: EstudioBase[] = [];
  const colocadas = new Set<string>();
  for (const madre of madres) {
    ordenadas.push(madre);
    for (const hija of hijas) {
      if (texto(hija.parent_base) === madre.nombre) {
        ordenadas.push(hija);
        colocadas.add(hija.nombre);
      }
    }
  }
  for (const hija of hijas) if (!colocadas.has(hija.nombre)) ordenadas.push(hija);

  const etiquetaDe = (nombre: string) => {
    const base = porNombre.get(nombre);
    return base ? etiquetaDeBase(base) : nombre;
  };
  const filas = ordenadas.map<FilaDeBase>((base) => {
    const madre = esGrupoRepetido(base) ? porNombre.get(texto(base.parent_base)) : undefined;
    const causas = causasDeBase(base, etiquetaDe, aprobaciones?.porBase.get(base.nombre), hoy);
    return {
      nombre: base.nombre,
      etiqueta: etiquetaDeBase(base),
      activa: base.nombre === activa,
      origen: origenDeBase(base),
      filas: entero(base.n_filas),
      columnas: entero(base.n_columnas),
      madre: madre ? etiquetaDeBase(madre) : null,
      fases: fasesDeBase(base.status, causas, normalizarFasesDeBase(base.fases), hoy),
    };
  });

  return { filas, nBases: madres.length, nGruposRepetidos: hijas.length };
}
