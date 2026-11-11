import { describe, expect, it } from "vitest";
import type { Grupo, RespuestaUnica } from "../../../api/codificacion";
import {
  LISTA_ALTO_MAXIMO,
  LISTA_ANCHO_MINIMO,
  posicionDeLista,
  EDITOR_INICIAL,
  campoDeLaFila,
  claveActivaVigente,
  codigosDeTabla,
  elementosDeTabla,
  filaSiguienteSinCodigo,
  filaVecina,
  filasDeTabla,
  filtrarCodigos,
  intencionDeTecla,
  nombreDeCodigoNuevo,
  opcionesDeLista,
  plegar,
  reducirEditor,
  type ContextoDeTecla,
} from "./tablaCodificarModelo";

const respuesta = (texto: string, frecuencia: number, extra: Partial<RespuestaUnica> = {}): RespuestaUnica => ({
  texto_normalizado: plegar(texto),
  texto,
  variantes: 1,
  frecuencia,
  uuids: [],
  ...extra,
});

const RESPUESTAS = [
  respuesta("Menos colas en ventanilla", 3, { variantes: 3 }),
  respuesta("Que amplíen el horario", 2),
  respuesta("Atención los sábados", 1),
  respuesta("Ábaco", 1),
  respuesta("Más personal", 2),
];
const NO_RESPONDEN = [respuesta("Ninguno", 4), respuesta("No", 9)];

const GRUPOS: Grupo[] = [
  { id: "g1", codigo: "1", etiqueta: "Trato del personal", respuestas: [], origen: "nuevo" },
  { id: "g2", codigo: "2", etiqueta: "Tiempos de espera", respuestas: ["menos colas en ventanilla", "mas personal"], origen: "nuevo" },
  { id: "g3", codigo: "3", etiqueta: "Horarios de atención", respuestas: ["que amplien el horario", "menos colas en ventanilla"], origen: "nuevo" },
  { id: "g10", codigo: "10", etiqueta: "Información y orientación", respuestas: [], origen: "nuevo" },
  { id: "g11", codigo: "11", etiqueta: "Trámites por internet", respuestas: [], origen: "nuevo" },
];

const TRAMOS = { conContenido: RESPUESTAS, noRespuestas: NO_RESPONDEN };
const codigos = codigosDeTabla(GRUPOS, [...RESPUESTAS, ...NO_RESPONDEN]);
const filas = (orden: "frecuencia" | "alfabetico" = "frecuencia") => filasDeTabla(TRAMOS, GRUPOS, codigos, orden);
const textos = (fs: { texto: string }[]) => fs.map((f) => f.texto);
const ids = (cs: { id: string }[]) => cs.map((c) => c.id);

describe("códigos de la tabla", () => {
  it("cada grupo lleva su número, su nombre, el rótulo con punto y sus casos", () => {
    const tiempos = codigos.find((c) => c.id === "g2");
    expect(tiempos).toMatchObject({ codigo: "2", numero: "2", nombre: "Tiempos de espera", rotulo: "2. Tiempos de espera" });
    // Casos: las veces de sus respuestas (3 de "menos colas" y 2 de "más personal"), no los textos distintos.
    expect(tiempos?.casos).toBe(5);
    expect(codigos.find((c) => c.id === "g1")?.casos).toBe(0);
  });
});

