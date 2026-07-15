/**
 * Capa de dominio del recorrido muestral universitario — ADAPTADOR.
 *
 * Convierte los agregados reales del marco de aulas (frame construido por el
 * backend R, campo `frame.perfil`, schema "calc_muestra_aulas_perfil_v1") en
 * un PerfilInstitucional para el Recorrido. Es el seam único entre la API y
 * la capa visual: el futuro recorrido/ consume `perfilActivo()` y nada más.
 *
 * Defensivo por diseño (patrón normalizeGraficosShareInspect de client.ts):
 * Plumber serializa escalares como arrays de 1 elemento y los NA de R llegan
 * de formas creativas (null, "NA", string vacío). Todo se coacciona antes de
 * usarse; los frames viejos persistidos no traen `perfil` y aquí se tolera.
 *
 * Decisiones documentadas:
 *  - Plantilla según input_mode: "dos_bases" usa PLANTILLA_UNIVERSIDAD tal
 *    cual (dos bases relacionadas, llave curso-horario). "base_madre" es UNA
 *    base plana, pero PLANTILLA_ESCUELA arrastra semántica ajena (unidad
 *    "grado", criterio de sede) que no aplica a una universidad con base
 *    madre: se parte de PLANTILLA_UNIVERSIDAD y solo se ajusta modeloDatos a
 *    1 base con deduplicación por código de alumno.
 *  - Orden de sexos: si sexo_labels trae 2 valores, etiquetasSexo = [label1,
 *    label2] en ese mismo orden (frecuencia descendente) y los conteos
 *    sexo_1_n/sexo_2_n van a los slots `mujeres`/`hombres` respetándolo.
 *    "mujeres"/"hombres" son los NOMBRES DE SLOT del diseño (así está
 *    modelado en tipos.ts); la etiqueta visible siempre sale de
 *    etiquetasSexo, nunca del nombre del campo.
 */
import type { CalcMuestraAulasFrame } from "../../../api/client";
import { PLANTILLA_UNIVERSIDAD } from "./presets";
import type {
  CriterioAula,
  EmbudoPaso,
  FacultadDatos,
  FilaCobertura,
  PerfilInstitucional,
} from "./tipos";

/** Impacto medido de activar un criterio opcional (shape de CriterioAula.impactoActivar). */
export type ImpactoOpcionalAula = NonNullable<CriterioAula["impactoActivar"]>;

const SCHEMA_PERFIL = "calc_muestra_aulas_perfil_v1";

// ---------------------------------------------------------------------------
// Coacciones defensivas (payloads de Plumber: escalares en arrays de 1, NA).
// ---------------------------------------------------------------------------

/** Desanida el array-de-1 con que Plumber serializa escalares. */
function desanidar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.length > 0 ? valor[0] : null;
  return valor;
}

/** Número finito o null (tolera strings numéricos, "NA", null, array-de-1). */
function numero(valor: unknown): number | null {
  const v = desanidar(valor);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s.toUpperCase() === "NA") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** String con trim o null (tolera números y array-de-1). */
