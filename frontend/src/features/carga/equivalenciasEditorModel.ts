/**
 * Modelo del editor de equivalencias (ADR 0062, enmienda del editor).
 *
 * La forma la dicta el Excel que el equipo ya usaba, porque es la que se lee
 * bien: **una fila por pregunta y los públicos en paralelo**. La plantilla que
 * la app emite tiene 300 filas sin emparejar —una por variable de cada base—,
 * y esa forma es correcta para no inventar emparejamientos en un archivo, pero
 * es peor para trabajar. Aquí el emparejamiento se hace en pantalla, donde una
 * sugerencia puede verse COMO sugerencia y confirmarse de un clic.
 *
 * La lógica vive aparte del render porque es donde estaban los errores que
 * importan: una variable asignada a dos filas a la vez, o una sugerencia que se
 * guarda sin que nadie la confirme.
 */

import type { EquivalenciaFila, OpcionDeEscala, VariableDeBase } from "../../api/equivalencias";

export type FilaEditor = EquivalenciaFila & {
  /** Identidad estable de la fila mientras se edita; no viaja al backend. */
  id: string;
};

let contador = 0;
export function nuevaFilaId(): string {
  contador += 1;
  return `fila-${contador}`;
}

export function filaVacia(seccion = "", diapositiva = "", enunciado = ""): FilaEditor {
  return {
    id: nuevaFilaId(),
    seccion,
    etiqueta_estandar: "",
    variables: {},
    diapositiva,
    enunciado,
    cantidad: 0,
  };
}

export function aFilasEditor(filas: readonly EquivalenciaFila[]): FilaEditor[] {
  return filas.map((f) => ({ ...f, id: nuevaFilaId() }));
}

/**
 * Asigna una variable de una base a una fila. Devuelve la lista completa porque
 * la asignación **también quita esa variable de cualquier otra fila**: una misma
 * variable en dos filas significaría que la pregunta es dos preguntas, y el
 * conteo por público —y el gráfico que salga de él— quedaría mal sin ninguna
 * señal.
 */
export function asignarVariable(
  filas: readonly FilaEditor[],
  filaId: string,
  base: string,
  variable: string,
): FilaEditor[] {
  return filas.map((fila) => {
    const variables = { ...fila.variables };
    if (fila.id === filaId) {
      if (variable) variables[base] = variable;
      else delete variables[base];
    } else if (variable && variables[base] === variable) {
      delete variables[base];
    }
    return { ...fila, variables, cantidad: Object.keys(variables).length };
  });
}

export type CampoFila =
  | "etiqueta_estandar"
  | "seccion"
  | "diapositiva"
  | "enunciado"
  | "grafico"
  | "corte"
  | "estilo";

export function editarCampo(
  filas: readonly FilaEditor[],
  filaId: string,
  campo: CampoFila,
  valor: string,
): FilaEditor[] {
  return filas.map((fila) => (fila.id === filaId ? { ...fila, [campo]: valor } : fila));
}

/**
 * Edita un campo en TODAS las filas de una diapositiva. El enunciado y la sección son
 * atributos de la diapositiva que el formato plano guarda repetidos por fila (ADR
 * 0064); escribirlos en una sola fila dejaría la diapositiva diciendo dos cosas según
 * qué fila se leyera primero.
 */
export function editarCampoDeDiapositiva(
  filas: readonly FilaEditor[],
  diapositiva: string,
  campo: CampoFila,
  valor: string,
): FilaEditor[] {
  return filas.map((fila) =>
    (fila.diapositiva ?? "").trim() === diapositiva ? { ...fila, [campo]: valor } : fila,
  );
}

/**
 * Edita un campo en todas las filas de un bloque, identificadas por su `id`.
 *
 * El gráfico y el corte son atributos del BLOQUE —los temas que comparten
 * escala— y el formato plano los guarda repetidos en sus filas, igual que el
 * enunciado en las de la diapositiva. Escribirlos en una sola fila dejaría el
 * bloque diciendo dos cosas según cuál se leyera primero.
 */
export function editarCampoDeBloque(
  filas: readonly FilaEditor[],
  ids: readonly string[],
  campo: CampoFila,
  valor: string,
): FilaEditor[] {
  const set = new Set(ids);
  return filas.map((fila) => (set.has(fila.id) ? { ...fila, [campo]: valor } : fila));
}

