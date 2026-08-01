import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { FormSwitcher } from "./FormSwitcher";
import type { LibraryEntry } from "../state/persistence";

// El nombre de un formulario lo escribe el usuario, así que el conmutador tiene
// que aguantar uno largo sin desbordar. Lo que se puede afirmar sin abrir el
// menú —que vive en estado local, y este proyecto no tiene Testing Library— es
// que el nombre viaja ENTERO hasta la vista: si se truncara en origen, el
// `title` del item no tendría qué exponer y el recorte visual dejaría el dato
// sin forma de leerse. El recorte con elipsis y su alcanzabilidad se verifican
// en scripts/tests/ui-quick-check-detector.test.mjs y en el barrido de
// popovers de ui-quick-check.
const NOMBRE_LARGO = "giehrhreioghrehgiorheoghriehgoierhiohgiohreoihgoreih";

function entrada(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: "form-1",
    name: NOMBRE_LARGO,
    savedAt: 0,
    source: { kind: "xlsform", original_name: "instrumento.xlsx" },
    ...overrides,
  } as LibraryEntry;
}

function render(forms: LibraryEntry[]): string {
  return renderToStaticMarkup(
    <FormSwitcher
      forms={forms}
      activeFormId="form-1"
      activeName={NOMBRE_LARGO}
      canCreate
      onSwitch={() => {}}
      onNew={() => {}}
      onViewAll={() => {}}
    />,
  );
}

describe("FormSwitcher", () => {
  test("el nombre del formulario abierto llega entero al trigger", () => {
    const markup = render([entrada()]);
    expect(markup).toContain(NOMBRE_LARGO);
  });

  test("no trunca el nombre en origen", () => {
    const markup = render([entrada()]);
    expect(markup).not.toContain("…");
    expect(markup).not.toContain("...");
  });
});
