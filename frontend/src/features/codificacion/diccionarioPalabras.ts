// Panel «Palabras» de una pregunta abierta (TXT-6/7): el borrador del diccionario y lo que hace cada acción. Puro y sin
// red: el hook (`useDiccionarioPalabras`) lee, guarda y despacha; el panel pinta.
//
// El servidor identifica cada palabra con todas sus formas escritas («estudiante», «estudiantes»); el borrador guarda
// palabras tal como se ven. Por eso unir o excluir escribe la forma visible (`forma`), y para saber si una palabra está
// en un grupo o excluida se compara por todas sus formas. Si el servidor la reconoció por otra forma (un grupo guardado
// con «alumno» cuando la lista muestra «alumnos»), el grupo se encuentra por la palabra que se muestra.

import type {
  DiccionarioPregunta,
  EquivalenciaPalabras,
  FraseDetectada,
  PalabraReconocida,
  TextoAbiertoDiccionario,
} from "../../api/textoAbierto";

export type LecturaPalabras =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; datos: TextoAbiertoDiccionario };

export type GuardadoPalabras =
  | { fase: "quieto" }
  | { fase: "guardando" }
  | { fase: "ok" }
  | { fase: "error"; mensaje: string };

/** Unión en curso: el usuario ya pulsó «Unir» y elige cuál palabra se muestra. */
export type UnionEnCurso = { opciones: string[]; mostrar: string };

export type EstadoPalabras = {
  lectura: LecturaPalabras;
  /** Diccionario tal como está guardado (lo último que devolvió el servidor). */
  guardadoEnProyecto: DiccionarioPregunta;
  borrador: DiccionarioPregunta;
  /** Claves de las palabras marcadas, en el orden en que se marcaron. */
  seleccion: string[];
  consulta: string;
  union: UnionEnCurso | null;
  guardado: GuardadoPalabras;
};

export type AccionPalabras =
  | { tipo: "cargando" }
  | { tipo: "cargado"; datos: TextoAbiertoDiccionario }
  | { tipo: "error-lectura"; mensaje: string }
  | { tipo: "buscar"; consulta: string }
  | { tipo: "marcar"; clave: string }
  | { tipo: "empezar-union" }
  | { tipo: "elegir-mostrar"; mostrar: string }
  | { tipo: "cancelar-union" }
  | { tipo: "confirmar-union" }
  | { tipo: "deshacer-grupo"; mostrar: string }
  | { tipo: "alternar-excluir"; termino: string; formas: readonly string[] }
  /** CCSS-TXT-14: excluye en lote las palabras marcadas (la misma selección que «Unir»). */
  | { tipo: "excluir-marcadas" }
  /** Devuelve a la cuenta un término excluido (palabra o frase). */
  | { tipo: "reincorporar"; termino: string }
  | { tipo: "alternar-frase"; frase: string }
  | { tipo: "guardando" }
  | { tipo: "guardado"; datos: TextoAbiertoDiccionario }
  | { tipo: "error-guardado"; mensaje: string };

const DICCIONARIO_VACIO: DiccionarioPregunta = { equivalencias: [], excluir: [], frases: [] };

export const ESTADO_INICIAL_PALABRAS: EstadoPalabras = {
  lectura: { fase: "cargando" },
  guardadoEnProyecto: DICCIONARIO_VACIO,
  borrador: DICCIONARIO_VACIO,
  seleccion: [],
  consulta: "",
  union: null,
  guardado: { fase: "quieto" },
};

/** Clave de comparación de un término: minúsculas, sin tildes ni espacios de más (como el servidor). */
export function claveTermino(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function contieneTermino(lista: readonly string[], termino: string): boolean {
  const k = claveTermino(termino);
  return lista.some((t) => claveTermino(t) === k);
}

function sinRepetidos(terminos: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of terminos) if (!contieneTermino(out, t)) out.push(t);
  return out;
}

/** Grupo del borrador al que pertenece la palabra, o `null`. */
export function grupoDePalabra(p: PalabraReconocida, dic: DiccionarioPregunta): EquivalenciaPalabras | null {
  const porForma = dic.equivalencias.find((g) => p.formas.some((f) => contieneTermino(g.formas, f)));
  if (porForma) return porForma;
  if (!p.grupo) return null;
  const k = claveTermino(p.grupo);
  return dic.equivalencias.find((g) => claveTermino(g.mostrar) === k) ?? null;
}

/** ¿El borrador excluye esta palabra por alguna de sus formas? */
export function palabraExcluida(p: PalabraReconocida, dic: DiccionarioPregunta): boolean {
  return p.formas.some((f) => contieneTermino(dic.excluir, f));
}

