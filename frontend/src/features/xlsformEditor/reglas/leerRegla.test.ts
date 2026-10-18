import { describe, expect, test } from "vitest";
import type { LogicScope } from "../logic";
import type { BuilderNode, ChoiceItem } from "../types";
import { leerRegla } from "./leerRegla";
import { textoDePiezas, type ColumnaRegla } from "./piezas";

const items = (pares: [string, string][]): ChoiceItem[] => pares.map(([name, label], i) => ({ rowIndex: i, name, label }));

const scope: LogicScope = {
  variables: [
    { name: "edad", label: "Edad", baseType: "integer" },
    { name: "total", label: "Total de personas", baseType: "integer" },
    { name: "fecha_nac", label: "Fecha de nacimiento", baseType: "date" },
    { name: "pais", label: "País", baseType: "select_one", listName: "paises" },
    { name: "sexo", label: "Sexo", baseType: "select_one", listName: "sexo" },
    { name: "gasto", label: "En qué gastó", baseType: "select_multiple", listName: "rubros" },
    { name: "region", label: "Región", baseType: "select_one", listName: "regiones" },
    { name: "inicio", label: "Inicio", baseType: "start" },
    { name: "fin", label: "Fin", baseType: "end" },
  ],
  catalogsByListName: new Map([
    ["paises", { listName: "paises", items: items([["PER", "Perú"], ["CHL", "Chile"]]) }],
    ["sexo", { listName: "sexo", items: items([["1", "Hombre"], ["2", "Mujer"]]) }],
    ["rubros", { listName: "rubros", items: items([["1", "Comida"], ["2", "Renta"], ["98", "No sabe"], ["99", "Ninguno"]]) }],
    ["docs", { listName: "docs", items: items([["1", "Sin documentos"], ["2", "Pasaporte"], ["3", "Carné"]]) }],
  ]),
};

function nodo(name: string, base: string, listName = ""): BuilderNode {
  return { name, typeInfo: { raw: `${base} ${listName}`.trim(), base, listName } } as BuilderNode;
}

const leer = (columna: ColumnaRegla, raw: string, n: BuilderNode = nodo("p", "text")) => leerRegla(columna, raw, n, scope);
const texto = (columna: ColumnaRegla, raw: string, n?: BuilderNode) => {
  const l = leer(columna, raw, n);
  return l.tecnica ? "TÉCNICA" : textoDePiezas(l.piezas);
};

const fecha = nodo("fecha", "date");
const numero = nodo("n", "integer");
const corto = nodo("dni", "text");
const varias = nodo("gasto", "select_multiple", "rubros");

describe("M1 · la lectura es una frase en piezas", () => {
  test("cada ${x} es una pieza pregunta con su etiqueta; cada código de lista, una pieza opción", () => {
    const l = leer("relevant", "${pais} = 'PER' and ${edad} >= 18");
    expect(l.tecnica).toBe(false);
    expect(l.piezas).toContainEqual({ tipo: "pregunta", name: "pais", etiqueta: "País" });
    expect(l.piezas).toContainEqual({ tipo: "opcion", lista: "paises", valor: "PER", etiqueta: "Perú" });
    expect(l.piezas).toContainEqual({ tipo: "valor", texto: "18" });
    expect(textoDePiezas(l.piezas)).toBe("País es Perú y Edad es 18 o más");
  });
  test("depende sale del árbol, en orden y sin repetir; también si la regla es técnica", () => {
    expect(leer("relevant", "${edad} > 3 and ${pais} = 'PER' and ${edad} < 9").depende.map((d) => d.name)).toEqual(["edad", "pais"]);
    const tecnica = leer("calculation", "${edad} ? ${total}");
    expect(tecnica.tecnica).toBe(true);
    expect(tecnica.piezas).toEqual([]);
    expect(tecnica.depende).toEqual([{ name: "edad", etiqueta: "Edad" }, { name: "total", etiqueta: "Total de personas" }]);
  });
  test("lo que no se reconoce es técnico, nunca una frase inventada", () => {
    expect(leer("constraint", "REG02_Other_recod", varias).tecnica).toBe(true);
    expect(leer("calculation", "misterio(${edad})").tecnica).toBe(true);
  });
  test("required: sí/no y expresión", () => {
    expect(texto("required", "yes")).toBe("Obligatoria");
    expect(texto("required", "false")).toBe("Opcional");
    expect(texto("required", "${edad} >= 18")).toBe("Obligatoria si Edad es 18 o más");
  });
});

