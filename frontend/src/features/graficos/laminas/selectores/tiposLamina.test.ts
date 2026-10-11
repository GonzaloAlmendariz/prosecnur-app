// Cobertura de los 33 tipos del registro (F6.2; inventario F6, fila 1: «12 de 33 tipos no insertables»):
// - `SlideType` y los mapas del editor conocen todos los tipos de `.SLIDES_META`, con los slots que el registro declara;
// - ningún tipo del selector queda sin intención y la población antigua queda fuera;
// - cada tipo tiene composición dibujable;
// - las variantes se leen y escriben donde el motor las busca.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SlideType } from "../../../../api/graficos";
import { CATALOGO_LAMINAS } from "../../iconos/catalogoTipos.generated";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { composicionDe } from "../../iconos/composicion";
import { tieneDibujoEstructura } from "../../iconos/dibujosEstructura";
import { payloadPorDefecto, SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "../../store";
import { isInsertableSlideType } from "../../v2/timeline/SlidePicker";
import { conVariante, INTENCIONES, intencionDe, rotuloRanuras, TIPOS_FUERA_DEL_SELECTOR, varianteDe, VARIANTES_LAMINA, variantesDe } from "./tiposLamina";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const nombres = CATALOGO_LAMINAS.map((s) => s.name);

/** Slots con `role = "chart"` de cada lámina en `.SLIDES_META` (graficos_metadata.R), en su orden de declaración. */
function slotsDelRegistro(): Record<string, string[]> {
  const fuente = fs.readFileSync(path.join(RAIZ, "api/R/graficos_metadata.R"), "utf8");
  const desde = fuente.indexOf(".SLIDES_META <- list(");
  const hasta = fuente.indexOf(".SLIDES_META <- lapply(");
  const bloque = fuente.slice(desde, hasta);
  const inicios = [...bloque.matchAll(/\n  (p_slide_\w+) = list\(/g)];
  return Object.fromEntries(inicios.map((m, i) => {
    const cuerpo = bloque.slice(m.index, inicios[i + 1]?.index ?? bloque.length);
    return [m[1], [...cuerpo.matchAll(/\n\s+(\w+) = list\(role = "chart"/g)].map((x) => x[1])];
  }));
}

describe("los 33 tipos del registro", () => {
  it("el registro tiene 33 tipos y el catálogo versionado los lista todos", () => {
    const registro = slotsDelRegistro();
    expect(Object.keys(registro)).toHaveLength(33);
    expect([...nombres].sort()).toEqual(Object.keys(registro).sort());
  });

  it("SlideType, nombres, slots y payload por defecto cubren exactamente los tipos del registro", () => {
    expect(Object.keys(SLIDE_LABELS).sort()).toEqual([...nombres].sort());
    expect(Object.keys(SLIDE_GRAF_SLOTS).sort()).toEqual([...nombres].sort());
    for (const t of nombres) {
      expect(isInsertableSlideType(t), t).toBe(true);
      expect(typeof payloadPorDefecto(t as SlideType), t).toBe("object");
    }
  });

  it("los slots de gráfico de cada tipo son los que el registro declara con rol de gráfico", () => {
    const registro = slotsDelRegistro();
    for (const t of nombres) {
      expect([...SLIDE_GRAF_SLOTS[t as SlideType]].sort(), t).toEqual([...registro[t]].sort());
    }
  });

  it("el payload por defecto nace con cada slot de gráfico vacío", () => {
    for (const t of nombres as SlideType[]) {
      const p = payloadPorDefecto(t);
      for (const slot of SLIDE_GRAF_SLOTS[t]) expect(p[slot], `${t}.${slot}`).toBeNull();
    }
  });

  it("ningún tipo del selector queda sin intención; los retirados no se ofrecen", () => {
    const ofrecidos = CATALOGO_LAMINAS.filter((s) => s.en_selector).map((s) => s.name as SlideType);
    expect(ofrecidos.filter((t) => intencionDe(t) === null)).toEqual([]);
    const retirados = CATALOGO_LAMINAS.filter((s) => !s.en_selector).map((s) => s.name as SlideType);
    expect([...retirados].sort()).toEqual([...TIPOS_FUERA_DEL_SELECTOR].sort());
    for (const t of retirados) expect(intencionDe(t), t).toBeNull();
  });

  it("cada tipo aparece en una sola intención", () => {
    const todos = INTENCIONES.flatMap((i) => i.tipos);
    expect(new Set(todos).size).toBe(todos.length);
    expect(todos.length + TIPOS_FUERA_DEL_SELECTOR.size).toBe(33);
  });

  it("cada tipo tiene composición dibujable: ranuras del estándar o dibujo de estructura", () => {
    for (const t of nombres as SlideType[]) {
      const comp = composicionDe(t, SLIDE_GRAF_SLOTS[t]);
      expect(comp.fuente !== "estructura" || tieneDibujoEstructura(t), t).toBe(true);
    }
  });

  it("rotula cuántos gráficos y cifras admite", () => {
    expect(rotuloRanuras("p_slide_1_grafico")).toBe("1 gráfico");
    expect(rotuloRanuras("p_slide_cifras_y_graficos")).toBe("2 gráficos y 3 cifras");
    expect(rotuloRanuras("p_slide_portada")).toBe("Sin gráficos");
  });
});

describe("variantes", () => {
  it("portada, índice y separador viven en meta; la de por defecto borra la clave", () => {
    const portada = { tipo: "p_slide_portada" as const, payload: { titulo: "Informe" } };
    expect(varianteDe(portada)).toBe("centrada");
    const banda = conVariante(portada, "banda");
    expect(banda).toEqual({ titulo: "Informe", meta: { variante: "banda" } });
    expect(varianteDe({ tipo: "p_slide_portada", payload: banda })).toBe("banda");
    expect(conVariante({ tipo: "p_slide_portada", payload: banda }, "centrada")).toEqual({ titulo: "Informe" });

    const indice = conVariante({ tipo: "p_slide_indice", payload: {} }, "facetas");
    expect(indice).toEqual({ meta: { composicion: "facetas" } });
    const sub = conVariante({ tipo: "p_slide_seccion", payload: { meta: { antetitulo: "X" } } }, "subcapitulo");
    expect(sub).toEqual({ meta: { antetitulo: "X", nivel: "subcapitulo" } });
  });

  it("el cierre la guarda en su arg `variante`, como lo declara el registro", () => {
    const cierre = { tipo: "p_slide_cierre" as const, payload: payloadPorDefecto("p_slide_cierre") };
    expect(varianteDe(cierre)).toBe("contraportada");
    expect(conVariante(cierre, "tres_columnas")).toMatchObject({ variante: "tres_columnas" });
  });

  it("un valor desconocido se lee como el de por defecto; un tipo sin variantes no las tiene", () => {
    expect(varianteDe({ tipo: "p_slide_portada", payload: { meta: { variante: "otra" } } })).toBe("centrada");
    expect(varianteDe({ tipo: "p_slide_1_grafico", payload: {} })).toBeNull();
    expect(variantesDe("p_slide_1_grafico")).toBeNull();
  });

  it("toma las etiquetas del registro cuando las declara", () => {
    const v = variantesDe("p_slide_cierre", [{ value: "contraportada", label: "Contacto al pie (65)" }]);
    expect(v?.opciones).toEqual([{ valor: "contraportada", label: "Contacto al pie (65)", detalle: "Lámina 65 del recetario" }]);
  });

  it("toda variante declarada incluye la de por defecto y tiene un dibujo distinto de las demás", () => {
    for (const [tipo, v] of Object.entries(VARIANTES_LAMINA)) {
      if (!v) continue;
      expect(v.opciones.some((o) => o.valor === v.defecto), tipo).toBe(true);
      const dibujos = v.opciones.map((o) => renderToStaticMarkup(createElement(ComposicionLamina, { tipo, slots: [], variante: o.valor }))
        .replace(/data-composicion-variante="[^"]*"/, ""));
      expect(new Set(dibujos).size, tipo).toBe(v.opciones.length);
    }
  });
});
