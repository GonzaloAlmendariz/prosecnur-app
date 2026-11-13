// @vitest-environment happy-dom
// Ítem 9 del checklist del practicante: el selector de pregunta del panel de
// regla (228 preguntas) no dejaba buscar y en una batería cortaba el rótulo
// justo antes del ítem.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ExploradorVariable } from "../../types";
import { CampoPregunta } from "./CampoPregunta";
import { filtrarPreguntas, normalizarBusqueda, partesDePreguntas } from "./modeloPregunta";

const v = (name: string, label: string, tipo: ExploradorVariable["tipo"] = "so"): ExploradorVariable =>
  ({ name, label, tipo, n_validos: 1, n_nulos: 0 });

const ENUNCIADO = "P7. A continuación, te presentamos algunos enunciados sobre tus amigos(as).";
const VARIABLES: ExploradorVariable[] = [
  v("p1_region", "P1. Lugar de nacimiento - Región", "texto"),
  v("p3", "P3. Edad", "num"),
  v("p7_1", `${ENUNCIADO} 1. Puedo compartir mis ideas con ellos/as`),
  v("p7_2", `${ENUNCIADO} 2. Puedo contarles como me siento`),
  v("p7_3", `${ENUNCIADO} 3. Puedo acudir a ellos/as si tengo un problema`),
  v("p10", "P10. ¿Con quiénes vives?", "sm"),
  ...Array.from({ length: 222 }, (_, i) => v(`q${i + 20}`, `Pregunta de relleno ${i + 20}`)),
];

describe("modelo", () => {
  test("en una batería el ítem va aparte del enunciado común", () => {
    const partes = partesDePreguntas(VARIABLES);
    expect(partes.get("p7_2")).toEqual({ texto: "2. Puedo contarles como me siento", enunciado: ENUNCIADO });
    expect(partes.get("p7_1")?.texto).toBe("1. Puedo compartir mis ideas con ellos/as");
    expect(partes.get("p3")).toEqual({ texto: "P3. Edad", enunciado: null });
    expect(partes.get("p1_region")).toEqual({ texto: "P1. Lugar de nacimiento - Región", enunciado: null });
    const lugar = partesDePreguntas([v("a", "P1. Lugar de nacimiento - Región"), v("b", "P1. Lugar de nacimiento - Provincia")]);
    expect(lugar.get("a")).toEqual({ texto: "Región", enunciado: "P1. Lugar de nacimiento" });
  });

  test("busca por código y por texto, sin distinguir tildes ni mayúsculas", () => {
    expect(filtrarPreguntas(VARIABLES, "p7_3").map((x) => x.name)).toEqual(["p7_3"]);
    expect(filtrarPreguntas(VARIABLES, "region").map((x) => x.name)).toEqual(["p1_region"]);
    expect(filtrarPreguntas(VARIABLES, "acudir problema").map((x) => x.name)).toEqual(["p7_3"]);
    expect(filtrarPreguntas(VARIABLES, "QUIÉNES").map((x) => x.name)).toEqual(["p10"]);
    // El código exacto primero, aunque otro rótulo lo nombre antes.
    expect(filtrarPreguntas([v("p30", "Igual que p3"), v("p3", "Edad")], "p3").map((x) => x.name)).toEqual(["p3", "p30"]);
    expect(normalizarBusqueda("Región")).toBe("region");
  });
});