describe("M2 · normalizar antes de leer", () => {
  test("today() >= . se lee igual que . <= today()", () => {
    expect(texto("constraint", "today() >= .", fecha)).toBe("No acepta fechas futuras");
    expect(texto("constraint", ". <= today()", fecha)).toBe("No acepta fechas futuras");
  });
  test("18 <= ${edad} se lee igual que ${edad} >= 18", () => {
    expect(texto("relevant", "18 <= ${edad}")).toBe(texto("relevant", "${edad} >= 18"));
  });
  test("en una restricción, la propia pregunta escrita como ${x} es la respuesta", () => {
    expect(texto("constraint", "${edad} >= 18 and ${edad} <= 100", nodo("edad", "integer"))).toBe("De 18 a 100");
  });
  test("dos cotas sobre lo mismo son un rango, aunque una esté volteada", () => {
    expect(texto("constraint", "18 <= . and . <= 65", numero)).toBe("De 18 a 65");
    expect(texto("relevant", "${edad} >= 5 and ${edad} <= 17")).toBe("Edad está entre 5 y 17");
  });
  test("not(x = v) entra a la comparación", () => {
    expect(texto("relevant", "not(${sexo} = '1')")).toBe("Sexo no es Hombre");
    expect(texto("relevant", "not(selected(${gasto}, '1') or selected(${gasto}, '2'))")).toBe("En qué gastó no incluye Comida ni Renta");
  });
});

