import { enteroONulo, escalar, lista, registro, texto } from "../../../../../api/normalizarR";

const numeroONulo = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};

/**
 * Avance territorial por cuotas (ADR 0125 A1): por zona y por celda (sexo ×
 * rango de edad), no por UMP. Lo calcula `monitoreo_territorial_avance_cuotas`
 * (api/R/monitoreo_territorial_cuotas.R) con las mismas efectivas del avance.
 */
export type CeldaDeZona = {
  sexo: string; rangoEdad: string; meta: number; efectivas: number; enObservacion: number; falta: number;
  /** ADR 0126: con una dimensión referencial la celda no se exige; su cifra viaja en `referencia`. */
  caracter: "meta" | "referencial";
  referencia: number | null;
};
/** Lo que se exige cuando una dimensión es referencial: la marginal de la otra (o el total de la zona). */
export type MarginalDeZona = { dimension: "sexo" | "edad" | "zona"; categoria: string; meta: number; efectivas: number; falta: number };
/** Una dimensión referencial: lo obtenido frente a su parte en el reparto de Hojas de ruta. */
export type ComposicionDeZona = {
  dimension: "sexo" | "edad"; categoria: string; efectivas: number; referencia: number;
  obtenidaPct: number | null; esperadaPct: number | null; diferenciaPp: number | null; celdaVacia: boolean;
};
export type PersonaDeZona = { codigo: string; parte: number | null; efectivas: number; falta: number | null };
/** Quién levantó la zona según los casos (no la asignación de Material). */
export type MiembroDelEquipo = { codigo: string; nombre: string; efectivas: number; dias: number; enObservacion: number };
export type DiaDeZona = { fecha: string; efectivas: number };
export type Zona = {
  idZona: string;
  nombre: string;
  meta: number;
  efectivas: number;
  enObservacion: number;
  celdas: CeldaDeZona[];
  celdasCompletas: number;
  /** Vacías cuando las dos dimensiones son meta: entonces se exigen las celdas. */
  marginales: MarginalDeZona[];
  composicion: ComposicionDeZona[];
  /** Lo que se exige (celdas o marginales) y cuánto está cubierto. */
  unidades: number;
  unidadesCompletas: number;
  personas: PersonaDeZona[];
  equipo: MiembroDelEquipo[];
  /** Casos efectivos cuyo código no casa con la lista de códigos: se cuentan, no se nombran. */
  sinCodigo: number;
  diario: DiaDeZona[];
  duracionMedianaMin: number | null;
};
export type AvancePorZona = {
  zonas: Zona[];
  meta: number;
  efectivas: number;
  celdas: number;
  celdasCompletas: number;
  unidades: number;
  unidadesCompletas: number;
  sinZona: number;
  sinCelda: number;
};

const n = (v: unknown) => enteroONulo(v) ?? 0;

/** `null` si el reporte no trae avance por cuotas (envío por UMP o corte anterior). */
export function avancePorZona(raw: unknown): AvancePorZona | null {
  const r = registro(escalar(raw));
  if (texto(r.kind) !== "cuotas") return null;
  const total = registro(r.total);
  const zonas = lista(r.zonas).map((z): Zona => ({
    idZona: texto(z.id_zona),
    nombre: texto(z.nombre) || texto(z.ubigeo),
    meta: n(z.meta),
    efectivas: n(z.efectivas),
    enObservacion: n(z.en_observacion),
    celdasCompletas: n(z.celdas_completas),
    celdas: lista(z.celdas).map((c) => ({
      sexo: texto(c.sexo),
      rangoEdad: texto(c.rango_edad),
      meta: n(c.meta),
      efectivas: n(c.efectivas),
      enObservacion: n(c.en_observacion),
      falta: n(c.falta),
      caracter: texto(c.caracter) === "referencial" ? "referencial" as const : "meta" as const,
      referencia: enteroONulo(c.referencia),
    })),
    marginales: lista(z.marginales).map((g) => ({
      dimension: (["sexo", "edad"].includes(texto(g.dimension)) ? texto(g.dimension) : "zona") as MarginalDeZona["dimension"],
      categoria: texto(g.categoria),
      meta: n(g.meta),
      efectivas: n(g.efectivas),
      falta: n(g.falta),
    })),
    composicion: lista(z.composicion).map((g) => ({
      dimension: (texto(g.dimension) === "edad" ? "edad" : "sexo") as ComposicionDeZona["dimension"],
      categoria: texto(g.categoria),
      efectivas: n(g.efectivas),
      referencia: n(g.referencia),
      obtenidaPct: numeroONulo(escalar(g.obtenida_pct)),
      esperadaPct: numeroONulo(escalar(g.esperada_pct)),
      diferenciaPp: numeroONulo(escalar(g.diferencia_pp)),
      celdaVacia: escalar(g.celda_vacia) === true,
    })),
    // Un corte anterior no trae unidades: son las celdas.
    unidades: z.unidades == null ? lista(z.celdas).length : n(z.unidades),
    unidadesCompletas: z.unidades_completas == null ? n(z.celdas_completas) : n(z.unidades_completas),
    personas: lista(z.personas).map((p) => ({
      codigo: texto(p.codigo),
      parte: enteroONulo(p.parte),
      efectivas: n(p.efectivas),
      falta: enteroONulo(p.falta),
    })),
    equipo: lista(registro(z.equipo).personas).map((p) => ({
      codigo: texto(p.codigo),
      nombre: texto(p.nombre),
      efectivas: n(p.efectivas),
      dias: n(p.dias),
      enObservacion: n(p.en_observacion),
    })),
    sinCodigo: n(registro(z.equipo).sin_codigo),
    diario: lista(registro(z.diario).dias).map((d) => ({ fecha: texto(d.fecha), efectivas: n(d.efectivas) })),
    duracionMedianaMin: numeroONulo(escalar(z.duracion_mediana_min)),
  }));
  return {
    zonas,
    meta: n(total.meta),
    efectivas: n(total.efectivas),
    celdas: n(total.celdas),
    celdasCompletas: n(total.celdas_completas),
    unidades: total.unidades == null ? n(total.celdas) : n(total.unidades),
    unidadesCompletas: total.unidades_completas == null ? n(total.celdas_completas) : n(total.unidades_completas),
    sinZona: n(r.sin_zona),
    sinCelda: n(r.sin_celda),
  };
}

