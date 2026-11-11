// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { SessionState } from "../../../api/core";
import type { EstudioBase, EstudioPayload } from "../../../api/estudio";

const api = vi.hoisted(() => ({
  apiEstudioGet: vi.fn(),
  apiEstudioActiveBaseSet: vi.fn(),
}));
const sesion = vi.hoisted(() => ({
  state: null as SessionState | null,
  refresh: vi.fn(async () => undefined),
}));

vi.mock("../../../api/estudio", () => api);
vi.mock("../../../lib/SessionContext", () => ({
  useSession: () => ({ state: sesion.state, refresh: sesion.refresh }),
}));

const { default: EstadoDelEstudioPage } = await import("./EstadoDelEstudioPage");

function base(parcial: Partial<EstudioBase> & { nombre: string }): EstudioBase {
  return {
    xlsform_file_id: "x",
    data_file_id: "d",
    data_ext: "xlsx",
    n_filas: 100,
    n_columnas: 20,
    added_at: "2026-11-01",
    status: { imported: true },
    ...parcial,
  };
}

function estudio(bases: EstudioBase[], activa: string | null): EstudioPayload {
  return {
    nombre: "Estudio",
    active_base: activa,
    n_bases: bases.length,
    bases: Object.fromEntries(bases.map((b) => [b.nombre, b])),
    max_bases: 16,
  };
}

const TRES = [
  base({ nombre: "docentes", source_alias: "Docentes", source_kind: "surveymonkey", n_filas: 115, n_columnas: 48, status: { imported: true, validacion: true, codificacion: true, codificacion_adaptada: true, analitica: true, graficos: true } }),
  base({ nombre: "egresados", source_alias: "Egresados", source_kind: "manual", n_filas: 1, n_columnas: 1, status: { imported: true, validacion: true } }),
  base({ nombre: "estudiantes", source_alias: "Estudiantes", source_kind: "kobo_api", n_filas: 1283, n_columnas: 61 }),
];

function Ubicacion() {
  const { pathname } = useLocation();
  return <output data-testid="ruta">{pathname}</output>;
}

