import { aulasFieldLabel, escalaDeProporciones, presentAulasRow } from "./aulasPresentation";
import { AulasMatrizUmbrales } from "./AulasMatrizUmbrales";
import { contrasteDeValidadores, type CriterioDelEstudio } from "./criterioDelEstudio";
import { fmt } from "./kpisDeAulas";
import { columnasConDato } from "./columnasConDato";
import { perdidaDelControl } from "./perdidaDelControl";
import { avisoAsistenciaSinParte } from "./avisoAsistenciaSinParte";
import { Info } from "../../../../vendor/lucide-react";

/**
 * «Base de control», la tercera hoja del operativo, leída en la app.
 *
 * Las otras dos hojas ya se veían: el agendamiento manda sus 20 campos a Agenda
 * y a las cadenas, y el parte de campo sus 10 a Consultas. Ésta se leía desde el
 * principio y sus 25 campos propios —validadores, cortas y largas, umbrales 70T
 * y 70P, cuota por sexo del aula, rango horario— no llegaban a ninguna
 * pantalla: el lector dejaba las filas en la sesión y no las consumía nadie.
 *
 * Vive en Validación porque es control de calidad, que es lo que esa sección
 * contiene. Los otros controles los deriva el motor; éstos los calcula el equipo
 * con sus fórmulas en el Excel, así que aquí se LEEN y no se recalculan: tener
 * dos cuentas del mismo número es peor que no tenerlo.
 *
 * Lo primero que se dice es cuánto del control viene lleno. Un aula sin
 * controles y un aula con el control en cero se ven igual en una tabla, y son
 * cosas distintas: la primera no se ha revisado.
 */

export type GrupoDeControl = {
  clave: string;
  etiqueta: string;
  campos: number;
  aulas_con_dato: number;
};

export type VeredictoDeControl = {
  efectivas: number;
  cumple_una: number;
  /** De `cumple_una`: llegó al 70 % de los asistentes y no al de los matriculados. */
  solo_asistentes?: number;
  /** De `cumple_una`: llegó al de los matriculados y no al de los asistentes. */
  solo_poblacion?: number;
  no_efectivas: number;
  indeterminadas: number;
};

export type ResumenDeControl = {
  aulas: number;
  grupos: GrupoDeControl[];
  veredicto?: VeredictoDeControl;
};

/**
 * Lo que esta hoja contesta, en una línea.
 *
 * Gonzalo lo dijo así: un aula es efectiva si llegó al 70 % de los asistentes
 * elegibles **y** al 70 % de los alumnos elegibles, hayan asistido o no. Los
 * dos umbrales, no uno. Esa es la pregunta que el equipo le hace al libro, y
 * hasta ahora había que leer veintisiete columnas para contestarla.
 *
 * «Cumple uno» va separado de «no cumple ninguno» porque es donde queda
 * decisión: al aula que falló los dos ya no hay nada que hacerle.
 * «Sin evaluar» no se suma a las que fallaron: nadie las miró todavía.
 */