export function quitarFila(filas: readonly FilaEditor[], filaId: string): FilaEditor[] {
  return filas.filter((fila) => fila.id !== filaId);
}

/** Variables de una base que ya están tomadas por alguna fila. */
export function variablesTomadas(filas: readonly FilaEditor[], base: string): Set<string> {
  const out = new Set<string>();
  for (const fila of filas) {
    const v = fila.variables[base];
    if (v) out.add(v);
  }
  return out;
}

/**
 * Incorpora sugerencias sin pisar lo decidido. Una sugerencia se descarta
 * entera si **cualquiera** de sus variables ya está tomada: aceptarla a medias
 * produciría una fila que dice ser la misma pregunta en tres públicos cuando el
 * analista sólo confirmó dos, y esa diferencia no se ve en la tabla.
 */
export function incorporarSugerencias(
  filas: readonly FilaEditor[],
  sugerencias: readonly EquivalenciaFila[],
): FilaEditor[] {
  const tomadas = new Map<string, Set<string>>();
  for (const fila of filas) {
    for (const [base, v] of Object.entries(fila.variables)) {
      if (!tomadas.has(base)) tomadas.set(base, new Set());
      tomadas.get(base)!.add(v);
    }
  }

  const nuevas: FilaEditor[] = [];
  for (const sug of sugerencias) {
    const choca = Object.entries(sug.variables).some(
      ([base, v]) => tomadas.get(base)?.has(v),
    );
    if (choca) continue;
    for (const [base, v] of Object.entries(sug.variables)) {
      if (!tomadas.has(base)) tomadas.set(base, new Set());
      tomadas.get(base)!.add(v);
    }
    nuevas.push({ ...sug, id: nuevaFilaId(), sugerida: true });
  }
  return [...filas, ...nuevas];
}

/** Marca una fila propuesta como decidida por el analista. */
export function confirmarFila(filas: readonly FilaEditor[], filaId: string): FilaEditor[] {
  return filas.map((fila) =>
    fila.id === filaId ? { ...fila, sugerida: false } : fila,
  );
}

export function confirmarTodas(filas: readonly FilaEditor[]): FilaEditor[] {
  return filas.map((fila) => ({ ...fila, sugerida: false }));
}

/**
 * Lo que se guarda. Las filas sin variables no declaran nada y se descartan.
 *
 * Las propuestas **sí se guardan, marcadas** (ADR 0064). La regla anterior las
 * descartaba al guardar, y con la plantilla sembrada eso destruía el trabajo:
 * confirmar diez de cincuenta y ocho propuestas y pulsar Guardar borraba las
 * otras cuarenta y ocho sin ninguna señal. Lo que el ADR 0062 protege —que una
 * sugerencia nunca actúe como decisión— se cumple donde importa: una propuesta
 * no escribe etiquetas en Analítica y no llega al mazo.
 */
export function filasParaGuardar(filas: readonly FilaEditor[]): EquivalenciaFila[] {
  return filas
    .filter((fila) => Object.keys(fila.variables).length > 0)
    .map(({ id: _id, ...resto }) => ({
      ...resto,
      cantidad: Object.keys(resto.variables).length,
    }));
}

export type ResumenEditor = {
  total: number;
  confirmadas: number;
  sugeridas: number;
  sinEtiqueta: number;
  conDiapositiva: number;
};

// ---------------------------------------------------------------------------
// Agrupación en diapositivas (ADR 0064)
// ---------------------------------------------------------------------------

export type InfoEscala = { firma: string; opciones: OpcionDeEscala[] };

/** `base -> variable -> {firma, opciones}`, para no rebuscar en el catálogo. */
export type CatalogoEscalas = Record<string, Record<string, InfoEscala>>;

export function catalogoEscalas(
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): CatalogoEscalas {
  const out: CatalogoEscalas = {};
  for (const [base, vars] of Object.entries(variablesPorBase ?? {})) {
    const porNombre: Record<string, InfoEscala> = {};
    for (const v of vars ?? []) {
      porNombre[v.name] = { firma: v.firma ?? "", opciones: v.opciones ?? [] };
    }
    out[base] = porNombre;
  }
  return out;
}

/**
 * Texto del chip de escala: SIEMPRE cuántas opciones son, nunca cuáles.
 *
 * Antes decía la escala entera cuando cabía —«Sí / No»— y el número cuando no.
 * Con eso, dos bloques de la misma diapositiva se anunciaban en dos idiomas
 * distintos y el chip cambiaba de forma según lo larga que fuera la lista. El
 * chip dice el TAMAÑO de la escala, que es lo comparable entre bloques; cuáles
 * son las opciones lo dice el popover al abrirlo.
 */
