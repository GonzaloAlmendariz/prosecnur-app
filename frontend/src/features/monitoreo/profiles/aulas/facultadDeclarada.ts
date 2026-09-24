/**
 * Las decisiones de la pantalla que declara la facultad, fuera del componente.
 *
 * El estudio DECLARA qué pregunta del cuestionario dice la facultad y qué
 * significa cada uno de sus códigos —la plataforma manda «7», no «Ciencias y
 * Artes de la Comunicación»—. Sin eso no hay cruce, y adivinarlo sería inventar
 * justo el dato que el control existe para vigilar.
 *
 * Lo que sí se puede hacer es PROPONER, que es distinto de suponer: el
 * cuestionario lista las facultades en orden alfabético y los códigos van del 1
 * en adelante, así que la correspondencia por orden acierta casi siempre. Se
 * propone, se ve, y alguien la confirma. Y al guardar, el motor devuelve cuánto
 * coincide: un catálogo bien mapeado coincide en ~95 % y uno corrido una sola
 * posición, en ~1 %. Medido sobre HSVG2026 el 2026-09-17.
 */

import { pctPerfil } from "./kpisDeAulas";

export type MapaFacultades = Record<string, string>;

/** Los códigos de la variable, en orden numérico cuando lo son. */
export function codigosOrdenados(valores: ReadonlyArray<string>): string[] {
  const v = Array.from(new Set((valores ?? []).map((x) => String(x ?? "").trim())))
    .filter((x) => x !== "");
  const numericos = v.every((x) => /^\d+$/.test(x));
  return numericos ? v.sort((a, b) => Number(a) - Number(b)) : v.sort();
}

/**
 * La propuesta por orden: el código n-ésimo con la facultad n-ésima en
 * alfabético.
 *
 * **Sólo cuando las dos listas miden lo mismo.** Con doce códigos y quince
 * facultades, emparejar por posición corre el catálogo entero desde el primer
 * hueco, y un catálogo corrido no se ve mal: se ve como un estudio donde nadie
 * coincide con su aula. Si no cuadran, no se propone nada y la pantalla lo dice.
 */
export function propuestaPorOrden(
  codigos: ReadonlyArray<string>, facultades: ReadonlyArray<string>,
): MapaFacultades {
  const c = codigosOrdenados(codigos);
  const f = Array.from(new Set((facultades ?? []).map((x) => String(x ?? "").trim())))
    .filter((x) => x !== "")
    .sort((a, b) => a.localeCompare(b, "es"));
  if (!c.length || c.length !== f.length) return {};
  const out: MapaFacultades = {};
  c.forEach((k, i) => { out[k] = f[i]; });
  return out;
}

/** Sólo los pares con código y nombre: un código sin nombre no traduce nada. */
export function etiquetasGuardables(mapa: MapaFacultades): MapaFacultades {
  const out: MapaFacultades = {};
  for (const [k, v] of Object.entries(mapa ?? {})) {
    const codigo = String(k ?? "").trim();
    const nombre = String(v ?? "").trim();
    if (codigo !== "" && nombre !== "") out[codigo] = nombre;
  }
  return out;
}

/** Los códigos de la base que todavía no tienen facultad asignada. */
export function codigosSinMapear(
  codigos: ReadonlyArray<string>, mapa: MapaFacultades,
): string[] {
  const listo = etiquetasGuardables(mapa);
  return codigosOrdenados(codigos).filter((k) => !(k in listo));
}

/**
 * Cómo se lee el resultado del cruce, para que la pantalla no tenga que
 * interpretar porcentajes a mano.
 *
 * El umbral no es una opinión: con el catálogo correcto el operativo coincide
 * en 95,2 % y con uno corrido una posición, en 1,1 %. Cualquier cosa por
 * debajo de la mitad es un mapeo equivocado, no un hallazgo de campo — un
 * estudio donde la mayoría de la gente estuviera en el aula de otra facultad
 * no tendría cuotas por facultad que valga la pena medir.
 */
export function veredictoDelCruce(
  control: { ok?: boolean; motivo?: string; comparables?: number; coinciden?: number } | null | undefined,
): { tono: "ok" | "atencion" | "neutro"; texto: string } {
  if (!control) return { tono: "neutro", texto: "" };
  const comparables = Number(control.comparables ?? 0);
  if (!control.ok || !comparables) {
    return { tono: "neutro", texto: control.motivo ? String(control.motivo) : "" };
  }
  const pct = (Number(control.coinciden ?? 0) / comparables) * 100;
  const cifra = `${comparables.toLocaleString("es-PE")} respuestas comparables · ${pctPerfil(pct)} coinciden con la facultad de su curso-horario`;
  if (pct < 50) {
    return {
      tono: "atencion",
      texto: `${cifra}. Con tan pocas coincidencias el catálogo está mal emparejado, no es un hallazgo de campo: revisa qué código es cada facultad.`,
    };
  }
  return { tono: "ok", texto: cifra };
}