function texto(valor: unknown): string | null {
  const v = desanidar(valor);
  if (typeof v === "string") {
    const s = v.trim();
    return s.length > 0 ? s : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Array tolerante: undefined/null → [], escalar suelto → [escalar]. */
function lista(valor: unknown): unknown[] {
  if (valor == null) return [];
  if (Array.isArray(valor)) return valor;
  return [valor];
}

/** Fila de un data.frame serializado: objeto plano o {} si llegó basura. */
function registro(valor: unknown): Record<string, unknown> {
  if (typeof valor === "object" && valor !== null && !Array.isArray(valor)) {
    return valor as Record<string, unknown>;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Formateo en español para los textos didácticos generados.
// ---------------------------------------------------------------------------

/** Miles con coma (estilo de la documentación del método: "21,365"). */
function fmtMiles(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "DD/MM/YYYY" desde un timestamp ISO/R ("2026-07-11 10:30:00"), o null. */
function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}

/** Año del timestamp del frame; si no se puede leer, el año actual. */
function anioDe(iso: string | null): number {
  if (iso) {
    const m = iso.match(/\b(19|20)\d{2}\b/);
    if (m) return Number(m[0]);
    const fecha = new Date(iso);
    if (!Number.isNaN(fecha.getTime())) return fecha.getFullYear();
  }
  return new Date().getFullYear();
}

/** Slug estable para ids faltantes (sin tildes, minúsculas, guiones). */
function slug(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Embudos: los conteos vienen del backend; el porQué se redacta aquí.
// ---------------------------------------------------------------------------

type ClaseEmbudo = "alumno" | "aula";

/** Redacciones por paso conocido del contrato (ids del backend). */
const POR_QUE_ALUMNO: Record<string, (n: string) => string> = {
  pregrado: (n) => `Excluye ${n} estudiantes fuera de pregrado (posgrado, diplomados, segundas especialidades).`,
  regular: (n) => `Excluye ${n} estudiantes sin matrícula regular.`,
  "mayor-edad": (n) => `Excluye ${n} estudiantes menores de 18 años. El resultado es la población objetivo (N).`,
};

const POR_QUE_AULA: Record<string, (n: string) => string> = {
  presencial: (n) => `Excluye ${n} cursos-horario no presenciales.`,
  tipo: (n) => `Excluye ${n} cursos-horario por tipo de curso no válido (seminarios, tesis, asesorías).`,
  sede: (n) => `Excluye ${n} cursos-horario fuera de las sedes definidas para el operativo.`,
  elegibles: (n) => `Excluye ${n} cursos-horario bajo el umbral de elegibles.`,
  docente: (n) => `Excluye ${n} cursos-horario sin al menos un docente de tipo aceptado (contratado, ordinario…).`,
  nivel: (n) => `Excluye ${n} cursos-horario fuera del rango de nivel definido para su unidad académica.`,
  c7: (n) => `Excluye ${n} cursos-horario bajo el umbral de prevalencia de población objetivo (c7).`,
  c8: (n) => `Excluye ${n} cursos-horario bajo el umbral de homogeneidad de ciclo (c8).`,
};

/** Genera el porQué en llano de un paso a partir de sus excluidos medidos. */
function porQuePaso(clase: ClaseEmbudo, id: string, indice: number, excluidos: number): string {
  if (indice === 0) return "Base cruda leída del proyecto.";
  const sustantivo = clase === "alumno" ? "estudiantes" : "cursos-horario";
  if (excluidos <= 0) return `No excluye ${sustantivo}: el conteo se mantiene.`;
  const n = fmtMiles(excluidos);
  const redaccion = (clase === "alumno" ? POR_QUE_ALUMNO : POR_QUE_AULA)[id];
  return redaccion ? redaccion(n) : `Excluye ${n} ${sustantivo} en este filtro.`;
}

/** EmbudoPaso[] desde el embudo serializado; null si no llegó ningún paso. */
function embudoDesde(crudo: unknown, clase: ClaseEmbudo): EmbudoPaso[] | null {
  const pasos = lista(crudo)
    .map(registro)
    .map((fila, indice): EmbudoPaso | null => {
      const label = texto(fila.label) ?? texto(fila.id);
      const conteo = numero(fila.conteo);
      if (label == null || conteo == null) return null;
      const id = texto(fila.id) ?? slug(label);
      const excluidos = numero(fila.excluidos) ?? 0;
      // Sin sello: los sellos de confiabilidad son del canon, no del proyecto.
      return { id, label, conteo, porQue: porQuePaso(clase, id, indice, excluidos) };
    })
    .filter((paso): paso is EmbudoPaso => paso != null);
  return pasos.length > 0 ? pasos : null;
}

// ---------------------------------------------------------------------------
// Normalización del payload crudo del backend.
// ---------------------------------------------------------------------------

/** Perfil crudo validado (schema + población) o null si el frame no lo trae. */
function perfilCrudoDe(frame: CalcMuestraAulasFrame | null | undefined): Record<string, unknown> | null {
  if (!frame || frame.perfil == null) return null;
  const crudo = registro(desanidar(frame.perfil as unknown));
  if (texto(crudo.schema) !== SCHEMA_PERFIL) return null;
  const poblacion = numero(crudo.poblacion_n) ?? 0;
  if (poblacion <= 0) return null;
  return crudo;
}

/** FacultadDatos[] desde las filas serializadas del perfil. */
function facultadesDesde(crudo: unknown): FacultadDatos[] {
  return lista(crudo)
    .map(registro)
    .map((fila): FacultadDatos | null => {
      const nombre = texto(fila.nombre) ?? texto(fila.id);
      if (nombre == null) return null;
      const id = texto(fila.id) ?? slug(nombre);
      return {
        id,
        nombre,
        N: numero(fila.n) ?? 0,
        // Slots del diseño: siguen el orden de sexo_labels (ver docstring).
        mujeres: numero(fila.sexo_1_n) ?? 0,
        hombres: numero(fila.sexo_2_n) ?? 0,
        estAulaMediana: numero(fila.est_aula_mediana),
        estAulaMedia: numero(fila.est_aula_media),
        // IC 95% del bootstrap de la media (percentiles 2.5/97.5). El backend R
        // emite NA cuando la facultad tiene <15 CH: numero(...) lo coacciona a
        // null y el motor cae a mín(mediana, media) para esa facultad.
        estAulaLo95: numero(fila.est_aula_lo95),
        estAulaHi95: numero(fila.est_aula_hi95),
        estAulaNCh: numero(fila.est_aula_n_ch),
        alcanzables: numero(fila.alcanzables),
        pExito: null,
      };
    })
    .filter((f): f is FacultadDatos => f != null);
}

/** Capitaliza la primera letra respetando el resto tal cual llega. */
function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Impacto medido de los criterios opcionales (`crudo.opcionales`, contrato
 * {c7: {id, aplicado, umbral, aulas, cobertura_pct, unidades_rotas}, c8: …}),
 * indexado por id. Frames viejos no lo traen: devuelve {} y se tolera.
 */
function impactosOpcionalesDe(crudo: unknown): Record<string, ImpactoOpcionalAula> {
  const out: Record<string, ImpactoOpcionalAula> = {};
  const mapa = registro(desanidar(crudo));
  for (const [clave, valor] of Object.entries(mapa)) {
    const fila = registro(desanidar(valor));
    const aulas = numero(fila.aulas);
    const coberturaPct = numero(fila.cobertura_pct);
    if (aulas == null || coberturaPct == null) continue;
    const id = texto(fila.id) ?? clave;
    out[id] = {
      aulas,
      coberturaPct,
      facultadesRotas: lista(fila.unidades_rotas)
        .map(texto)
        .filter((s): s is string => s != null),
    };
  }
  return out;
}

/**
 * Embudo de AULA medido del frame (perfil del backend), o null si el frame no
 * trae perfil utilizable. Lo reusa datosProyecto para preferir el embudo real
 * sobre el fallback pobre de dos pasos.
 */
export function embudoAulaDesdeFrame(frame: CalcMuestraAulasFrame | null | undefined): EmbudoPaso[] | null {
  const crudo = perfilCrudoDe(frame);
  if (!crudo) return null;
  return embudoDesde(crudo.embudo_aula, "aula");
}

/**
 * Embudo de ALUMNO medido del frame (perfil del backend): universo → pregrado →
 * regular → mayor de edad → población objetivo. Null si el frame no trae perfil
 * utilizable — en ese caso la pestaña cae a su flujo agregado de tres pasos.
 */
export function embudoAlumnoDesdeFrame(frame: CalcMuestraAulasFrame | null | undefined): EmbudoPaso[] | null {
  const crudo = perfilCrudoDe(frame);
  if (!crudo) return null;
  return embudoDesde(crudo.embudo_alumno, "alumno");
}

/**
 * FacultadDatos[] del perfil del frame (agregado R): incluye el IC 95% del
 * bootstrap de estudiantes-por-aula (estAulaLo95/hi95/nCh) que solo el backend
 * puede calcular. `[]` si el frame no trae perfil utilizable — en ese caso la
 * pestaña de cursos-horario cae a la mediana/media recomputadas del aula_frame.
 */
export function facultadesDesdeFrame(frame: CalcMuestraAulasFrame | null | undefined): FacultadDatos[] {
  const crudo = perfilCrudoDe(frame);
  if (!crudo) return [];
  return facultadesDesde(crudo.facultades);
}

/**
 * Impacto medido de los opcionales (c7/c8) por id, desde el perfil del frame;
 * null si el frame no trae perfil o el perfil no mide opcionales (frames viejos).
 */
export function impactoOpcionalesDesdeFrame(
  frame: CalcMuestraAulasFrame | null | undefined,
): Record<string, ImpactoOpcionalAula> | null {
  const crudo = perfilCrudoDe(frame);
  if (!crudo) return null;
  const impactos = impactosOpcionalesDe(crudo.opcionales);
  return Object.keys(impactos).length > 0 ? impactos : null;
}

// ---------------------------------------------------------------------------
// API del adaptador.
// ---------------------------------------------------------------------------

/**
 * PerfilInstitucional real desde el frame de aulas del proyecto, o null si el
 * frame no trae perfil utilizable (frame viejo persistido, schema desconocido
 * o población no positiva) — en ese caso el recorrido cae al canon.
 */
export function perfilDesdeFrame(input: {
  frame?: CalcMuestraAulasFrame | null;
  titulo?: string | null;
}): PerfilInstitucional | null {
  const { frame } = input;
  const crudo = perfilCrudoDe(frame);
  if (!crudo || !frame) return null;

  const plantilla = PLANTILLA_UNIVERSIDAD;
  const generadoEn = texto(frame.generated_at);
  const fecha = fechaCorta(generadoEn);

  // Etiquetas de sexo por slot: cada etiqueta medida reemplaza SU slot, para
  // que sexo_1_n/sexo_2_n siempre se muestren bajo su etiqueta real (una base
  // de un solo sexo conserva la etiqueta de plantilla únicamente en el slot
  // vacío, cuyo conteo es 0).
  const sexoLabels = lista(crudo.sexo_labels)
    .map(texto)
    .filter((s): s is string => s != null);
  const etiquetasSexo: [string, string] = [
    sexoLabels[0] != null ? capitalizar(sexoLabels[0]) : plantilla.etiquetasSexo[0],
    sexoLabels[1] != null ? capitalizar(sexoLabels[1]) : plantilla.etiquetasSexo[1],
  ];

  const cobertura = registro(desanidar(crudo.cobertura));
  const pct = numero(cobertura.pct);
  const notas: string[] = [];
  if (pct != null) {
    const alcanzables = numero(cobertura.alcanzables) ?? 0;
    const elegibles = numero(cobertura.elegibles) ?? 0;
    notas.push(
      `Cobertura del cruce: ${fmtMiles(alcanzables)} de ${fmtMiles(elegibles)} elegibles alcanzables (${(pct * 100).toFixed(1)}%).`,
    );
  }

  const esBaseMadre = texto(frame.input_mode) === "base_madre";
  const impactosOpcionales = impactosOpcionalesDe(crudo.opcionales);

  return {
    ...plantilla,
    id: "estudio-real",
    nombre: texto(input.titulo) ?? "Estudio del proyecto",
    esEjemplo: false,
    etiquetasSexo,
    anio: anioDe(generadoEn),
    etapa: "propuesta",
    fuenteData: fecha ? `marco construido ${fecha}` : "marco construido del proyecto",
    // base_madre = UNA base plana: mismo recorrido universitario, pero el
    // modelo de datos declara 1 base con deduplicación por código de alumno.
    modeloDatos: esBaseMadre
      ? {
          bases: 1,
          descripcion: "Una base plana alumno × curso-horario, deduplicada por código de alumno para todo conteo de estudiantes.",
          llaveCruce: null,
          riesgo: "Contar duplicando: deduplicar por código de alumno antes de todo conteo.",
        }
      : { ...plantilla.modeloDatos },
    facultades: facultadesDesde(crudo.facultades),
    universo: numero(crudo.universo),
    embudoAlumno: embudoDesde(crudo.embudo_alumno, "alumno"),
    aulasTotales: numero(crudo.aulas_totales),
    embudoAula: embudoDesde(crudo.embudo_aula, "aula"),
    marcoAulas: numero(crudo.marco_aulas),
    // Copias profundas de la configuración de la plantilla: el recorrido
    // edita el perfil activo y no debe mutar el preset compartido. Los
    // opcionales (c7/c8) reciben su impacto MEDIDO sobre la base del proyecto
    // cuando el perfil del frame lo trae (frames viejos: se tolera la ausencia).
    criteriosAlumno: plantilla.criteriosAlumno.map((c) => ({ ...c })),
    criteriosAula: plantilla.criteriosAula.map((c) => {
      const impacto = impactosOpcionales[c.id];
      return impacto ? { ...c, impactoActivar: impacto } : { ...c };
    }),
    parametros: { ...plantilla.parametros },
    escenario2: plantilla.escenario2
      ? { ...plantilla.escenario2, escalones: plantilla.escenario2.escalones.map((e) => ({ ...e })) }
      : null,
    bolsaOpciones: [...plantilla.bolsaOpciones],
    notas,
  };
}

/**
 * Cobertura del cruce por facultad, derivada del perfil del frame. La
 * sobremuestra llega en 0 y la factibilidad en null: ambas dependen de las
 * decisiones del recorrido (las completa motor.cobertura con las cuotas).
 */
export function coberturaDesdeFrame(frame: CalcMuestraAulasFrame | null | undefined): FilaCobertura[] {
  const crudo = perfilCrudoDe(frame);
  if (!crudo) return [];
  return facultadesDesde(crudo.facultades).map((f): FilaCobertura => ({
    facultadId: f.id,
    nombre: f.nombre,
    elegibles: f.N,
    alcanzables: f.alcanzables,
    pct: f.alcanzables == null || f.N <= 0
      ? null
      : Number((f.alcanzables / f.N).toFixed(4)),
    sobremuestra: 0,
    factible: null,
  }));
}

/**
 * Perfil PENDIENTE del proyecto real: la plantilla universitaria sin ningún
 * conteo (universo/embudos/marco en null, facultades vacías). Es el fallback del
 * seam cuando aún no hay marco construido — §ADR 0035: un proyecto real muestra
 * "—/pendiente", NUNCA las cifras del caso de referencia (PERFIL_EJEMPLO), que
 * solo se consumen en modo ejemplo explícito.
 */
function perfilPendiente(titulo?: string | null): PerfilInstitucional {
  const plantilla = structuredClone(PLANTILLA_UNIVERSIDAD);
  return {
    ...plantilla,
    id: "estudio-real-pendiente",
    nombre: texto(titulo ?? null) ?? "Estudio del proyecto",
    esEjemplo: false,
  };
}

/**
 * Seam único para el recorrido: el perfil real del proyecto si el frame trae
 * agregados utilizables; si no, un perfil PENDIENTE sin conteos (esReal false).
 * Jamás cae al caso de referencia hardcodeado: sus cifras solo viven en el modo
 * ejemplo explícito, nunca se filtran al flujo del proyecto real.
 */
export function perfilActivo(input: {
  frame?: CalcMuestraAulasFrame | null;
  titulo?: string | null;
}): { perfil: PerfilInstitucional; esReal: boolean } {
  const real = perfilDesdeFrame(input);
  if (real) return { perfil: real, esReal: true };
  return { perfil: perfilPendiente(input.titulo), esReal: false };
}