describe("filas de la tabla", () => {
  it("hay una fila por texto distinto, con sus veces y sus variantes", () => {
    const fs = filas();
    expect(fs).toHaveLength(7);
    expect(fs.find((f) => f.clave === "menos colas en ventanilla")).toMatchObject({ veces: 3, variantes: 3, noResponde: false });
  });

  it("las más repetidas van primero y los empates se ordenan por texto", () => {
    expect(textos(filas("frecuencia").filter((f) => !f.noResponde))).toEqual([
      "Menos colas en ventanilla",
      "Más personal",
      "Que amplíen el horario",
      "Ábaco",
      "Atención los sábados",
    ]);
  });

  it("el orden alfabético no distingue tildes ni mayúsculas", () => {
    expect(textos(filas("alfabetico").filter((f) => !f.noResponde))).toEqual([
      "Ábaco",
      "Atención los sábados",
      "Más personal",
      "Menos colas en ventanilla",
      "Que amplíen el horario",
    ]);
  });

  it("las no respuestas van al final en su tramo, cada tramo con su orden", () => {
    expect(textos(filas("frecuencia")).slice(-2)).toEqual(["No", "Ninguno"]);
    expect(textos(filas("alfabetico")).slice(-2)).toEqual(["Ninguno", "No"]);
  });

  it("cada fila lleva todos sus códigos, en el orden del libro", () => {
    const colas = filas().find((f) => f.clave === "menos colas en ventanilla");
    expect(ids(colas?.codigos ?? [])).toEqual(["g2", "g3"]);
    expect(filas().find((f) => f.clave === "abaco")?.codigos).toEqual([]);
  });

  it("el separador de las no respuestas se intercala una vez, antes de la primera", () => {
    const elementos = elementosDeTabla(filas());
    expect(elementos.map((e) => e.tipo)).toEqual(["fila", "fila", "fila", "fila", "fila", "tramo", "fila", "fila"]);
    expect(elementos[5]).toEqual({ tipo: "tramo", n: 2 });
    expect(elementosDeTabla(filasDeTabla({ conContenido: RESPUESTAS, noRespuestas: [] }, GRUPOS, codigos, "frecuencia")).some((e) => e.tipo === "tramo")).toBe(false);
  });
});

describe("filtrar los códigos por lo que se escribe", () => {
  it("sin texto devuelve todos, en el orden del libro", () => {
    expect(ids(filtrarCodigos(codigos, "  "))).toEqual(["g1", "g2", "g3", "g10", "g11"]);
  });

  it("por número: el exacto va primero y siguen los que empiezan igual", () => {
    expect(ids(filtrarCodigos(codigos, "1"))).toEqual(["g1", "g10", "g11"]);
    expect(ids(filtrarCodigos(codigos, "10"))).toEqual(["g10"]);
    expect(ids(filtrarCodigos(codigos, "7"))).toEqual([]);
  });

  it("por parte del nombre, sin distinguir tildes ni mayúsculas", () => {
    expect(ids(filtrarCodigos(codigos, "ti"))).toEqual(["g2"]);
    expect(ids(filtrarCodigos(codigos, "TRAMITES"))).toEqual(["g11"]);
    expect(ids(filtrarCodigos(codigos, "atencion"))).toEqual(["g3"]);
    expect(ids(filtrarCodigos(codigos, "orientación"))).toEqual(["g10"]);
  });

  it("el nombre que empieza con lo escrito va antes que el que solo lo contiene", () => {
    // "tr" abre "Trato" y "Trámites"; no está dentro de ningún otro nombre.
    expect(ids(filtrarCodigos(codigos, "tr"))).toEqual(["g1", "g11"]);
    // "es" abre la palabra "espera" (g2) y solo va dentro de "trámites" (g11).
    expect(ids(filtrarCodigos(codigos, "es"))).toEqual(["g2", "g11"]);
    // "at" abre "atención" (g3) y solo va dentro de "trato" (g1): g3 pasa delante aunque en el libro vaya después.
    expect(ids(filtrarCodigos(codigos, "at"))).toEqual(["g3", "g1"]);
  });

  it("acepta el rótulo entero, con su punto", () => {
    expect(ids(filtrarCodigos(codigos, "2. tiem"))).toEqual(["g2"]);
  });
});

describe("crear un código con lo escrito", () => {
  it("propone el nombre con mayúscula inicial", () => {
    expect(nombreDeCodigoNuevo("  limpieza de  baños ", codigos)).toBe("Limpieza de baños");
  });

  it("no lo propone sin texto, con solo un número o si el nombre ya existe", () => {
    expect(nombreDeCodigoNuevo("", codigos)).toBeNull();
    expect(nombreDeCodigoNuevo("12", codigos)).toBeNull();
    expect(nombreDeCodigoNuevo("tiempos de ESPERA", codigos)).toBeNull();
  });
});

