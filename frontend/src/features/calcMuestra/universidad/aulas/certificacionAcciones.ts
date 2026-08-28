/**
 * Acciones REGISTRADAS desde la certificación por facultad.
 *
 * Gonzalo, textual: «estas decisiones más específicas, como por ejemplo la
 * psicología darle un aula más, tenemos que asegurarnos que estén disponibles
 * en la interfaz usuario, porque nada puede ser manual y todo tiene que estar
 * registrado en la aplicación».
 *
 * El mecanismo registrado ya existía de punta a punta —el engine respeta
 * `aulas_base_fijas` por estrato y la afijación lo hereda al recalcular—
 * pero no había NINGÚN editor en la UI: la decisión habría sido manual.
 * Este módulo la vuelve un clic donde aparece el hallazgo: fija el número
 * de titulares de la facultad en (actuales + 1) dentro del estrato del
 * componente por facultad, y el flujo existente (recalcular → seleccionar)
 * la aplica y la deja escrita en el estudio.
 */
import type { CalcMuestraEstrato } from "../../../../api/calcMuestra";

/** Espejo de `.cm_criterios_fac_key`: minúsculas, sin tildes, ñ→n, _ */
function claveFacultad(nombre: unknown): string {
  return String(nombre ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ñ]/g, "n")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[`'´’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Estratos con el override de UNA facultad fijado en `aulasActuales + 1`.
 * Devuelve `null` si la facultad no existe en los estratos: el caller no debe
 * parchear nada (una acción que no encuentra su blanco no se aplica a medias).
 */
export function estratosConAulaExtra(
  estratos: CalcMuestraEstrato[] | null | undefined,
  facultad: string,
  aulasActuales: number,
): CalcMuestraEstrato[] | null {
  if (!Array.isArray(estratos) || !estratos.length) return null;
  if (!Number.isFinite(aulasActuales) || aulasActuales < 0) return null;
  const objetivo = claveFacultad(facultad);
  if (!objetivo) return null;
  let tocado = false;
  const nuevos = estratos.map((e) => {
    if (claveFacultad(e.label) !== objetivo) return e;
    tocado = true;
    return {
      ...e,
      aulas_base_fijas: Math.round(aulasActuales) + 1,
      aulas_base_certificada: Number(e.aulas_base_certificada) || 0,
      aulas_base_origen: "operativa" as const,
    };
  });
  return tocado ? nuevos : null;
}

/**
 * Generalización del ajuste (pedido de Gonzalo 2026-08-19: «el usuario puede
 * hacer este tipo de ajustes» — subir Y bajar): fija el override de UNA
 * facultad en `aulasActuales + delta`, con piso 1 (bajar a 0 titulares es
 * excluir la facultad del sorteo, y eso es otra decisión con otra puerta).
 */
export function estratosConAjusteAula(
  estratos: CalcMuestraEstrato[] | null | undefined,
  facultad: string,
  aulasActuales: number,
  delta: 1 | -1,
): CalcMuestraEstrato[] | null {
  if (!Array.isArray(estratos) || !estratos.length) return null;
  if (!Number.isFinite(aulasActuales) || aulasActuales < 0) return null;
  const nuevo = Math.round(aulasActuales) + delta;
  if (nuevo < 1) return null;
  const objetivo = claveFacultad(facultad);
  if (!objetivo) return null;
  let tocado = false;
  const nuevos = estratos.map((e) => {
    if (claveFacultad(e.label) !== objetivo) return e;
    tocado = true;
    // El ajuste NO borra lo que pidio la certificacion.
    //
    // Antes ponia `operativa` a secas, y con eso un estrato que ya venia
    // certificado perdia su primera decision: Derecho tenia 18 por
    // certificacion —la formula pedia 16— y al subirlo a 19 quedaba entero
    // como operativa. El total seguia bien; la descomposicion decia 6 aulas de
    // certificacion y 3 operativas, cuando eran 8 y 1.
    //
    // El nivel certificado se conserva y el origen nombra a quien fijo el
    // valor ACTUAL: volver exactamente al numero certificado devuelve el
    // origen a la certificacion, porque ahi ya no queda decision del analista.
    const certificada = Number(e.aulas_base_certificada) || 0;
    return {
      ...e,
      aulas_base_fijas: nuevo,
      aulas_base_certificada: certificada,
      aulas_base_origen: (certificada > 0 && nuevo === certificada
        ? "certificacion"
        : "operativa") as "certificacion" | "operativa",
    };
  });
  return tocado ? nuevos : null;
}

/**
 * Llevar una facultad al numero que la certificacion pide, de un golpe.
 *
 * El panel «¿Alcanza?» dice en Calculo · CH por facultad que Derecho necesita
 * 19 titulares cuando el diseno pide 16; el stepper de ±1 vive en Aulas ·
 * Seleccion. El hallazgo aparece en un sitio y la accion esta en otro, y
 * cubrir esa diferencia son tres clics. Esto la vuelve uno, donde aparece el
 * hallazgo, que es para lo que existe este modulo.
 *
 * Mismo piso que `estratosConAjusteAula`: bajar a 0 titulares es excluir la
 * facultad del sorteo, y eso es otra decision con otra puerta.
 */
export function estratosConAulasFijadas(
  estratos: CalcMuestraEstrato[] | null | undefined,
  facultad: string,
  aulas: number,
): CalcMuestraEstrato[] | null {
  if (!Array.isArray(estratos) || !estratos.length) return null;
  if (!Number.isFinite(aulas)) return null;
  const nuevo = Math.round(aulas);
  if (nuevo < 1) return null;
  const objetivo = claveFacultad(facultad);
  if (!objetivo) return null;
  let tocado = false;
  const nuevos = estratos.map((e) => {
    if (claveFacultad(e.label) !== objetivo) return e;
    tocado = true;
    return {
      ...e,
      aulas_base_fijas: nuevo,
      aulas_base_certificada: nuevo,
      aulas_base_origen: "certificacion" as const,
    };
  });
  return tocado ? nuevos : null;
}

/**
 * Las fijaciones PENDIENTES: estratos con `aulas_base_fijas` que el resultado
 * calculado aún no refleja. Hallazgo del click-test (EF8c): al fijar, la
 * selección se invalida en cadena pero NADA nombraba la causa — el usuario
 * veía desaparecer su selección sin letrero. Esto alimenta ese letrero.
 */
export type FijaPendiente = { facultad: string; fijada: number; calculada: number | null };

export function fijasPendientes(
  estratos: ReadonlyArray<CalcMuestraEstrato> | null | undefined,
  aulasPorEstrato: ReadonlyArray<{ estrato?: unknown; aulas_base?: unknown }> | null | undefined,
): FijaPendiente[] {
  if (!Array.isArray(estratos) || !estratos.length) return [];
  const calculadas = new Map<string, number>();
  for (const fila of aulasPorEstrato ?? []) {
    const clave = claveFacultad(fila.estrato);
    const base = Number(fila.aulas_base);
    if (clave && Number.isFinite(base)) calculadas.set(clave, base);
  }
  const out: FijaPendiente[] = [];
  for (const e of estratos) {
    const fijada = Number((e as { aulas_base_fijas?: unknown }).aulas_base_fijas);
    if (!Number.isFinite(fijada) || fijada <= 0) continue;
    const clave = claveFacultad(e.label);
    const calculada = calculadas.has(clave) ? calculadas.get(clave)! : null;
    if (calculada !== fijada) {
      out.push({ facultad: String(e.label ?? ""), fijada, calculada });
    }
  }
  return out;
}

/**
 * Los estratos PROPIOS de un componente, no los del normalizado.
 *
 * `universityComponents` reparte UN SOLO marco a los dos componentes de
 * universidad —el de nivel universidad manda si tiene estratos— porque el
 * marco es dato compartido. Pero `aulas_base_fijas` NO es dato del marco: es
 * una decisión del analista sobre ESE componente, y viaja de polizón dentro
 * de un objeto que se comparte. El componente de facultad llega entonces a la
 * UI con las fijaciones del otro, que normalmente son ninguna.
 *
 * Leer de ahí y escribir de vuelta las borra, porque `updateComponente` hace
 * `{ ...c.marco, ...patch.marco }`: `estratos` se REEMPLAZA entero, no se
 * funde estrato a estrato. Medido en HSVG2026 el 2026-08-27: un «+1» sobre
 * ARQUITECTURA dejaba el componente de facultad con **una** fijación de 9
 * donde tenía **quince que sumaban 174**.
 *
 * `respaldo` cubre el componente que aún no tiene estratos propios (recién
 * creado): ahí el marco compartido sí es la única fuente.
 */
export function estratosDelComponente(
  componentes: ReadonlyArray<{ id: string; marco?: { estratos?: CalcMuestraEstrato[] | null } | null }> | null | undefined,
  id: string,
  respaldo?: CalcMuestraEstrato[] | null,
): CalcMuestraEstrato[] | null {
  const propios = (componentes ?? []).find((c) => c.id === id)?.marco?.estratos;
  if (propios?.length) return propios;
  return respaldo?.length ? respaldo : null;
}

/**
 * Cuántas facultades llevan titulares fijados a mano y cuánto suman.
 *
 * Vive acá y no en la pestaña de Cálculo por una razón de contrato: esa
 * pestaña tiene prohibida la aritmética (`calculoSinRecalculo.contract.test`),
 * porque su trabajo es PROYECTAR lo que publica R y no recalcularlo. Estas
 * cifras no son de R —son las fijaciones que el analista escribió y que el
 * motor todavía no ha incorporado—, pero contarlas dentro de la pestaña
 * abriría un boquete en una guarda que sí importa.
 */
export function resumenFijaciones(
  estratos: ReadonlyArray<CalcMuestraEstrato> | null | undefined,
): { total: number; suma: number } {
  let total = 0;
  let suma = 0;
  for (const e of estratos ?? []) {
    const n = Number((e as { aulas_base_fijas?: unknown }).aulas_base_fijas);
    if (Number.isFinite(n) && n > 0) { total += 1; suma += n; }
  }
  return { total, suma };
}

/**
 * El motivo de una agregación operativa.
 *
 * Va aparte del ajuste porque el número se aplica en el momento y el motivo se
 * escribe después: exigirlo en el mismo clic convertiría un stepper de ±1 en un
 * formulario. Lo que no se puede es quedarse sin él — una agregación operativa
 * sin motivo escrito es indistinguible de un error de dedo tres meses después,
 * y por eso la celda declara que falta hasta que se escribe.
 */
export function estratosConNotaOperativa(
  estratos: CalcMuestraEstrato[] | null | undefined,
  facultad: string,
  nota: string,
): CalcMuestraEstrato[] | null {
  if (!Array.isArray(estratos) || !estratos.length) return null;
  const objetivo = claveFacultad(facultad);
  if (!objetivo) return null;
  let tocado = false;
  const nuevos = estratos.map((e) => {
    if (claveFacultad(e.label) !== objetivo) return e;
    tocado = true;
    return { ...e, aulas_base_nota: nota.trim() };
  });
  return tocado ? nuevos : null;
}

/**
 * Todas las facultades cortas llevadas a su minimo certificado de una vez.
 *
 * La certeza mide los quince minimos en UNA corrida y son independientes entre
 * si: el minimo de Derecho no cambia porque se fije Psicologia. Pero fijar una
 * invalida el resultado del componente, y con el resultado invalido la pantalla
 * ya no tiene sobre que medir: «Todavia no hay un calculo por facultad sobre el
 * que medir». Aplicarlas de a una obligaba a fijar → recalcular → volver a
 * medir seis veces para una evidencia que ya estaba completa.
 *
 * Gonzalo, sobre este mismo mecanismo: «nada puede ser manual y todo tiene que
 * estar registrado en la aplicacion».
 *
 * Solo SUBE: las facultades donde la certeza dice que sobran aulas se dejan en
 * lo que pide la formula («no bajes ninguna, solo sube donde haga falta»).
 * Devuelve `null` si no hay ninguna que subir, para que el caller no escriba un
 * cambio vacio.
 */
export function estratosConMinimosCertificados(
  estratos: CalcMuestraEstrato[] | null | undefined,
  minimos: ReadonlyArray<{ label: string; aulas: number | null; brecha: number | null }>,
): CalcMuestraEstrato[] | null {
  if (!Array.isArray(estratos) || !estratos.length) return null;
  const porFacultad = new Map<string, number>();
  for (const fila of minimos) {
    const clave = claveFacultad(fila.label);
    const aulas = Number(fila.aulas);
    const brecha = Number(fila.brecha);
    if (!clave || !Number.isFinite(aulas) || aulas < 1) continue;
    if (!Number.isFinite(brecha) || brecha <= 0) continue;
    porFacultad.set(clave, Math.round(aulas));
  }
  if (porFacultad.size === 0) return null;
  let tocado = false;
  const nuevos = estratos.map((e) => {
    const objetivo = porFacultad.get(claveFacultad(e.label));
    if (objetivo == null) return e;
    tocado = true;
    return {
      ...e,
      aulas_base_fijas: objetivo,
      aulas_base_certificada: objetivo,
      aulas_base_origen: "certificacion" as const,
    };
  });
  return tocado ? nuevos : null;
}
