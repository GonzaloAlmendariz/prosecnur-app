// monitoreoPublicarEnsayo.ts — ensayo «Revisar» de las publicaciones de
// Avance › Salidas a Google Sheets (Meta B, L38).
//
// `POST /api/monitoreo/publication/sheets/revisar` recibe el MISMO body que la
// publicación (`monitoreoPublicationRequestBody`) y devuelve, sin escribir, qué
// cambiaría en cada pestaña: filas añadidas, cambiadas y borradas, si la hoja
// encoge o se crea, y qué pestañas ajenas quedan intactas.
//
// Normalizador defensivo: Plumber serializa con auto_unbox (lista de uno como
// objeto suelto, `NULL` como `{}`). Un recuento ausente queda en 0 y un ensayo
// sin `pestanas` es un error, no un «sin cambios».

import { ApiError, apiFetch, handle, headers } from "./core";
import { monitoreoPublicationRequestBody, type MonitoreoPublicationRequestOptions } from "./monitoreo";
import { booleano, enteroONulo, escalar, lista, registro, texto } from "./normalizarR";

export type EnsayoFila = { clave: string; valores: string[] };
export type EnsayoCelda = { columna: string; antes: string; despues: string };
export type EnsayoCambio = { clave: string; celdas: EnsayoCelda[] };
export type EnsayoColumna = { columna: number; antes: string; despues: string };

export type EnsayoPestana = {
  pestana: string;
  seCrea: boolean;
  /** Rótulo de la primera columna cuando sirve de clave; "" si se comparó por fila completa. */
  clave: string;
  sinClave: boolean;
  anadidas: number;
  cambiadas: number;
  borradas: number;
  columnasCambiadas: EnsayoColumna[];
  filasAntes: number;
  filasDespues: number;
  columnasAntes: number;
  columnasDespues: number;
  encoge: boolean;
  destructiva: boolean;
  sinCambios: boolean;
  detalle: { anadidas: EnsayoFila[]; cambiadas: EnsayoCambio[]; borradas: EnsayoFila[] };
  detalleTruncado: boolean;
};

export type EnsayoPublicacion = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  generadoEn: string;
  firma: string;
  pestanas: EnsayoPestana[];
  intactas: string[];
  resumen: {
    anadidas: number;
    cambiadas: number;
    borradas: number;
    pestanasNuevas: number;
    pestanasQueEncogen: number;
    destructivo: boolean;
  };
};

const entero = (value: unknown) => enteroONulo(value) ?? 0;

function textos(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => texto(v));
  const v = escalar(value);
  return v === undefined || v === null || (typeof v === "object" && !Array.isArray(v)) ? [] : [texto(v)];
}

function fila(value: unknown): EnsayoFila {
  const r = registro(value);
  return { clave: texto(r.clave), valores: textos(r.valores) };
}

function pestana(value: unknown): EnsayoPestana {
  const r = registro(value);
  const detalle = registro(r.detalle);
  return {
    pestana: texto(r.pestana),
    seCrea: booleano(r.se_crea),
    clave: texto(r.clave),
    sinClave: booleano(r.sin_clave),
    anadidas: entero(r.anadidas),
    cambiadas: entero(r.cambiadas),
    borradas: entero(r.borradas),
    columnasCambiadas: lista(r.columnas_cambiadas).map((c) => ({
      columna: entero(c.columna),
      antes: texto(c.antes),
      despues: texto(c.despues),
    })),
    filasAntes: entero(r.filas_antes),
    filasDespues: entero(r.filas_despues),
    columnasAntes: entero(r.columnas_antes),
    columnasDespues: entero(r.columnas_despues),
    encoge: booleano(r.encoge),
    destructiva: booleano(r.destructiva),
    sinCambios: booleano(r.sin_cambios),
    detalle: {
      anadidas: lista(detalle.anadidas).map(fila),
      cambiadas: lista(detalle.cambiadas).map((c) => ({
        clave: texto(c.clave),
        celdas: lista(c.celdas).map((celda) => ({
          columna: texto(celda.columna),
          antes: texto(celda.antes),
          despues: texto(celda.despues),
        })),
      })),
      borradas: lista(detalle.borradas).map(fila),
    },
    detalleTruncado: booleano(r.detalle_truncado),
  };
}

export function normalizarEnsayoPublicacion(data: unknown): EnsayoPublicacion {
  const r = registro(data);
  const pestanas = lista(r.pestanas).map(pestana).filter((p) => p.pestana);
  if (!pestanas.length) {
    throw new ApiError("E_SHEETS_ENSAYO_VACIO", "El ensayo no devolvió pestañas. No se publicó nada; vuelve a revisar.");
  }
  const resumen = registro(r.resumen);
  return {
    spreadsheetId: texto(r.spreadsheet_id),
    spreadsheetUrl: texto(r.spreadsheet_url),
    generadoEn: texto(r.generado_en),
    firma: texto(r.firma),
    pestanas,
    intactas: textos(r.intactas),
    resumen: {
      anadidas: entero(resumen.anadidas),
      cambiadas: entero(resumen.cambiadas),
      borradas: entero(resumen.borradas),
      pestanasNuevas: entero(resumen.pestanas_nuevas),
      pestanasQueEncogen: entero(resumen.pestanas_que_encogen),
      // El destructivo se recalcula también desde las pestañas: si el resumen
      // llega mal, el rojo no puede perderse.
      destructivo: booleano(resumen.destructivo) || pestanas.some((p) => p.destructiva),
    },
  };
}

export async function apiMonitoreoPublicationSheetsRevisar(
  spreadsheetId = "",
  options: MonitoreoPublicationRequestOptions = {},
): Promise<EnsayoPublicacion> {
  const data = await handle<unknown>(
    await apiFetch("/api/monitoreo/publication/sheets/revisar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(monitoreoPublicationRequestBody(spreadsheetId, options)),
    }),
  );
  return normalizarEnsayoPublicacion(data);
}
