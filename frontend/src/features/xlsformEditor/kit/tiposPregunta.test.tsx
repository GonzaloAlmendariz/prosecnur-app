// El kit de tipos de pregunta (M8): cada tipo del catálogo tiene nombre, ícono y una maqueta propia, distinta de la
// de cualquier otro tipo. Mata: un tipo nuevo sin dibujo (caería en la caja genérica), dos tipos con la misma
// maqueta (dejaría de ser un código de identidad) o un juego de íconos paralelo que no lea del catálogo.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MaquetaTipo } from "./MaquetaTipo";
import { TIPOS_PREGUNTA, tipoPregunta } from "./tiposPregunta";
import { iconForType } from "../helpers/icons";
import { typeLabel } from "../parsing/parseType";

const dibujo = (base: string) => renderToStaticMarkup(<MaquetaTipo baseType={base} />);

describe("kit de tipos de pregunta", () => {
  it("cada tipo tiene una maqueta propia, distinta de la genérica y de las demás", () => {
    const generica = dibujo("tipo_inventado");
    const vistos = new Map<string, string>();
    for (const t of TIPOS_PREGUNTA) {
      const d = dibujo(t.base);
      expect(d, t.base).not.toBe(generica);
      expect(vistos.get(d), `${t.base} repite la maqueta de ${vistos.get(d)}`).toBeUndefined();
      vistos.set(d, t.base);
    }
  });
  it("nombre e ícono salen del catálogo en todo el editor", () => {
    for (const t of TIPOS_PREGUNTA) {
      expect(typeLabel(t.base)).toBe(t.nombre);
      expect(iconForType(t.base)).toBe(t.icono);
    }
    expect(tipoPregunta("select_one_from_file").base).toBe("select_one");
    expect(tipoPregunta("tipo_inventado").familia).toBe("otro");
  });
});
