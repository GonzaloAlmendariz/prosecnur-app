import { describe, expect, test } from "vitest";
import { textoDePiezas } from "../../reglas/piezas";
import {
  FORMATOS,
  bloquesDesdePatron,
  constraintDe,
  cuerpoDeConstraint,
  cuerpoRegex,
  estadoInicial,
  lecturaDe,
  nuevoBloque,
  probar,
  rangoRegex,
  reducirArmador,
  type Bloque,
} from "./armadorModelo";

const formato = (id: string) => FORMATOS.find((f) => f.id === id)!.bloques();
const lectura = (bs: Bloque[]) => {
  const f = lecturaDe(bs);
  return f ? textoDePiezas(f) : null;
};
const sinId = (bs: Bloque[]) => bs.map(({ id: _id, ...resto }) => resto);

describe("armador · la frase sale del lector de reglas", () => {
  test("cada formato de la galería se lee", () => {
    expect(lectura(formato("dni"))).toBe("8 dígitos");
    expect(lectura(formato("cel"))).toBe("9 dígitos que empiezan con 9");
    expect(lectura(formato("ruc"))).toBe("11 dígitos que empiezan con 10 o 20");
    expect(lectura(formato("hora"))).toBe("una hora de 00:00 a 23:59");
    expect(lectura(formato("anio"))).toBe("4 dígitos");
    expect(lectura(formato("correo"))).toBe("un correo electrónico");
    expect(lectura(formato("letras"))).toBe("letras con tildes y espacios");
    expect(lectura(formato("codigo"))).toBe("2 letras mayúsculas y 4 dígitos");
    expect(lectura(formato("postal"))).toBe("5 dígitos");
  });

  test("sin partes no hay frase", () => {
    expect(lecturaDe([])).toBeNull();
  });
});

describe("armador · regex", () => {
  test("rangos de ancho fijo", () => {
    expect(rangoRegex(0, 23)).toBe("(?:[0-1][0-9]|2[0-3])");
    expect(rangoRegex(0, 59)).toBe("[0-5][0-9]");
    expect(rangoRegex(8, 17)).toBe("(?:0[8-9]|1[0-7])");
  });

  test("la constraint es regex(., '^…$') y se lee de vuelta", () => {
    const c = constraintDe(cuerpoRegex(formato("cel")));
    expect(c).toBe("regex(., '^9[0-9]{8}$')");
    expect(cuerpoDeConstraint(c)).toBe("9[0-9]{8}");
    expect(cuerpoDeConstraint("regex(., '^[0-9]{8}$') and . != ''")).toBeNull();
  });

  test("cada formato vuelve a sus bloques", () => {
    for (const f of FORMATOS) {
      const r = bloquesDesdePatron(cuerpoRegex(f.bloques()));
      expect(r?.formato).toBe(f.id);
      expect(sinId(r!.bloques)).toEqual(sinId(f.bloques()));
    }
  });

  test("un patrón armado a mano se reconoce por partes", () => {
    const r = bloquesDesdePatron("[A-Z]{3}-(?:[0-1][0-9]|2[0-3])(?:-)?[0-9]{2,4}");
    expect(r?.bloques.map((b) => b.tipo)).toEqual(["letras", "fijo", "digitos", "opcional", "digitos"]);
    expect(r?.bloques[2]).toMatchObject({ modo: "rango", desde: 0, hasta: 23 });
    expect(r?.bloques[4]).toMatchObject({ modo: "entre", min: 2, max: 4 });
  });

  test("separadores fijos entre partes", () => {
    const partes = (cuerpo: string) => bloquesDesdePatron(cuerpo)?.bloques.map((b) => [b.tipo, b.texto || b.opciones || b.n]);
    expect(partes("[0-9]{2}/[0-9]{4}")).toEqual([["digitos", 2], ["fijo", "/"], ["digitos", 4]]);
    expect(partes("[A-Z]{2}-[0-9]{2}")).toEqual([["letras", 2], ["fijo", "-"], ["digitos", 2]]);
    expect(partes("MV[HV][0-9]{4}")).toEqual([["lista", "MVH, MVV"], ["digitos", 4]]);
  });

  test("[0-9] y \\d dan lo mismo, y el separador escapado también", () => {
    const sinIds = (cuerpo: string) => sinId(bloquesDesdePatron(cuerpo)!.bloques);
    expect(sinIds("\\d{2}/\\d{4}")).toEqual(sinIds("[0-9]{2}/[0-9]{4}"));
    expect(sinIds("[0-9]{2}\\/[0-9]{4}")).toEqual(sinIds("[0-9]{2}/[0-9]{4}"));
    expect(sinIds("[A-Z]{2}\\-\\d{2}")).toEqual(sinIds("[A-Z]{2}-[0-9]{2}"));
    expect(estadoInicial("regex(., '^MV[HV]\\d{4}$')").reemplaza).toBe(false);
  });

  test("lo que no sabe escribir no se reinterpreta", () => {
    expect(bloquesDesdePatron("[^@\\s]+@[^@\\s]+")).toBeNull();
    expect(bloquesDesdePatron("a|b")).toBeNull();
    expect(bloquesDesdePatron("\\w{4}")).toBeNull();
  });
});

describe("armador · prueba", () => {
  test("el que pasa trae sus tramos", () => {
    const r = probar(formato("hora"), "08:30");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tramos.map((t) => t.texto)).toEqual(["08", ":", "30"]);
  });

  test("motivos cortos", () => {
    const motivo = (bs: Bloque[], s: string) => {
      const r = probar(bs, s);
      return r.ok ? null : r.motivo;
    };
    expect(motivo(formato("dni"), "4587123")).toBe("falta 1 dígito");
    expect(motivo(formato("hora"), "24:00")).toBe("24 no es una hora");
    expect(motivo(formato("codigo"), "ab1234")).toBe("van en mayúscula");
    expect(motivo(formato("cel"), "887654321")).toBe("no empieza con 9");
    expect(motivo(formato("dni"), "458712361")).toBe("sobra 1");
    expect(motivo(formato("letras"), "María 2")).toBe("«2» no es una letra");
  });
});

describe("armador · estado", () => {
  test("una constraint que entiende abre con sus bloques", () => {
    const e = estadoInicial("regex(., '^[0-9]{8}$')");
    expect(e.formato).toBe("dni");
    expect(e.reemplaza).toBe(false);
  });

  test("una constraint ajena abre vacía y avisa que se reemplaza", () => {
    const e = estadoInicial(". > 0");
    expect(e.bloques).toEqual([]);
    expect(e.reemplaza).toBe(true);
    expect(estadoInicial("").reemplaza).toBe(false);
  });

  test("editar suelta el formato elegido", () => {
    let e = reducirArmador(estadoInicial(""), { tipo: "formato", id: "dni" });
    expect(e.formato).toBe("dni");
    e = reducirArmador(e, { tipo: "agregar", bloque: nuevoBloque("fijo", { texto: "-" }) });
    expect(e.formato).toBeNull();
    expect(cuerpoRegex(e.bloques)).toBe("[0-9]{8}-");
    e = reducirArmador(e, { tipo: "mover", id: e.bloques[1]!.id, delta: -1 });
    expect(cuerpoRegex(e.bloques)).toBe("-[0-9]{8}");
  });
});
