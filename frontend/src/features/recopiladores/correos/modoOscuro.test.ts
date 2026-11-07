// Modo oscuro de la vista previa (loop editor de correos, L21): los tres casos
// medidos en vivo en el correo de Egresados de pregrado de Acreditación 2026.
// `aplicarModoOscuro` sobre el documento real se verifica en vivo: happy-dom no
// está instalado en el node_modules compartido del worktree.
import { describe, expect, it } from "vitest";

import {
  colorDelTextoEnOscuro,
  contraste,
  leerColor,
  oscureceElFondo,
} from "./modoOscuro";

const PALETA = { papel: "rgb(23, 33, 47)", tinta: "rgb(232, 236, 242)", suave: "rgb(60, 70, 85)" };
const c = (v: string) => leerColor(v)!;

describe("decisiones del modo oscuro", () => {
  it("oscurece el blanco y el tinte claro del sorteo; deja el acento, el botón y lo transparente", () => {
    expect(oscureceElFondo(c("#ffffff"))).toBe(true);
    expect(oscureceElFondo(c("#ebf1f8"))).toBe(true);
    expect(oscureceElFondo(c("#004dac"))).toBe(false);
    expect(oscureceElFondo(c("#ffb000"))).toBe(false);
    expect(oscureceElFondo(c("rgba(0, 0, 0, 0)"))).toBe(false);
  });

  it("el enlace en el acento sobre el fondo oscuro se aclara y queda legible; el texto blanco sobre el acento no se toca", () => {
    const nuevo = colorDelTextoEnOscuro(c("#004dac"), c(PALETA.papel), true, PALETA.tinta);
    expect(nuevo).not.toBeNull();
    expect(contraste(c(nuevo!), c(PALETA.papel))).toBeGreaterThanOrEqual(4.5);
    expect(colorDelTextoEnOscuro(c("#ffffff"), c("#004dac"), false, PALETA.tinta)).toBeNull();
    // Un título en el acento conserva el tono (azul aclarado); un gris pasa a la tinta.
    const titulo = colorDelTextoEnOscuro(c("#004dac"), c(PALETA.papel), false, PALETA.tinta)!;
    expect(c(titulo).b).toBeGreaterThan(c(titulo).r);
    expect(contraste(c(titulo), c(PALETA.papel))).toBeGreaterThanOrEqual(4.5);
    expect(colorDelTextoEnOscuro(c("#22262e"), c(PALETA.papel), false, PALETA.tinta)).toBe(PALETA.tinta);
    // Sobre un fondo que siguió claro no hay nada que corregir.
    expect(colorDelTextoEnOscuro(c("#22262e"), c("#ffffff"), false, PALETA.tinta)).toBeNull();
  });
});

