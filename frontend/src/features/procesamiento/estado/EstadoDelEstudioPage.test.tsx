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
const aprobacion = vi.hoisted(() => ({ apiProcessingReleases: vi.fn() }));
const sesion = vi.hoisted(() => ({
  state: null as SessionState | null,
  refresh: vi.fn(async () => undefined),
}));

vi.mock("../../../api/estudio", () => api);
vi.mock("../../../api/xlsformEditor", () => aprobacion);
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
    aprobacion.apiProcessingReleases.mockReset();
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
    expect(texto).toContain("293 respuestas");
    // Las columnas no van: el archivo recibido no es la base que se procesa.
    expect(texto).not.toContain("columnas");
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
    expect(filas()[1].textContent).toContain("1 respuesta");
    expect(filas()[2].textContent).toContain("Kobo");
    expect(filas()[2].textContent).toContain("1,283 respuestas");
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
    // La cabecera no publica un conteo de cero bases; su estado lo dice.
    expect(contenedor.querySelector(".pulso-cifra-pestana")).toBeNull();
    expect(contenedor.querySelector(".pulso-cabecera-pestana-estado")?.textContent).toBe("Sin bases");
    const abrir = Array.from(contenedor.querySelectorAll("[data-estado-vacio] button"))[0];
    await act(async () => {
      abrir?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(contenedor.querySelector("[data-testid='ruta']")?.textContent).toBe("/carga");
  });

  test("Por hacer numera el paso del estudio y lo bloqueado; Ir lleva a la sección que antes elegía el redirect", async () => {
    sesion.state = { xlsform: true, data: true, auditoria_run: false, n_bases: 3 } as SessionState;
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    const tareas = Array.from(contenedor.querySelectorAll(".pulso-estado-sigue-pendiente")).map((li) => li.textContent);
    expect(tareas).toEqual([
      "1Auditar las respuestasTodavía no se ha ejecutado la auditoría.Ir",
      "2GráficosPrepara Analítica.Bloqueada",
    ]);
    const ir = contenedor.querySelector<HTMLButtonElement>("button[aria-label='Ir a Validación: Auditar las respuestas']");
    expect(ir?.textContent).toBe("Ir");
    await act(async () => {
      ir?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
    const cifras = Array.from(contenedor.querySelectorAll(".pulso-cifra-pestana")).map((c) => c.textContent);
    // Las filas del grupo repetido son instancias: no suman respuestas.
    expect(cifras).toEqual(["base1", "grupo repetido1", "respuestas100", "con informe0/1"]);
    expect(filas()[1].hasAttribute("data-grupo-repetido")).toBe(true);
    expect(filas()[1].textContent).toContain("Grupo repetido");
    expect(filas()[1].textContent).toContain("100 filas");
    // El título del panel no repite la cifra de la cabecera.
    expect(contenedor.querySelector(".pulso-panel-de-mesa--estado-avance .pulso-panel-de-mesa-titulo")?.textContent).toBe(
      "Avance por base y por fase",
    );
  });

  test("declara su geometría: la mesa, sus dos pilas, las filas de base, las fases y los archivos", async () => {
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    const grupos = Array.from(contenedor.querySelectorAll("[data-qa-geometry-group]")).map((g) => [
      g.getAttribute("data-qa-geometry-group"),
      g.getAttribute("data-qa-geometry-contract"),
    ]);
    expect(grupos).toEqual(
      expect.arrayContaining([
        ["estado-estudio-mesa", "intrinsic"],
        ["estado-estudio-bases-pila", "intrinsic"],
        ["estado-estudio-seguimiento-pila", "intrinsic"],
        ["estado-estudio-bases", "intrinsic"],
        ["estado-estudio-fases", "equal"],
        ["estado-estudio-archivos", "intrinsic"],
        ["estado-estudio-archivos-celdas", "equal"],
        ["estado-estudio-pendientes", "intrinsic"],
        ["estado-estudio-cambios", "intrinsic"],
      ]),
    );
    // Cada fila declara sus cinco fases como pares, y cada fila de archivos sus seis entregables.
    expect(contenedor.querySelectorAll("[data-qa-geometry-group='estado-estudio-fases']")).toHaveLength(3);
    expect(filas()[0].querySelectorAll("[data-qa-geometry-member]")).toHaveLength(5);
    expect(contenedor.querySelectorAll(".pulso-estado-archivos-fila")[0].querySelectorAll("[data-qa-geometry-member]")).toHaveLength(6);
    // Cuatro contenedores del kit; cada uno es dueño de su vacío y de su scroll.
    expect(contenedor.querySelectorAll(".pulso-mesa-pestana-pila > .pulso-panel-de-mesa")).toHaveLength(4);
    const cuerpos = Array.from(contenedor.querySelectorAll(".pulso-panel-de-mesa-cuerpo"));
    expect(cuerpos).toHaveLength(4);
    expect(cuerpos.every((c) => c.getAttribute("data-qa-geometry-capacity") === "owned")).toBe(true);
    // Nada dentro de un cuerpo reclama el vacío otra vez.
    expect(cuerpos.some((c) => c.querySelector("[data-qa-geometry-capacity]"))).toBe(false);
  });

  test("cada celda dice su causa cuando el motor la publica y, si no, declara el pedido", async () => {
    const leida = base({
      nombre: "estudiantes",
      source_alias: "Estudiantes",
      source_kind: "surveymonkey",
      surveymonkey_last_refresh: { refreshed_at: "2026-11-09T19:00:00Z", n_new: 14 },
      status: { imported: true, codificacion: true, shared_logic_from: "docentes" },
    });
    const docentes = base({ nombre: "docentes", source_alias: "Docentes", status: { imported: true } });
    const sinRespuestas = base({ nombre: "egresados", source_alias: "Egresados", data_file_id: "", status: { imported: false } });
    api.apiEstudioGet.mockResolvedValue(estudio([leida, docentes, sinRespuestas], "estudiantes"));
    await montar();
    const causas = (i: number) => Array.from(filas()[i].querySelectorAll("[role='cell']")).map((c) => c.querySelector(".pulso-estado-base-causa")?.textContent ?? null);
    expect(causas(0).slice(0, 5)).toEqual([
      "Leída de SurveyMonkey el 9 nov, 14 respuestas nuevas",
      null,
      "Codificación copiada de Docentes",
      null,
      null,
    ]);
    expect(causas(2)[0]).toBe("Faltan las respuestas");
    // Sin causa, el hueco queda declarado en el marcado con su pedido al motor.
    const validacion = filas()[0].querySelectorAll("[role='cell']")[1];
    expect(validacion.getAttribute("data-causa-pendiente")).toMatch(/^M8: hallazgos por decidir/);
    expect(filas()[0].querySelectorAll("[role='cell']")[0].hasAttribute("data-causa-pendiente")).toBe(false);
    // El mismo hecho, con su fecha, en Cambios recientes.
    const cambios = Array.from(contenedor.querySelectorAll(".pulso-estado-cambio")).map((li) => li.textContent);
    expect(cambios[0]).toBe("9 novEstudiantes: lectura de SurveyMonkey, 14 respuestas nuevas.");
    // Sin aprobación por base, la cabecera declara el hueco de esas cifras.
    expect(contenedor.querySelector("[data-cifras-pendientes]")?.getAttribute("data-cifras-pendientes")).toMatch(/M8/);
    expect(aprobacion.apiProcessingReleases).not.toHaveBeenCalled();
  });

  test("Archivos del estudio: la base activa con los indicadores de la sesión; las otras, solo el informe", async () => {
    sesion.state = {
      xlsform: true, data: true, n_bases: 3, analitica_codebook_ok: true, analitica_frecuencias_ok: true, graficos_ppt_ok: true,
    } as SessionState;
    api.apiEstudioGet.mockResolvedValue(estudio(TRES, "egresados"));
    await montar();
    const fila = (i: number) => Array.from(contenedor.querySelectorAll(".pulso-estado-archivos-fila")[i].querySelectorAll("[role='cell']")).map((c) => c.textContent);
    // Docentes, no activa: el informe sale de su estado; lo demás no se publica por base.
    expect(fila(0)).toEqual(["Sin dato", "Sin dato", "Sin dato", "Sin dato", "Sin dato", "Generado"]);
    // Egresados, activa.
    expect(fila(1)).toEqual(["Por generar", "Generado", "Generado", "Por generar", "Por generar", "GeneradoPowerPoint"]);
    expect(fila(2)[5]).toBe("Por generar");
  });

  test("bases independientes: la aprobación da cifras, causa de Gráficos y tareas que activan su base antes de ir", async () => {
    const independientes = { ...estudio(TRES, "egresados"), processing_mode: "independent_siblings" };
    api.apiEstudioGet.mockResolvedValue(independientes);
    api.apiEstudioActiveBaseSet.mockResolvedValue({ ok: true, active: "estudiantes", options: [], processing_mode: "independent_siblings" });
    aprobacion.apiProcessingReleases.mockResolvedValue({
      ok: true, schema: "processing_release_catalog/v1", detected: true, family_id: "f", active_base: "egresados", all_approved: false,
      entries: [
        { base: "docentes", status: "approved", release: { approved_at: "2026-11-07T15:00:00Z" } },
        { base: "egresados", status: "pending", release: null },
        { base: "estudiantes", status: "ready", release: null },
      ],
    });
    await montar();
    expect(aprobacion.apiProcessingReleases).toHaveBeenCalledTimes(1);
    const cifras = Array.from(contenedor.querySelectorAll(".pulso-cifra-pestana")).map((c) => c.textContent);
    expect(cifras).toEqual(["bases3", "respuestas1,399", "aprobada para informe1/3"]);
    expect(contenedor.querySelector("[data-cifras-pendientes]")).toBeNull();
    expect(filas()[0].querySelectorAll("[role='cell']")[4].querySelector(".pulso-estado-base-causa")?.textContent).toBe(
      "Aprobada para informe el 7 nov",
    );
    const tareas = Array.from(contenedor.querySelectorAll(".pulso-estado-sigue-pendiente-nombre")).map((n) => n.textContent);
    expect(tareas).toContain("Aprobar para informe");

    const ir = contenedor.querySelector<HTMLButtonElement>("button[aria-label='Ir a Analítica: Aprobar para informe']");
    await act(async () => {
      ir?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(api.apiEstudioActiveBaseSet).toHaveBeenCalledWith("estudiantes");
    expect(contenedor.querySelector("[data-testid='ruta']")?.textContent).toBe("/analitica");
  });

  test("si la base no se puede activar, Ir no lleva a otra sección y el error queda en el avance", async () => {
    api.apiEstudioGet.mockResolvedValue({ ...estudio(TRES, "egresados"), processing_mode: "independent_siblings" });
    api.apiEstudioActiveBaseSet.mockRejectedValue(new Error("La base no existe en el estudio. [E_BASE_NOT_FOUND]"));
    aprobacion.apiProcessingReleases.mockResolvedValue({
      ok: true, schema: "processing_release_catalog/v1", detected: true, family_id: "f", active_base: "egresados", all_approved: false,
      entries: [{ base: "estudiantes", status: "ready", release: null }],
    });
    await montar();
    await act(async () => {
      contenedor.querySelector("button[aria-label='Ir a Analítica: Aprobar para informe']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(contenedor.querySelector("[data-testid='ruta']")?.textContent).toBe("/procesamiento");
    expect(contenedor.querySelector("[role='alert']")?.textContent).toContain("No se pudo activar la base");
  });
});
