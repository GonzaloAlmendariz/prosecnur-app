/**
 * El vacío del comparador es la primera frase de Método para quien no comparó.
 *
 * Al invertir el orden de la pestaña (a4a4cf4b) este bloque pasó a ser lo primero
 * que se ve. Su vacío decía «Sin comparación vigente · El método configurado no
 * se presenta como recomendación hasta comparar el marco y el objetivo
 * actuales»: un matiz técnico que no nombraba el botón que lo llena.
 *
 * El proyecto de trabajo siempre tiene comparación, así que esta rama no se
 * observa en la app; se verifica renderizando.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassroomMethodComparator } from "../ClassroomMethodComparator";

const render = (ready: boolean, comparison: unknown) =>
  renderToStaticMarkup(
    <ClassroomMethodComparator
      ready={ready}
      comparison={comparison as never}
      methods={[]}
      recommendedMethodId=""
      config={{} as never}
      busy={null}
      onSelectMethod={() => undefined}
    />,
  );

describe("el vacío del comparador", () => {
  it("nombra el botón que lo llena", () => {
    const html = render(false, null);
    expect(html).toContain("Comparar los cuatro métodos");
  });

  it("dice que comparar no es obligatorio para sortear", () => {
    // Desde f2623619 se puede sortear con el método configurado sin comparar;
    // un vacío que lo callara dejaría al analista esperando por nada.
    expect(render(false, null)).toContain("No es obligatorio");
  });

  it("no vuelve al matiz técnico que no orientaba", () => {
    const html = render(false, null);
    expect(html).not.toContain("Sin comparación vigente");
    expect(html).not.toContain("no se presenta como recomendación");
  });

  it("con comparación lista no pinta el vacío", () => {
    const html = render(true, { recommendation: { method_id: "cube_balanceado" }, balance: [] });
    expect(html).not.toContain("Todavía no has comparado");
  });

  it("el encabezado no promete un paso de una secuencia que ya no existe", () => {
    // Llevó «Paso 2» mientras la didáctica iba encima.
    expect(render(false, null)).not.toContain("Paso 2");
  });
});
