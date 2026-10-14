// La ficha de «¿Qué lámina?» habla como analista: una sola frase (sin repetir la idea), el tamaño del texto en
// palabras, ninguna medida del motor y un botón que dice qué hace con la palabra «composición».
import { describe, expect, it } from "vitest";
import { ESTANDAR_LAMINAS } from "../../iconos/estandarLaminas.generated";
import { etiquetaBoton, fraseDetalle, tamanoTexto, usoDeTarjeta } from "./detalleLamina";
import { INTENCIONES } from "./tiposLamina";
import { nombreLamina } from "./etiquetas";

const base = { cambio: null, variantes: null, variante: null, varianteActual: null, confirmando: false } as const;

describe("fraseDetalle", () => {
  it("una sola frase: manda el uso del estándar y no se le pega la descripción del registro", () => {
    const frase = fraseDetalle("La lámina estándar: una pregunta, un gráfico", "Lámina estándar con un solo gráfico grande al centro.");
    expect(frase).toBe("La lámina estándar: una pregunta, un gráfico.");
  });

  it("sin uso, la descripción; si habla del ícono del público, nada", () => {
    expect(fraseDetalle(undefined, "Contraportada del informe.")).toBe("Contraportada del informe.");
    expect(fraseDetalle("", "Grid 3×2 con ícono central.")).toBe("");
  });
});

describe("usoDeTarjeta", () => {
  it("cada composición del selector tiene una línea corta, sin «ícono», que cabe en dos renglones", () => {
    for (const t of INTENCIONES.flatMap((i) => i.tipos)) {
      const uso = usoDeTarjeta(t, ESTANDAR_LAMINAS[t]?.uso, undefined);
      expect(uso, t).not.toBe("");
      if (t.includes("graficos")) expect(uso, t).not.toMatch(/[íi]cono/i);
      expect(uso.length, t).toBeLessThanOrEqual(56);
    }
  });

  it("sin uso propio, recorta la descripción a su primera frase", () => {
    expect(usoDeTarjeta("p_slide_texto", undefined, "Sólo texto. Útil para conclusiones.")).toBe("Sólo texto");
  });
});

describe("tamanoTexto", () => {
  it("traduce el rótulo de la familia a palabras", () => {
    expect(tamanoTexto({ rotulo_pt: 12 })).toBe("Estándar");
    expect(tamanoTexto({ rotulo_pt: 11.5 })).toBe("Reducido");
    expect(tamanoTexto({ rotulo_pt: 10.5 })).toBe("Pequeño");
    expect(tamanoTexto(null)).toBeNull();
  });
});

describe("etiquetaBoton", () => {
  it("dice qué hace con la palabra de la columna", () => {
    expect(etiquetaBoton({ ...base, modo: "insertar" })).toEqual({ texto: "Insertar esta composición", deshabilitado: false });
    expect(etiquetaBoton({ ...base, modo: "cambiar", cambio: { mismoTipo: false, sobrantes: [] } }))
      .toEqual({ texto: "Usar esta composición", deshabilitado: false });
    expect(etiquetaBoton({ ...base, modo: "cambiar", cambio: { mismoTipo: true, sobrantes: [] } }))
      .toEqual({ texto: "Es la composición actual", deshabilitado: true });
  });

  it("con variantes, distingue la actual de otra; al confirmar, cuenta lo que se quita", () => {
    const variantes = { donde: { en: "payload", clave: "variante" }, label: "X", defecto: "a", opciones: [] } as const;
    const mismo = { ...base, modo: "cambiar", cambio: { mismoTipo: true, sobrantes: [] }, variantes, varianteActual: "a" } as const;
    expect(etiquetaBoton({ ...mismo, variante: "a" })).toEqual({ texto: "Es la variante actual", deshabilitado: true });
    expect(etiquetaBoton({ ...mismo, variante: "b" })).toEqual({ texto: "Usar esta variante", deshabilitado: false });
    expect(etiquetaBoton({ ...base, modo: "cambiar", confirmando: true, cambio: { mismoTipo: false, sobrantes: [1, 2] } }).texto)
      .toBe("Cambiar y quitar 2 gráficos");
  });
});

describe("nombres sin ícono", () => {
  it("las de población se nombran por su reparto aunque el registro diga «+ ícono»", () => {
    expect(nombreLamina("p_slide_6_graficos_poblacion", { titulo_humano: "Seis gráficos + ícono" } as never)).toBe("Seis gráficos");
    // El objetivo sí lleva su ícono (la diana): la regla es de las láminas de varios gráficos.
    for (const t of INTENCIONES.flatMap((i) => i.tipos).filter((x) => x.includes("graficos"))) {
      expect(nombreLamina(t), t).not.toMatch(/[íi]cono/i);
    }
  });
});

import { rotuloVariable } from "./etiquetas";
describe("la variable del gráfico sin la referencia cruda", () => {
  it("«estudiantes$ciclo» se lee «ciclo (estudiantes)»", () => {
    expect(rotuloVariable("estudiantes$ciclo")).toBe("ciclo (estudiantes)");
    expect(rotuloVariable("p12")).toBe("p12");
  });
});
