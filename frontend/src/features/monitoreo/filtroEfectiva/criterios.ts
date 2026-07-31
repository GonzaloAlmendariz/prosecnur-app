/**
 * Los criterios que definen qué respuesta cuenta como efectiva.
 *
 * El contrato admitía uno solo —una variable y sus valores válidos— y eso
 * alcanza mientras la única condición sea el consentimiento. Deja de alcanzar
 * en cuanto el estudio pide dos: consintió Y terminó la encuesta. Con un solo
 * campo había que elegir cuál de las dos se comprobaba, y la otra quedaba
 * declarada en la cabeza de quien configuró el proyecto.
 *
 * Los criterios viajan dentro del mismo `platform_effective_filter` que ya
 * persistía, en `filters`, y `variable`/`values` siguen llevando el primero.
 * Esa repetición es la que mantiene leyendo correctamente a todo lo que
 * conocía solo el par suelto (el PDF telefónico, los proyectos guardados
 * antes). El detalle y el porqué están en `api/R/monitoreo_filtro_efectiva.R`.
 *
 * Se combinan con Y. No es configurable: «efectiva» significa que la respuesta
 * cumple todo lo que el estudio pide, y un O produciría definiciones que nadie
 * puede auditar después. Dentro de un criterio, en cambio, los valores son
 * alternativas —`["Yes", "Sí"]` acepta las dos escrituras de la misma
 * respuesta—.
 */

export type CriterioDeEfectiva = {
  variable: string;
  values: string[];
  label?: string;
  value_label?: string;
};

function texto(value: unknown) {
  return String(value ?? "").trim();
}

function clave(value: unknown) {
  return texto(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function comoLista(value: unknown): string[] {
  const bruto = Array.isArray(value) ? value : [value];
  return bruto.map(texto).filter(Boolean);
}

function criterioDesde(raw: unknown): CriterioDeEfectiva | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const variable = texto(item.variable ?? item.field ?? item.question ?? item.pregunta);
  const values = comoLista(item.values ?? item.value ?? item.options ?? item.opciones);
  if (!variable || !values.length) return null;
  return {
    variable,
    values,
    label: texto(item.label ?? item.etiqueta) || variable,
    value_label: texto(item.value_label ?? item.etiqueta_valor),
  };
}

/**
 * Los criterios declarados, en orden y con una sola entrada por variable.
 *
 * El primero sale del par suelto y el resto de `filters`; si `filters` ya trae
 * ese primero, no se duplica. Se normaliza defensivamente porque el payload
 * viene del backend y un `filters` que llegue como objeto suelto en vez de
 * lista —lo que hace `jsonlite` con un solo elemento— no debe convertirse en
 * tantos criterios como campos tenga.
 */
export function criteriosDesdeFiltro(raw: unknown): CriterioDeEfectiva[] {
  if (!raw || typeof raw !== "object") return [];
  const filtro = raw as Record<string, unknown>;

  const primero = criterioDesde(filtro);
  const declarados = filtro.filters ?? filtro.filtros;
  const lista = Array.isArray(declarados)
    ? declarados
    : declarados && typeof declarados === "object"
      ? [declarados]
      : [];
  const resto = lista.map(criterioDesde).filter((item): item is CriterioDeEfectiva => Boolean(item));

  const salida: CriterioDeEfectiva[] = [];
  const vistas = new Set<string>();
  for (const criterio of [...(primero ? [primero] : []), ...resto]) {
    const k = clave(criterio.variable);
    if (vistas.has(k)) continue;
    vistas.add(k);
    salida.push(criterio);
  }
  return salida;
}

/**
 * El bloque que se manda a guardar.
 *
 * Emite el par suelto Y la lista, siempre coherentes entre sí: el par es el
 * primer criterio. Guardar solo la lista habría dejado a los consumidores
 * viejos leyendo un filtro vacío sin que nada fallara.
 */
export function filtroDesdeCriterios(criterios: readonly CriterioDeEfectiva[]) {
  const limpios = criterios
    .map((criterio) => ({
      variable: texto(criterio.variable),
      values: comoLista(criterio.values),
      label: texto(criterio.label) || texto(criterio.variable),
      value_label: texto(criterio.value_label),
    }))
    .filter((criterio) => criterio.variable && criterio.values.length);

  const primero = limpios[0];
  return {
    enabled: limpios.length > 0,
    variable: primero?.variable ?? "",
    values: primero?.values ?? [],
    filters: limpios,
    label: primero?.label ?? "",
    value_label: primero?.value_label ?? "",
    source_kind: "kobo",
  };
}

/** Cuántas condiciones tiene que cumplir una respuesta para contar. */
export function resumenDeCriterios(criterios: readonly CriterioDeEfectiva[]) {
  if (!criterios.length) return "Sin definir";
  if (criterios.length === 1) return "1 criterio";
  return `${criterios.length} criterios`;
}