export function resumenEscala(opciones: readonly OpcionDeEscala[]): string {
  if (!opciones.length) return "";
  return opciones.length === 1 ? "1 opción" : `${opciones.length} opciones`;
}

/**
 * Las opciones enumeradas, para el aviso de escala divergente. Ahí el conteo no
 * sirve —«5 opciones en docentes; 5 opciones en estudiantes» no dice en qué
 * difieren— y hace falta ver los textos: es lo que destapó que 56 de 58
 * divergencias eran sólo mayúsculas.
 */
export function listarEscala(opciones: readonly OpcionDeEscala[], max = 4): string {
  if (!opciones.length) return "";
  const etiquetas = opciones.map((o) => o.etiqueta);
  if (etiquetas.length <= max) return etiquetas.join(" / ");
  return `${etiquetas.slice(0, max).join(" / ")} … (${etiquetas.length})`;
}

/** Una escala y los públicos que la usan. Nombrar los dos es lo que convierte
 *  «no comparten escala» en algo que se puede resolver sin abrir el instrumento. */
export type EscalaConBases = {
  /** Resumen legible, para el aviso. */
  texto: string;
  /** Opciones enteras, para el popover. Vacío cuando la escala no tiene lista. */
  opciones: OpcionDeEscala[];
  bases: string[];
};

export type EscalaDeFila = {
  /** Firmas distintas entre los públicos del tema. */
  firmas: string[];
  /** Resumen legible; el del primer público que la declare. */
  texto: string;
  /** Opciones enteras de esa primera escala. */
  opciones: OpcionDeEscala[];
  /** **E1 rota**: los públicos de este tema no comparten escala. */
  rota: boolean;
  /** Qué escala usa cada público, agrupado por firma y en orden de aparición. */
  porFirma: EscalaConBases[];
};

/**
 * Escala de un tema. **E1** del ADR 0064: las variables de los distintos
 * públicos deben compartir firma. Se compara la firma y nunca el texto, porque
 * dos listas distintas pueden verse iguales truncadas.
 *
 * Una variable sin firma —numérica sin recodificar, texto libre— no cuenta como
 * divergencia: no tiene escala que contradecir, y marcarla en rojo enseñaría un
 * problema donde sólo hay una ausencia.
 */
/**
 * Cómo se nombra una escala que no tiene lista de opciones. El backend devuelve
 * `escala` vacía en ese caso —no hay opciones que enumerar— y la firma guarda el
 * tipo. Sin traducirlo, el aviso decía «escala sin etiquetas en docentes; escala
 * sin etiquetas en estudiantes», que se lee como un sinsentido: dos escalas
 * distintas con el mismo nombre. Con el tipo dice lo que de verdad pasa —«código
 * PUCP es numérico en docentes y texto en estudiantes»—, que además es el
 * hallazgo.
 */
function textoDeEscala(info: InfoEscala): string {
  const listado = listarEscala(info.opciones);
  if (listado) return listado;
  const libre = /^libre:(.*)$/.exec(info.firma);
  if (libre) {
    const tipo = libre[1];
    if (/^(integer|decimal)$/.test(tipo)) return "numérica, sin opciones";
    if (tipo === "text") return "texto libre";
    if (/^(date|datetime|time)$/.test(tipo)) return "fecha";
    return tipo ? `tipo ${tipo}, sin opciones` : "sin escala";
  }
  const lista = /^lista:(.*)$/.exec(info.firma);
  if (lista) return `lista «${lista[1]}» sin opciones descritas`;
  return "sin escala";
}

export function escalaDeFila(fila: FilaEditor, cat: CatalogoEscalas): EscalaDeFila {
  const firmas: string[] = [];
  const porFirma: EscalaConBases[] = [];
  for (const [base, variable] of Object.entries(fila.variables)) {
    const info = cat[base]?.[variable];
    if (!info?.firma) continue;
    const i = firmas.indexOf(info.firma);
    if (i === -1) {
      firmas.push(info.firma);
      porFirma.push({ texto: textoDeEscala(info), opciones: info.opciones, bases: [base] });
    } else {
      porFirma[i].bases.push(base);
    }
  }
  const primera = porFirma.find((e) => e.opciones.length) ?? porFirma[0];
  return {
    firmas,
    texto: primera?.texto ?? "",
    opciones: primera?.opciones ?? [],
    rota: firmas.length > 1,
    porFirma,
  };
}

