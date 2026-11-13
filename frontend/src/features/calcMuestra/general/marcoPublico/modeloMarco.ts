/**
 * Modelo del recorrido del marco de un público (D6, D7): qué decidió el usuario en cada paso y la receta que se
 * guarda. Puro: lo prueban `modeloMarco.test.ts` y lo usa `RecorridoMarco`.
 */
import type {
  ColumnaDelMarco,
  CruceDelMarco,
  GrupoDeCeldas,
  LecturaDelMarco,
  RecetaDelMarco,
  ReglaDeInvitacion,
  UsoDeColumna,
} from "../../../../api/calcMuestraMarcoPublico";
import { fmtInt } from "../../sharedCore";

export const PASOS_MARCO = [
  { id: "archivo", rotulo: "Archivo" },
  { id: "columnas", rotulo: "Columnas" },
  { id: "invitados", rotulo: "Quién se invita" },
  { id: "segmentos", rotulo: "Segmentos" },
] as const;
export type PasoMarco = (typeof PASOS_MARCO)[number]["id"];

export const USOS_DE_COLUMNA: ReadonlyArray<{ uso: UsoDeColumna; rotulo: string; detalle: string }> = [
  { uso: "id", rotulo: "Identificador", detalle: "Una fila por persona, sin repetidos" },
  { uso: "correo", rotulo: "Correo de envío", detalle: "Va al listado, no a la pantalla" },
  { uso: "cuota", rotulo: "Para cuotas", detalle: "La meta se puede repartir por esta columna" },
  { uso: "regla", rotulo: "Para reglas", detalle: "Decide quién se invita" },
  { uso: "personal", rotulo: "Dato personal", detalle: "Se guarda oculto" },
  { uso: "no", rotulo: "No se usa", detalle: "" },
];

export const ROTULO_TIPO: Record<ColumnaDelMarco["tipo"], string> = {
  codigo: "Código",
  correo: "Correo",
  telefono: "Teléfono",
  texto: "Texto",
  categoria: "Categoría",
  numero: "Número",
  vacia: "Vacía",
};

export type EstadoMarco = {
  fileId: string;
  nombreArchivo: string;
  hoja: string;
  lectura: LecturaDelMarco | null;
  /** Lo que el usuario cambió; lo demás sigue el uso sugerido. */
  usos: Record<string, UsoDeColumna>;
  /** Valores excluidos por columna (regla "excluir_valores"). */
  exclusiones: Record<string, string[]>;
  sinCorreo: boolean;
  segmento: { nombre: string; fila: string; columna: string; grupos: GrupoDeCeldas[] };
};

export const ESTADO_MARCO_INICIAL: EstadoMarco = {
  fileId: "",
  nombreArchivo: "",
  hoja: "",
  lectura: null,
  usos: {},
  exclusiones: {},
  sinCorreo: false,
  segmento: { nombre: "", fila: "", columna: "", grupos: [] },
};

export function usoDe(columna: ColumnaDelMarco, usos: Readonly<Record<string, UsoDeColumna>>): UsoDeColumna {
  return usos[columna.nombre] ?? columna.usoSugerido;
}

/** Columnas con ese uso, en el orden del archivo. */
export function columnasConUso(estado: EstadoMarco, uso: UsoDeColumna): string[] {
  return (estado.lectura?.columnas ?? []).filter((c) => usoDe(c, estado.usos) === uso).map((c) => c.nombre);
}

/**
 * Cambiar el uso de una columna. Identificador y correo son únicos: elegir uno nuevo devuelve el anterior a su uso
 * sugerido (o a "No se usa" si el sugerido era ese mismo).
 */
export function conUso(estado: EstadoMarco, nombre: string, uso: UsoDeColumna): Record<string, UsoDeColumna> {
  const usos = { ...estado.usos, [nombre]: uso };
  if (uso === "id" || uso === "correo") {
    for (const c of estado.lectura?.columnas ?? []) {
      if (c.nombre !== nombre && usoDe(c, usos) === uso) usos[c.nombre] = c.usoSugerido === uso ? "no" : c.usoSugerido;
    }
  }
  return usos;
}

export function reglasDe(estado: EstadoMarco): ReglaDeInvitacion[] {
  const reglas: ReglaDeInvitacion[] = Object.entries(estado.exclusiones)
    .filter(([, valores]) => valores.length > 0)
    .map(([columna, valores]) => ({ tipo: "excluir_valores", columna, valores }));
  if (estado.sinCorreo && columnasConUso(estado, "correo").length) reglas.push({ tipo: "excluir_sin_correo" });
  return reglas;
}