describe("Estado del estudio", () => {
  let contenedor: HTMLDivElement;
  let raiz: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    api.apiEstudioGet.mockReset();
    api.apiEstudioActiveBaseSet.mockReset();
    sesion.refresh.mockClear();
    sesion.state = { xlsform: true, data: true, n_bases: 3 } as SessionState;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    contenedor.remove();
  });

  async function montar() {
    await act(async () => {
      raiz.render(
        <MemoryRouter initialEntries={["/procesamiento"]}>
          <EstadoDelEstudioPage />
          <Ubicacion />
        </MemoryRouter>,
      );
    });
  }
  const filas = () => Array.from(contenedor.querySelectorAll<HTMLElement>(".pulso-estado-base"));
  const boton = (texto: string) =>
    Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent?.trim() === texto);
  const marca = () => contenedor.querySelector("[data-audit-ready]")?.getAttribute("data-audit-ready");

  test("mientras el estudio se lee la marca vale false; al llegar, nombra la vista", async () => {
    let entregar: (valor: EstudioPayload) => void = () => undefined;
    api.apiEstudioGet.mockReturnValue(new Promise<EstudioPayload>((ok) => { entregar = ok; }));
    await montar();
    expect(marca()).toBe("false");
    expect(contenedor.querySelector(".pulso-estado-base")).toBeNull();
    expect(contenedor.textContent).toContain("Cargando las bases del estudio");

    await act(async () => entregar(estudio([base({ nombre: "default" })], "default")));
    expect(marca()).toBe("procesamiento-estado");
    expect(filas()).toHaveLength(1);
  });

  test("sin sesión leída no afirma qué sigue", async () => {
    sesion.state = null;
    api.apiEstudioGet.mockResolvedValue(estudio([base({ nombre: "default" })], "default"));
    await montar();
    expect(marca()).toBe("false");
    expect(contenedor.textContent).not.toContain("Cargar el formulario");
    expect(contenedor.textContent).toContain("Cargando el estado del estudio");
  });

  test("con una sola base no hay botón para activar ni marca de base activa", async () => {
    api.apiEstudioGet.mockResolvedValue(estudio([base({ nombre: "default", n_filas: 293, n_columnas: 61 })], "default"));
    await montar();
    expect(filas()).toHaveLength(1);
    expect(boton("Activar")).toBeUndefined();
    expect(contenedor.querySelector(".pulso-estado-base-accion")).toBeNull();
    expect(filas()[0].hasAttribute("data-activa")).toBe(false);
    expect(contenedor.textContent).not.toContain("Activa");
    const texto = filas()[0].textContent ?? "";
    expect(texto).toContain("Base única");
    expect(texto).toContain("Archivo");
    expect(texto).toContain("293 filas");
    expect(texto).toContain("61 columnas");
  });

  test("cada fila muestra el estado que el motor da de ESA base, también las no activas", async () => {
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    const estados = filas().map((fila) =>
      Array.from(fila.querySelectorAll(".pulso-estado-chip-rotulo")).map((n) => n.textContent),
    );
    expect(estados).toEqual([
      ["Cargada", "Iniciada", "Aplicada", "Iniciada", "Con informe"],
      ["Cargada", "Iniciada", "Por iniciar", "Por iniciar", "Sin informe"],
      ["Cargada", "Por iniciar", "Por iniciar", "Por iniciar", "Sin informe"],
    ]);
    // Origen en llano y concordancia de número.
    expect(filas()[0].textContent).toContain("SurveyMonkey");
    expect(filas()[1].textContent).toContain("1 fila");
    expect(filas()[1].textContent).toContain("1 columna");
    expect(filas()[2].textContent).toContain("Kobo");
    expect(filas()[2].textContent).toContain("1,283 filas");
    expect(contenedor.textContent).not.toMatch(/kobo_api|surveymonkey|manual/);
  });

  test("con varias bases, la activa se marca y las demás se pueden activar", async () => {
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    const acciones = filas().map((fila) => fila.querySelector(".pulso-estado-base-accion")?.textContent?.trim());
    expect(acciones).toEqual(["Activar", "Activa", "Activar"]);
    expect(filas()[1].hasAttribute("data-activa")).toBe(true);
    expect(filas()[0].querySelector("button")?.getAttribute("aria-label")).toBe("Activar Docentes");
  });

  test("activar usa la API del estudio, refresca la sesión, avisa a las secciones y vuelve a leer", async () => {
    api.apiEstudioGet.mockResolvedValueOnce(estudio(TRES, "egresados")).mockResolvedValue(estudio(TRES, "docentes"));
    api.apiEstudioActiveBaseSet.mockResolvedValue({ ok: true, active: "docentes", options: [], processing_mode: "multibase" });
    const avisos: unknown[] = [];
    const escucha = (evento: Event) => avisos.push((evento as CustomEvent).detail);
    window.addEventListener("pulso:active-base-changed", escucha);
    await montar();

    await act(async () => {
      filas()[0].querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    window.removeEventListener("pulso:active-base-changed", escucha);

    expect(api.apiEstudioActiveBaseSet).toHaveBeenCalledTimes(1);
    expect(api.apiEstudioActiveBaseSet).toHaveBeenCalledWith("docentes");
    expect(sesion.refresh).toHaveBeenCalledTimes(1);
    expect(avisos).toEqual([{ active: "docentes", processing_mode: "multibase" }]);
    expect(filas()[0].hasAttribute("data-activa")).toBe(true);
    expect(filas()[1].hasAttribute("data-activa")).toBe(false);
    // Al terminar, las otras bases vuelven a poder activarse y la vista vuelve a estar lista.
    expect(boton("Activar")?.hasAttribute("disabled")).toBe(false);
    expect(marca()).toBe("procesamiento-estado");
  });

  test("mientras se cambia de base los botones se apagan, el destino lo dice y la vista no está lista", async () => {
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    let terminar: (valor: unknown) => void = () => undefined;
    api.apiEstudioActiveBaseSet.mockReturnValue(new Promise((ok) => { terminar = ok; }));
    await montar();
    await act(async () => {
      filas()[0].querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(marca()).toBe("false");
    expect(filas()[0].querySelector("button")?.textContent).toBe("Activando");
    expect(Array.from(contenedor.querySelectorAll(".pulso-estado-base-accion button")).every((b) => b.hasAttribute("disabled"))).toBe(true);
    expect(contenedor.querySelector("[aria-live='polite']")?.textContent).toBe("Activando Docentes");

    await act(async () => terminar({ ok: true, active: "docentes", options: [], processing_mode: "multibase" }));
    expect(marca()).toBe("procesamiento-estado");
  });

  test("si activar falla lo dice dentro del panel y la base activa no cambia", async () => {
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    api.apiEstudioActiveBaseSet.mockRejectedValue(new Error("La base no existe en el estudio. [E_BASE_NOT_FOUND]"));
    await montar();
    await act(async () => {
      filas()[0].querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(contenedor.querySelector("[role='alert']")?.textContent).toContain("No se pudo activar la base");
    expect(filas()[1].hasAttribute("data-activa")).toBe(true);
    expect(boton("Activar")?.hasAttribute("disabled")).toBe(false);
  });

  test("si el estudio no se puede leer, el panel lo dice con su causa y deja reintentar", async () => {
    api.apiEstudioGet.mockRejectedValueOnce(new Error("Sin conexión con el motor.")).mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    expect(marca()).toBe("procesamiento-estado");
    expect(contenedor.textContent).toContain("No se pudieron leer las bases del estudio");
    expect(contenedor.textContent).toContain("Sin conexión con el motor.");
    expect(filas()).toHaveLength(0);

    await act(async () => {
      boton("Reintentar")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(filas()).toHaveLength(3);
  });

  test("sin bases el panel contiene su vacío y lleva a Carga", async () => {
    sesion.state = { xlsform: false, data: false, n_bases: 0 } as SessionState;
    api.apiEstudioGet.mockResolvedValue(estudio([], null));
    await montar();
    expect(contenedor.querySelector("[data-estado-vacio]")?.textContent).toContain("Sin bases");
    // La cabecera no publica un conteo de cero bases.
    expect(contenedor.querySelector(".pulso-tab-heading-chips")).toBeNull();
    const abrir = Array.from(contenedor.querySelectorAll("[data-estado-vacio] button"))[0];
    await act(async () => {
      abrir?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(contenedor.querySelector("[data-testid='ruta']")?.textContent).toBe("/carga");
  });

  test("Por hacer lleva a la sección que antes elegía el redirect y lista lo bloqueado", async () => {
    sesion.state = { xlsform: true, data: true, auditoria_run: false, n_bases: 3 } as SessionState;
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    expect(contenedor.querySelector(".pulso-estado-sigue-titulo")?.textContent).toBe("Auditar las respuestas");
    expect(contenedor.querySelector(".pulso-estado-sigue-causa")?.textContent).toBe(
      "Todavía no se ha ejecutado la auditoría.",
    );
    const pendientes = Array.from(contenedor.querySelectorAll(".pulso-estado-sigue-pendiente")).map((li) => li.textContent);
    expect(pendientes).toEqual(["GráficosPrepara Analítica.Bloqueada"]);

    await act(async () => {
      boton("Abrir Validación")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(contenedor.querySelector("[data-testid='ruta']")?.textContent).toBe("/validacion");
  });

  test("la cabecera cuenta las bases una vez y aparte los grupos repetidos", async () => {
    api.apiEstudioGet.mockResolvedValue(
      estudio(
        [
          base({ nombre: "hogares", source_kind: "kobo_api", source_alias: "Hogares" }),
          base({ nombre: "miembros", source_kind: "kobo_repeat", parent_base: "hogares", source_alias: "Miembros" }),
        ],
        "hogares",
      ),
    );
    await montar();
    const chips = Array.from(contenedor.querySelectorAll(".pulso-tab-heading-chip")).map((c) => c.textContent);
    expect(chips).toEqual(["1base", "1grupo repetido"]);
    expect(filas()[1].hasAttribute("data-grupo-repetido")).toBe(true);
    expect(filas()[1].textContent).toContain("Grupo repetido");
    // El título del panel no repite la cifra de la cabecera.
    expect(contenedor.querySelector(".pulso-estado-estudio-panel .pulso-panel-title")?.textContent).toBe("Bases del estudio");
  });

  test("declara su geometría: dos paneles, las filas de base y los pendientes", async () => {
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    const grupos = Array.from(contenedor.querySelectorAll("[data-qa-geometry-group]")).map((g) => [
      g.getAttribute("data-qa-geometry-group"),
      g.getAttribute("data-qa-geometry-contract"),
    ]);
    expect(grupos).toEqual(
      expect.arrayContaining([
        ["estado-estudio-paneles", "intrinsic"],
        ["estado-estudio-bases", "intrinsic"],
        ["estado-estudio-fases", "equal"],
        ["estado-estudio-pendientes", "intrinsic"],
      ]),
    );
    // Cada fila declara sus cinco fases como pares.
    expect(contenedor.querySelectorAll("[data-qa-geometry-group='estado-estudio-fases']")).toHaveLength(3);
    expect(filas()[0].querySelectorAll("[data-qa-geometry-member]")).toHaveLength(5);
    expect(contenedor.querySelectorAll(".pulso-estado-estudio-mesa > .pulso-panel")).toHaveLength(2);
    expect(contenedor.querySelectorAll("[data-qa-geometry-capacity='owned']").length).toBeGreaterThanOrEqual(2);
  });
});
