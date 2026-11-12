// Lo que el formulario dice de una pregunta, en palabras (Explorar, panel "En
// el formulario" y la línea bajo el título; plan de fidelidad, V5). La
// condición de aparición y la restricción se leen de la frase de las reglas
// del catálogo (contrato M3), nunca de la expresión cruda del XLSForm. Se
// cruza por código y por familia; si el catálogo no tiene la regla, se dice
// que la condición existe sin escribir la expresión.

import type { CatalogoCompleto, PiezaDelCatalogo } from "../../../../api/validacionCatalogo";

export type CondicionDeAparicion =
  | { tipo: "siempre" }
  | { tipo: "frase"; piezas: PiezaDelCatalogo[] }
  /** Hay `relevant` pero ninguna regla del catálogo lo escribe en palabras. */
  | { tipo: "sin-frase" };

export type LecturaDelFormulario = {
  aparece: CondicionDeAparicion;
  /** La frase de cada restricción de la pregunta ("Se marca cuando ..."). */
  restricciones: PiezaDelCatalogo[][];
};

/** Las piezas que siguen al primer texto que termina en "cuando ", sin el punto final. */
function condicionDeLaFrase(frase: readonly PiezaDelCatalogo[]): PiezaDelCatalogo[] | null {
  const i = frase.findIndex((p) => p.tipo === "texto" && /cuando\s*$/.test(p.texto));
  if (i < 0 || i === frase.length - 1) return null;
  const resto = frase.slice(i + 1);
  const ultima = resto[resto.length - 1];
  if (ultima.tipo === "texto") {
    const sinPunto = ultima.texto.replace(/\.\s*$/, "");
    return sinPunto ? [...resto.slice(0, -1), { tipo: "texto", texto: sinPunto }] : resto.slice(0, -1);
  }
  return resto;
}

export function lecturaDelFormulario(
  catalogo: CatalogoCompleto | null,
  variable: string,
  relevant: string | null,
): LecturaDelFormulario {
  const propias = (catalogo?.reglas ?? []).filter((r) => r.origen === "formulario" && r.variable_revisada === variable);
  const salto = propias.find((r) => r.familia === "salto" && r.direccion === "debe")
    ?? propias.find((r) => r.familia === "obligatoria" && r.frase.some((p) => p.tipo === "texto" && /cuando\s*$/.test(p.texto)));
  const condicion = salto ? condicionDeLaFrase(salto.frase) : null;
  const aparece: CondicionDeAparicion = condicion && condicion.length
    ? { tipo: "frase", piezas: condicion }
    : relevant
      ? { tipo: "sin-frase" }
      : { tipo: "siempre" };
  const restricciones = propias.filter((r) => r.familia === "restriccion" && r.frase.length > 0).map((r) => r.frase);
  return { aparece, restricciones };
}

/** La frase en texto llano, con cada pregunta por su código: para la línea bajo el título. */
export function fraseEnTexto(piezas: readonly PiezaDelCatalogo[]): string {
  return piezas.map((p) => (p.tipo === "pregunta" ? p.codigo : p.tipo === "valor" ? p.valor : p.texto)).join("");
}
