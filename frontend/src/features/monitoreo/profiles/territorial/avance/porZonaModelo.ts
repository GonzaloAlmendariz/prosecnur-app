import { enteroONulo, escalar, lista, registro, texto } from "../../../../../api/normalizarR";

/**
 * Avance territorial por cuotas (ADR 0125 A1): por zona y por celda (sexo ×
 * rango de edad), no por UMP. Lo calcula `monitoreo_territorial_avance_cuotas`
 * (api/R/monitoreo_territorial_cuotas.R) con las mismas efectivas del avance.
 */
export type CeldaDeZona = { sexo: string; rangoEdad: string; meta: number; efectivas: number; enObservacion: number; falta: number };
export type PersonaDeZona = { codigo: string; parte: number | null; efectivas: number; falta: number | null };
export type Zona = {
  idZona: string;
  nombre: string;
  meta: number;
  efectivas: number;
  enObservacion: number;
  celdas: CeldaDeZona[];
  celdasCompletas: number;
  personas: PersonaDeZona[];
};
export type AvancePorZona = {
  zonas: Zona[];
  meta: number;
  efectivas: number;
  celdas: number;
  celdasCompletas: number;
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
    })),
    personas: lista(z.personas).map((p) => ({
      codigo: texto(p.codigo),
      parte: enteroONulo(p.parte),
      efectivas: n(p.efectivas),
      falta: enteroONulo(p.falta),
    })),
  }));
  return {
    zonas,
    meta: n(total.meta),
    efectivas: n(total.efectivas),
    celdas: n(total.celdas),
    celdasCompletas: n(total.celdas_completas),
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
