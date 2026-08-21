/**
 * Qué anunciar cuando el cálculo termina.
 *
 * Contar componentes no es contar éxitos. Medido en vivo: el motor devolvió
 * los dos componentes y marcó su distribución «incompatible» —«La suma de
 * facultades no coincide con el marco validado del diseño»— y la pantalla
 * anunciaba «Cálculo completado: 2 componentes» justo al lado de una cabecera
 * que decía «resultado inválido». Dos superficies, dos versiones del mismo
 * hecho, y la de éxito era la que estaba a la vista.
 *
 * Un aviso de éxito que no mira el resultado es peor que ninguno: manda a
 * seguir adelante sobre algo que no se sostiene.
 */

/**
 * Sólo lo que este aviso necesita mirar. Deliberadamente laxo: el resultado
 * del motor tiene decenas de campos y acoplar esta función al tipo completo la
 * ataría a cambios que no le incumben.
 */
type ComponenteCalculado = { resultado?: unknown };

function estadoDistribucion(comp: ComponenteCalculado): unknown {
  const res = comp?.resultado;
  if (!res || typeof res !== "object") return undefined;
  const du = (res as Record<string, unknown>).distribucion_universitaria;
  if (!du || typeof du !== "object") return undefined;
  return (du as Record<string, unknown>).status;
}

export type AvisoCalculo = { kind: "info" | "warn"; text: string };

export function avisoTrasCalcular(componentes: ComponenteCalculado[]): AvisoCalculo {
  const total = componentes.length;
  const incompatibles = componentes.filter((comp) => estadoDistribucion(comp) === "incompatible").length;

  if (incompatibles === 0) {
    return {
      kind: "info",
      text: `Cálculo completado: ${total} ${total === 1 ? "componente" : "componentes"}.`,
    };
  }
  return {
    kind: "warn",
    text: incompatibles === total
      // Con todos incompatibles no hay nada que rescatar del resultado, así
      // que se manda al único sitio donde está escrito el porqué.
      ? "El cálculo corrió, pero su distribución quedó incompatible con el marco. Revisa el detalle en el resumen del diseño."
      : `El cálculo corrió, pero ${incompatibles} de ${total} componentes quedaron con la distribución incompatible con el marco.`,
  };
}
