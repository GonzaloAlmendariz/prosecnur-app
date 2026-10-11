// @vitest-environment happy-dom
/**
 * L8 — importador SurveyMonkey del editor:
 *  - abrir NO consulta la API (ni token guardado, ni SurveyMonkey, ni catálogo);
 *  - el estado inicial es vacío y reproducible (sin errores pintados);
 *  - la primera consulta la dispara una acción explícita;
 *  - al cerrar, el foco vuelve al disparador (o a su alternativa si el
 *    disparador, un ítem de menú, ya se desmontó).
 */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiXlsformEditorSmTokenLoad: vi.fn(),
  apiXlsformEditorSmTokenSave: vi.fn(),
  apiXlsformEditorSmTokenClear: vi.fn(),
  apiXlsformEditorSmCheckToken: vi.fn(),
  apiXlsformEditorSmListSurveys: vi.fn(),
  apiXlsformEditorSmFetchSurveyInfo: vi.fn(),
  apiXlsformEditorImportSurveyMonkeyWithLogic: vi.fn(),
  apiXlsformEditorSmInterpretRule: vi.fn(),
  apiXlsformEditorSmApplyLogic: vi.fn(),
}));

vi.mock("../../../api/multiIntegrado", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/multiIntegrado")>()),
  apiXlsformEditorSmTokenLoad: api.apiXlsformEditorSmTokenLoad,
  apiXlsformEditorSmTokenSave: api.apiXlsformEditorSmTokenSave,
  apiXlsformEditorSmTokenClear: api.apiXlsformEditorSmTokenClear,
  apiXlsformEditorSmCheckToken: api.apiXlsformEditorSmCheckToken,
  apiXlsformEditorSmListSurveys: api.apiXlsformEditorSmListSurveys,
  apiXlsformEditorSmFetchSurveyInfo: api.apiXlsformEditorSmFetchSurveyInfo,
}));

vi.mock("../../../api/xlsformEditor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/xlsformEditor")>()),
  apiXlsformEditorImportSurveyMonkeyWithLogic: api.apiXlsformEditorImportSurveyMonkeyWithLogic,
  apiXlsformEditorSmInterpretRule: api.apiXlsformEditorSmInterpretRule,
  apiXlsformEditorSmApplyLogic: api.apiXlsformEditorSmApplyLogic,
}));

const { FinalImportReviewModal, ImportSurveyMonkeyDialog, SM_IMPORT_RETURN_FOCUS } = await import("./ImportSurveyMonkeyDialog");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  for (const fn of Object.values(api)) fn.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

/** Radix devuelve el foco en un `setTimeout(0)` al desmontar el FocusScope. */
async function tick() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function boton(nombre: string): HTMLButtonElement {
  const encontrado = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === nombre,
  );
  if (!encontrado) throw new Error(`no hay botón «${nombre}»`);
  return encontrado;
}

function llamadasDeRed(): number {
  return Object.values(api).reduce((n, fn) => n + fn.mock.calls.length, 0);
}

