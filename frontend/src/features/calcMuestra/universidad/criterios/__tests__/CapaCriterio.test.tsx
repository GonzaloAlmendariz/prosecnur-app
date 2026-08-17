/**
 * La capa de un criterio de alumno se puede CAMBIAR, no sólo leer.
 *
 * El motor distingue tres capas y sólo `marco` recorta el universo; el catálogo
 * publica `defaultLayer` por variable y el dominio del front tenía `capaDe` y
 * `setLayer` desde hace tiempo, con sus tests. Lo que no existía era el mando:
 * ninguna pantalla llamaba a `setLayer`, así que la capa era la que trajera el
 * proyecto y no había forma de moverla.
 *
 * En HSVG2026 se ve el efecto: «Ciclo o nivel curricular» nace en `instrumento`,
 * deja pasar 100.920 de 136.284 filas y no recorta nada. La tarjeta lo decía
 * —«en capa instrumento no recorta el marco»— y ahí se acababa la conversación:
 * si el estudio quería excluir del marco a los de primer ciclo, no podía.
 */
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type {
  CriterioLayer,
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../../api/client";
import { CapaCriterio } from "../CapaCriterio";
import { CriterioCard } from "../CriterioCard";

/** `level` real: de alumno, ordinal y con la capa `instrumento` por defecto. */
const NIVEL = {
  id: "level",
  label: "Ciclo o nivel curricular",
  scope: "alumno",
  kind: "flat",
  mappedColumn: "Nivel curricular",
  defaultLayer: "instrumento",
  categories: [{ key: "1", label: "1", n: 10 }, { key: "2", label: "2", n: 20 }],
} as unknown as CriterioVariable;

/** Un criterio de aula no tiene capa: construye el marco y no hay otro sitio. */
const TIPO_SESION = {
  ...(NIVEL as unknown as Record<string, unknown>),
  id: "session_type",
  label: "Tipo de sesión",
  scope: "aula",
  defaultLayer: undefined,
} as unknown as CriterioVariable;

function pintar(variable: CriterioVariable, sel: CriterioSeleccion = { mode: "include" }): string {
  return renderToStaticMarkup(<CapaCriterio variable={variable} sel={sel} onSel={() => {}} />);
}

/** La línea que describe la capa VIGENTE, sin los `title` de las tres opciones. */
function efecto(html: string): string {
  return html.match(/<p class="cmv2-crit-capa-efecto">([^<]*)</)?.[1] ?? "";
}

/** Recorre el árbol de elementos y devuelve los botones de capa. */
function botones(el: ReactElement | null): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const visitar = (nodo: unknown): void => {
    if (Array.isArray(nodo)) return void nodo.forEach(visitar);
    if (!nodo || typeof nodo !== "object") return;
    const e = nodo as { type?: unknown; props?: Record<string, unknown> };
    if (!e.props) return;
    if (e.type === "button" && e.props["data-activa"] !== undefined) out.push(e.props);
    visitar(e.props.children);
  };
  visitar(el);
  return out;
}

describe("selector de capa del criterio", () => {
  it("ofrece las tres capas y marca la vigente", () => {
    const html = pintar(NIVEL);
    expect(html).toContain("Marco");
    expect(html).toContain("Instrumento");
    expect(html).toContain("Procesamiento");
    // Sin capa en la selección manda el default de la variable, que aquí NO es
    // marco: mostrarla como «Marco» prometería un recorte que no ocurre.
    expect(html).toContain('data-capa="instrumento"');
  });

  it("la selección guardada gana al default de la variable", () => {
    expect(pintar(NIVEL, { mode: "include", layer: "marco" })).toContain('data-capa="marco"');
    expect(pintar(NIVEL, { mode: "include", layer: "procesamiento" })).toContain(
      'data-capa="procesamiento"',
    );
  });

  it("dice qué hace cada capa, y sólo una habla de recortar", () => {
    // Sin esto el selector pide una decisión metodológica sin decir qué cambia.
    // Y sólo `marco` menciona el recorte: la línea de arriba —el recorte
    // medido— ya dice «no recorta el marco» para las otras dos, y repetirlo
    // aquí serían dos renglones seguidos diciendo lo mismo.
    // Se mira SÓLO la línea de efecto: el `title` de cada botón describe su
    // opción, así que buscar en todo el markup encontraría «Recorta» siempre.
    expect(efecto(pintar(NIVEL, { mode: "include", layer: "marco" }))).toContain(
      "Recorta el universo",
    );
    expect(efecto(pintar(NIVEL))).toContain("se comprueba en campo");
    expect(efecto(pintar(NIVEL))).not.toContain("ecorta");
    const proc = efecto(pintar(NIVEL, { mode: "include", layer: "procesamiento" }));
    expect(proc).toContain("al depurar la base");
    expect(proc).not.toContain("ecorta");
  });

  it("un criterio de aula no muestra capa", () => {
    expect(pintar(TIPO_SESION)).toBe("");
  });

  it("pulsar una capa emite la selección con esa capa", () => {
    // El mando que faltaba: sin este emit el selector sería decorativo.
    const emitidas: CriterioSeleccion[] = [];
    const el = CapaCriterio({
      variable: NIVEL,
      sel: { mode: "include", categories: ["1"] },
      onSel: (next) => emitidas.push(next),
    }) as ReactElement;
    const btns = botones(el);
    expect(btns).toHaveLength(3);
    for (const b of btns) (b.onClick as () => void)();
    // La vigente no emite —no hay cambio que guardar—; las otras dos sí.
    expect(emitidas.map((s) => s.layer)).toEqual<CriterioLayer[]>(["marco", "procesamiento"]);
    // Y no pisa lo demás de la selección.
    expect(emitidas[0].categories).toEqual(["1"]);
    expect(emitidas[0].mode).toBe("include");
  });
});

describe("el selector vive dentro de la tarjeta que decide el criterio", () => {
  // Un test del componente suelto no protege el MONTAJE: si nadie lo pinta, el
  // mando sigue sin existir para el analista y los de arriba pasan igual.
  const SEL = {
    byVariable: { level: { mode: "include", categories: ["1"] } },
  } as unknown as CriteriosSeleccionMarco;

  function tarjeta(variable: CriterioVariable): string {
    return renderToStaticMarkup(
      <CriterioCard
        variable={variable}
        seleccion={SEL}
        facultades={[]}
        onSel={() => {}}
        onRango={() => {}}
        pendiente={false}
        onConfirmar={() => {}}
        onDescartar={() => {}}
      />,
    );
  }

  it("la tarjeta de un criterio de alumno trae el selector", () => {
    const html = tarjeta(NIVEL);
    expect(html).toContain("cmv2-crit-capa");
    expect(html).toContain("Dónde se aplica");
    expect(html).toContain('data-capa="instrumento"');
  });

  it("la tarjeta de un criterio de aula no lo trae", () => {
    // Control: si esto también lo trajera, el test de arriba no probaría que el
    // selector depende del scope.
    expect(tarjeta(TIPO_SESION)).not.toContain("cmv2-crit-capa");
  });
});