describe("selector", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function montar(valor = "", onCambio = vi.fn()) {
    act(() => root.render(<CampoPregunta variables={VARIABLES} valor={valor} onCambio={onCambio} ariaLabel="Pregunta 1" />));
    return onCambio;
  }

  const disparador = () => host.querySelector<HTMLButtonElement>("button[aria-haspopup='listbox']")!;
  const campo = () => host.querySelector<HTMLInputElement>("input[role='combobox']");
  const opciones = () => Array.from(host.querySelectorAll<HTMLElement>("[role='option']"));
  const escribir = (texto: string) => {
    const input = campo()!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, texto);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const tecla = (el: Element, key: string) =>
    act(() => {
      el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });

  test("abre con un campo de búsqueda que filtra las 228 preguntas por texto y elige con Enter", () => {
    const onCambio = montar();
    act(() => disparador().click());
    expect(campo()).not.toBeNull();
    expect(opciones()).toHaveLength(228);
    escribir("compartir");
    expect(opciones().map((o) => o.textContent)).toEqual([`p7_11. Puedo compartir mis ideas con ellos/as${ENUNCIADO}`]);
    tecla(campo()!, "Enter");
    expect(onCambio).toHaveBeenCalledWith("p7_1");
    expect(campo()).toBeNull();
  });

  test("teclear sobre el disparador abre la búsqueda con esa letra", () => {
    montar();
    act(() => disparador().focus());
    tecla(disparador(), "p");
    expect(campo()?.value).toBe("p");
  });

  test("en una batería el disparador muestra el ítem, no el enunciado cortado", () => {
    montar("p7_2");
    expect(disparador().textContent).toContain("2. Puedo contarles como me siento");
    expect(disparador().textContent).not.toContain("A continuación");
    expect(disparador().getAttribute("aria-label")).toBe("Pregunta 1");
    expect(disparador().getAttribute("title")).toContain("p7_2");
  });

  test("Escape cierra la lista sin llegar al panel que la contiene", () => {
    montar();
    const alPanel = vi.fn();
    document.addEventListener("keydown", alPanel, true);
    act(() => disparador().click());
    tecla(campo()!, "Escape");
    document.removeEventListener("keydown", alPanel, true);
    expect(campo()).toBeNull();
    expect(alPanel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(disparador());
  });

  test("una pregunta guardada que ya no está en la base se sigue viendo", () => {
    montar("p99");
    expect(disparador().textContent).toContain("p99");
    expect(disparador().textContent).toContain("No está en esta base");
    act(() => disparador().click());
    expect(opciones()[0].textContent).toContain("No está en esta base");
    escribir("zzz");
    expect(host.textContent).toContain("Ninguna pregunta coincide con \"zzz\"");
  });

  test("ítem 45.3: dos preguntas con el mismo texto, o una sin texto, se distinguen por su código en el disparador", () => {
    const lugar = [
      v("p1_2", "P1. Lugar de nacimiento - Provincia", "texto"),
      v("p1_3", "P1. Lugar de nacimiento - Distrito", "texto"),
      v("distrito", "Distrito", "texto"),
      v("columna_sin_etiqueta", "", "texto"),
    ];
    const montarCon = (valor: string) => {
      act(() => root.render(<CampoPregunta variables={lugar} valor={valor} onCambio={vi.fn()} ariaLabel="Pregunta 1" />));
      return disparador();
    };
    const codigoVisible = (b: HTMLElement) => b.querySelector("code")?.classList.contains("is-a-la-vista");
    const repetida = montarCon("p1_3");
    expect(codigoVisible(repetida)).toBe(true);
    expect(repetida.textContent).toContain("p1_3");
    expect(repetida.textContent).toContain("Distrito (P1. Lugar de nacimiento)");
    const sinTexto = montarCon("columna_sin_etiqueta");
    expect(codigoVisible(sinTexto)).toBe(true);
    expect(sinTexto.textContent).toContain("columna_sin_etiqueta");
    // Una etiqueta que se lee igual que el código de una columna sin etiqueta también lleva su código.
    const sinEtiqueta = [v("p1_2", "P1. Lugar de nacimiento - Provincia", "texto"), v("p1_3", "P1. Lugar de nacimiento - Distrito", "texto"), v("distrito", "", "texto")];
    act(() => root.render(<CampoPregunta variables={sinEtiqueta} valor="p1_3" onCambio={vi.fn()} ariaLabel="Pregunta 1" />));
    expect(codigoVisible(disparador())).toBe(true);
    // Una pregunta con texto propio y único no repite su código.
    act(() => root.render(<CampoPregunta variables={lugar} valor="p1_2" onCambio={vi.fn()} ariaLabel="Pregunta 1" />));
    expect(codigoVisible(montarCon("p1_2"))).toBeFalsy();
  });
});
