/**
 * **El valor de una dimensión, escrito para la pantalla.**
 *
 * Con el eje de cuotas declarable, el mismo hueco de la UI enseña una facultad
 * («CIENCIAS E INGENIERIA»), un nivel («7») o una carrera («ECONOMÍA») según lo
 * que el estudio declare. Escribir ese rótulo en cada sitio es cómo se llega a
 * que el mismo valor se lea de dos formas en dos paneles vecinos — ya pasó con
 * el nombre de las facultades, que salía distinto en Monitoreo y en
 * Recopiladores en 11 de 16 casos.
 *
 * **Aquí no se escribe ninguna tabla nueva.** Cada dimensión delega en la pieza
 * que ya resolvía su caso: el nombre de facultad en `facultadCorta`, el sexo en
 * `etiquetaDeSexo`, y la carrera en el normalizador compartido —las carreras
 * llegan del marco en MAYÚSCULAS igual que las facultades—. Lo único propio de
 * este módulo es el NIVEL, que no tenía dueño: un «7» suelto no dice de qué es,
 * y el rótulo con el que se dice sale del eje (`etiqueta`), no de aquí.
 */
import { facultadCorta, facultadEnPalabras } from "./facultadEnPalabras";
import { etiquetaDeSexo } from "./etiquetaDeSexo";

/** La declaración del eje tal como la publica el motor en `avance_cuota.eje`. */
export type EjeDeclarado = {
  clave?: string | null;
  etiqueta?: string | null;
  etiqueta_plural?: string | null;
  etiqueta_sin?: string | null;
} | null | undefined;

/** El rótulo singular del eje: «Facultad», «Nivel». Sin eje, «Facultad». */
export function etiquetaDelEje(eje: EjeDeclarado): string {
  const e = String(eje?.etiqueta ?? "").trim();
  return e || "Facultad";
}

/** Su plural, para los rótulos de conjunto: «Facultades», «Niveles». */
export function etiquetaPluralDelEje(eje: EjeDeclarado): string {
  const e = String(eje?.etiqueta_plural ?? "").trim();
  return e || "Facultades";
}

/**
 * Cómo se dice «no tiene valor de este eje»: «Sin facultad», «Sin nivel».
 *
 * Importa que salga del eje y no de aquí porque es una fila que el usuario VE —
 * el motor publica esas respuestas en su propia fila con el centinela— y
 * llamarla «Sin facultad» en un estudio por nivel sería mentir sobre qué falta.
 */
export function etiquetaSinValorDelEje(eje: EjeDeclarado): string {
  const e = String(eje?.etiqueta_sin ?? "").trim();
  return e || "Sin facultad";
}

/**
 * El valor de una dimensión, listo para pintar.
 *
 * @param valor el valor crudo tal como lo publica el motor.
 * @param dimension `facultad` | `nivel` | `carrera` | `sexo`; por defecto, la
 *   clave del eje.
 * @param eje la declaración del eje, de donde sale el rótulo del nivel.
 */
export function etiquetaDeValor(
  valor: string | null | undefined,
  dimension: string | null | undefined,
  eje?: EjeDeclarado,
): string {
  const v = String(valor ?? "").trim();
  if (!v) return "";
  const dim = String(dimension ?? eje?.clave ?? "facultad").trim();
  if (dim === "sexo") return etiquetaDeSexo(v, { mayuscula: true });
  if (dim === "nivel") {
    // «Nivel 7» y no «7»: el número suelto no dice de qué es, y en una leyenda
    // junto a otras cifras se lee como un conteo. Si el valor ya trae la
    // palabra —porque alguien la escribió en el marco— no se repite.
    const rotulo = etiquetaDelEje(eje);
    if (v.toLocaleLowerCase("es").startsWith(rotulo.toLocaleLowerCase("es"))) return v;
    return `${rotulo} ${v}`;
  }
  // Facultad y carrera comparten el trato: las dos llegan en MAYÚSCULAS del
  // marco. La facultad además se acorta, porque sus nombres no caben en una
  // etiqueta de gráfico; una carrera sí cabe.
  if (dim === "carrera") return facultadEnPalabras(v);
  return facultadCorta(v);
}