export function fraseFijada(f: FraseDetectada, dic: DiccionarioPregunta): boolean {
  return contieneTermino(dic.frases, f.forma);
}

export function fraseExcluida(f: FraseDetectada, dic: DiccionarioPregunta): boolean {
  return contieneTermino(dic.excluir, f.forma);
}

/** Lista de «más frecuentes»: las no excluidas que coinciden con la búsqueda, de más a menos personas. */
export function palabrasFrecuentes(s: EstadoPalabras): PalabraReconocida[] {
  if (s.lectura.fase !== "lista") return [];
  return filtrarPalabras(s.lectura.datos.palabras, s.consulta)
    .filter((p) => !palabraExcluida(p, s.borrador))
    .sort((a, b) => b.personas - a.personas);
}

export function filtrarPalabras(palabras: readonly PalabraReconocida[], consulta: string): PalabraReconocida[] {
  const k = claveTermino(consulta);
  if (!k) return [...palabras];
  return palabras.filter((p) => p.formas.some((f) => claveTermino(f).includes(k)));
}

function mismaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((t, i) => claveTermino(t) === claveTermino(b[i]));
}

export function mismoDiccionario(a: DiccionarioPregunta, b: DiccionarioPregunta): boolean {
  return (
    mismaLista(a.excluir, b.excluir) &&
    mismaLista(a.frases, b.frases) &&
    a.equivalencias.length === b.equivalencias.length &&
    a.equivalencias.every((g, i) => claveTermino(g.mostrar) === claveTermino(b.equivalencias[i].mostrar) && mismaLista(g.formas, b.equivalencias[i].formas))
  );
}

export function hayCambios(s: EstadoPalabras): boolean {
  return !mismoDiccionario(s.borrador, s.guardadoEnProyecto);
}

function palabrasMarcadas(s: EstadoPalabras): PalabraReconocida[] {
  if (s.lectura.fase !== "lista") return [];
  const porClave = new Map(s.lectura.datos.palabras.map((p) => [p.clave, p]));
  return s.seleccion.flatMap((k) => {
    const p = porClave.get(k);
    return p ? [p] : [];
  });
}

/** Lo que resultaría de unir lo marcado: las palabras marcadas (las más usadas primero) y las de sus grupos. */
function planDeUnion(s: EstadoPalabras): { formas: string[]; absorbidos: EquivalenciaPalabras[] } {
  const marcadas = palabrasMarcadas(s).sort((a, b) => b.personas - a.personas);
  const absorbidos: EquivalenciaPalabras[] = [];
  for (const p of marcadas) {
    const g = grupoDePalabra(p, s.borrador);
    if (g && !absorbidos.includes(g)) absorbidos.push(g);
  }
  const formas = sinRepetidos([
    ...marcadas.map((p) => p.forma),
    ...absorbidos.flatMap((g) => [g.mostrar, ...g.formas]),
  ]);
  return { formas, absorbidos };
}

function conBorrador(s: EstadoPalabras, borrador: DiccionarioPregunta): EstadoPalabras {
  return { ...s, borrador, guardado: s.guardado.fase === "guardando" ? s.guardado : { fase: "quieto" } };
}