/**
 * Un bloque de la diapositiva: los temas que comparten escala.
 *
 * Es la unidad que el render dibuja junto —`multilista` apila un bloque por
 * escala— y por eso es también la unidad que enseña sus opciones. Una
 * diapositiva que junta «¿Conoce?» (Sí/No) con la satisfacción (5 puntos) tiene
 * dos bloques con **categorías distintas**, y decir «la escala de la
 * diapositiva» ahí era decir la de uno de los dos y callar el otro.
 */
export type BloqueEditor = {
  /** Firma que comparten sus temas. `""` = ninguno declara escala. */
  firma: string;
  opciones: OpcionDeEscala[];
  filas: FilaEditor[];
  /** `""` = barras multiapiladas (el defecto); `radar`. */
  grafico: string;
  /** Códigos que suman el indicador del radar, en el orden de la escala. */
  corte: string[];
  /** Clave de estilo del radar. `""` = `comparativo`. */
  estilo: string;
  /** Públicos con variable asignada, si TODOS sus temas coinciden. */
  publicos: string[];
  /**
   * ¿Se muestra el control de gráfico? Basta con tener ejes suficientes.
   *
   * Se muestra aunque el radar no se pueda activar: esconderlo hacía que la
   * función pareciera inexistente. En el estudio medido, 4 bloques de 53 tienen
   * 5+ temas y sólo 2 pueden dibujar el radar — los otros dos merecen saber por
   * qué, no quedarse sin control.
   */
  ofrecerRadar: boolean;
  /**
   * ¿Se puede ACTIVAR el radar? Además de los ejes, **cobertura rectangular**:
   * todos los públicos presentes con todos los temas. Lo que rompe la figura es
   * el hueco —un vértice que le falta a una serie y no a otra deforma el
   * polígono sin decir por qué—, no el número de series: con un solo público el
   * radar sale con una línea y se lee perfectamente.
   */
  elegibleRadar: boolean;
  /** Por qué no se puede activar. Vacío cuando sí se puede. */
  motivoNoRadar: string;
};

/** Mínimo de ejes para que un radar diga más que las barras. */
export const RADAR_MIN_EJES = 5;

export type DiapositivaEditor = {
  /** Clave declarada. `""` es el grupo de lo que todavía no tiene diapositiva. */
  clave: string;
  enunciado: string;
  seccion: string;
  filas: FilaEditor[];
  /**
   * Sus temas agrupados por escala, en orden de aparición. Más de uno = **E2**:
   * la diapositiva sale apilada, un bloque por escala.
   */
  bloques: BloqueEditor[];
  /**
   * Temas cuyos públicos no comparten escala (**E1**), con nombre y con qué
   * escala usa cada público. Un conteo no basta: «1 tema no comparte escala» no
   * dice cuál de los cuatro es ni qué hay que mirar.
   */
  temasEscalaRota: { etiqueta: string; porFirma: EscalaConBases[] }[];
  /** Etiquetas repetidas dentro de la diapositiva (**E3**): barras indistinguibles. */
  etiquetasRepetidas: { etiqueta: string; veces: number }[];
};

/**
 * Orden de diapositivas. Numérico cuando se puede: como texto, «10» va antes que «2»
 * y el editor mostraría un orden que nadie pidió. Lo que no tiene diapositiva va al
 * final, porque es trabajo pendiente y no una diapositiva más.
 */
function ordenarClaves(claves: readonly string[]): string[] {
  return [...claves].sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    const na = Number(a);
    const nb = Number(b);
    const aNum = a !== "" && Number.isFinite(na);
    const bNum = b !== "" && Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b, "es");
  });
}

