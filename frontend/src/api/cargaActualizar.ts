// Carga › Actualizar una fuente: vista previa, aplicación con copia y vuelta a
// la versión anterior de las respuestas de una base (motor `carga_actualizar_*`).
// Contrato: `POST /api/estudio/base/respuestas/{vista-previa,actualizar,revertir}`.
// Ausente es `null`, nunca cero: un conteo que el motor no pudo calcular llega
// `null` con su causa y la pantalla dice la causa.
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de aquí.

import { apiFetch, handle, headers } from "./core";
import type { EstudioBase } from "./estudio";

export type ItemDeFase = { clave: string; que: string; n: number | null; causa: string | null };

export type FaseDeActualizacion = {
  fase: string;
  nombre: string;
  seConserva: ItemDeFase[];
  hayQueRehacer: ItemDeFase[];
  sePierde: ItemDeFase[];
};

export type DecisionDeActualizacion = {
  id: string;
  accion: string;
  sourceId: string | null;
  destino: "conserva" | "se_pierde";
  causa: string | null;
  nCasosGuardados: number | null;
  nCasosQueYaNoVienen: number | null;
};

export type RespaldoDeActualizacion = {
  creadoEn: string | null;
  archivo: string | null;
  nFilas: number | null;
  legible: boolean;
  causa: string | null;
};

export type CasosDeActualizacion = {
  antes: number | null;
  despues: number | null;
  nuevos: number | null;
  yaNoVienen: number | null;
  editados: number | null;
  sinCambios: number | null;
  celdasCambiadas: number | null;
  causa: string | null;
  ejemplos: { nuevos: string[]; yaNoVienen: string[]; editados: string[] };
};

export type ColumnasDeActualizacion = {
  nuevas: string[];
  yaNoVienen: string[];
  conCambios: { columna: string; nCasos: number | null }[];
  noComparadas: { columna: string; causa: string | null }[];
};

export type CambiosDeActualizacion = {
  identificador: { columnas: string[]; metodo: string | null };
  casos: CasosDeActualizacion;
  columnas: ColumnasDeActualizacion;
};

export type VistaPreviaDeActualizacion = CambiosDeActualizacion & {
  versionVigente: { archivo: string | null; es: string | null };
  versionNueva: { archivo: string | null };
  formulario: { cambia: boolean; causa: string | null };
  fases: FaseDeActualizacion[];
  decisiones: DecisionDeActualizacion[];
  respaldo: RespaldoDeActualizacion | null;
};

export type ActualizacionAplicada = {
  base: EstudioBase | null;
  archivo: string | null;
  cambios: CambiosDeActualizacion;
  fases: FaseDeActualizacion[];
  decisiones: DecisionDeActualizacion[];
  respaldo: RespaldoDeActualizacion | null;
};

// ---------------------------------------------------------------------------
// Normalizadores defensivos (Plumber puede mandar escalares como [x])
// ---------------------------------------------------------------------------

type Registro = Record<string, unknown>;

