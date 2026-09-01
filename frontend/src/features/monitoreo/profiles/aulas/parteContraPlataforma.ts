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
 *
 * **Y el filtro se descuenta antes de acusar a la atribución** (B8,
 * docs/qa/checklist-tres-fuentes-monitoreo-2026-08-27.md:183-213). El parte
 * declara lo que el aplicador contó; `respuestas_validas` es el POST-filtro, y
 * en cuanto el estudio declara un criterio de efectiva las dos cifras difieren
 * POR DISEÑO. Comparadas a secas, el panel llegó a acusar «74 de 78» de fallo
 * de atribución cuando el filtro descartaba respuestas en exactamente esas 74.
 * La regla: la comparación va contra el CRUDO —`responses_total`, o
 * `respuestas_validas + filter_rejected` cuando el total no viene—, y sólo la
 * diferencia que sobra después de ese descuento apunta a la atribución. Sin
 * ningún crudo se compara contra las válidas, como siempre, pero el resultado
 * lo declara (`sinCrudo`) para que el panel diga su limitación.
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
  /**
   * Lo que la plataforma atribuye al curso-horario: el total CRUDO cuando la
   * base lo publica; sólo lo que pasó el filtro cuando no (`sinCrudo`). Siempre
   * es el número contra el que se calculó `diferencia`, para que el lector
   * pueda reconstruirla restando los dos que ve.
   */
  enPlataforma: number;
  /** La residual tras descontar el filtro: `declaradas − enPlataforma`. */
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
  /**
   * Cursos-horario que trajeron más de un parte de campo y cuyos declarados se
   * sumaron para poder compararlos.
   *
   * Se declara porque cambia la lectura: «3 de 150 descuadran» significa otra
   * cosa si detrás hay 160 partes que si hay 150.
   */
  conVariosPartes: number;
  /**
   * Cursos-horario cuya diferencia con el post-filtro la explica el filtro DEL
   * TODO: contra el crudo cuadran exacto, así que no hay nada que listar.
   *
   * Cuenta sólo explicaciones completas. Un caso donde el filtro descartó algo
   * pero aun así sobra residual se lista con esa residual y NO suma aquí: lo
   * que este número dice es cuántas diferencias desaparecieron con el
   * descuento, no cuántas veces actuó el filtro.
   */
  explicadasPorFiltro: number;
  /**
   * `true` cuando algún comparable no trajo crudo (`responses_total` ni
   * `filter_rejected`) y hubo que comparar contra las válidas, como antes de
   * B8. El panel lo usa para declarar esa limitación.
   */
  sinCrudo: boolean;
};

/** A partir de aquí, lo que falla es la correspondencia y no el conteo. */
export const PROPORCION_QUE_DELATA_EL_MAPEO = 0.9;
/** Con pocas aulas, una proporción alta no dice nada: hacen falta casos. */
export const MINIMO_PARA_SOSPECHAR_DEL_MAPEO = 20;

export function parteContraPlataforma(
  partes: ReadonlyArray<Fila>,
  agenda: ReadonlyArray<Fila>,
): ParteContraPlataforma {
  const enPlataforma = new Map<string, { validas: number; crudo: number | null }>();
  const facultades = new Map<string, string>();
  for (const f of agenda) {
    const codigo = txt(f.operational_code);
    if (!codigo) continue;
    const validas = num(f.respuestas_validas);
    if (validas !== null) {
      // El crudo del aula: todas las respuestas atribuidas, antes del filtro.
      // `responses_total` viene de la whitelist del motor; si sólo llega el
      // rechazo, válidas + rechazadas ES el total. OJO: `respuestas_total` (en
      // español) existe en el bloque de kpis y es OTRO campo de OTRO grano.
      const rechazadas = num(f.filter_rejected);
      const crudo = num(f.responses_total)
        ?? (rechazadas !== null ? validas + rechazadas : null);
      enPlataforma.set(codigo, { validas, crudo });
    }
    const facultad = txt(f.faculty);
    if (facultad) facultades.set(codigo, facultad);
  }

  // Los partes se AGRUPAN por curso-horario antes de comparar. Antes se comparaba
  // fila a fila contra el total de plataforma, y un curso-horario con dos partes
  // —dos sesiones, o el libro partido en dos filas— descuadraba DOS VECES aunque
  // la suma cuadrara exacta: 20 y 18 contra 38 daba dos descuadres de un cruce
  // perfecto. El lado de plataforma siempre fue por código; el del parte no, y
  // ese desnivel de grano era el defecto.
  const declaradasPorCodigo = new Map<string, number>();
  const partesPorCodigo = new Map<string, number>();
  for (const p of partes) {
    const codigo = txt(p.operational_code);
    const declaradas = num(p.effective_surveys);
    if (!codigo || declaradas === null || !enPlataforma.has(codigo)) continue;
    declaradasPorCodigo.set(codigo, (declaradasPorCodigo.get(codigo) ?? 0) + declaradas);
    partesPorCodigo.set(codigo, (partesPorCodigo.get(codigo) ?? 0) + 1);
  }

  const casos: DescuadreDeAula[] = [];
  let comparables = 0;
  let conVariosPartes = 0;
  let explicadasPorFiltro = 0;
  let sinCrudo = false;
  for (const [codigo, declaradas] of declaradasPorCodigo) {
    const enP = enPlataforma.get(codigo)!;
    comparables += 1;
    if ((partesPorCodigo.get(codigo) ?? 0) > 1) conVariosPartes += 1;
    // El descuento de B8: contra el crudo cuando existe, para que lo que el
    // filtro descartó no se lea como descuadre. Sin crudo, contra las válidas
    // —como siempre— y se declara.
    if (enP.crudo === null) sinCrudo = true;
    const referencia = enP.crudo ?? enP.validas;
    const diferencia = declaradas - referencia;
    if (diferencia !== 0) {
      casos.push({
        codigo, facultad: facultades.get(codigo) ?? "",
        declaradas, enPlataforma: referencia, diferencia,
      });
    } else if (enP.crudo !== null && enP.crudo !== enP.validas) {
      // Contra el post-filtro habría descuadrado; contra el crudo cuadra
      // exacto: la diferencia entera era del filtro.
      explicadasPorFiltro += 1;
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
    conVariosPartes,
    explicadasPorFiltro,
    sinCrudo,
    // Sobre los descuadres RESIDUALES: 74 de 78 explicadas por el filtro son
    // atribución perfecta, no un mapeo roto — el defecto medido de B8.
    fuentesSinCorrespondencia: comparables >= MINIMO_PARA_SOSPECHAR_DEL_MAPEO
      && casos.length >= comparables * PROPORCION_QUE_DELATA_EL_MAPEO,
  };
}