describe("M3 · vocabulario por tipo (los fallos medidos en la línea base)", () => {
  test("fechas", () => {
    expect(texto("constraint", ". < today()", fecha)).toBe("Solo fechas anteriores a hoy");
    expect(texto("constraint", ". >= ${fecha_nac}", fecha)).toBe("No puede ser anterior a Fecha de nacimiento");
    expect(texto("constraint", ". >= date('2026-01-01')", fecha)).toBe("No puede ser anterior a 1 de enero de 2026");
    expect(texto("constraint", ". = today()", fecha)).toBe("Solo la fecha de hoy");
    expect(texto("constraint", ". >= today() - 396 and . <= today()", fecha)).toBe("Desde hace 396 días hasta hoy");
    expect(texto("relevant", "${fecha_nac} < '2000-03-15'")).toBe("Fecha de nacimiento es anterior a 15 de marzo de 2000");
  });
  test("una fecha comparada con hoy se lee como fecha aunque la pregunta no sea date", () => {
    expect(texto("constraint", ". <= today()", nodo("x", "note"))).toBe("No acepta fechas futuras");
  });
  test("números", () => {
    expect(texto("constraint", ". >= 0", numero)).toBe("0 o más");
    expect(texto("constraint", ". > 0 and . < 24", numero)).toBe("Mayor que 0 y menor que 24");
    expect(texto("constraint", ". <= ${total}", numero)).toBe("No puede superar Total de personas");
    expect(texto("constraint", ". >= 0 and . <= ${total}", numero)).toBe("De 0 a Total de personas");
  });
  test("texto: caracteres", () => {
    expect(texto("constraint", "string-length(.) <= 9", corto)).toBe("Máximo 9 caracteres");
    expect(texto("constraint", "string-length(.) >= 9 and string-length(.) <= 9", corto)).toBe("Exactamente 9 caracteres");
    expect(texto("constraint", "string-length(.) >= 1 and string-length(.) <= 5000", corto)).toBe("De 1 a 5000 caracteres");
  });
  test("selección múltiple: opciones", () => {
    expect(texto("constraint", "count-selected(.) <= 3", varias)).toBe("Máximo 3 opciones");
    expect(texto("constraint", "count-selected(.) >= 1", varias)).toBe("Al menos 1 opción");
    expect(texto("constraint", "not(selected(., '99') and count-selected(.) > 1)", varias)).toBe("Ninguno no se puede marcar junto con otras opciones");
    expect(texto("constraint", "not(count-selected(.) > 1 and (selected(., '98') or selected(., '99')))", varias)).toBe("No sabe y Ninguno no se pueden marcar junto con otras opciones");
    expect(texto("constraint", "not(selected(., '98') and count-selected(.) > 1) and not(selected(., '99') and count-selected(.) > 1)", varias)).toBe("No sabe y Ninguno no se pueden marcar junto con otras opciones");
  });
  test("selección única: la opción por su etiqueta", () => {
    expect(texto("constraint", ". != '1'", nodo("sexo", "select_one", "sexo"))).toBe("No acepta Hombre");
    expect(texto("constraint", ". = 2", nodo("s", "select_one", "sexo"))).toBe("Solo acepta Mujer");
  });
  test("patrones regex leídos por estructura, no por texto fijo", () => {
    expect(texto("constraint", "regex(., '^[0-9]{8}$')", corto)).toBe("Solo acepta 8 dígitos");
    expect(texto("constraint", "regex(., '^[0-9]{2}[/][0-9]{4}$')", corto)).toBe("Solo acepta el formato 99/9999");
    expect(texto("constraint", "regex(., '^(1[89]|[2-9][0-9])$')", corto)).toBe("Solo acepta un número de 18 a 99");
    expect(texto("constraint", "regex(., '^(MVH|MVV)[0-9]{4}$')", corto)).toBe("Solo acepta el formato MVH9999 o MVV9999");
    expect(texto("constraint", "regex(., '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')", corto)).toBe("Solo acepta un correo electrónico");
  });
});

describe("M4 · filtros de opciones", () => {
  const cascada = nodo("distrito", "select_one", "distritos");
  test("<columna> = ${pregunta} → coincide con la respuesta", () => {
    const l = leer("choice_filter", "filter_District= ${region}", cascada);
    expect(textoDePiezas(l.piezas)).toBe("Muestra las opciones cuya columna filter_District coincide con la respuesta de Región");
    expect(l.lista).toBe("distritos");
    expect(l.depende).toEqual([{ name: "region", etiqueta: "Región" }]);
  });
  test("con la pregunta a la izquierda se lee igual", () => {
    expect(texto("choice_filter", "${region} = filter_District", cascada)).toBe(texto("choice_filter", "filter_District = ${region}", cascada));
  });
  test("selected(<columna>, ${pregunta}) → la columna incluye la respuesta (forma compacta)", () => {
    expect(texto("choice_filter", "selected(filter_region, ${region})", cascada)).toBe("Muestra las opciones cuya columna filter_region incluye la respuesta de Región");
  });
  test("selected(${pregunta}, <columna>) → marcada en la pregunta", () => {
    expect(texto("choice_filter", "selected(${gasto},filter_Spent)", cascada)).toBe("Muestra las opciones cuya columna filter_Spent está marcada en En qué gastó");
  });
  test("<columna> = literal", () => {
    expect(texto("choice_filter", "REF05CO= 'pp'", cascada)).toBe("Muestra siempre las mismas opciones: las marcadas con pp en la columna REF05CO");
  });
  test("name = … usa las etiquetas de la propia lista y la condición sin columna va al final", () => {
    const doc = nodo("doc", "select_one", "docs");
    expect(texto("choice_filter", "(${pais} = 'PER' and (name = '1' or name = '3'))", doc)).toBe("Muestra solo las opciones Sin documentos y Carné cuando País es Perú");
  });
  test("varias columnas contra la misma pregunta se agrupan; un or mixto se enumera", () => {
    expect(texto("choice_filter", "f1 = ${region} or f2 = ${region}", cascada)).toBe("Muestra las opciones cuya columna f1 o f2 coincide con la respuesta de Región");
    expect(texto("choice_filter", "f1 = ${region} or f2 = ${pais} or name = '0'", cascada)).toBe("Muestra las opciones cuya columna f1 coincide con Región, cuya columna f2 coincide con País o la opción 0");
  });
  test("una forma no reconocida es técnica pero trae lista y depende", () => {
    const l = leer("choice_filter", "contains(filtro, ${region})", cascada);
    expect(l.tecnica).toBe(true);
    expect(l.lista).toBe("distritos");
    expect(l.depende.map((d) => d.name)).toEqual(["region"]);
  });
});

