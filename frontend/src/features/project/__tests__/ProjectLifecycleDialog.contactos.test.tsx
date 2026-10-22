import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProjectLifecycleDialog, { avisoDeContactos } from "../ProjectLifecycleDialog";

// ADR 0112 §5: los contactos de las campañas de correo viajan en el `.pulso`,
// así que compartir el proyecto es compartir datos personales. Al guardar se
// dice en una línea; sin contactos, nada.

function pintar(contactosCampanas?: number): string {
  const noop = () => undefined;
  return renderToStaticMarkup(
    <ProjectLifecycleDialog
      intent="manage"
      projectName="Egresados"
      projectPath="/ruta/Egresados.pulso"
      dirty
      lastSavedAt={null}
      contactosCampanas={contactosCampanas}
      busy={false}
      action={null}
      error=""
      notice=""
      onCancel={noop}
      onSave={noop}
      onSaveAs={noop}
      onSaveAndContinue={noop}
      onContinueWithoutSave={noop}
    />,
  );
}

describe("aviso de contactos al guardar", () => {
  it("dice cuántas campañas, en singular o plural", () => {
    expect(avisoDeContactos(1)).toBe("Este proyecto lleva los contactos de 1 campaña");
    expect(avisoDeContactos(3)).toBe("Este proyecto lleva los contactos de 3 campañas");
    expect(avisoDeContactos([2])).toBe("Este proyecto lleva los contactos de 2 campañas");
  });

  it("sin contactos, o con un backend viejo que no lo manda, no dice nada", () => {
    expect(avisoDeContactos(0)).toBeNull();
    expect(avisoDeContactos(undefined)).toBeNull();
    expect(pintar()).not.toContain("contactos de");
  });

  it("aparece en la hoja de guardar", () => {
    expect(pintar(2)).toContain("Este proyecto lleva los contactos de 2 campañas.");
  });
});
