import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProjectIndicator from "../ProjectIndicator";
import type { UseProjectReturn } from "../useProject";

// El `.pulso` salía completo a la vista y roto al reabrirlo en otra máquina:
// «Conta 10-08» viajó con un ícono cuyo PNG ya no estaba en la sesión, y al
// abrirlo el export moría entero. Guardar sigue siendo posible —bloquearlo
// sería peor— pero el chip, que es donde el analista mira si guardó, lo dice.
//
// Se prueba aquí y no en la app porque el único camino de guardado que pasa
// por el hook usa el diálogo nativo de Electron, ausente en el navegador.

function proyecto(refsPerdidas: string[]): UseProjectReturn {
  const noop = async () => null;
  return {
    status: {
      has_project: true,
      path: "/ruta/Conta.pulso",
      name: "Conta",
      dirty: false,
      last_saved_at: new Date().toISOString(),
    },
    recents: [],
    busy: false,
    error: "",
    refsPerdidas,
    open: noop,
    newProject: noop,
    save: noop,
    saveAs: noop,
    duplicate: noop,
    close: noop,
    removeRecent: noop,
    refresh: noop,
    refreshRecents: noop,
  } as unknown as UseProjectReturn;
}

function pintar(refsPerdidas: string[]): string {
  return renderToStaticMarkup(
    <ProjectIndicator
      project={proyecto(refsPerdidas)}
      onOpenProjectViewer={() => {}}
      onRequestSelector={() => {}}
    />,
  );
}

describe("ProjectIndicator · recursos que no viajaron en el .pulso", () => {
  it("sin referencias perdidas el chip no dice nada nuevo", () => {
    const html = pintar([]);
    expect(html).not.toContain("falta");
    expect(html).not.toContain("Guardado sin");
  });

  it("con una referencia perdida lo dice y la nombra en el tooltip", () => {
    const html = pintar(["el ícono «Perfil»"]);
    expect(html).toContain("falta 1 recurso");
    expect(html).toContain("el ícono «Perfil»");
    // El aviso tiene que decir qué hacer, no solo que algo falló.
    expect(html).toContain("Vuelve a subirla y guarda otra vez");
  });

  it("con varias usa el plural y las lista", () => {
    const html = pintar(["el ícono «Perfil»", "plantilla.xlsx"]);
    expect(html).toContain("faltan 2 recursos");
    expect(html).toContain("plantilla.xlsx");
  });
});
