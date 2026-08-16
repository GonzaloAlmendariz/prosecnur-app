/**
 * La pantalla de rutas dibuja la cadena entera, no sus primeros seis eslabones.
 *
 * `bolsas_reemplazo` vale 11 por defecto y en la selección de referencia los 30
 * titulares tienen exactamente 11 reservas cada uno —330 filas con
 * `replacement_for`, mínimo 11, mediana 11, máximo 11—. La pantalla recortaba a
 * 6 por partida doble: el call site pasaba `Math.min(6, …)` y el panel volvía a
 * acotar con `Math.min(depth, 6)`. Se veían 6 de 11 y la métrica anunciaba
 * «Reemplazos por ruta: R n.1–R n.6».
 *
 * No es cosmético: estos códigos viajan a agenda, Excel/Sheets y Monitoreo, así
 * que esconder cinco eslabones de cada ruta hace planificar campo con menos
 * reemplazos de los que existen.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ClassroomReplacementChainPanel,
  profundidadCadenaPedida,
} from "../ClassroomReplacementPanels";

const PROFUNDIDAD_REAL = 11;

/** Un titular con `n` reservas atadas, como las devuelve el motor. */
function seleccion(n: number) {
  const titular = {
    classroom_id: "CH-1",
    selection_slot_id: "slot-1",
    sample_role: "titular",
    // El motor marca la ola del titular como M1; sin ella se cuela en su propia
    // lista de reemplazos, porque `reserves` acepta todo lo que no sea M1.
    wave: "M1",
    course_name: "Curso titular",
    faculty: "Ciencias",
    stratum: "Ciencias",
    eligible_n: 40,
    operational_code: "CH 1",
  };
  const reservas = Array.from({ length: n }, (_, i) => ({
    classroom_id: `R-${i + 1}`,
    selection_slot_id: "slot-1",
    replacement_for: "CH-1",
    sample_role: "chain_reserve",
    course_name: `Reemplazo ${i + 1}`,
    faculty: "Ciencias",
    stratum: "Ciencias",
    replacement_order: i + 1,
    wave: `M${i + 2}`,
    operational_code: `R 1.${i + 1}`,
    equivalence_level: "misma_celda",
  }));
  return [titular, ...reservas];
}

/** `n` titulares, cada uno con dos reservas atadas. */
function variosTitulares(n: number) {
  return Array.from({ length: n }, (_, i) => [
    {
      classroom_id: `CH-${i + 1}`,
      selection_slot_id: `slot-${i + 1}`,
      sample_role: "titular",
      wave: "M1",
      course_name: `Titular ${i + 1}`,
      faculty: "Ciencias",
      stratum: "Ciencias",
      eligible_n: 40,
      operational_code: `CH ${i + 1}`,
    },
    {
      classroom_id: `R-${i + 1}-1`,
      selection_slot_id: `slot-${i + 1}`,
      replacement_for: `CH-${i + 1}`,
      sample_role: "chain_reserve",
      course_name: `Reemplazo de ${i + 1}`,
      faculty: "Ciencias",
      stratum: "Ciencias",
      replacement_order: 1,
      wave: "M2",
      operational_code: `R ${i + 1}.1`,
      equivalence_level: "misma_celda",
    },
  ]).flat();
}

function pintar(n: number, depth: number): string {
  return renderToStaticMarkup(
    <ClassroomReplacementChainPanel selectionRows={seleccion(n)} depth={depth} />,
  );
}

describe("profundidad de la cadena de reemplazos en pantalla", () => {
  it("dibuja los once reemplazos que el motor encadenó", () => {
    const html = pintar(PROFUNDIDAD_REAL, PROFUNDIDAD_REAL);
    for (let i = 1; i <= PROFUNDIDAD_REAL; i += 1) {
      expect(html).toContain(`Reemplazo ${i}`);
    }
  });

  it("el séptimo eslabón ya no se pierde", () => {
    // EL defecto: con el tope en 6, del 7 al 11 no llegaban a pintarse.
    const html = pintar(PROFUNDIDAD_REAL, PROFUNDIDAD_REAL);
    expect(html).toContain("Reemplazo 7");
    expect(html).toContain("Reemplazo 11");
  });

  it("la métrica anuncia el rango real de la ruta", () => {
    const html = pintar(PROFUNDIDAD_REAL, PROFUNDIDAD_REAL);
    expect(html).toContain("R n.1–R n.11");
    expect(html).not.toContain("R n.1–R n.6");
  });

  it("una cadena más corta no inventa profundidad", () => {
    // Control: el rango sigue al dato, no al tope pedido.
    const html = pintar(3, PROFUNDIDAD_REAL);
    expect(html).toContain("R n.1–R n.3");
    expect(html).toContain("Reemplazo 3");
  });

  it("respeta el tope pedido cuando la config lo baja", () => {
    // Control: `depth` sigue mandando; lo que se retiró es el 6 clavado.
    const html = pintar(PROFUNDIDAD_REAL, 4);
    expect(html).toContain("R n.1–R n.4");
    expect(html).not.toContain("Reemplazo 5");
  });
});

describe("profundidad que la pestaña pide", () => {
  /**
   * El recorte estaba en DOS sitios: el panel y el call site. Con el panel ya
   * atado a los datos, esta función es lo que impide que el `Math.min(6, …)`
   * reaparezca en la pestaña sin que nadie se entere.
   */
  it("pide la profundidad que el estudio configuró", () => {
    expect(profundidadCadenaPedida(11)).toBe(11);
    expect(profundidadCadenaPedida(12)).toBe(12);
  });

  it("no la recorta a seis", () => {
    expect(profundidadCadenaPedida(11)).not.toBe(6);
  });

  it("cae a seis solo cuando la config no dice nada usable", () => {
    for (const vacio of [undefined, null, 0, -3, "", Number.NaN]) {
      expect(profundidadCadenaPedida(vacio)).toBe(6);
    }
  });
});

describe("cuántos titulares reciben tarjeta de ruta", () => {
  /**
   * Tercer recorte silencioso de la misma familia: `titulars.slice(0, 24)`
   * mientras la selección de referencia trae 30 titulares. Seis se quedaban sin
   * tarjeta y sin aviso, en la pantalla que entrega los códigos operativos a
   * campo. La métrica «Titulares con ruta» decía 24 y sonaba a dato del plan.
   */
  it("dibuja los treinta titulares de la selección de referencia", () => {
    const html = renderToStaticMarkup(
      <ClassroomReplacementChainPanel selectionRows={variosTitulares(30)} depth={11} />,
    );
    const tarjetas = html.match(/cmv2-chain-route-card/g) ?? [];
    expect(tarjetas).toHaveLength(30);
  });

  it("el titular 25 ya no se pierde", () => {
    // EL defecto: del 25 al 30 no llegaban a pintarse.
    const html = renderToStaticMarkup(
      <ClassroomReplacementChainPanel selectionRows={variosTitulares(30)} depth={11} />,
    );
    expect(html).toContain("Titular 25");
    expect(html).toContain("Titular 30");
  });

  it("la métrica cuenta los titulares que hay", () => {
    const html = renderToStaticMarkup(
      <ClassroomReplacementChainPanel selectionRows={variosTitulares(30)} depth={11} />,
    );
    expect(html).toContain("<strong>30</strong>");
    expect(html).not.toContain("<strong>24</strong>");
  });
});