/** Los rangos de edad en el orden en que aparecen, y los sexos de la matriz. */
export function ejesDeLaMatriz(zona: Zona): { sexos: string[]; rangos: string[] } {
  const sexos: string[] = [];
  const rangos: string[] = [];
  for (const c of zona.celdas) {
    if (!sexos.includes(c.sexo)) sexos.push(c.sexo);
    if (!rangos.includes(c.rangoEdad)) rangos.push(c.rangoEdad);
  }
  return { sexos, rangos };
}

/** Lo que falta en una zona, de mayor a menor: por celda o, si una dimensión es referencial, por marginal. */
export function faltantesDeZona(zona: Zona): Array<{ texto: string; falta: number }> {
  if (zona.marginales.length) {
    return zona.marginales
      .filter((g) => g.falta > 0)
      .sort((a, b) => b.falta - a.falta)
      .map((g) => ({ texto: g.dimension === "zona" ? "total de la zona" : g.dimension === "sexo" ? g.categoria.toLowerCase() : g.categoria, falta: g.falta }));
  }
  return zona.celdas
    .filter((c) => c.falta > 0)
    .sort((a, b) => b.falta - a.falta)
    .map((c) => ({ texto: `${c.sexo.toLowerCase()} ${c.rangoEdad}`, falta: c.falta }));
}

/** Zonas con algo por cubrir, primero las que más les falta. */
export function zonasPendientes(modelo: AvancePorZona): Zona[] {
  return modelo.zonas.filter((z) => faltaDeZona(z) > 0).sort((a, b) => faltaDeZona(b) - faltaDeZona(a));
}

/**
 * Lo que falta en una zona: sus celdas por cubrir o, si una dimensión es
 * referencial (ADR 0126), sus marginales; nunca las dos, que contarían dos veces.
 */
export function faltaDeZona(zona: Zona): number {
  if (zona.marginales.length) return zona.marginales.reduce((suma, g) => suma + g.falta, 0);
  return zona.celdas.reduce((suma, c) => suma + c.falta, 0);
}

/**
 * Lo que falta por celda sumando zonas, de más a menos. No es la diferencia
 * entre la cuota total y lo logrado: el exceso de una zona no cubre la falta
 * de otra.
 */
export function faltantePorCelda(modelo: AvancePorZona): Array<{ sexo: string; rangoEdad: string; falta: number; zonas: number }> {
  const porCelda = new Map<string, { sexo: string; rangoEdad: string; falta: number; zonas: number }>();
  for (const z of modelo.zonas) {
    for (const c of z.celdas) {
      if (c.falta <= 0) continue;
      const clave = `${c.sexo}|${c.rangoEdad}`;
      const item = porCelda.get(clave) ?? { sexo: c.sexo, rangoEdad: c.rangoEdad, falta: 0, zonas: 0 };
      item.falta += c.falta;
      item.zonas += 1;
      porCelda.set(clave, item);
    }
  }
  return [...porCelda.values()].sort((a, b) => b.falta - a.falta);
}

/** La celda con menor logro sobre su cuota sumando zonas, o `null` si todas están cubiertas. */
export function celdaMasAtrasada(modelo: AvancePorZona): { sexo: string; rangoEdad: string; efectivas: number; meta: number } | null {
  const totales = new Map<string, { sexo: string; rangoEdad: string; efectivas: number; meta: number }>();
  for (const z of modelo.zonas) {
    for (const c of z.celdas) {
      const clave = `${c.sexo}|${c.rangoEdad}`;
      const item = totales.get(clave) ?? { sexo: c.sexo, rangoEdad: c.rangoEdad, efectivas: 0, meta: 0 };
      item.efectivas += c.efectivas;
      item.meta += c.meta;
      totales.set(clave, item);
    }
  }
  const atrasadas = [...totales.values()].filter((t) => t.meta > 0 && t.efectivas < t.meta);
  if (!atrasadas.length) return null;
  return atrasadas.sort((a, b) => a.efectivas / a.meta - b.efectivas / b.meta)[0];
}

/**
 * Con una dimensión referencial (ADR 0126): lo que falta por meta marginal
 * sumando zonas, de más a menos. Como por celda, el exceso de una zona no cubre
 * la falta de otra.
 */
export function faltantePorMarginal(modelo: AvancePorZona): Array<{ dimension: MarginalDeZona["dimension"]; categoria: string; falta: number; zonas: number }> {
  const porCategoria = new Map<string, { dimension: MarginalDeZona["dimension"]; categoria: string; falta: number; zonas: number }>();
  for (const z of modelo.zonas) {
    for (const g of z.marginales) {
      if (g.falta <= 0) continue;
      const clave = `${g.dimension}|${g.dimension === "zona" ? "" : g.categoria}`;
      const item = porCategoria.get(clave) ?? { dimension: g.dimension, categoria: g.dimension === "zona" ? "Total de la zona" : g.categoria, falta: 0, zonas: 0 };
      item.falta += g.falta;
      item.zonas += 1;
      porCategoria.set(clave, item);
    }
  }
  return [...porCategoria.values()].sort((a, b) => b.falta - a.falta);
}