export function agruparEnDiapositivas(
  filas: readonly FilaEditor[],
  cat: CatalogoEscalas,
  /**
   * Largo máximo del nombre de un tema para que el bloque pueda salir como
   * radar. Llega del motor: sin él, el editor ofrecería un radar que el mazo
   * rechaza después y lo declarado dejaría de ser lo que sale.
   */
  radarMaxEtiqueta?: number,
): DiapositivaEditor[] {
  const grupos = new Map<string, FilaEditor[]>();
  for (const fila of filas) {
    const clave = (fila.diapositiva ?? "").trim();
    const actual = grupos.get(clave);
    if (actual) actual.push(fila);
    else grupos.set(clave, [fila]);
  }

  return ordenarClaves([...grupos.keys()]).map((clave) => {
    const propias = grupos.get(clave) ?? [];
    const bloques: BloqueEditor[] = [];
    const temasEscalaRota: { etiqueta: string; porFirma: EscalaConBases[] }[] = [];
    for (const fila of propias) {
      const e = escalaDeFila(fila, cat);
      if (e.rota) {
        temasEscalaRota.push({
          etiqueta: fila.etiqueta_estandar.trim() || Object.values(fila.variables).join(" · "),
          porFirma: e.porFirma,
        });
      }
      // El tema entra al bloque de SU primera firma. Uno con E1 rota reparte sus
      // públicos entre escalas y no pertenece limpiamente a ninguno; se le pone
      // en el primero y su aviso propio dice lo que le pasa.
      const firma = e.firmas[0] ?? "";
      const bloque = bloques.find((b) => b.firma === firma);
      if (bloque) bloque.filas.push(fila);
      else {
        bloques.push({
          firma,
          opciones: e.opciones,
          filas: [fila],
          grafico: (fila.grafico ?? "").trim().toLowerCase(),
          corte: (fila.corte ?? "").split(",").map((c) => c.trim()).filter(Boolean),
          estilo: (fila.estilo ?? "").trim().toLowerCase(),
          publicos: [],
          ofrecerRadar: false,
          elegibleRadar: false,
          motivoNoRadar: "",
        });
      }
    }

    // E3 se comprueba DENTRO de la diapositiva y no en todo el estudio: que
    // «Servicio de salud» se repita entre diapositivas es correcto —cada una tiene su
    // enunciado—, y sólo dentro de una serían dos barras con el mismo nombre.
    const conteo = new Map<string, { etiqueta: string; veces: number }>();
    for (const fila of propias) {
      const et = fila.etiqueta_estandar.trim();
      if (!et) continue;
      const clave3 = et.toLowerCase();
      const previo = conteo.get(clave3);
      if (previo) previo.veces += 1;
      else conteo.set(clave3, { etiqueta: et, veces: 1 });
    }
    const repetidas = [...conteo.values()].filter((c) => c.veces > 1);

    // Elegibilidad del radar, por bloque. Se calcula al cerrarlo porque las tres
    // condiciones son sobre el conjunto de sus temas, no sobre uno.
    for (const bloque of bloques) {
      const coberturas = bloque.filas.map((f) =>
        Object.keys(f.variables).sort().join("|"),
      );
      const rectangular = coberturas.length > 0 && new Set(coberturas).size === 1;
      bloque.publicos = rectangular ? Object.keys(bloque.filas[0].variables).sort() : [];
      bloque.ofrecerRadar = bloque.filas.length >= RADAR_MIN_EJES;
      // Un vértice no admite una oración. Es el MISMO límite que aplica el
      // motor al derivar el mazo: ofrecer aquí lo que allá se rechaza rompe la
      // única garantía que sostiene la pestaña — que lo declarado es lo que sale.
      const masLargo = Math.max(
        0,
        ...bloque.filas.map((f) => (f.etiqueta_estandar ?? "").trim().length),
      );
      const etiquetasLargas =
        typeof radarMaxEtiqueta === "number" &&
        radarMaxEtiqueta > 0 &&
        masLargo > radarMaxEtiqueta;

      bloque.motivoNoRadar = !bloque.ofrecerRadar
        ? ""
        : !rectangular
          ? "sus temas no cubren los mismos públicos: al radar le faltarían vértices en unas series y no en otras"
          : bloque.opciones.length === 0
            ? "su escala no tiene opciones con las que construir un indicador"
            : etiquetasLargas
              ? `sus temas son demasiado largos para un vértice (${masLargo} caracteres, máximo ${radarMaxEtiqueta}): en un radar se taparían entre sí`
              : "";
      bloque.elegibleRadar = bloque.ofrecerRadar && !bloque.motivoNoRadar;
    }

    return {
      clave,
      enunciado: propias.find((f) => (f.enunciado ?? "").trim())?.enunciado?.trim() ?? "",
      seccion: propias.find((f) => f.seccion.trim())?.seccion.trim() ?? "",
      filas: propias,
      bloques,
      temasEscalaRota,
      etiquetasRepetidas: repetidas,
    };
  });
}