describe("M5 · restricciones del corpus que caían en técnica", () => {
  const unica = nodo("p17", "select_one", "sexo");
  test("if(cond, regla, true()) se lee como regla condicional", () => {
    expect(texto("constraint", "if(${sexo} = '2', . = '2', true())", unica)).toBe("Si Sexo es Mujer, solo acepta Mujer");
    expect(texto("constraint", "if(. = '1', ${sexo} != '1', true())", unica)).toBe("Si la respuesta es Hombre, Sexo no puede ser Hombre");
  });
  test("if con dos ramas", () => {
    expect(texto("constraint", "if(selected(., '1'), count-selected(.) = 1, count-selected(.) >= 1)", varias)).toBe("Si la respuesta incluye Comida, exactamente 1 opción. Si no, al menos 1 opción");
  });
  test("las partes que no tocan la respuesta son condición", () => {
    expect(texto("constraint", ". >= 0 and (${edad} >= 6 or ${edad} = 0)", numero)).toBe("0 o más, solo si Edad es 6 o más o es 0");
  });
  test("varias exclusiones se juntan", () => {
    expect(texto("constraint", ". != ${edad} and . != ${total}", numero)).toBe("No puede ser igual a Edad ni Total de personas");
  });
  test("un caso por oración cuando cada rama trae su condición", () => {
    expect(texto("constraint", "(${sexo} = '1' and . = '1') or (${sexo} = '2' and . >= 2)", numero)).toBe("Si Sexo es Hombre, solo acepta 1. Si Sexo es Mujer, 2 o más");
  });
  test("comillas tipográficas: se lee el sentido y se avisa", () => {
    expect(texto("constraint", "not(count-selected(.) > 1 and selected(., ‘99’))", varias)).toBe("Ninguno no se puede marcar junto con otras opciones (con comillas tipográficas: ODK no las acepta)");
  });
  test("el aviso de comillas también llega en `avisos`; sin comillas no hay avisos", () => {
    expect(leerRegla("constraint", "not(count-selected(.) > 1 and selected(., ‘99’))", varias, scope).avisos).toEqual([expect.stringContaining("comillas tipográficas")]);
    expect(leerRegla("constraint", ". >= 0", numero, scope).avisos).toBeUndefined();
  });
});

describe("cálculos y condiciones", () => {
  test("if encadenado, sin punto y coma", () => {
    expect(texto("calculation", "if(${edad} < 30, 'joven', if(${edad} < 60, 'adulto', 'mayor'))")).toBe("Si Edad es menor que 30, vale «joven». Si Edad es menor que 60, vale «adulto». Si no, vale «mayor»");
  });
  test("aritmética con paréntesis donde cambian el sentido", () => {
    expect(texto("calculation", "${edad} - (${total} * 12)")).toBe("Edad menos (Total de personas por 12)");
    expect(texto("calculation", "${edad} + ${total}")).toBe("La suma de Edad y Total de personas");
  });
  test("duraciones", () => {
    expect(texto("calculation", "int((decimal-date-time(${fin}) - decimal-date-time(${inicio})) * 24 * 60)")).toBe("Los minutos entre Inicio y Fin");
  });
  test("mismo sujeto con varios valores se agrupa", () => {
    expect(texto("relevant", "${sexo} = '1' or ${sexo} = '2'")).toBe("Sexo es Hombre o Mujer");
    expect(texto("relevant", "(${sexo} = '1' or ${sexo} = '2') or ${pais} = 'PER'")).toBe("Sexo es Hombre o Mujer, o País es Perú");
  });
  test("vocabulario del motor con mayúscula, datos no", () => {
    expect(texto("calculation", "once(today())")).toBe("Hoy (se guarda la primera vez y no cambia)");
  });
});

