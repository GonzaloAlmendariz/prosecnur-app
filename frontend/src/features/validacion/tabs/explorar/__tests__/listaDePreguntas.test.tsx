// @vitest-environment happy-dom
// Ítem 38: la lista "Preguntas" de Explorar con buscador tras la lupa,
// secciones en su contenedor y plegables.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ExploradorSeccion } from "../../../types";
import AccionesDeLaLista from "../AccionesDeLaLista";
import ListaDePreguntas from "../ListaDePreguntas";
import {
  calzaConLaBusqueda,
  conteoDeLasCoincidencias,
  plegadasAlComprimir,
  rotuloDeSeccion,
  seccionesVisibles,
  todasAbiertas,
} from "../listaDePreguntasModelo";
import { useListaDePreguntasStore } from "../listaDePreguntasStore";

const SECCIONES: ExploradorSeccion[] = [
  {
    nombre: "General",
    variables: [{ name: "sexo", label: "Sexo", tipo: "so", n_validos: 10, n_nulos: 0 }],
  },
  {
    nombre: "seccion_D_7",
    variables: [
      { name: "p7_region", label: "Región de nacimiento", tipo: "so", n_validos: 8, n_nulos: 2 },
      { name: "p7_edad", label: "Edad al llegar", tipo: "num", n_validos: 10, n_nulos: 0 },
    ],
  },
  {
    nombre: "pag3",
    etiqueta: "Datos del hogar",
    variables: [{ name: "p9_miembros", label: "Miembros del hogar", tipo: "num", n_validos: 10, n_nulos: 0 }],
  } as ExploradorSeccion,
];

describe("modelo de la lista", () => {
  test("la búsqueda ignora tildes y mayúsculas y pide cada palabra", () => {
    expect(calzaConLaBusqueda({ name: "p7_region", label: "Región de nacimiento" }, "REGION")).toBe(true);
    expect(calzaConLaBusqueda({ name: "p7_region", label: "Región de nacimiento" }, "p7 nacim")).toBe(true);
    expect(calzaConLaBusqueda({ name: "p7_region", label: "Región de nacimiento" }, "region hogar")).toBe(false);
    expect(seccionesVisibles(SECCIONES, "edad", "todas").map((s) => s.nombre)).toEqual(["seccion_D_7"]);
    expect(seccionesVisibles(SECCIONES, "", "num").map((s) => s.variables.length)).toEqual([1, 1]);
  });

  test("los chips cuentan las coincidencias de la búsqueda, no las de toda la base (ítem 45.11)", () => {
    expect(conteoDeLasCoincidencias(SECCIONES, "")).toMatchObject({ todas: 4, so: 2, num: 2 });
    expect(conteoDeLasCoincidencias(SECCIONES, "edad")).toMatchObject({ todas: 1, so: 0, num: 1 });
    expect(conteoDeLasCoincidencias(SECCIONES, "zzz")).toMatchObject({ todas: 0, num: 0 });
  });

  test("el rótulo usa el del formulario; sin él, el identificador discreto", () => {
    expect(rotuloDeSeccion(SECCIONES[2])).toEqual({ texto: "Datos del hogar", esIdentificador: false });
    expect(rotuloDeSeccion(SECCIONES[1])).toEqual({ texto: "seccion_D_7", esIdentificador: true });
    expect(rotuloDeSeccion(SECCIONES[0])).toEqual({ texto: "Sin sección", esIdentificador: false });
  });

  test("comprimir todas deja abierta la sección de la pregunta elegida", () => {
    expect(plegadasAlComprimir(SECCIONES, "p7_edad")).toEqual(["General", "pag3"]);
    expect(todasAbiertas(SECCIONES, [])).toBe(true);
    expect(todasAbiertas(SECCIONES, ["pag3"])).toBe(false);
  });
});

describe("render de la lista", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useListaDePreguntasStore.setState({ porBase: {} });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = "";
  });

  const montar = (elegida: string | null = null) =>
    act(() =>
      root.render(
        <>
          <AccionesDeLaLista base="b" secciones={SECCIONES} elegida={elegida} />
          <ListaDePreguntas base="b" secciones={SECCIONES} elegida={elegida} onElegir={vi.fn()} />
        </>,
      ),
    );
  const encabezados = () => Array.from(host.querySelectorAll<HTMLButtonElement>(".vx-preguntas-grupo > button"));
  const boton = (nombre: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${nombre}"]`)!;
  const escribir = (texto: string) => {
    const campo = host.querySelector<HTMLInputElement>("input[type='search']")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(campo, texto);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  test("cada sección es un contenedor plegable con su rótulo y su conteo", () => {
    montar();
    const cabs = encabezados();
    expect(cabs.map((b) => b.textContent)).toEqual(["Sin sección1 pregunta", "seccion_D_72 preguntas", "Datos del hogar1 pregunta"]);
    expect(cabs.every((b) => b.getAttribute("aria-expanded") === "true")).toBe(true);
    expect(host.querySelector("code.vx-preguntas-grupo-nombre.is-id")?.textContent).toBe("seccion_D_7");
    act(() => cabs[1].click());
    expect(cabs[1].getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(cabs[1].getAttribute("aria-controls")!)?.hidden).toBe(true);
    expect(host.querySelector("[data-qa-geometry-group='validacion/explorar-secciones']")?.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
  });

  test("comprimir y expandir todas; la sección de la elegida queda abierta", () => {
    montar("p7_edad");
    act(() => boton("Comprimir todas").click());
    expect(encabezados().map((b) => b.getAttribute("aria-expanded"))).toEqual(["false", "true", "false"]);
    act(() => boton("Expandir todas").click());
    expect(encabezados().every((b) => b.getAttribute("aria-expanded") === "true")).toBe(true);
  });

  test("la lupa abre el buscador; buscar abre las secciones con coincidencias y cuenta", () => {
    montar();
    expect(host.querySelector("input[type='search']")).toBeNull();
    act(() => boton("Comprimir todas").click());
    act(() => boton("Buscar preguntas").click());
    expect(boton("Buscar preguntas").getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(host.querySelector("input[type='search']"));
    escribir("region");
    expect(encabezados().map((b) => [b.textContent, b.getAttribute("aria-expanded")])).toEqual([["seccion_D_71 pregunta", "true"]]);
    expect(host.querySelector(".vx-busca-conteo")?.textContent).toBe("1 coincidencia");
    escribir("zzz");
    expect(host.querySelector(".vx-barra-nota")?.textContent).toBe('Ninguna pregunta coincide con "zzz".');
  });

  test("Escape cierra el buscador, borra lo escrito y devuelve el foco a la lupa", () => {
    montar();
    act(() => boton("Buscar preguntas").click());
    escribir("edad");
    const campo = host.querySelector<HTMLInputElement>("input[type='search']")!;
    act(() => {
      campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(host.querySelector("input[type='search']")).toBeNull();
    expect(encabezados()).toHaveLength(3);
    expect(document.activeElement).toBe(boton("Buscar preguntas"));
  });

  test("elegir una pregunta de una sección plegada la abre", () => {
    montar();
    act(() => boton("Comprimir todas").click());
    expect(encabezados()[2].getAttribute("aria-expanded")).toBe("false");
    montar("p9_miembros");
    expect(encabezados()[2].getAttribute("aria-expanded")).toBe("true");
  });
});
