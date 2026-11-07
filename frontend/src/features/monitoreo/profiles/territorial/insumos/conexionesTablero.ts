import { enumerar } from "../../../../../lib/enumerar";
import { formatoConteo, formatoConteoDe } from "../../../../../lib/formatoNumero";
import type { ChromeStatusTone } from "../../../../../components/ModuleCommandBar";
import type { CifraDeFuente, ModeloConexiones, TarjetaDeFuente, TonoDeFuente } from "./conexionesModel";

/**
 * Insumos › Conexiones, presentación (pasada de diseño de Material, 3 nov 2026).
 * `conexionesModel.ts` calcula qué trajo cada fuente; aquí sólo se decide cómo
 * se enseña: qué cifras van en tarjeta y cuáles son metadatos de la cabecera,
 * la tira de lecturas, la acción principal y el orden de las fuentes. Ninguna
 * cifra se recalcula: los valores llegan ya formateados del modelo.
 */

export type IconoDeFuente = "kobo" | "ocurrencias" | "hoja";

export type TiraDeLecturas = {
  /** Alto relativo de cada lectura, de 0 a 1, en orden de llegada. */
  alturas: number[];
  /** «Respuestas por lectura» lo dice el rótulo; esto es lo que muestra la tira. */
  resumen: string;
};

export type FuenteDelTablero = {
  clave: string;
  titulo: string;
  icono: IconoDeFuente;
  estado: string;
  tono: ChromeStatusTone;
  /** La fuente de una fase que no es la activa: sin acción principal y más apagada. */
  discreta: boolean;
  formulario: string;
  /** El nombre llega tal como lo escribió quien armó el formulario: si es todo
   *  mayúsculas no se reescribe (no es seguro), se le baja el peso. */
  formularioEnMayusculas: boolean;
  metadatos: string;
  cifras: CifraDeFuente[];
  tira: TiraDeLecturas | null;
  /** «Traer nuevas» (principal) y «Traer todo de nuevo» sólo en la fase activa. */
  traer: boolean;
  /** «Releer ficha o cambiar formulario…» en las fuentes de fase. */
  administrar: boolean;
};

export type TableroDeConexiones = {
  fuentes: FuenteDelTablero[];
  muestra: CifraDeFuente[];
};

const TONO: Record<TonoDeFuente, ChromeStatusTone> = { ok: "success", aviso: "warn", error: "danger", inactiva: "neutral" };

/** Lo que describe la fuente y no se cuenta: va en la línea de la cabecera. */
const METADATOS = new Set(["preguntas", "opciones", "fase-desde"]);

const SIN_DATO = "—";

function icono(tarjeta: TarjetaDeFuente): IconoDeFuente {
  if (tarjeta.fase) return "kobo";
  return tarjeta.clave === "ocurrencias" ? "ocurrencias" : "hoja";
}

function enMayusculas(texto: string): boolean {
  const letras = texto.replace(/[^\p{L}]/gu, "");
  return letras.length > 3 && letras === letras.toLocaleUpperCase("es-PE") && letras !== letras.toLocaleLowerCase("es-PE");
}

function frase(cifras: readonly CifraDeFuente[]): string {
  const por = (id: string) => cifras.find((cifra) => cifra.id === id)?.valor;
  const conteo = (valor: string | undefined, singular: string, plural: string) =>
    valor && valor !== SIN_DATO ? `${valor} ${valor === "1" ? singular : plural}` : null;
  const desde = por("fase-desde");
  return enumerar([
    conteo(por("preguntas"), "pregunta", "preguntas"),
    conteo(por("opciones"), "opción", "opciones"),
    desde === undefined ? null : desde === SIN_DATO ? "fase sin fecha de inicio" : `fase desde ${desde}`,
  ]);
}

export function tiraDeLecturas(serie: readonly number[]): TiraDeLecturas | null {
  if (serie.length < 2) return null;
  const maximo = Math.max(1, ...serie);
  const minimo = Math.min(...serie);
  const lecturas = formatoConteoDe(serie.length, "lectura");
  const resumen = minimo === Math.max(...serie)
    ? `${formatoConteo(minimo)} en cada una de las ${lecturas}`
    : `De ${formatoConteo(serie[0])} a ${formatoConteo(serie[serie.length - 1])} en ${lecturas}`;
  return { alturas: serie.map((valor) => Math.max(0, valor) / maximo), resumen };
}

function rango(fuente: FuenteDelTablero): number {
  if (fuente.traer) return 0;
  return fuente.discreta ? 2 : 1;
}

export function construirTableroDeConexiones(modelo: ModeloConexiones): TableroDeConexiones {
  const fuentes = modelo.tarjetas.map((tarjeta): FuenteDelTablero => {
    const discreta = Boolean(tarjeta.fase) && !tarjeta.activa;
    return {
      clave: tarjeta.clave,
      titulo: tarjeta.titulo,
      icono: icono(tarjeta),
      estado: tarjeta.estado,
      tono: TONO[tarjeta.tono],
      discreta,
      formulario: tarjeta.formulario,
      formularioEnMayusculas: enMayusculas(tarjeta.formulario),
      metadatos: frase(tarjeta.cifras),
      cifras: tarjeta.cifras.filter((cifra) => !METADATOS.has(cifra.id)),
      tira: tiraDeLecturas(tarjeta.serie),
      traer: Boolean(tarjeta.fase) && tarjeta.activa,
      administrar: Boolean(tarjeta.fase),
    };
  });
  // La fase activa primero, después las fuentes que la acompañan (ocurrencias,
  // hoja de ruta) y al final la fase que no corre. `sort` es estable.
  return { fuentes: [...fuentes].sort((a, b) => rango(a) - rango(b)), muestra: modelo.muestra };
}