describe("redondeos", () => {
  test("una operación redondeada lleva paréntesis", () => {
    expect(texto("calculation", "round((${edad} div ${total}) * 100, 1)")).toBe("((Edad entre Total de personas) por 100) redondeado a 1 decimal");
  });
});

describe("G1 · patrones que el corpus variado destapó", () => {
  const scopeG1: LogicScope = {
    variables: [
      { name: "nacio", label: "Nacimiento", baseType: "date" },
      { name: "ingreso", label: "Ingreso mensual", baseType: "decimal" },
      { name: "cod", label: "Código de tienda", baseType: "text" },
      { name: "cod", label: "Código de almacén", baseType: "text" },
    ],
    catalogsByListName: new Map(),
  };
  const g1 = (columna: ColumnaRegla, raw: string, n: BuilderNode = corto) => {
    const l = leerRegla(columna, raw, n, scopeG1);
    return l.tecnica ? "TÉCNICA" : textoDePiezas(l.piezas);
  };

  test("un patrón con un lenguaje enorme no agota la memoria: se lee por su forma", () => {
    expect(g1("constraint", "regex(., '^[A-Z]{3}-\\d{3,4}$')")).toBe("Solo acepta el formato AAA-999 o AAA-9999");
    expect(g1("constraint", "regex(., '^[a-z]{6}[0-9]{6}$')")).toBe("Solo acepta 6 letras minúsculas y 6 dígitos");
  });

  test("una resta de fechas son días, no una fecha; dividida entre 365.25, años", () => {
    expect(g1("relevant", "(today() - ${nacio}) >= 365 * 18")).toBe("Han pasado al menos 6,570 días (18 años) desde Nacimiento");
    expect(g1("calculation", "int((today() - ${nacio}) div 365.25)")).toBe("Los años cumplidos desde Nacimiento");
    expect(g1("calculation", "int((decimal-date-time(today()) - decimal-date-time(${nacio})) div 365.25)")).toBe("Los años cumplidos desde Nacimiento");
    expect(g1("relevant", "int((today() - ${nacio}) div 365.25) < 65")).toBe("Han pasado menos de 65 años desde Nacimiento");
    // Sin forma de lapso, la precedencia se respeta con paréntesis.
    expect(g1("calculation", "(today() - ${ingreso}) div 2")).toBe("(hoy menos Ingreso mensual) entre 2");
  });

  test("dentro de un «o» no hay «solo acepta» por alternativa", () => {
    expect(g1("constraint", "(. > 0 and . <= 98) or . = 99", numero)).toBe("Mayor que 0 y hasta 98, o 99");
    expect(g1("constraint", "regex(., '^[A-Z]{2}-[0-9]{2}$') or . = ''")).toBe("El formato AA-99 o vacía");
    expect(g1("constraint", "string-length(.) = 0 or regex(., '^[0-9]+$')")).toBe("Vacía o solo números");
    expect(g1("constraint", ". = 1 or . = 5", numero)).toBe("Solo acepta 1 o 5");
  });

  test("una cota proporcional a otra pregunta se lee como múltiplo", () => {
    expect(g1("constraint", ". <= ${ingreso} * 2", numero)).toBe("No puede superar el doble de Ingreso mensual");
    expect(g1("constraint", ". <= 3 * ${ingreso}", numero)).toBe("No puede superar el triple de Ingreso mensual");
    expect(g1("constraint", ". <= ${ingreso} * 1.5", numero)).toBe("No puede superar Ingreso mensual × 1.5");
  });

  test("una clase de solo mayúsculas se ilustra en mayúscula", () => {
    expect(g1("constraint", "regex(., '^[A-Z]{2}-[0-9]{2}$')")).toBe("Solo acepta el formato AA-99");
    expect(g1("constraint", "regex(., '^[a-z]{2}[0-9]$')")).toBe("Solo acepta 2 letras minúsculas y 1 dígito");
  });

  test("un código repetido en el survey se avisa, no se resuelve en silencio", () => {
    const l = leerRegla("relevant", "${cod} != ''", corto, scopeG1);
    expect(l.avisos).toEqual(["Hay dos preguntas con el código cod: la regla no dice a cuál se refiere."]);
    expect(leerRegla("relevant", "${ingreso} > 0", corto, scopeG1).avisos).toBeUndefined();
  });

  test("clases negadas, \\s y \\w se traducen", () => {
    expect(g1("constraint", "regex(., '^[^0-9]*$')")).toBe("No acepta números");
    expect(g1("constraint", "regex(., '^[A-Za-zÁÉÍÓÚáéíóúÑñ\\s]{2,60}$')")).toBe("Solo acepta de 2 a 60 letras con tildes y espacios");
    expect(g1("constraint", "regex(., '^\\w{4,12}$')")).toBe("Solo acepta de 4 a 12 letras o dígitos");
    expect(g1("constraint", "not(regex(., '\\s'))")).toBe("Sin espacios");
    expect(g1("constraint", "not(regex(., '[0-9]'))")).toBe("Sin números");
  });
});

