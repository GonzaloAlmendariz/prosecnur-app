import type { AulaMedida, SenalesPorAula } from "./senalesPorAula";

/**
 * El buscador de «Cada curso-horario contra su propio margen».
 *
 * Gonzalo, el 2026-09-09, sobre esa tabla: «son muchísimos cursos horarios… a
 * lo mejor algún selector de curso horario, un buscador». Agrupar los
 * pendientes por facultad bajó el panel de 161 renglones a doce, pero el
 * recorrido inverso —«¿cómo va CH 74?»— seguía obligando a desplegar los seis
 * grupos y leerlos a ojo, porque un curso-horario puede estar en cualquiera de
 * ellos y el grupo en el que cae ES el dato que se busca.
 *
 * Por eso el filtro cruza TODOS los grupos y ninguno se privilegia: la
 * respuesta a «dónde está CH 74» es el grupo que queda con filas.
 */

/** Sin tildes y en minúsculas: se teclea «ingenieria» y la facultad es «INGENIERÍA». */
export function normalizaBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Todos los términos tienen que aparecer, en cualquiera de los tres campos que
 * identifican la fila. Es AND y no OR a propósito: «derecho 12» busca el 12 DE
 * derecho; con OR devolvería la facultad entera más todos los que llevan 12.
 */
export function coincideCursoHorario(aula: AulaMedida, consulta: string): boolean {
  const terminos = normalizaBusqueda(consulta).split(/\s+/).filter(Boolean);
  if (!terminos.length) return true;
  const heno = normalizaBusqueda(
    [aula.codigo, aula.facultad, aula.estadoOperativo ?? ""].join(" "),
  );
  return terminos.every((t) => heno.includes(t));
}

type Medido = Extract<SenalesPorAula, { estado: "medido" }>;

export type SenalesFiltradas = Medido & {
  /** Cuántas filas quedan y cuántas había: el contador que dice si buscar sirvió. */
  encontrados: number;
  total: number;
  /** Con la consulta vacía no se filtró nada, y la UI no debe decir «0 de N». */
  filtrado: boolean;
};

const CUENTA = (res: Medido) =>
  res.senalados.length + res.descuadres.length + res.conformes.length +
  res.pendientes.length + res.retiradas.length + res.desconocidos.length +
  res.sinMedir.reduce((n, g) => n + g.aulas.length, 0);

/**
 * Filtra los siete grupos con la misma consulta. Un grupo que se queda sin
 * filas desaparece —enseñar «0 cursos-horario — sin banda» al buscar sería
 * ruido—, pero el grupo VACÍO DE ORIGEN ya no estaba, así que no se pierde
 * ninguna causa que el panel supiera nombrar.
 */
/**
 * Se queda con los cursos-horario de una facultad, en los siete grupos.
 *
 * **Aquí el foco SÍ filtra, al revés que en la tabla de facultades de arriba.**
 * Aquélla existe para comparar facultades entre sí y recortarla a una fila la
 * dejaría sin sentido; ésta es una lista de 175 cursos-horario, y con una
 * facultad puesta en la cabecera enseñar los de las otras catorce es no
 * responder al mando. Gonzalo, 2026-09-10: «absolutamente todos los gráficos
 * deben ajustarse y ser robustos a mostrar o todas las facultades o una en
 * específica».
 *
 * Compara con la misma normalización que `deLaFacultad` —mayúsculas y sin
 * tildes—: un solo criterio en todo el perfil para decidir si dos nombres de
 * facultad son el mismo.
 */
export function soloDeLaFacultad(res: Medido, facultad: string | undefined): Medido {
  if (!facultad) return res;
  const clave = (v: unknown) =>
    (v == null ? "" : String(v)).trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const buscada = clave(facultad);
  const f = (aulas: AulaMedida[]) => aulas.filter((a) => clave(a.facultad) === buscada);
  return {
    ...res,
    senalados: f(res.senalados),
    descuadres: f(res.descuadres),
    conformes: f(res.conformes),
    pendientes: f(res.pendientes),
    retiradas: f(res.retiradas),
    desconocidos: f(res.desconocidos),
    sinMedir: res.sinMedir
      .map((g) => ({ ...g, aulas: f(g.aulas) }))
      .filter((g) => g.aulas.length > 0),
  };
}

export function filtraSenales(res: Medido, consulta: string): SenalesFiltradas {
  const total = CUENTA(res);
  if (!normalizaBusqueda(consulta)) {
    return { ...res, encontrados: total, total, filtrado: false };
  }
  const f = (aulas: AulaMedida[]) => aulas.filter((a) => coincideCursoHorario(a, consulta));
  const filtrado: Medido = {
    ...res,
    senalados: f(res.senalados),
    descuadres: f(res.descuadres),
    conformes: f(res.conformes),
    pendientes: f(res.pendientes),
    retiradas: f(res.retiradas),
    desconocidos: f(res.desconocidos),
    sinMedir: res.sinMedir
      .map((g) => ({ ...g, aulas: f(g.aulas) }))
      .filter((g) => g.aulas.length > 0),
  };
  return { ...filtrado, encontrados: CUENTA(filtrado), total, filtrado: true };
}