describe("opciones de la lista de una fila", () => {
  const fila = (clave: string) => {
    const f = filas().find((x) => x.clave === clave);
    if (!f) throw new Error(`sin fila ${clave}`);
    return f;
  };

  it("no ofrece los códigos que la fila ya tiene", () => {
    const opciones = opcionesDeLista(codigos, fila("menos colas en ventanilla"), "");
    expect(opciones.map((o) => (o.tipo === "codigo" ? o.codigo.id : "crear"))).toEqual(["g1", "g10", "g11"]);
  });

  it("al final ofrece crear un código con lo escrito, y solo cuando corresponde", () => {
    const con = opcionesDeLista(codigos, fila("abaco"), "tr");
    expect(con.map((o) => (o.tipo === "codigo" ? o.codigo.id : `crear:${o.nombre}`))).toEqual(["g1", "g11", "crear:Tr"]);
    expect(opcionesDeLista(codigos, fila("abaco"), "1").some((o) => o.tipo === "crear")).toBe(false);
    expect(opcionesDeLista(codigos, fila("abaco"), "9")).toEqual([]);
  });

  it("avisa cuando quien dio la respuesta ya había marcado ese código", () => {
    const marcada = filasDeTabla(
      { conContenido: [respuesta("Otro motivo", 2, { ya_marcadas: [{ codigo: "3", n: 2 }] })], noRespuestas: [] },
      GRUPOS,
      codigos,
      "frecuencia",
    )[0];
    const opciones = opcionesDeLista(codigos, marcada, "");
    const aviso = (id: string) => opciones.find((o) => o.tipo === "codigo" && o.codigo.id === id);
    expect(aviso("g3")).toMatchObject({ aviso: { todas: true, etiqueta: "ya marcada" } });
    expect(aviso("g2")).toMatchObject({ aviso: null });
  });
});

describe("a qué fila se pasa", () => {
  it("la vecina de arriba o de abajo, sin salirse de la tabla", () => {
    const fs = filas();
    expect(filaVecina(fs, fs[0].clave, 1)).toBe(fs[1].clave);
    expect(filaVecina(fs, fs[1].clave, -1)).toBe(fs[0].clave);
    expect(filaVecina(fs, fs[0].clave, -1)).toBe(fs[0].clave);
    expect(filaVecina(fs, fs[fs.length - 1].clave, 1)).toBe(fs[fs.length - 1].clave);
    expect(filaVecina([], null, 1)).toBeNull();
  });

  it("después de asignar, la siguiente sin código hacia abajo (salta las que ya tienen)", () => {
    // Orden: Menos colas (g2, g3), Más personal (g2), Que amplíen (g3), Ábaco, Atención, No, Ninguno.
    const fs = filas();
    expect(filaSiguienteSinCodigo(fs, "menos colas en ventanilla")).toBe("abaco");
    expect(filaSiguienteSinCodigo(fs, "abaco")).toBe("atencion los sabados");
  });

  it("si abajo no queda ninguna, vuelve a buscar desde arriba; si no hay otra, no se mueve", () => {
    const fs = filas();
    expect(filaSiguienteSinCodigo(fs, "ninguno")).toBe("abaco");
    const todasConCodigo = fs.map((f) => (f.clave === "abaco" ? f : { ...f, codigos: [codigos[0]] }));
    // "abaco" es la única sin código y es la propia fila: no cuenta.
    expect(filaSiguienteSinCodigo(todasConCodigo, "abaco")).toBeNull();
  });

  it("la fila activa propuesta es la primera sin código; la elegida vale mientras siga a la vista", () => {
    const fs = filas();
    expect(claveActivaVigente(fs, null)).toBe("abaco");
    expect(claveActivaVigente(fs, "que amplien el horario")).toBe("que amplien el horario");
    expect(claveActivaVigente(fs, "ya no esta")).toBe("abaco");
    expect(claveActivaVigente([], "abaco")).toBeNull();
    const conCodigo = fs.filter((f) => f.codigos.length > 0);
    expect(claveActivaVigente(conCodigo, null)).toBe(conCodigo[0].clave);
    // Sin la elegida a la vista vale la última que estuvo activa, antes que la primera sin código.
    expect(claveActivaVigente(fs, "ya no esta", "no")).toBe("no");
    expect(claveActivaVigente(fs, null, "tampoco esta")).toBe("abaco");
  });
});