describe("G2 · lecturas que pide el armador de patrones", () => {
  const g2 = (raw: string) => texto("constraint", raw, corto);

  test("dígitos con un prefijo fijo: «9 dígitos que empiezan con 9»", () => {
    expect(g2("regex(., '^9[0-9]{8}$')")).toBe("Solo acepta 9 dígitos que empiezan con 9");
    expect(g2("regex(., '^(?:10|20)[0-9]{9}$')")).toBe("Solo acepta 11 dígitos que empiezan con 10 o 20");
  });

  test("un rango de horas se lee como hora, no como formato", () => {
    expect(g2("regex(., '^(?:[0-1][0-9]|2[0-3]):[0-5][0-9]$')")).toBe("Solo acepta una hora de 00:00 a 23:59");
    expect(g2("regex(., '^(0[8-9]|1[0-7]):[0-5][0-9]$')")).toBe("Solo acepta una hora de 08:00 a 17:59");
  });

  test("letras con tildes y espacios, sin «una o más»", () => {
    expect(g2("regex(., '^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]+$')")).toBe("Solo acepta letras con tildes y espacios");
    expect(g2("regex(., '^[A-Za-z]+$')")).toBe("Solo acepta letras");
    expect(g2("regex(., '^[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,4}$')")).toBe("Solo acepta de 2 a 4 letras con tildes");
    expect(g2("regex(., '^[A-Z]{3}$')")).toBe("Solo acepta 3 letras mayúsculas");
  });

  test("un formato mixto de largo fijo se lee por partes", () => {
    expect(g2("regex(., '^[A-Z]{2}[0-9]{4}$')")).toBe("Solo acepta 2 letras mayúsculas y 4 dígitos");
  });

  test("dígitos parciales se ilustran como 9 y el ejemplo no se repite", () => {
    expect(g2("regex(., '^[0-5][0-9]/[0-9]{2}$')")).toBe("Solo acepta el formato 99/99");
    expect(g2("regex(., '^(A|A)[0-9]-[0-9]{2}$')")).toBe("Solo acepta el formato A9-99");
  });
});