// ---------------------------------------------------------------------------
// Agrupación asistida (ADR 0064, regla 8)
// ---------------------------------------------------------------------------
//
// El instrumento ya trae sus baterías: en cada público las variables de una
// matriz comparten raíz (`p13_1`, `p13_2`, `p13_3` → `p13`). Dos temas que
// comparten raíz **en algún público** pertenecen a la misma batería, y esa
// batería es el punto de partida de una diapositiva.
//
// La unión se hace POR PÚBLICO y no sobre la tupla completa: «Empleabilidad»
// sólo existe en estudiantes, así que nunca compartiría una firma de cuatro
// públicos con sus hermanas — pero sí comparte la raíz `p11` con ellas dentro de
// estudiantes, que es como se descubre que van juntas.
//
// Medido contra la matriz real: reconstruye 33 de las 44 diapositivas exactas.
// Las 11 restantes juntan dos baterías, y las baterías largas —una de 25 temas—
// el analista las parte. Por eso esto PROPONE y no resuelve: se aplica al editor
// como una edición más, visible en las tarjetas, y sólo se persiste al guardar.

/** Raíz de una variable de batería: `p13_1` → `p13`. Una variable sin sufijo
 *  numérico no pertenece a ninguna batería y devuelve `""`. */
function raizDeVariable(nombre: string): string {
  const m = /^(.*?)_\d{1,4}$/.exec(nombre);
  return m ? m[1] : "";
}

/**
 * Propone una diapositiva para cada tema que no tenga una, agrupando por batería
 * del instrumento. **No toca los que ya tienen diapositiva**: una asignación
 * hecha por el analista no se reescribe por una heurística.
 *
 * Las claves nuevas continúan la numeración existente, para que la propuesta no
 * choque con lo declarado ni renumere el informe.
 */
export function agruparPorBateria(filas: readonly FilaEditor[]): FilaEditor[] {
  const sinDiapo = filas
    .map((fila, i) => ({ fila, i }))
    .filter(({ fila }) => !(fila.diapositiva ?? "").trim());
  if (!sinDiapo.length) return [...filas];

  // Union-find sobre los índices de `sinDiapo`.
  const padre = sinDiapo.map((_, i) => i);
  const raiz = (a: number): number => {
    let x = a;
    while (padre[x] !== x) {
      padre[x] = padre[padre[x]];
      x = padre[x];
    }
    return x;
  };
  const unir = (a: number, b: number) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre[ra] = rb;
  };

  const porRaiz = new Map<string, number>();
  sinDiapo.forEach(({ fila }, idx) => {
    for (const [base, variable] of Object.entries(fila.variables)) {
      const r = raizDeVariable(variable);
      if (!r) continue;
      const clave = `${base}::${r}`;
      const previo = porRaiz.get(clave);
      if (previo === undefined) porRaiz.set(clave, idx);
      else unir(previo, idx);
    }
  });

  // Numeración: se continúa después de la mayor clave numérica ya declarada.
  let siguiente = 0;
  for (const fila of filas) {
    const n = Number((fila.diapositiva ?? "").trim());
    if (Number.isFinite(n)) siguiente = Math.max(siguiente, n);
  }

  // El orden de las claves nuevas sigue el orden de la declaración, no el de los
  // componentes: un informe numerado al azar obligaría a reordenarlo entero.
  const claveDeGrupo = new Map<number, string>();
  const asignada = new Map<number, string>();
  sinDiapo.forEach((_, idx) => {
    const g = raiz(idx);
    let clave = claveDeGrupo.get(g);
    if (clave === undefined) {
      siguiente += 1;
      clave = String(siguiente);
      claveDeGrupo.set(g, clave);
    }
    asignada.set(sinDiapo[idx].i, clave);
  });

  return filas.map((fila, i) => {
    const clave = asignada.get(i);
    return clave === undefined ? fila : { ...fila, diapositiva: clave };
  });
}

export function resumenEditor(filas: readonly FilaEditor[]): ResumenEditor {
  const confirmadas = filas.filter((f) => !f.sugerida && Object.keys(f.variables).length > 0);
  return {
    total: filas.length,
    confirmadas: confirmadas.length,
    sugeridas: filas.filter((f) => f.sugerida).length,
    sinEtiqueta: confirmadas.filter((f) => !f.etiqueta_estandar.trim()).length,
    conDiapositiva: confirmadas.filter((f) => (f.diapositiva ?? "").trim()).length,
  };
}