describe("teclas del campo", () => {
  const ctx = (cambios: Partial<ContextoDeTecla> = {}): ContextoDeTecla => ({
    abierta: true,
    nOpciones: 2,
    texto: "ti",
    permiteVarios: false,
    nCodigos: 0,
    ...cambios,
  });
  const tecla = (key: string, extra: { shiftKey?: boolean; altKey?: boolean; repeat?: boolean } = {}) => ({
    key,
    shiftKey: false,
    altKey: false,
    ...extra,
  });

  it("Enter asigna la opción resaltada y baja", () => {
    expect(intencionDeTecla(tecla("Enter"), ctx())).toEqual({ tipo: "asignar", avanza: true });
  });

  it("Mayús y Enter suma otro código y se queda en la fila solo si la pregunta admite varios", () => {
    expect(intencionDeTecla(tecla("Enter", { shiftKey: true }), ctx({ permiteVarios: true }))).toEqual({ tipo: "asignar", avanza: false });
    // Sin varios códigos no hace nada: ni asigna ni cambia de fila.
    expect(intencionDeTecla(tecla("Enter", { shiftKey: true }), ctx({ permiteVarios: false }))).toBeNull();
    expect(intencionDeTecla(tecla("Enter", { shiftKey: true }), ctx({ permiteVarios: false, abierta: false, texto: "" }))).toBeNull();
  });

  it("Enter sin nada que asignar: con la lista vacía no hace nada; con el campo vacío baja una fila", () => {
    expect(intencionDeTecla(tecla("Enter"), ctx({ nOpciones: 0 }))).toBeNull();
    expect(intencionDeTecla(tecla("Enter"), ctx({ abierta: false, texto: "" }))).toEqual({ tipo: "mover-fila", paso: 1 });
    expect(intencionDeTecla(tecla("Enter"), ctx({ abierta: false, texto: "ti" }))).toEqual({ tipo: "abrir" });
  });

  it("las flechas cambian de fila con la lista cerrada y recorren las opciones con la lista abierta", () => {
    expect(intencionDeTecla(tecla("ArrowDown"), ctx({ abierta: false, texto: "" }))).toEqual({ tipo: "mover-fila", paso: 1 });
    expect(intencionDeTecla(tecla("ArrowUp"), ctx({ abierta: false, texto: "" }))).toEqual({ tipo: "mover-fila", paso: -1 });
    expect(intencionDeTecla(tecla("ArrowDown"), ctx())).toEqual({ tipo: "mover-cursor", paso: 1 });
    expect(intencionDeTecla(tecla("ArrowUp"), ctx())).toEqual({ tipo: "mover-cursor", paso: -1 });
    // Abierta pero sin opciones no hay nada que recorrer: cambia de fila.
    expect(intencionDeTecla(tecla("ArrowDown"), ctx({ nOpciones: 0 }))).toEqual({ tipo: "mover-fila", paso: 1 });
  });

  it("Alt y flecha abajo abre la lista entera; Alt y flecha arriba la cierra", () => {
    expect(intencionDeTecla(tecla("ArrowDown", { altKey: true }), ctx({ abierta: false, texto: "" }))).toEqual({ tipo: "abrir" });
    expect(intencionDeTecla(tecla("ArrowUp", { altKey: true }), ctx())).toEqual({ tipo: "cerrar" });
  });

  it("Escape cierra la lista; con la lista cerrada borra lo escrito; sin nada, no se queda la tecla", () => {
    expect(intencionDeTecla(tecla("Escape"), ctx())).toEqual({ tipo: "cerrar" });
    expect(intencionDeTecla(tecla("Escape"), ctx({ abierta: false }))).toEqual({ tipo: "limpiar" });
    expect(intencionDeTecla(tecla("Escape"), ctx({ abierta: false, texto: "" }))).toBeNull();
  });

  it("Retroceso con el campo vacío quita el último código, pero no al mantener la tecla ni si hay texto", () => {
    expect(intencionDeTecla(tecla("Backspace"), ctx({ abierta: false, texto: "", nCodigos: 2 }))).toEqual({ tipo: "quitar-ultimo" });
    expect(intencionDeTecla(tecla("Backspace", { repeat: true }), ctx({ abierta: false, texto: "", nCodigos: 2 }))).toBeNull();
    expect(intencionDeTecla(tecla("Backspace"), ctx({ texto: "t", nCodigos: 2 }))).toBeNull();
    expect(intencionDeTecla(tecla("Backspace"), ctx({ abierta: false, texto: "", nCodigos: 0 }))).toBeNull();
  });

  it("las demás teclas se dejan al campo", () => {
    expect(intencionDeTecla(tecla("a"), ctx())).toBeNull();
    expect(intencionDeTecla(tecla("Tab"), ctx())).toBeNull();
  });
});