/** Sin cruce, cada categoría es su propio grupo; con cruce, cada fila agrupa todas sus celdas. */
export function gruposIniciales(cruce: CruceDelMarco): GrupoDeCeldas[] {
  return cruce.filas.map((fila, i) => ({
    nombre: fila,
    celdas: cruce.columnas.filter((_, j) => (cruce.conteos[i]?.[j] ?? 0) > 0).map((columna) => ({ fila, columna })),
  }));
}

export function grupoDeCelda(grupos: readonly GrupoDeCeldas[], fila: string, columna: string): string {
  return grupos.find((g) => g.celdas.some((c) => c.fila === fila && c.columna === columna))?.nombre ?? "";
}

/** Mueve una celda a un grupo (lo crea si no existe); un grupo que se queda sin celdas desaparece. */
export function moverCelda(grupos: readonly GrupoDeCeldas[], fila: string, columna: string, destino: string): GrupoDeCeldas[] {
  const sin = grupos.map((g) => ({ ...g, celdas: g.celdas.filter((c) => !(c.fila === fila && c.columna === columna)) }));
  const existe = sin.some((g) => g.nombre === destino);
  const con = existe
    ? sin.map((g) => (g.nombre === destino ? { ...g, celdas: [...g.celdas, { fila, columna }] } : g))
    : [...sin, { nombre: destino, celdas: [{ fila, columna }] }];
  return con.filter((g) => g.celdas.length > 0);
}

export function renombrarGrupo(grupos: readonly GrupoDeCeldas[], antes: string, despues: string): GrupoDeCeldas[] {
  const nombre = despues.trim();
  if (!nombre || nombre === antes || grupos.some((g) => g.nombre === nombre)) return [...grupos];
  return grupos.map((g) => (g.nombre === antes ? { ...g, nombre } : g));
}

export function poblacionDeGrupo(cruce: CruceDelMarco, grupo: GrupoDeCeldas): number {
  return grupo.celdas.reduce((s, c) => {
    const i = cruce.filas.indexOf(c.fila);
    const j = cruce.columnas.indexOf(c.columna);
    return s + (i >= 0 && j >= 0 ? cruce.conteos[i]?.[j] ?? 0 : 0);
  }, 0);
}

export function celdasSinGrupo(cruce: CruceDelMarco, grupos: readonly GrupoDeCeldas[]): Array<{ fila: string; columna: string; n: number }> {
  const libres: Array<{ fila: string; columna: string; n: number }> = [];
  cruce.filas.forEach((fila, i) => cruce.columnas.forEach((columna, j) => {
    const n = cruce.conteos[i]?.[j] ?? 0;
    if (n > 0 && !grupoDeCelda(grupos, fila, columna)) libres.push({ fila, columna, n });
  }));
  return libres;
}

/** Por qué no se puede pasar del paso; `null` si se puede. Dice la causa, no solo el hecho. */
export function motivoNoAvanzar(paso: PasoMarco, estado: EstadoMarco, cruce: CruceDelMarco | null): string | null {
  if (paso === "archivo") return estado.lectura ? null : "Sube el archivo del marco.";
  if (paso === "columnas") {
    const ids = columnasConUso(estado, "id");
    return ids.length === 1 ? null : "Marca la columna que identifica a cada persona.";
  }
  if (paso === "invitados") return null;
  if (!estado.segmento.fila) return null;
  if (!cruce) return "Esperando el cruce de la base.";
  const libres = celdasSinGrupo(cruce, estado.segmento.grupos);
  return libres.length ? `${libres.length === 1 ? "Queda 1 celda" : `Quedan ${fmtInt(libres.length)} celdas`} sin grupo.` : null;
}

/** El nombre del segmento; sin nombre escrito, el de sus columnas ("CAT_DESCRI por DEDICACION"). */
export function nombreDeSegmento(seg: EstadoMarco["segmento"]): string {
  const escrito = seg.nombre.trim();
  if (escrito || !seg.fila) return escrito;
  return seg.columna ? `${seg.fila} por ${seg.columna}` : `Segmento por ${seg.fila}`;
}

export function recetaDe(estado: EstadoMarco): RecetaDelMarco {
  const usos: Record<string, UsoDeColumna> = {};
  for (const c of estado.lectura?.columnas ?? []) usos[c.nombre] = usoDe(c, estado.usos);
  return {
    columnas: { id: columnasConUso(estado, "id")[0] ?? "", correo: columnasConUso(estado, "correo")[0] ?? "" },
    usos,
    reglas: reglasDe(estado),
    segmento: {
      nombre: nombreDeSegmento(estado.segmento),
      fila: estado.segmento.fila,
      columna: estado.segmento.columna,
      grupos: estado.segmento.fila ? estado.segmento.grupos : [],
    },
  };
}
