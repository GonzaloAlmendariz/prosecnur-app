/**
 * Origen de la muestra y marca de reemplazo (Insumos › Llave y filtros).
 *
 * El motor publica `origen_de_la_muestra` (`monitoreo_telefonico_origen.R`):
 * casos por valor de la columna de origen y de la marca de reemplazo
 * declaradas, o de las columnas cuyo nombre lo sugiere si nada se declaró. La
 * declaración vive en el perfil: `sample_origin` y `replacement_flag`. Modelo ›
 * Reserva y Avance › Reemplazos leen esas mismas claves.
 */
import type { MonitoreoAcreditacionReports, MonitoreoProfile } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";

export type RolDeOrigen = "titular" | "reserva" | "sin_rol";

export type FilaDeOrigen = { columna: string; valor: string; rol: string; casos: number };

export type BorradorDeOrigen = {
  origen: { columna: string; roles: Record<string, RolDeOrigen> };
  marca: { columna: string; si: string[] };
};

export const SIN_DATO = "Sin dato";

const PATRON_ORIGEN = /origen|titular|reserva|backup|lista|fuente de la muestra/i;
const PATRON_MARCA = /reemplaz|sustitu|suplent/i;
const PATRON_RESERVA = /backup|reserva|reemplazo|suplente|sustitut/i;
const PATRON_TITULAR = /muestra|titular|original|principal|listado|base/i;
const PATRON_SI = /^(s[ií]|y|yes|1|x|true|verdadero)$/i;

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function clave(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function filasDeOrigen(reports: MonitoreoAcreditacionReports | null | undefined): FilaDeOrigen[] {
  return filasDeBloque(reports, ["origen_de_la_muestra"])
    .map((fila) => ({
      columna: texto(fila.Columna),
      valor: texto(fila.Valor) || SIN_DATO,
      rol: texto(fila.Rol),
      casos: Number(fila.Casos) || 0,
    }))
    .filter((fila) => fila.columna);
}

export function columnasConConteo(filas: readonly FilaDeOrigen[]) {
  return [...new Set(filas.map((fila) => fila.columna))];
}

export function valoresDeColumna(filas: readonly FilaDeOrigen[], columna: string) {
  return filas
    .filter((fila) => fila.columna === columna)
    .map(({ valor, casos }) => ({ valor, casos }))
    .sort((a, b) => Number(a.valor === SIN_DATO) - Number(b.valor === SIN_DATO) || b.casos - a.casos);
}

export function rolSugerido(valor: string): RolDeOrigen {
  if (valor === SIN_DATO) return "sin_rol";
  if (PATRON_RESERVA.test(valor)) return "reserva";
  if (PATRON_TITULAR.test(valor)) return "titular";
  return "sin_rol";
}

export function siSugerido(valores: readonly string[]) {
  return valores.filter((valor) => PATRON_SI.test(clave(valor)));
}

/** La columna que el nombre señala; la marca de reemplazo no es columna de origen aunque diga «Backup». */
export function columnaSugerida(columnas: readonly string[], tipo: "origen" | "marca") {
  if (tipo === "marca") return columnas.find((columna) => PATRON_MARCA.test(columna)) ?? "";
  return columnas.find((columna) => PATRON_ORIGEN.test(columna) && !PATRON_MARCA.test(columna)) ?? "";
}

export function rolesSugeridos(valores: ReadonlyArray<{ valor: string }>) {
  return Object.fromEntries(valores.map(({ valor }) => [valor, rolSugerido(valor)])) as Record<string, RolDeOrigen>;
}

/**
 * El borrador parte de lo declarado; si no hay nada declarado, de la sugerencia
 * por nombre. Sugiere también desde las columnas de la base (`variables`)
 * cuando el corte es anterior al bloque `origen_de_la_muestra` y no trae
 * conteos (RMS): la columna se reconoce igual, los casos llegan al actualizar.
 */
export function borradorInicial(
  perfil: MonitoreoProfile | null | undefined,
  filas: readonly FilaDeOrigen[],
  variables: readonly VariableDeLaBase[] = [],
) {
  const columnas = columnasOfrecidas(filas, variables);
  const origenDeclarado = perfil?.sample_origin;
  const marcaDeclarada = perfil?.replacement_flag;
  const columnaOrigen = origenDeclarado?.column ?? columnaSugerida(columnas, "origen");
  const valoresOrigen = valoresParaElegir(filas, variables, columnaOrigen);
  const roles: Record<string, RolDeOrigen> = origenDeclarado
    ? Object.fromEntries(valoresOrigen.map(({ valor }) => {
      const k = clave(valor);
      if (origenDeclarado.titular_values.some((v) => clave(v) === k)) return [valor, "titular"];
      if (origenDeclarado.reserva_values.some((v) => clave(v) === k)) return [valor, "reserva"];
      return [valor, "sin_rol"];
    }))
    : rolesSugeridos(valoresOrigen);
  const columnaMarca = marcaDeclarada?.column ?? columnaSugerida(columnas.filter((c) => c !== columnaOrigen), "marca");
  const si = marcaDeclarada
    ? marcaDeclarada.yes_values
    : siSugerido(valoresParaElegir(filas, variables, columnaMarca).map(({ valor }) => valor));
  const borrador: BorradorDeOrigen = { origen: { columna: columnaOrigen, roles }, marca: { columna: columnaMarca, si } };
  const declarado = Boolean(origenDeclarado || marcaDeclarada);
  return { borrador, declarado, sugerido: !declarado && Boolean(columnaOrigen || columnaMarca) };
}

export type LecturaDeOrigen = {
  titular: number;
  reserva: number;
  sinRol: number;
  reemplazos: number;
  /** El motor publicó conteos para la columna elegida. */
  conConteoOrigen: boolean;
  conConteoMarca: boolean;
};

export function lecturaDeOrigen(borrador: BorradorDeOrigen, filas: readonly FilaDeOrigen[]): LecturaDeOrigen {
  const origen = valoresDeColumna(filas, borrador.origen.columna);
  const marca = valoresDeColumna(filas, borrador.marca.columna);
  const suma = (rol: RolDeOrigen) => origen
    .filter(({ valor }) => (borrador.origen.roles[valor] ?? "sin_rol") === rol)
    .reduce((total, { casos }) => total + casos, 0);
  const si = new Set(borrador.marca.si.map(clave));
  return {
    titular: suma("titular"),
    reserva: suma("reserva"),
    sinRol: suma("sin_rol"),
    reemplazos: marca.filter(({ valor }) => si.has(clave(valor))).reduce((total, { casos }) => total + casos, 0),
    conConteoOrigen: origen.length > 0,
    conConteoMarca: marca.length > 0,
  };
}

/** Lo que se guarda en el perfil; una columna vacía quita la clave. */
export function clavesDelPerfil(borrador: BorradorDeOrigen): Pick<MonitoreoProfile, "sample_origin" | "replacement_flag"> {
  const valoresCon = (rol: RolDeOrigen) => Object.entries(borrador.origen.roles)
    .filter(([valor, asignado]) => asignado === rol && valor !== SIN_DATO)
    .map(([valor]) => valor);
  return {
    sample_origin: borrador.origen.columna
      ? { column: borrador.origen.columna, titular_values: valoresCon("titular"), reserva_values: valoresCon("reserva") }
      : undefined,
    replacement_flag: borrador.marca.columna
      ? { column: borrador.marca.columna, yes_values: borrador.marca.si.filter((valor) => valor !== SIN_DATO) }
      : undefined,
  };
}

export function mismoBorrador(a: BorradorDeOrigen, b: BorradorDeOrigen) {
  return JSON.stringify(clavesDelPerfil(a)) === JSON.stringify(clavesDelPerfil(b));
}

type VariableDeLaBase = { name: string; n_unique: number; values?: string[] };

/** Columnas que se ofrecen: las que traen conteo y las de la base con pocos valores. */
export function columnasOfrecidas(filas: readonly FilaDeOrigen[], variables: readonly VariableDeLaBase[]) {
  const pocas = variables
    .filter((variable) => variable.n_unique >= 2 && variable.n_unique <= 12 && !variable.name.startsWith(".") && !variable.name.startsWith("dim_"))
    .map((variable) => variable.name);
  return [...new Set([...columnasConConteo(filas), ...pocas])];
}

/** Valores de la columna con su conteo; sin conteo publicado, los valores de la base y `casos: null`. */
export function valoresParaElegir(filas: readonly FilaDeOrigen[], variables: readonly VariableDeLaBase[], columna: string) {
  const conConteo = valoresDeColumna(filas, columna);
  if (conConteo.length) return conConteo.map((item) => ({ ...item, casos: item.casos as number | null }));
  const variable = variables.find((item) => item.name === columna);
  return (variable?.values ?? []).map((valor) => ({ valor, casos: null as number | null }));
}