describe("estado del campo", () => {
  it("escribir abre la lista y fija la fila; borrar todo la cierra", () => {
    const escrito = reducirEditor(EDITOR_INICIAL, { tipo: "escribir", clave: "abaco", texto: "ti" });
    expect(escrito).toEqual({ activa: "abaco", texto: "ti", abierta: true, cursor: 0 });
    expect(reducirEditor(escrito, { tipo: "escribir", clave: "abaco", texto: " " }).abierta).toBe(false);
  });

  it("escribir de nuevo devuelve el cursor a la primera opción", () => {
    const movido = reducirEditor({ activa: "abaco", texto: "t", abierta: true, cursor: 2 }, { tipo: "escribir", clave: "abaco", texto: "ti" });
    expect(movido.cursor).toBe(0);
  });

  it("activar una fila vacía el campo y cierra la lista", () => {
    const estado = reducirEditor({ activa: "abaco", texto: "ti", abierta: true, cursor: 1 }, { tipo: "activar", clave: "no" });
    expect(estado).toEqual({ activa: "no", texto: "", abierta: false, cursor: 0 });
  });

  it("cerrar conserva lo escrito y abrir en otra fila no arrastra el texto de la anterior", () => {
    const cerrada = reducirEditor({ activa: "abaco", texto: "ti", abierta: true, cursor: 1 }, { tipo: "cerrar" });
    expect(cerrada).toMatchObject({ texto: "ti", abierta: false });
    expect(reducirEditor(cerrada, { tipo: "abrir", clave: "abaco" })).toMatchObject({ activa: "abaco", texto: "ti", abierta: true });
    expect(reducirEditor(cerrada, { tipo: "abrir", clave: "no" })).toMatchObject({ activa: "no", texto: "", abierta: true });
  });

  it("lo escrito solo vale para la fila en que se escribió", () => {
    const estado = { activa: "abaco", texto: "ti", abierta: true, cursor: 0 };
    expect(campoDeLaFila(estado, "abaco")).toEqual({ texto: "ti", abierta: true });
    // La búsqueda dejó fuera a "abaco" y la tabla propone otra fila: su campo sale vacío.
    expect(campoDeLaFila(estado, "no")).toEqual({ texto: "", abierta: false });
    expect(campoDeLaFila(estado, null)).toEqual({ texto: "", abierta: false });
  });
});

describe("dónde va la lista de códigos", () => {
  const ventana = { ancho: 1440, alto: 1000 };
  // El campo de la celda de código: su borde derecho es el de la columna de la tabla.
  const campo = { left: 780, right: 1008, top: 632, bottom: 660, width: 228 };

  it("más ancha que el campo, crece hacia la izquierda y no pasa de su borde derecho", () => {
    const pos = posicionDeLista(campo, ventana);
    expect(pos.width).toBe(LISTA_ANCHO_MINIMO);
    expect(pos.left + pos.width).toBe(campo.right);
    expect(pos.left).toBeLessThan(campo.left);
  });

  it("con un campo más ancho que el mínimo, toma su ancho y su borde izquierdo", () => {
    const ancho = { left: 400, right: 800, top: 300, bottom: 328, width: 400 };
    expect(posicionDeLista(ancho, ventana)).toMatchObject({ left: 400, width: 400 });
  });

  it("no se sale por la izquierda de la ventana", () => {
    const pegado = { left: 20, right: 200, top: 300, bottom: 328, width: 180 };
    expect(posicionDeLista(pegado, ventana).left).toBe(8);
  });

  it("abre hacia abajo si cabe y hacia arriba si abajo no cabe", () => {
    expect(posicionDeLista(campo, ventana)).toMatchObject({ top: 664, maxHeight: LISTA_ALTO_MAXIMO - 4 });
    const alFinal = { left: 780, right: 1008, top: 894, bottom: 922, width: 228 };
    const arriba = posicionDeLista(alFinal, ventana);
    expect(arriba).toMatchObject({ bottom: 1000 - 894 + 4, maxHeight: LISTA_ALTO_MAXIMO - 4 });
    expect("top" in arriba).toBe(false);
  });

  it("con poco sitio arriba y abajo, limita el alto al lado elegido", () => {
    const bajo = { ancho: 1366, alto: 400 };
    const medio = { left: 700, right: 930, top: 150, bottom: 178, width: 230 };
    // Abajo quedan 214 px y arriba 142: va abajo, con lo que hay.
    expect(posicionDeLista(medio, bajo)).toMatchObject({ top: 182, maxHeight: 210 });
  });
});
