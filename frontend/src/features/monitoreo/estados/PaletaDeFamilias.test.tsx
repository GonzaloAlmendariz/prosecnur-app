import { isValidElement, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ACREDITACION_ORDEN_FAMILIAS, acreditacionEtiquetaDeFamilia } from "./familiasDeLlamada";
import type { AcreditacionFamiliaLlamada } from "./familiasDeLlamada";
import { PaletaDeFamilias } from "./PaletaDeFamilias";

const COLORES: Record<AcreditacionFamiliaLlamada, string> = Object.fromEntries(
  ACREDITACION_ORDEN_FAMILIAS.map((familia, indice) => [familia, `#10203${indice}`]),
) as Record<AcreditacionFamiliaLlamada, string>;

type PropsDeInput = { type?: string; "aria-label"?: string; onChange?: (event: ChangeEvent<HTMLInputElement>) => void };

function inputsDe(nodo: ReactNode): ReactElement<PropsDeInput>[] {
  if (Array.isArray(nodo)) return nodo.flatMap(inputsDe);
  if (!isValidElement<PropsDeInput & { children?: ReactNode }>(nodo)) return [];
  const propios = nodo.type === "input" ? [nodo] : [];
  return [...propios, ...inputsDe(nodo.props.children)];
}

describe("editor del color de cada familia", () => {
  const html = renderToStaticMarkup(<PaletaDeFamilias colorDe={(familia) => COLORES[familia]} colorear={() => undefined} />);

  it("cada familia tiene su selector de color con nombre accesible", () => {
    for (const familia of ACREDITACION_ORDEN_FAMILIAS) {
      const etiqueta = acreditacionEtiquetaDeFamilia(familia);
      expect(html).toContain(`aria-label="Color de ${etiqueta}"`);
      expect(html).toContain(`value="${COLORES[familia]}"`);
    }
    expect(html.match(/type="color"/g)).toHaveLength(ACREDITACION_ORDEN_FAMILIAS.length);
  });

  it("el input vive dentro de la fila, que es la que se pulsa", () => {
    const filas = html.match(/<label class="mon-paleta-fila"[\s\S]*?<\/label>/g) ?? [];
    expect(filas).toHaveLength(ACREDITACION_ORDEN_FAMILIAS.length);
    for (const fila of filas) expect(fila).toMatch(/<input type="color"/);
  });

  it("cambiar el color de una fila lo guarda en su familia", () => {
    const llamadas: Array<[AcreditacionFamiliaLlamada, string]> = [];
    const arbol = PaletaDeFamilias({ colorDe: (familia) => COLORES[familia], colorear: (familia, color) => { llamadas.push([familia, color]); } });
    const inputs = inputsDe(arbol);
    expect(inputs).toHaveLength(ACREDITACION_ORDEN_FAMILIAS.length);
    const segunda = ACREDITACION_ORDEN_FAMILIAS[1];
    inputs[1].props.onChange?.({ currentTarget: { value: "#abcdef" } } as ChangeEvent<HTMLInputElement>);
    expect(llamadas).toEqual([[segunda, "#abcdef"]]);
  });
});
