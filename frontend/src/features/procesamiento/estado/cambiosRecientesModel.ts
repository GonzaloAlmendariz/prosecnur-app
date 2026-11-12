// "Cambios recientes" de Estado del estudio: los hechos con fecha que el motor
// ya guarda de cada base, del más reciente al más antiguo (prototipo "estado").
// No hay un historial del estudio en el motor: esta lista se arma con las
// marcas que `GET /api/estudio` publica por base y con la fecha de la
// aprobación para informe. Lo que no deja marca (el cierre de la limpieza, la
// codificación aplicada, una lectura de Kobo) no aparece: es el pedido
// `PEDIDO_CAMBIOS` (M8).

import type { EstudioBase, EstudioPayload } from "../../../api/estudio";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import type { Aprobaciones } from "./aprobacionesModel";
import { esGrupoRepetido, etiquetaDeBase } from "./basesDelEstudioModel";
import { ultimaLecturaDeSurveyMonkey } from "./causaDeFaseModel";
import { fechaCorta, instanteDe } from "./fechaDelEstudio";

export type CambioReciente = {
  clave: string;
  instante: number;
  /** "9 nov". */
  fecha: string;
  /** Etiqueta de la base: "Estudiantes". */
  base: string;
  /** El hecho, en minúscula inicial porque sigue al nombre de la base: "lectura de SurveyMonkey". */
  hecho: string;
};

export const MAX_CAMBIOS = 12;

export const PEDIDO_CAMBIOS =
  "M8: fecha del cierre de la limpieza, de la codificación aplicada, de las lecturas de Kobo y de cada archivo generado, por base";

function texto(valor: unknown): string {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  return limpio === "NA" ? "" : limpio;
}

function hechoDeLectura(base: EstudioBase): { marca: unknown; hecho: string } | null {
  const lectura = ultimaLecturaDeSurveyMonkey(base);
  if (!lectura) return null;
  const { marca, via, n } = lectura;
  if (via !== "api") {
    const archivo = via === "sav" ? "SAV" : "Excel";
    const hecho = n === null
      ? `importación del ${archivo} de SurveyMonkey`
      : `importación del ${archivo} de SurveyMonkey, ${formatoConteoDe(n, "respuesta")}`;
    return { marca, hecho };
  }
  const hecho = n === null
    ? "lectura de SurveyMonkey"
    : n === 0
      ? "lectura de SurveyMonkey, sin respuestas nuevas"
      : `lectura de SurveyMonkey, ${formatoConteoDe(n, "respuesta nueva", "respuestas nuevas")}`;
  return { marca, hecho };
}

/** De qué base vino la lógica del formulario; `null` si no se puede nombrar sin inventar. */
function origenDeLaLogica(plantilla: string, porNombre: ReadonlyMap<string, EstudioBase>): string | null {
  const origen = porNombre.get(plantilla);
  if (origen) return etiquetaDeBase(origen);
  // El motor guarda el nombre del archivo cuando la plantilla vino de otro proyecto.
  if (/\.pulso$/i.test(plantilla)) return "otro proyecto";
  return null;
}

export function cambiosRecientes(
  estudio: EstudioPayload | null,
  aprobaciones: Aprobaciones | null,
  hoy: Date = new Date(),
): CambioReciente[] {
  if (!estudio) return [];
  const bases = Object.entries(estudio.bases ?? {}).map(([clave, base]) => ({ ...base, nombre: base.nombre || clave }));
  const porNombre = new Map(bases.map((b) => [b.nombre, b]));
  const cambios: CambioReciente[] = [];
  const agregar = (base: EstudioBase, tipo: string, marca: unknown, hecho: string) => {
    const instante = instanteDe(marca);
    const fecha = fechaCorta(marca, hoy);
    if (instante === null || fecha === null) return;
    cambios.push({ clave: `${base.nombre}:${tipo}`, instante, fecha, base: etiquetaDeBase(base), hecho });
  };

  for (const base of bases) {
    agregar(base, "alta", base.added_at, esGrupoRepetido(base) ? "grupo repetido agregado al estudio" : "base agregada al estudio");
    const lectura = hechoDeLectura(base);
    if (lectura) agregar(base, "lectura", lectura.marca, lectura.hecho);
    const plantilla = texto(base.logic_template_base);
    const origen = plantilla && plantilla !== base.nombre ? origenDeLaLogica(plantilla, porNombre) : null;
    if (origen) agregar(base, "logica", base.logic_template_applied_at, `se aplicó la lógica del formulario de ${origen}`);
    const aprobacion = aprobaciones?.porBase.get(base.nombre);
    if (aprobacion?.aprobadaEl) agregar(base, "aprobacion", aprobacion.aprobadaEl, "aprobada para informe");
  }

  return cambios.sort((a, b) => b.instante - a.instante || a.base.localeCompare(b.base, "es")).slice(0, MAX_CAMBIOS);
}
