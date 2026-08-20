/**
 * Lo que el aplicador declaró contra lo que llegó a plataforma.
 *
 * Gonzalo: «al analista le interesa saber qué es lo que hay en plataforma; si lo
 * que hay en plataforma coincide con lo que se ve en el aula».
 *
 * **Y lo importante de este cruce es que tiene dos lecturas opuestas.**
 *
 * - Unas pocas aulas descuadran → son casos que mirar uno a uno: alguien contó
 *   mal, se quedaron encuestas sin enviar, entraron respuestas de otro sitio.
 * - **Casi todas descuadran → no es el campo, es el mapeo.** Cuando el
 *   identificador con el que se atribuyen las respuestas no corresponde con el
 *   de los partes, el cruce entero deja de significar nada, y un panel que
 *   liste «151 de 152 descuadran» estaría acusando al equipo de un error de
 *   configuración.
 *
 * Medido: en el fixture de QA pasa exactamente lo segundo —las respuestas y los
 * partes se siembran sin correspondencia—, así que este módulo nació con su
 * propio caso límite delante.
 */

type Fila = Readonly<Record<string, unknown>>;

const txt = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number.parseFloat(txt(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type DescuadreDeAula = {
  codigo: string;
  facultad: string;
  /** Lo que el aplicador anotó en el parte. */
  declaradas: number;
  /** Lo que llegó a plataforma y pasó el filtro. */
  enPlataforma: number;
  diferencia: number;
};

export type ParteContraPlataforma = {
  comparables: number;
  descuadran: number;
  casos: DescuadreDeAula[];
  /**
   * `true` cuando descuadra tanto que el cruce ya no habla del campo.
   * El umbral es alto a propósito: acusar de «mapeo roto» a un operativo que
   * simplemente cuenta regular sería igual de injusto que lo contrario.
   */
  fuentesSinCorrespondencia: boolean;
};

/** A partir de aquí, lo que falla es la correspondencia y no el conteo. */
export const PROPORCION_QUE_DELATA_EL_MAPEO = 0.9;
/** Con pocas aulas, una proporción alta no dice nada: hacen falta casos. */
export const MINIMO_PARA_SOSPECHAR_DEL_MAPEO = 20;

export function parteContraPlataforma(
  partes: ReadonlyArray<Fila>,
  agenda: ReadonlyArray<Fila>,
): ParteContraPlataforma {
  const enPlataforma = new Map<string, number>();
  const facultades = new Map<string, string>();
  for (const f of agenda) {
    const codigo = txt(f.operational_code);
    if (!codigo) continue;
    const validas = num(f.respuestas_validas);
    if (validas !== null) enPlataforma.set(codigo, validas);
    const facultad = txt(f.faculty);
    if (facultad) facultades.set(codigo, facultad);
  }

  const casos: DescuadreDeAula[] = [];
  let comparables = 0;
  for (const p of partes) {
    const codigo = txt(p.operational_code);
    const declaradas = num(p.effective_surveys);
    if (!codigo || declaradas === null || !enPlataforma.has(codigo)) continue;
    const enP = enPlataforma.get(codigo)!;
    comparables += 1;
    const diferencia = declaradas - enP;
    if (diferencia !== 0) {
      casos.push({
        codigo, facultad: facultades.get(codigo) ?? "",
        declaradas, enPlataforma: enP, diferencia,
      });
    }
  }

  // Por la diferencia más grande en valor absoluto: da igual de qué lado caiga,
  // lo que se mira primero es dónde más se separan las dos fuentes.
  casos.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia)
    || a.codigo.localeCompare(b.codigo, "es"));

  return {
    comparables,
    descuadran: casos.length,
    casos,
    fuentesSinCorrespondencia: comparables >= MINIMO_PARA_SOSPECHAR_DEL_MAPEO
      && casos.length >= comparables * PROPORCION_QUE_DELATA_EL_MAPEO,
  };
}