export function reducirPalabras(s: EstadoPalabras, a: AccionPalabras): EstadoPalabras {
  switch (a.tipo) {
    case "cargando":
      return { ...s, lectura: { fase: "cargando" } };
    case "cargado":
      return {
        ...s,
        lectura: { fase: "lista", datos: a.datos },
        guardadoEnProyecto: a.datos.diccionario,
        borrador: a.datos.diccionario,
        seleccion: s.seleccion.filter((k) => a.datos.palabras.some((p) => p.clave === k)),
        union: null,
      };
    case "error-lectura":
      return { ...s, lectura: { fase: "error", mensaje: a.mensaje } };
    case "buscar":
      return { ...s, consulta: a.consulta };
    case "marcar":
      return {
        ...s,
        union: null,
        seleccion: s.seleccion.includes(a.clave) ? s.seleccion.filter((k) => k !== a.clave) : [...s.seleccion, a.clave],
      };
    case "empezar-union": {
      const { formas } = planDeUnion(s);
      if (s.seleccion.length < 2 || formas.length < 2) return s;
      return { ...s, union: { opciones: formas, mostrar: formas[0] } };
    }
    case "elegir-mostrar":
      return s.union && s.union.opciones.includes(a.mostrar) ? { ...s, union: { ...s.union, mostrar: a.mostrar } } : s;
    case "cancelar-union":
      return { ...s, union: null };
    case "confirmar-union": {
      if (!s.union) return s;
      const { formas, absorbidos } = planDeUnion(s);
      if (formas.length < 2) return { ...s, union: null };
      const mostrar = contieneTermino(formas, s.union.mostrar) ? s.union.mostrar : formas[0];
      const resto = s.borrador.equivalencias.filter((g) => !absorbidos.includes(g));
      return {
        ...conBorrador(s, { ...s.borrador, equivalencias: [...resto, { mostrar, formas }] }),
        seleccion: [],
        union: null,
      };
    }
    case "deshacer-grupo": {
      const k = claveTermino(a.mostrar);
      return conBorrador(s, { ...s.borrador, equivalencias: s.borrador.equivalencias.filter((g) => claveTermino(g.mostrar) !== k) });
    }
    case "alternar-excluir": {
      const formas = a.formas.length ? a.formas : [a.termino];
      const yaExcluida = formas.some((f) => contieneTermino(s.borrador.excluir, f));
      const excluir = yaExcluida
        ? s.borrador.excluir.filter((t) => !formas.some((f) => claveTermino(f) === claveTermino(t)))
        : [...s.borrador.excluir, a.termino];
      return conBorrador(s, { ...s.borrador, excluir });
    }
    case "excluir-marcadas": {
      const nuevas = palabrasMarcadas(s).filter((p) => !palabraExcluida(p, s.borrador)).map((p) => p.forma);
      if (!nuevas.length) return s;
      return { ...conBorrador(s, { ...s.borrador, excluir: sinRepetidos([...s.borrador.excluir, ...nuevas]) }), seleccion: [], union: null };
    }
    case "reincorporar": {
      const k = claveTermino(a.termino);
      return conBorrador(s, { ...s.borrador, excluir: s.borrador.excluir.filter((t) => claveTermino(t) !== k) });
    }
    case "alternar-frase": {
      const frases = contieneTermino(s.borrador.frases, a.frase)
        ? s.borrador.frases.filter((t) => claveTermino(t) !== claveTermino(a.frase))
        : [...s.borrador.frases, a.frase];
      return conBorrador(s, { ...s.borrador, frases });
    }
    case "guardando":
      return { ...s, guardado: { fase: "guardando" } };
    case "guardado":
      return { ...reducirPalabras(s, { tipo: "cargado", datos: a.datos }), guardado: { fase: "ok" } };
    case "error-guardado":
      return { ...s, guardado: { fase: "error", mensaje: a.mensaje } };
  }
}

/** Primer término entre comillas latinas del mensaje del servidor, si lo hay. */
function primerCitado(mensaje: string): string | null {
  const m = /«([^»]+)»/.exec(mensaje);
  return m ? m[1] : null;
}

/**
 * Mensaje de un guardado rechazado, en texto llano: sin el código y sin vocabulario de procesamiento de texto.
 * `mensaje` es el de `ApiError` («<frase> · <código>»).
 */
export function mensajeGuardadoLlano(code: string, mensaje: string): string {
  const frase = mensaje.replace(/\s*·\s*[A-Z][A-Z0-9_]+\s*$/, "").trim();
  if (code === "E_TXT_FORMA_REPETIDA") {
    const citado = primerCitado(frase);
    const sujeto = citado ? `Una palabra del grupo «${citado}»` : "Una de las palabras";
    return `${sujeto} ya está en otro grupo (puede estar escrita de otra forma). Deshaz uno de los dos grupos y vuelve a unirlas.`;
  }
  if (code === "E_TXT_MOSTRAR_FUERA_DE_FORMAS") return "La palabra que se muestra tiene que ser una de las que uniste.";
  return frase || "No se pudo guardar.";
}

export type TotalGrupo = {
  /** Personas que usan alguna palabra del grupo, sin repetir (del backend); `null` mientras el grupo no esté guardado. */
  personas: number | null;
  /** Personas por palabra del grupo, de más a menos: el desglose («alumnos 6 + estudiantes 7»). */
  partes: Array<{ forma: string; personas: number }>;
};

/** TXT-18: el total de un grupo unido y su desglose por palabra. */
export function totalDelGrupo(g: EquivalenciaPalabras, datos: TextoAbiertoDiccionario | null): TotalGrupo {
  if (!datos) return { personas: null, partes: [] };
  const mismas = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((f) => contieneTermino(b, f));
  const guardado = datos.grupos.find((s) => claveTermino(s.mostrar) === claveTermino(g.mostrar) && mismas(s.formas, g.formas));
  const partes = datos.palabras
    .filter((p) => p.formas.some((f) => contieneTermino(g.formas, f)))
    .map((p) => ({ forma: p.forma, personas: p.personas }))
    .sort((a, b) => b.personas - a.personas);
  return { personas: guardado ? guardado.personas : null, partes };
}