/** Réplica mínima de cómo lo monta el editor: montaje condicional. */
function Editor({ desdeMenu }: { desdeMenu: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [menu, setMenu] = useState(false);
  return (
    <>
      <button type="button" className="pulso-xf-intake-trigger" onClick={() => setMenu(true)}>
        Nuevo formulario
      </button>
      <button type="button" onClick={() => setAbierto(true)}>
        Traducir SurveyMonkey
      </button>
      {desdeMenu && menu ? (
        <button
          type="button"
          onClick={() => {
            setMenu(false);
            setAbierto(true);
          }}
        >
          Traducir de SurveyMonkey
        </button>
      ) : null}
      {abierto ? (
        <ImportSurveyMonkeyDialog fileName="" onCancel={() => setAbierto(false)} onComplete={vi.fn()} />
      ) : null}
    </>
  );
}

describe("ImportSurveyMonkeyDialog · estado inicial (L8)", () => {
  test("abrir el diálogo no llama a la API de conexiones ni de catálogo", async () => {
    act(() => root.render(<Editor desdeMenu={false} />));
    act(() => boton("Traducir SurveyMonkey").click());
    await tick();
    await tick();

    expect(document.querySelector(".pulso-dialog")).not.toBeNull();
    expect(llamadasDeRed()).toBe(0);
    expect(api.apiXlsformEditorSmTokenLoad).not.toHaveBeenCalled();
    expect(api.apiXlsformEditorSmCheckToken).not.toHaveBeenCalled();
    expect(api.apiXlsformEditorSmListSurveys).not.toHaveBeenCalled();
  });

  test("el estado inicial es vacío: sin alertas y con las acciones disponibles", async () => {
    act(() => root.render(<Editor desdeMenu={false} />));
    act(() => boton("Traducir SurveyMonkey").click());
    await tick();

    const dialogo = document.querySelector<HTMLElement>(".pulso-dialog")!;
    expect(dialogo.getAttribute("aria-modal")).toBe("true");
    expect(dialogo.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(boton("Probar conexión").disabled).toBe(false);
    expect(boton("Buscar mis encuestas").disabled).toBe(false);
    expect(boton("Revisar borrador").disabled).toBe(true);
    expect(dialogo.textContent).not.toContain("Token activo");
  });

  test("la primera consulta la dispara una acción explícita del usuario", async () => {
    api.apiXlsformEditorSmTokenLoad.mockResolvedValue({
      ok: true,
      has_token: false,
      masked_token: "",
      persisted: false,
      ephemeral: false,
    });
    act(() => root.render(<Editor desdeMenu={false} />));
    act(() => boton("Traducir SurveyMonkey").click());
    await tick();
    expect(llamadasDeRed()).toBe(0);

    await act(async () => {
      boton("Buscar mis encuestas").click();
    });
    await tick();

    expect(api.apiXlsformEditorSmTokenLoad).toHaveBeenCalledTimes(1);
    expect(api.apiXlsformEditorSmListSurveys).not.toHaveBeenCalled();
    expect(document.querySelector('.pulso-dialog [role="alert"]')?.textContent).toContain("token");
  });
});

describe("ImportSurveyMonkeyDialog · foco de vuelta (L8)", () => {
  test("al cerrar vuelve al botón que lo abrió", async () => {
    act(() => root.render(<Editor desdeMenu={false} />));
    const disparador = boton("Traducir SurveyMonkey");
    act(() => {
      disparador.focus();
      disparador.click();
    });
    await tick();
    expect(document.activeElement).not.toBe(disparador);

    act(() => boton("Cerrar importación de SurveyMonkey").click());
    await tick();

    expect(document.querySelector(".pulso-dialog")).toBeNull();
    expect(document.activeElement).toBe(disparador);
  });

  test("Escape cierra sin progreso y devuelve el foco al disparador", async () => {
    act(() => root.render(<Editor desdeMenu={false} />));
    const disparador = boton("Traducir SurveyMonkey");
    act(() => {
      disparador.focus();
      disparador.click();
    });
    await tick();

    const activo = document.activeElement ?? document.body;
    act(() => {
      activo.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    await tick();

    expect(document.querySelector(".pulso-dialog")).toBeNull();
    expect(document.activeElement).toBe(disparador);
  });

  test("si el ítem de menú que lo abrió se desmontó, el foco va al botón del menú", async () => {
    act(() => root.render(<Editor desdeMenu />));
    act(() => boton("Nuevo formulario").click());
    const item = boton("Traducir de SurveyMonkey");
    act(() => {
      item.focus();
      item.click();
    });
    await tick();
    expect(item.isConnected).toBe(false);

    act(() => boton("Cancelar").click());
    await tick();

    expect(document.activeElement).toBe(document.querySelector(SM_IMPORT_RETURN_FOCUS));
  });
});

describe("FinalImportReviewModal · foco inicial", () => {
  test("al aparecer, el foco cae en el switch de confirmación", () => {
    act(() => root.render(
      <FinalImportReviewModal
        surveyId="123456789"
        sectionCount={2}
        questionCount={12}
        visualRuleCount={0}
        advancedRuleCount={0}
        overrideCount={0}
        checked={false}
        submitting={false}
        onCheckedChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    ));

    expect(document.activeElement?.getAttribute("role")).toBe("switch");
  });
});
