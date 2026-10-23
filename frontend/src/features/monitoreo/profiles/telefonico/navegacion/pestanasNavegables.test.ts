/**
 * Toda pestaña pública del telefónico se puede abrir: su vista interna está en
 * la lista blanca que la página no reescribe a «resumen». Salió de T9:
 * `pestana=supervision` aterrizaba en Barrido porque `supervision` faltaba en
 * `TELEFONICO_VISIBLE_PHONE_TABS`, y el test que montaba el componente directo
 * no lo veía.
 */
import { describe, expect, it } from "vitest";
import { TELEFONICO_VISIBLE_ADVANCE_TABS, TELEFONICO_VISIBLE_PHONE_TABS } from "../telefonicoBase";
import { SECCIONES_TELEFONICAS, pestanasDeSeccion, vistaPrincipal } from "./direccionTelefonica";

describe("pestañas públicas del telefónico", () => {
  it("cada vista interna de Control y Avance está entre las que la página deja abiertas", () => {
    const cerradas: string[] = [];
    SECCIONES_TELEFONICAS.forEach((seccion) => {
      pestanasDeSeccion(seccion).forEach((pestana) => {
        const vista = vistaPrincipal(seccion, pestana);
        if (!vista) return;
        if (vista.seccion === "telefonico" && !(TELEFONICO_VISIBLE_PHONE_TABS as readonly string[]).includes(vista.pestana)) {
          cerradas.push(`${seccion}/${pestana} → ${vista.seccion}/${vista.pestana}`);
        }
        if (vista.seccion === "avance" && !(TELEFONICO_VISIBLE_ADVANCE_TABS as readonly string[]).includes(vista.pestana)) {
          cerradas.push(`${seccion}/${pestana} → ${vista.seccion}/${vista.pestana}`);
        }
      });
    });
    expect(cerradas).toEqual([]);
  });

  it("Supervisión es una pestaña de Control que abre su propia vista", () => {
    expect(pestanasDeSeccion("control")).toContain("supervision");
    expect(vistaPrincipal("control", "supervision")).toEqual({ seccion: "telefonico", pestana: "supervision" });
  });
});
