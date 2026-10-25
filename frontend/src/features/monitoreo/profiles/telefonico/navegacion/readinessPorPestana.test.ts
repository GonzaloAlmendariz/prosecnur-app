import { describe, expect, it } from "vitest";
import {
  ATERRIZAJE_TELEFONICO,
  SECCIONES_TELEFONICAS,
  pestanasDeSeccion,
  readinessDeTelefonico,
  vistaPrincipal,
} from "./direccionTelefonica";

/**
 * Meta B, L10: el perfil publicaba una sola marca, «monitoreo-telefonico», para
 * las 14 pestañas; el QA no podía saber a qué vista había llegado. Cada pestaña
 * publica ahora la suya, con su dirección pública.
 */
describe("readiness por pestaña del telefónico", () => {
  const vistas = SECCIONES_TELEFONICAS.flatMap((seccion) =>
    pestanasDeSeccion(seccion).map((pestana) => ({ seccion, pestana, interna: vistaPrincipal(seccion, pestana) })),
  );

  it("las 14 pestañas publican 14 marcas distintas, con su dirección pública", () => {
    expect(vistas).toHaveLength(14);
    const marcas = vistas.map(({ seccion, pestana, interna }) => {
      expect(interna).not.toBeNull();
      const marca = readinessDeTelefonico(interna!.seccion, interna!.pestana);
      expect(marca).toBe(`monitoreo-telefonico-${seccion}-${pestana}`);
      return marca;
    });
    expect(new Set(marcas).size).toBe(14);
  });

  it("el aterrizaje publica la marca de Avance › Cuotas", () => {
    expect(readinessDeTelefonico(ATERRIZAJE_TELEFONICO.seccion, ATERRIZAJE_TELEFONICO.pestana)).toBe("monitoreo-telefonico-avance-cuotas");
  });
});
