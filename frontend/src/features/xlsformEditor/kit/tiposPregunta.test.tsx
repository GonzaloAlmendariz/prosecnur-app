// El kit de tipos de pregunta (M8 → «Señales», 2026-10-17): cada tipo del catálogo tiene nombre, familia con tono
// propio y un glifo único que se pinta como sello. Mata: un tipo nuevo sin glifo (caería en el signo de pregunta),
// dos tipos con la misma silueta (dejaría de ser un código de identidad), dos familias con el mismo tono o una
// fachada (TypeIcon, MaquetaTipo, iconForType) que pinte otra cosa que el sello.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MaquetaTipo } from "./MaquetaTipo";
import { Sello } from "./Sello";
import { TypeIcon } from "./TypeIcon";
import { GLIFOS_TIPO } from "./glifosTipo";
import { TIPOS_PREGUNTA, TONO_FAMILIA, tipoPregunta, type FamiliaTipo } from "./tiposPregunta";
import { iconForType } from "../helpers/icons";
import { typeLabel } from "../parsing/parseType";

describe("kit de tipos de pregunta", () => {
  it("cada tipo tiene un glifo propio, distinto de los demás", () => {
    const vistos = new Map<string, string>();
    for (const t of TIPOS_PREGUNTA) {
      const g = GLIFOS_TIPO[t.base];
      expect(g, `${t.base} sin glifo`).toBeDefined();
      const firma = JSON.stringify(g);
      expect(vistos.get(firma), `${t.base} repite el glifo de ${vistos.get(firma)}`).toBeUndefined();
      vistos.set(firma, t.base);
    }
    expect(Object.keys(GLIFOS_TIPO).sort()).toEqual(TIPOS_PREGUNTA.map((t) => t.base).sort());
  });

  it("familias de la propuesta: rank en opciones, oculto en cálculo, confirmación en nota, sección y repetición aparte", () => {
    expect(tipoPregunta("rank").familia).toBe("opciones");
    expect(tipoPregunta("hidden").familia).toBe("calculo");
    expect(tipoPregunta("acknowledge").familia).toBe("nota");
    expect(tipoPregunta("begin_group").familia).toBe("seccion");
    expect(tipoPregunta("end_group").familia).toBe("seccion");
    expect(tipoPregunta("begin_repeat").familia).toBe("repeticion");
    expect(tipoPregunta("end_repeat").familia).toBe("repeticion");
  });

  it("cada familia tiene su token y nunca dos familias comparten tono", () => {
    const familias = Object.keys(TONO_FAMILIA).filter((f) => f !== "otro") as FamiliaTipo[];
    const tonos = familias.map((f) => TONO_FAMILIA[f]);
    expect(new Set(tonos).size).toBe(tonos.length);
    for (const t of tonos) expect(t).toMatch(/^var\(--pulso-tipo-[a-z]+\)$/);
  });

  it("el sello pinta la silueta sobre el color de su familia; el cierre va en suave", () => {
    const abre = renderToStaticMarkup(<Sello baseType="begin_group" size={22} />);
    const cierra = renderToStaticMarkup(<Sello baseType="end_group" size={22} />);
    expect(abre).toContain("--xfk-c:var(--pulso-tipo-seccion)");
    expect(abre).not.toContain("is-cierre");
    expect(cierra).toContain("is-cierre");
    expect(cierra).toContain("--xfk-c:var(--pulso-tipo-seccion)");
    expect(renderToStaticMarkup(<Sello baseType="end_repeat" />)).toContain("is-cierre");
    expect(renderToStaticMarkup(<Sello baseType="tipo_inventado" />)).toContain('data-familia="otro"');
  });

  it("las fachadas pintan el sello: TypeIcon, MaquetaTipo e iconForType", () => {
    expect(renderToStaticMarkup(<TypeIcon baseType="integer" size={14} />)).toMatch(/class="xfk-sello[^"]*" width="18" height="18"/);
    expect(renderToStaticMarkup(<TypeIcon baseType="integer" boxed />)).toContain('width="22"');
    const maqueta = renderToStaticMarkup(<MaquetaTipo baseType="date" ancho={54} />);
    expect(maqueta).toContain('class="xfk-maqueta" width="54" height="36"');
    expect(maqueta).toContain('data-tipo="date"');
    const Icon = iconForType("select_one");
    expect(iconForType("select_one")).toBe(Icon);
    expect(iconForType("select_one_from_file")).toBe(Icon);
    expect(renderToStaticMarkup(<Icon size={16} />)).toContain('data-tipo="select_one"');
  });

  it("el nombre sale del catálogo en todo el editor", () => {
    for (const t of TIPOS_PREGUNTA) expect(typeLabel(t.base)).toBe(t.nombre);
    expect(tipoPregunta("select_one_from_file").base).toBe("select_one");
    expect(tipoPregunta("tipo_inventado").familia).toBe("otro");
  });
});