function primero(x: unknown): unknown {
  return Array.isArray(x) && x.length === 1 ? x[0] : x;
}
function registro(x: unknown): Registro {
  const v = primero(x);
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {};
}
function textoONulo(x: unknown): string | null {
  const v = primero(x);
  if (v == null || (Array.isArray(v) && v.length === 0)) return null;
  const s = String(v).trim();
  return s === "" || s === "NA" ? null : s;
}
function enteroONulo(x: unknown): number | null {
  const v = primero(x);
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function textos(x: unknown): string[] {
  if (x == null) return [];
  const lista = Array.isArray(x) ? x : [x];
  return lista.map((v) => textoONulo(v)).filter((v): v is string => v !== null);
}
function lista(x: unknown): unknown[] {
  if (Array.isArray(x)) return x;
  return x && typeof x === "object" ? [x] : [];
}

function normalizarItem(x: unknown): ItemDeFase | null {
  const r = registro(x);
  const que = textoONulo(r.que);
  if (!que) return null;
  return { clave: textoONulo(r.clave) ?? que, que, n: enteroONulo(r.n), causa: textoONulo(r.causa) };
}
function items(x: unknown): ItemDeFase[] {
  return lista(x).map(normalizarItem).filter((v): v is ItemDeFase => v !== null);
}

export function normalizarFases(x: unknown): FaseDeActualizacion[] {
  return lista(x).flatMap((f) => {
    const r = registro(f);
    const fase = textoONulo(r.fase);
    if (!fase) return [];
    return [{
      fase,
      nombre: textoONulo(r.nombre) ?? fase,
      seConserva: items(r.se_conserva),
      hayQueRehacer: items(r.hay_que_rehacer),
      sePierde: items(r.se_pierde),
    }];
  });
}

export function normalizarDecisiones(x: unknown): DecisionDeActualizacion[] {
  return lista(x).flatMap((d) => {
    const r = registro(d);
    const id = textoONulo(r.id);
    if (!id) return [];
    // Un destino desconocido no se da por conservado: se lee como pérdida.
    const destino = textoONulo(r.destino) === "conserva" ? "conserva" : "se_pierde";
    return [{
      id,
      accion: textoONulo(r.accion) ?? "",
      sourceId: textoONulo(r.source_id),
      destino,
      causa: textoONulo(r.causa),
      nCasosGuardados: enteroONulo(r.n_casos_guardados),
      nCasosQueYaNoVienen: enteroONulo(r.n_casos_que_ya_no_vienen),
    }];
  });
}

export function normalizarRespaldo(x: unknown): RespaldoDeActualizacion | null {
  const v = primero(x);
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Registro;
  return {
    creadoEn: textoONulo(r.creado_en),
    archivo: textoONulo(r.archivo),
    nFilas: enteroONulo(r.n_filas),
    legible: primero(r.legible) === true,
    causa: textoONulo(r.causa),
  };
}

function normalizarCambios(raw: Registro): CambiosDeActualizacion {
  const id = registro(raw.identificador);
  const c = registro(raw.casos);
  const ej = registro(c.ejemplos);
  const col = registro(raw.columnas);
  return {
    identificador: { columnas: textos(id.columnas), metodo: textoONulo(id.metodo) },
    casos: {
      antes: enteroONulo(c.antes),
      despues: enteroONulo(c.despues),
      nuevos: enteroONulo(c.nuevos),
      yaNoVienen: enteroONulo(c.ya_no_vienen),
      editados: enteroONulo(c.editados),
      sinCambios: enteroONulo(c.sin_cambios),
      celdasCambiadas: enteroONulo(c.celdas_cambiadas),
      causa: textoONulo(c.causa),
      ejemplos: { nuevos: textos(ej.nuevos), yaNoVienen: textos(ej.ya_no_vienen), editados: textos(ej.editados) },
    },
    columnas: {
      nuevas: textos(col.nuevas),
      yaNoVienen: textos(col.ya_no_vienen),
      conCambios: lista(col.con_cambios).flatMap((x) => {
        const r = registro(x);
        const columna = textoONulo(r.columna);
        return columna ? [{ columna, nCasos: enteroONulo(r.n_casos) }] : [];
      }),
      noComparadas: lista(col.no_comparadas).flatMap((x) => {
        const r = registro(x);
        const columna = textoONulo(r.columna);
        return columna ? [{ columna, causa: textoONulo(r.causa) }] : [];
      }),
    },
  };
}

export function normalizarVistaPrevia(raw: unknown): VistaPreviaDeActualizacion {
  const r = registro(raw);
  const vigente = registro(r.version_vigente);
  const nueva = registro(r.version_nueva);
  const formulario = registro(r.formulario);
  return {
    ...normalizarCambios(r),
    versionVigente: { archivo: textoONulo(vigente.archivo), es: textoONulo(vigente.es) },
    versionNueva: { archivo: textoONulo(nueva.archivo) },
    formulario: { cambia: primero(formulario.cambia) === true, causa: textoONulo(formulario.causa) },
    fases: normalizarFases(r.fases),
    decisiones: normalizarDecisiones(r.decisiones),
    respaldo: normalizarRespaldo(r.respaldo),
  };
}

export function normalizarActualizacion(raw: unknown): ActualizacionAplicada {
  const r = registro(raw);
  const base = registro(r.base);
  return {
    base: Object.keys(base).length ? (base as unknown as EstudioBase) : null,
    archivo: textoONulo(r.archivo),
    cambios: normalizarCambios(registro(r.cambios)),
    fases: normalizarFases(r.fases),
    decisiones: normalizarDecisiones(r.decisiones),
    respaldo: normalizarRespaldo(r.respaldo),
  };
}

// ---------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------

function post(ruta: string, cuerpo: Registro): Promise<Response> {
  return apiFetch(ruta, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(cuerpo),
  });
}

/** Compara la versión nueva (`data_file_id` de `apiUpload`) con la base. No escribe nada. */
export async function apiCargaVistaPreviaActualizacion(payload: { nombre: string; data_file_id: string }) {
  return normalizarVistaPrevia(await handle<unknown>(await post("/api/estudio/base/respuestas/vista-previa", payload)));
}

/** Guarda una copia de la base, reemplaza sus respuestas y devuelve a Validación lo que se conserva. */
export async function apiCargaActualizarRespuestas(payload: { nombre: string; data_file_id: string }) {
  return normalizarActualizacion(await handle<unknown>(await post("/api/estudio/base/respuestas/actualizar", payload)));
}

/** Vuelve a la versión guardada en la copia. La copia se usa una vez. */
export async function apiCargaRevertirActualizacion(payload: { nombre: string }) {
  const r = registro(await handle<unknown>(await post("/api/estudio/base/respuestas/revertir", payload)));
  return { archivo: textoONulo(r.archivo), respaldo: normalizarRespaldo(r.respaldo) };
}