function Veredicto({ v, aulas }: { v: VeredictoDeControl; aulas: number }) {
  // **El denominador son las EVALUADAS, no las filas del libro.**
  //
  // Dividir entre las 152 filas con 50 sin evaluar dentro daba 15 %, y ese 15 %
  // no mide el campo: sube solo porque el equipo termine de llenar la hoja
  // —sin que ninguna aula haya mejorado— y baja en cuanto se añaden filas
  // vacías. La tasa de efectividad tiene que moverse por lo que pasa en las
  // aulas, así que las que nadie miró salen del denominador y se dicen aparte,
  // que es lo que el desglose ya hacía debajo.
  const sinEvaluar = v.indeterminadas ?? 0;
  const evaluadas = Math.max(0, aulas - sinEvaluar);
  // Con cero evaluadas NO hay porcentaje. Un «0 %» sobre 0 de 0 se lee como
  // «ninguna llegó», y lo cierto es que ninguna se ha mirado todavía —el caso
  // de un estudio que generó su libro y aún no lo llenó—. Es la misma familia
  // que «un denominador que garantiza la respuesta»: la cifra existe, pero no
  // mide nada.
  const pct = evaluadas > 0 ? Math.round((v.efectivas / evaluadas) * 100) : null;
  return (
    <div className="aulas-control-veredicto">
      <p className="aulas-control-titular">
        {/* Dos redacciones, no una con la palabra intercalada: «102 aulas
            evaluadas efectivas» encadena dos adjetivos y se lee torcido. */}
        {/* **«grupos de curso-horario y sexo», no «aulas».** Este veredicto NO
            cuenta aulas: la hoja está en formato largo, con una fila por
            curso-horario y sexo, y el motor cuenta filas —medido: 304 filas
            sobre 152 cursos-horario, cada uno con su «F» y su «M», e
            `indeterminadas: 304`—. Decir «aulas» prometía un número que es el
            DOBLE de las aulas que existen.

            Es la misma reparación que ya se hizo con «de 30 celdas sexo ×
            facultad» → «de 30 grupos de facultad y sexo»: la unidad de la cuota
            de sexo es el grupo, y el rótulo tiene que nombrarla. */}
        {sinEvaluar ? (
          <><strong>{v.efectivas}</strong> efectivos de {evaluadas} grupos evaluados</>
        ) : (
          <><strong>{v.efectivas}</strong> de {evaluadas} grupos de curso-horario y sexo</>
        )}
        {pct !== null ? <span> · {pct} %</span> : null}
      </p>
      <p className="mon-profile-muted">
        Alcanzaron el 70 % contra los dos denominadores: asistentes elegibles y alumnos elegibles.
      </p>
      <ul className="aulas-control-desglose">
        {/* «Cumplen sólo uno» valía igual para dos diagnósticos opuestos, y la
            hoja ya sabía cuál era cada uno. Se desglosa porque de eso depende
            si volver al aula sirve de algo: si sobró aplicación y faltó gente
            en clase, no se arregla volviendo a la misma sesión. Los dos suman
            `cumple_una`; si el desglose no llega —motor viejo— se enseña el
            total, que es lo que había. */}
        {v.cumple_una > 0 && (v.solo_asistentes ?? 0) + (v.solo_poblacion ?? 0) === v.cumple_una ? (
          <>
            {v.solo_asistentes ? (
              <li>
                <strong>{v.solo_asistentes}</strong> llegaron al 70 % de los asistentes y no al de los matriculados
                <span className="mon-profile-muted"> · fue poca gente a clase; volver a esa sesión no la trae</span>
              </li>
            ) : null}
            {v.solo_poblacion ? (
              <li>
                <strong>{v.solo_poblacion}</strong> llegaron al 70 % de los matriculados y no al de los asistentes
                <span className="mon-profile-muted"> · había más presentes que elegibles y parte no respondió</span>
              </li>
            ) : null}
          </>
        ) : v.cumple_una > 0 ? (
          <li>
            <strong>{v.cumple_una}</strong> cumplen sólo uno de los dos
          </li>
        ) : null}
        {v.no_efectivas > 0 ? (
          <li>
            <strong>{v.no_efectivas}</strong> no alcanzan ninguno
          </li>
        ) : null}
        {v.indeterminadas > 0 ? (
          <li>
            {/* Distinto de «no llegó»: es que el libro no trae con qué decidirlo. */}
            <strong>{v.indeterminadas}</strong> sin evaluar en el libro
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * El nombre visible de cada grupo.
 *
 * NO se usa la `etiqueta` que manda el motor: el R del proyecto se escribe sin
 * tildes, así que llegaba «Control - duracion» y eso es lo que se leía en
 * pantalla. El nombre que ve el equipo es de la capa de presentación, igual que
 * el de cualquier otra columna. Son los rótulos de la fila 1 de la hoja.
 */
const NOMBRE_DE_GRUPO: Record<string, string> = {
  cuenta: "Cuenta",
  // El grupo se llama por lo que compara, no por la columna que lo abre: la
  // pregunta que contesta es si el aula llegó a lo que se esperaba de ella.
  esperado: "Esperado vs obtenido",
  duracion: "Duración",
  cuotas: "Cuotas",
  horario: "Rango horario",
};

function nombreDeGrupo(grupo: GrupoDeControl) {
  return NOMBRE_DE_GRUPO[grupo.clave] ?? grupo.etiqueta.replace("Control - ", "");
}

/** Los campos de cada grupo, en el orden de la hoja. Espeja al motor. */
const CAMPOS_POR_GRUPO: Record<string, string[]> = {
  cuenta: [
    "sent_total", "sent_vs_total", "sent_vs_population",
    "validator_1", "validator_2", "validator_3",
    "short_total", "short_vs_total", "long_total", "long_vs_total",
    "threshold_total", "threshold_population", "valid_total", "valid_population",
  ],
  // **El bloque que decide.** `efectivas_esperadas` es la vara vigente y sus
  // columnas viajan en el libro desde que sustituyeron al 70 %; no estaban en
  // ningún grupo, así que esta tabla pintaba `70T` y `70P` —retirados— y no la
  // meta ni la brecha. La pantalla que enseña lo que trae el libro enseñaba lo
  // viejo y escondía lo vigente.
  esperado: [
    "efectivas_esperadas", "efectivas_obtenidas",
    "efectivas_pct_esperado", "efectivas_pct_obtenido",
    "efectivas_brecha", "elegibles_esperados",
  ],
  duracion: ["last_response_day"],
  cuotas: [
    "observed_students", "non_respondents", "attendance_pct",
    "quota_pct", "quota_missing",
    // Cada esperado junto a su obtenido: la cuota de sexo se veía sin su vara.
    "mujeres_esperadas", "women_n", "women_pct",
    "hombres_esperados", "men_n", "men_pct",
  ],
  horario: ["schedule_norm", "schedule_range"],
};

/**
 * Qué es cada columna al pintarla, que es distinto de qué significa.
 *
 * Sin esto la tabla salía con las 27 columnas alineadas a la izquierda —«92.3 %»
 * pegado al borde y «91.7 %» partido en dos líneas porque la columna es
 * estrecha—, así que ninguna se podía recorrer con el ojo. Las cifras van a la
 * derecha, tabulares y sin partirse; los dos veredictos se pintan como marca,
 * porque un `1` y un `0` en una tabla de números no se leen como sí y no.
 */
/* Loop mejora-ui E13: el rótulo «%» cumple lo que promete. Las columnas de
   porcentaje que la app calcula viajan como FRACCIÓN (0.5178571) y la celda
   las pintaba crudas — siete decimales donde el título dice «%». Solo se
   formatea lo que ES una fracción numérica en [0, 1]; lo tecleado en la hoja
   («92.3 %», un 85 a secas, NA) pasa intacto — presentación, no parseo. */
const COLUMNAS_DE_PORCENTAJE = new Set([
  "attendance_pct", "quota_pct", "women_pct", "men_pct",
  "efectivas_pct_esperado", "efectivas_pct_obtenido",
]);
const comoPorcentaje = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || !/^[0-9]*\.?[0-9]+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n > 1) return null;
  return `${Math.round(n * 100)} %`;
};

const COLUMNAS_DE_CIFRA = new Set([
  "sent_total", "sent_vs_total", "sent_vs_population",
  "validator_1", "validator_2", "validator_3",
  "short_total", "short_vs_total", "long_total", "long_vs_total",
  "threshold_total", "threshold_population",
  "observed_students", "non_respondents", "attendance_pct",
  "quota_pct", "quota_missing", "women_n", "men_n", "women_pct", "men_pct",
  "efectivas_esperadas", "efectivas_obtenidas", "efectivas_pct_esperado",
  "efectivas_pct_obtenido", "efectivas_brecha", "elegibles_esperados",
  "mujeres_esperadas", "hombres_esperados",
]);

/**
 * `VALIDO TOTAL` y `VALIDO POBLACION`: el veredicto del aula.
 *
 * Cada columna se dibuja desde el veredicto que **el motor ya resolvió**, no
 * releyendo la celda. El campo del motor y el umbral con el que se calcula el
 * respaldo van al lado del nombre de la columna porque son la misma decisión.
 */
/**
 * Qué columnas del bloque tienen algo que decir sobre estas filas.
 *
 * Es `columnasConDato` **más una excepción que un test cazó**: las columnas de
 * veredicto no traen su valor en la fila, **la app las deriva** del umbral. Al
 * descartarlas por venir vacías desaparecía «Válido total» justo en el caso que
 * este componente existe para cubrir —la celda que la hoja no llenó y el motor
 * resolvió—, y con ella su marca de «lo calculó la app».
 *
 * Así que una columna se queda si trae dato **o si se puede derivar**: si alguna
 * fila trae su veredicto o el umbral con el que se calcula.
 */
function camposConAlgoQueDecir(
  filas: ReadonlyArray<Record<string, unknown>>,
  campos: ReadonlyArray<string>,
): string[] {
  const conDato = new Set(columnasConDato(filas, campos));
  const hay = (clave: string) => filas.some((f) => {
    const v = f[clave];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
  return campos.filter((campo) => {
    if (conDato.has(campo)) return true;
    const derivada = COLUMNAS_DE_VEREDICTO.get(campo);
    return Boolean(derivada) && (hay(derivada!.veredicto) || hay(derivada!.umbral));
  });
}

const COLUMNAS_DE_VEREDICTO = new Map([
  ["valid_total", { veredicto: "cumple_total", umbral: "threshold_total", celda: "valid_total" }],
  ["valid_population", { veredicto: "cumple_poblacion", umbral: "threshold_population", celda: "valid_population" }],
]);

/**
 * El veredicto del aula, con TRES estados.
 *
 * Antes esta marca releía la celda con su propia lista de palabras válidas y
 * mandaba a «✗ No válido» todo lo que no reconocía. Contra el motor, que ya
 * resuelve lo mismo en `cumple_total` / `cumple_poblacion`, las dos fuentes
 * discrepaban **en los dos sentidos**, y las dos discrepancias son visibles en
 * la misma pantalla:
 *
 * - una celda con «PENDIENTE» → el motor la deja INDETERMINADA y el aula no
 *   cuenta como efectiva, pero la tabla la marcaba «✗ No válido», que es acusar
 *   a un aula de no llegar cuando lo que pasa es que nadie la evaluó;
 * - una celda VACÍA con 30 enviadas contra un umbral de 20 → el motor declara
 *   el aula EFECTIVA y la cuenta arriba, mientras la tabla decía «—», o sea
 *   «sin dato» sobre un aula que el propio panel ya contó entre las efectivas.
 *
 * El fixture no produce ninguno de los dos casos —sus celdas son 1, 0 o
 * vacías—, así que ninguna pasada visual podía verlo: salió de correr el motor.
 *
 * `cumple_*` no tenía un solo consumidor en el frontend. Ahora es la fuente, y
 * la celda cruda pasa al `title`: la hoja es del equipo y un veredicto que el
 * equipo no escribió tiene que decir de dónde salió.
 */
function VeredictoDelAula({
  fila,
  campo,
  umbral,
  celdaDeLaHoja,
}: {
  fila: Readonly<Record<string, unknown>>;
  campo: string;
  umbral: string;
  celdaDeLaHoja: string;
}) {
  const v = fila[campo];
  const celda = String(fila[celdaDeLaHoja] ?? "").trim();
  if (v !== true && v !== false) {
    return (
      <span
        className="mon-profile-muted"
        title={celda
          ? `La hoja dice «${celda}», que no se lee como un veredicto, y no hay umbral con qué calcularlo.`
          : "La hoja no trae el veredicto y no hay umbral con qué calcularlo."}
      >
        —
      </span>
    );
  }
  // Derivado: la hoja no lo escribió y el motor lo calculó contra el umbral que
  // la propia hoja trae. Se marca —punteado, sin color nuevo— porque quien vaya
  // al Excel a buscar este ✓ no lo va a encontrar ahí.
  const derivado = !celda;
  const cifra = texto(fila[umbral]);
  const enviadas = texto(fila.sent_total);
  return (
    <span
      className={`aulas-control-marca${v ? " es-si" : " es-no"}${derivado ? " es-derivado" : ""}`}
      title={derivado
        ? `Lo calculó la app: ${enviadas || "las"} enviadas contra el umbral ${cifra || "de la hoja"}. La hoja no trae este veredicto.`
        : v ? "Válido, según la hoja" : "No válido, según la hoja"}
    >
      {v ? "✓" : "✗"}
    </span>
  );
}

function texto(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  return String(valor).trim();
}

/**
 * Cuántas columnas acaba pintando la tabla del libro.
 *
 * Vive aquí y no en la página porque **es la misma cuenta que hace la tabla**:
 * el identificador más los campos de los grupos que traen dato. Calcularla otra
 * vez en el encabezado daría dos definiciones que se separan en cuanto una de
 * las dos cambie —ya pasó con los tramos de la agenda, que tenían su propia
 * copia—.
 */
export function columnasDelControl(resumen: ResumenDeControl | null): number {
  const grupos = resumen?.grupos ?? [];
  const campos = grupos
    .filter((g) => g.aulas_con_dato > 0)
    .flatMap((g) => CAMPOS_POR_GRUPO[g.clave] ?? []);
  return campos.length ? campos.length + 1 : 0;
}


export function AulasControlDelLibro({
  filas,
  resumen,
  criterio,
  partes,
}: {
  filas: ReadonlyArray<Record<string, unknown>>;
  resumen: ResumenDeControl | null;
  /** El criterio de validez que declara el ESTUDIO, para contrastarlo. */
  criterio?: CriterioDelEstudio | null;
  /** Los partes de campo en sesión: con ellos el aviso de A3 distingue el aula
   *  sin parte de la que lo tiene y el libro leído aún no trae. */
  partes?: ReadonlyArray<Record<string, unknown>> | null;
}) {
  const validadores = contrasteDeValidadores(criterio, filas);
  // A3: lo que sólo sabe quien estuvo en el salón, dicho con causa y salida.
  const asistencia = avisoAsistenciaSinParte(filas, partes ?? []);
  // **La banda compara dos cifras de la misma hoja, no el veredicto.**
  // `sent_total` es lo que el equipo da por enviado y `efectivas_obtenidas` la
  // efectiva de plataforma que la app escribe en la fila; `valid_total` es el
  // veredicto que esta misma tabla pinta como marca de sí/no dos líneas más
  // abajo, y leerlo como conteo daba «De 770 enviadas cuentan 2» con banderas
  // 0/1 y apagaba la banda con «SI»/«NO» (checklist A20 · censo de las cuatro
  // cifras 2026-09-01, choque 1). Medido en 2025 se pierde el 9-13 %, y para
  // saberlo había que sumar 190 filas a mano.
  const perdida = perdidaDelControl(filas);
  const grupos = resumen?.grupos ?? [];
  const aulas = resumen?.aulas ?? filas.length;

  if (!aulas) {
    return (
      // El vacío vive dentro de la caja y dice de dónde saldría el dato (C3):
      // esta hoja no la produce la app, la llena el equipo.
      //
      // **Y declara lo mismo que la rama con datos.** Sin `member`, el grupo
      // `monitoring-aulas-table` se queda sin miembro explícito y el runner cae
      // a los hijos directos del `section`: el encabezado del panel entra como
      // si fuera un contenedor de datos y sus 4 px de padding compiten contra
      // los 17 del aviso → `capacity-drift` en los dos viewports. Con datos el
      // grupo iba verde, así que el defecto sólo existía en el estado vacío.
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        El libro importado no trae la hoja «Base de control», o la trae sin filas.
        Es la hoja donde el equipo lleva el control de calidad por curso-horario.
      </p>
    );
  }

  // Sólo los grupos que traen algo. Un grupo entero vacío se dice en una línea
  // al final, no ocupando una columna de ceros.
  const conDato = grupos.filter((g) => g.aulas_con_dato > 0);
  const vacios = grupos.filter((g) => g.aulas_con_dato === 0);
  // Las columnas que se muestran salen de los grupos que tienen dato: enseñar
  // catorce columnas vacías porque la hoja las declara no informa de nada.
  // Las columnas se agrupan como en el libro. La fila 1 del Excel declara
  // «Control - cuenta», «- duracion», «- cuotas» y «- rango horario», y sin esa
  // banda las 27 columnas iban seguidas: no se veia donde acababa un bloque y
  // empezaba el siguiente, que es lo que convertia la tabla en un muro.
  // **La tabla enseña lo que el libro TRAE, no la plantilla de 2025.**
  //
  // Gonzalo, al verla: «¿por qué sigue poniendo 70T y 70P? Veo que sigue siendo
  // una copia de la tabla del año pasado [...] parece que estuvieras haciendo un
  // calco». Tenía razón y el mecanismo es preciso: `carga_base_control.R` marca
  // `70T`/`70P` como `solo_lectura` —«la hoja que generamos YA NO ESCRIBE esa
  // columna», sólo se leen para no romper un libro viejo— pero esta tabla las
  // pintaba igual, vacías. Y con ellas «Validador 1/2/3», «Total cortas» y
  // «Total largas», que este estudio tampoco llena.
  //
  // `columnasConDato` ya encierra el criterio —«una columna vacía en TODAS las
  // filas no llega a la tabla»— y esta tabla era la única del perfil que no lo
  // usaba. Un libro de 2025 que SÍ traiga 70T las sigue viendo: se descarta lo
  // vacío, no lo viejo.
  const bloques = conDato.map((g) => ({
    clave: g.clave,
    nombre: nombreDeGrupo(g),
    campos: camposConAlgoQueDecir(filas, CAMPOS_POR_GRUPO[g.clave] ?? []),
  })).filter((b) => b.campos.length);
  const columnas = ["operational_code", ...bloques.flatMap((b) => b.campos)];
  // Que columna abre cada bloque, para pintarle la linea divisoria y que el ojo
  // encuentre el corte sin leer la cabecera de arriba.
  const abreBloque = new Set(bloques.map((b) => b.campos[0]));
  // Esta tabla pinta sus celdas por su cuenta —no pasa por `DataTable`— y por
  // eso enseñaba «0.909» bajo un rótulo que dice «vs Total». La conversión es
  // de la capa de presentación, la misma que ya traduce estados y motivos, y la
  // escala se decide sobre la columna entera.
  const enProporcion = escalaDeProporciones(filas);
  const presentadas = filas.map((fila) => presentAulasRow(fila, enProporcion));

  return (
    <div className="aulas-control-libro">
      {/* Primero el veredicto, después de qué está hecho y sólo al final el
          detalle fila a fila. Es el orden del histórico del cálculo de muestra
          (ADR 0060): se narra en el orden en que se decide, y la tabla cruda
          queda de respaldo para quien vaya a por un aula concreta. */}
      {resumen?.veredicto ? (
        <>
          {/* Los cuatro casos, en dos ejes. La lista de frases obliga a
              reconstruir de cabeza cuántas quedaron a un solo umbral y por
              cuál; la matriz lo enseña. Las frases se quedan porque dicen qué
              hacer con cada caso, que un número no dice. */}
          <AulasMatrizUmbrales v={resumen.veredicto} aulas={aulas} />
          <Veredicto v={resumen.veredicto} aulas={aulas} />
        </>
      ) : null}
      {/* A3: ALUMNOS EN AULA sólo la sabe el parte. Sin él, tres columnas de
          esta hoja se apagan en silencio; el aviso nombra las aulas y dice
          dónde se llena. Mismo marco que los avisos de la página. */}
      {asistencia.texto ? (
        <div className="aulas-aviso" data-tono={asistencia.tono} data-qa-geometry-member>
          <Info size={16} /> {asistencia.texto}
        </div>
      ) : null}
      {/* **De quién son los validadores.**
          La hoja trae columnas VALIDADOR y el estudio declara sus propios
          filtros de respuesta efectiva en la app: dos sistemas distintos, juntos
          en la misma pantalla y sin nada que dijera cuál es cuál. Aquí no se
          inventa la relación —no la hay— sino que se nombra. */}
      {/* **De qué está hecha esta hoja, en un solo sitio.**
          Estas tres líneas —quién llena los validadores, cuántas filas trae cada
          bloque y qué bloque vino vacío— son procedencia, no veredicto. Sueltas
          entre el resultado y la tabla eran tres renglones flotantes con tres
          estilos distintos, y esa es la mitad del «no tiene formato»: nada decía
          que fueran lo mismo ni dónde acababan. Juntas en su propia caja se leen
          de un vistazo y dejan de competir con el veredicto de arriba.
          Van ANTES de la tabla porque explican lo que se va a leer, no después
          como una nota al pie que ya nadie mira. */}
      <div className="aulas-control-procedencia">
      {validadores.columnas > 0 ? (
          <p className="mon-profile-muted aulas-control-validadores">
            Las {validadores.columnas === 1 ? "columna" : `${validadores.columnas} columnas`}
            {" "}de validador {validadores.columnas === 1 ? "es" : "son"} del equipo: las llena
            en su Excel y la app no las calcula.{" "}
            {validadores.sinDeclarar ? (
              <>Este estudio todavía no declara sus filtros de respuesta efectiva, así
              que no hay con qué compararlas.</>
            ) : (
              <>
                El estudio declara {validadores.declarados.length}{" "}
                {validadores.declarados.length === 1 ? "filtro" : "filtros"} propios
                ({validadores.declarados.join(", ")}), que es otro criterio.
              </>
            )}
          </p>
        ) : null}
        {/* **Qué filtro decide, que es la pregunta siguiente.**

            Arriba se lee cuántos filtros declara el estudio y cuáles; eso deja
            sin contestar cuál de ellos tumba las respuestas. El motor ya lo
            tenía contado y el dato viajaba dentro de `criterio_validez` sin
            consumidor: sobre este corte, «filtro» tumba 109 y `consent_1` sólo
            7, y con la lectura vieja los tres pesaban igual.

            La segunda cifra es la que evita el error de sumarlos: son las que
            caen SÓLO por ese filtro, o sea lo que se recuperaría quitándolo.
            Cuando es mucho menor que la primera, ese filtro está tumbando
            respuestas que otro ya tumbaba. */}
        {/* **El desglose por filtro NO va aqui: ya vive en Fuentes.**

            Lo puse en los dos sitios el mismo dia sin darme cuenta: el motor
            lo dice en «Que cuenta como encuesta efectiva» —«de las 144 que no
            cuentan, 109 por filtro»— que es donde el criterio SE CONFIGURA y
            donde la cifra explica lo que acabas de tocar. Repetirlo en la hoja
            del libro no añade lectura, solo otra copia que mantener.

            Es ademas la queja literal de Gonzalo sobre esta familia de
            paneles, ya anotada en `AulasFiltrosDeEfectiva`: «todos los
            elementos visuales siguen bastante verborreados en esta seccion».
            El dato sigue viajando en `criterio_validez.por_filtro` y
            `caidasPorFiltro()` sigue exportado para quien lo necesite. */}
        <p className="aulas-cadenas-lectura">
          {/* Filas de la hoja, no aulas del plan: son 210 contra las 196 que el
              plan sigue, y llamarlas igual confundía dos denominadores. */}
          <strong>{aulas}</strong> {aulas === 1 ? "fila" : "filas"} en la hoja
          {conDato.map((g) => (
            <span key={g.clave}>
              {" · "}
              {nombreDeGrupo(g)} <strong>{g.aulas_con_dato}</strong>
            </span>
          ))}
        </p>
        {vacios.length ? (
          <p className="mon-profile-muted">
            Sin llenar en el libro: {vacios.map(nombreDeGrupo).join(" · ")}.
          </p>
        ) : null}
      </div>
      {!bloques.length ? (
        // La hoja llego con filas pero SIN una sola columna de control llena.
        // La tabla entonces pintaba 190 filas de una unica columna —el codigo
        // del curso-horario— con la banda de grupos vacia encima: la vista
        // entera ocupada por una lista que no dice nada del control, mientras
        // el encabezado del panel declaraba «sin columnas». Medido: 190 `td`,
        // 2 `th` y uno de ellos vacio.
        //
        // No se pierde capacidad al retirarla: que aulas trae la hoja ya lo
        // dice «190 filas en la hoja» aqui arriba, y cuales son los grupos que
        // faltan lo dice «Sin llenar en el libro». Y declara lo mismo que la
        // rama con datos, que es lo que evita que el gate mida el encabezado
        // del panel como si fuera el contenedor de datos.
        <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          La hoja trae sus filas pero ninguna columna de control llena, así que
          todavía no hay veredicto por curso-horario que mostrar. Se llenan en el Excel
          del equipo y vuelven al importar el libro.
        </p>
      ) : (
      <>
      {/* La banda va ANTES de la tabla porque contesta la pregunta con la que
          se entra —«¿cuánto de lo que mandamos cuenta?»— y la tabla es donde se
          busca un aula concreta. Una sola línea: la sección reparte alto y un
          panel nuevo se lo quitaría a los vecinos. */}
      {perdida ? (
        <p className="aulas-perdida" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          {/* Cada cifra con su fuente, como en el alcance del banco: «enviado»
              lo declara la hoja y «efectivas» la plataforma; sin decirlo, las
              dos parecen cuentas de la app. */}
          <span className="aulas-perdida-cifras">
            De <strong>{fmt(perdida.enviadas)}</strong> que la hoja da por enviado,
            la plataforma da por efectivas <strong>{fmt(perdida.validas)}</strong>
            {perdida.pierde > 0 ? <> · se pierden {fmt(perdida.pierde)}</> : null}
            {" "}({Math.round(perdida.pasa * 100)} % pasa)
            {/* Las filas sin efectiva de plataforma NO son pérdida: decirlo
                evita leer el porcentaje como si el libro estuviera completo. */}
            {perdida.sinRevisar > 0 ? (
              <small>
                {" "}· {fmt(perdida.sinRevisar)} {perdida.sinRevisar === 1 ? "fila" : "filas"} aún
                sin efectiva de plataforma, fuera de la comparación
              </small>
            ) : null}
          </span>
          <span className="aulas-perdida-barra" aria-hidden="true">
            <i className="es-cuenta" style={{ width: `${perdida.pasa * 100}%` }} />
            <i className="es-pierde" style={{ width: `${(1 - perdida.pasa) * 100}%` }} />
          </span>
        </p>
      ) : null}
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <table className="mon-profile-table">
          <thead>
            <tr className="aulas-control-bloques">
              <th aria-hidden="true" />
              {bloques.map((b) => (
                <th key={b.clave} colSpan={b.campos.length} scope="colgroup">{b.nombre}</th>
              ))}
            </tr>
            <tr>
              {columnas.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={[
                    COLUMNAS_DE_CIFRA.has(c) ? "es-cifra" : "",
                    COLUMNAS_DE_VEREDICTO.has(c) ? "es-marca" : "",
                    abreBloque.has(c) ? "es-corte" : "",
                  ].filter(Boolean).join(" ")}
                  // El nombre entero, que la elipsis se lleva. La regla que
                  // recorta a 130 px lo daba por hecho —«con elipsis, el nombre
                  // entero queda en el `title`»— y el atributo no estaba: medido
                  // sobre las 26 columnas, tres se cortan («Asistentes que no
                  // respondieron» pide 231 px) y las tres tenían `title` nulo,
                  // así que el rótulo se perdía sin forma de recuperarlo.
                  title={aulasFieldLabel(c)}
                >
                  {aulasFieldLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {presentadas.map((fila, i) => (
              // Un aula que nadie ha evaluado es un código seguido de veintiséis
              // guiones, y a tamaño de tabla eso se lee como una franja en
              // blanco: 56 de las 170. La fila lo DICE con su fondo en vez de
              // parecer un hueco. El dato sale de `grupos_con_dato`, que el
              // motor ya publica por aula, y se lee de la fila CRUDA porque la
              // presentación no arrastra listas.
              <tr
                key={texto(fila.operational_code) || i}
                className={((filas[i]?.grupos_con_dato as unknown[] | undefined)?.length ?? 0) === 0
                  ? "es-sin-evaluar"
                  : undefined}
              >
                {columnas.map((c) => (
                  <td
                    key={c}
                    className={[
                      COLUMNAS_DE_CIFRA.has(c) ? "es-cifra" : "",
                      COLUMNAS_DE_VEREDICTO.has(c) ? "es-marca" : "",
                      abreBloque.has(c) ? "es-corte" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {COLUMNAS_DE_VEREDICTO.has(c)
                      ? (
                        <VeredictoDelAula
                          // La fila CRUDA, no la presentada: el veredicto es un
                          // dato de decision —`true`/`false`/`null`— y la capa
                          // de presentacion existe para rotular celdas de la
                          // hoja. Al pasarlo por ella, `cumple_total` llegaba
                          // convertido y las tres ramas caian en la misma.
                          fila={filas[i] ?? fila}
                          campo={COLUMNAS_DE_VEREDICTO.get(c)!.veredicto}
                          umbral={COLUMNAS_DE_VEREDICTO.get(c)!.umbral}
                          celdaDeLaHoja={COLUMNAS_DE_VEREDICTO.get(c)!.celda}
                        />
                      )
                      : (COLUMNAS_DE_PORCENTAJE.has(c) ? comoPorcentaje(fila[c]) : null)
                        ?? (texto(fila[c]) || <span className="mon-profile-muted">—</span>)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
