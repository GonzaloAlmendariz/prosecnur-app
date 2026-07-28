import { describe, expect, test } from "vitest";
import {
  admiteDireccionPegada,
  leerDireccion,
  leerDireccionDeKobo,
  leerDireccionDeSheets,
  leerDireccionDeSurveyMonkey,
} from "./direccionDeFuente";

describe("leerDireccionDeSheets", () => {
  test("saca el id de la dirección que el usuario copia del navegador", () => {
    const lectura = leerDireccionDeSheets(
      "https://docs.google.com/spreadsheets/d/1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ/edit#gid=0",
    );
    expect(lectura.ok).toBe(true);
    if (!lectura.ok || lectura.servicio !== "google_sheets") return;
    expect(lectura.spreadsheetId).toBe("1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ");
  });

  test("sigue aceptando el id suelto que los proyectos viejos tienen guardado", () => {
    const lectura = leerDireccionDeSheets("1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ");
    expect(lectura.ok).toBe(true);
    if (!lectura.ok || lectura.servicio !== "google_sheets") return;
    expect(lectura.spreadsheetId).toBe("1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ");
  });

  test("una dirección de otro servicio se nombra como tal", () => {
    const lectura = leerDireccionDeSheets("https://www.dropbox.com/s/abc/base.xlsx");
    expect(lectura.ok).toBe(false);
    if (lectura.ok) return;
    expect(lectura.motivo).toBe("otro_servicio");
    expect(lectura.mensaje).toContain("no es de Google Sheets");
  });

  test("una dirección de Google que no es una hoja se distingue del caso anterior", () => {
    const lectura = leerDireccionDeSheets("https://docs.google.com/document/d/abc/edit");
    expect(lectura.ok).toBe(false);
    if (lectura.ok) return;
    expect(lectura.motivo).toBe("sin_identificador");
    expect(lectura.mensaje).toContain("no apunta a una hoja");
  });

  test("vacío no es error de formato", () => {
    const lectura = leerDireccionDeSheets("   ");
    expect(lectura.ok).toBe(false);
    if (lectura.ok) return;
    expect(lectura.motivo).toBe("vacia");
  });
});

describe("leerDireccionDeKobo", () => {
  test("separa servidor y formulario, que es lo que hace falta para abrirlo", () => {
    const lectura = leerDireccionDeKobo("https://kobo.unhcr.org/#/forms/aXbYcZ123/landing");
    expect(lectura.ok).toBe(true);
    if (!lectura.ok || lectura.servicio !== "kobo") return;
    expect(lectura.baseUrl).toBe("https://kobo.unhcr.org");
    expect(lectura.assetUid).toBe("aXbYcZ123");
  });

  test("acepta la dirección de la API además de la del navegador", () => {
    const lectura = leerDireccionDeKobo("https://kf.kobotoolbox.org/api/v2/assets/aXbYcZ/");
    expect(lectura.ok).toBe(true);
    if (!lectura.ok || lectura.servicio !== "kobo") return;
    expect(lectura.assetUid).toBe("aXbYcZ");
  });

  test("el servidor no se pierde: dos estudios pueden vivir en Kobo distintos", () => {
    const uno = leerDireccionDeKobo("https://kf.kobotoolbox.org/#/forms/A1");
    const otro = leerDireccionDeKobo("https://kobo.humanitarianresponse.info/#/forms/A1");
    if (!uno.ok || uno.servicio !== "kobo" || !otro.ok || otro.servicio !== "kobo") throw new Error("no leyó");
    expect(uno.baseUrl).not.toBe(otro.baseUrl);
  });

  test("una dirección de Kobo sin formulario dice dónde encontrarlo", () => {
    const lectura = leerDireccionDeKobo("https://kf.kobotoolbox.org/#/account/settings");
    expect(lectura.ok).toBe(false);
    if (lectura.ok) return;
    expect(lectura.mensaje).toContain("no incluye un formulario");
  });

  test("sin esquema no se adivina uno", () => {
    const lectura = leerDireccionDeKobo("kf.kobotoolbox.org/#/forms/aXbYcZ");
    expect(lectura.ok).toBe(false);
    if (lectura.ok) return;
    expect(lectura.mensaje).toContain("https://");
  });
});

describe("SurveyMonkey", () => {
  test("no finge que hay una dirección que pegar", () => {
    const lectura = leerDireccionDeSurveyMonkey();
    expect(lectura.ok).toBe(false);
    expect(lectura.motivo).toBe("no_navegable");
    expect(lectura.mensaje).toContain("catálogo");
  });

  test("el flujo lo sabe antes de pedir nada", () => {
    expect(admiteDireccionPegada("surveymonkey")).toBe(false);
    expect(admiteDireccionPegada("google_sheets")).toBe(true);
    expect(admiteDireccionPegada("kobo")).toBe(true);
  });
});

describe("leerDireccion", () => {
  test("despacha por servicio", () => {
    expect(leerDireccion("google_sheets", "https://docs.google.com/spreadsheets/d/ABC123456789012345678/edit").ok).toBe(true);
    expect(leerDireccion("kobo", "https://kf.kobotoolbox.org/#/forms/A1").ok).toBe(true);
    expect(leerDireccion("surveymonkey", "lo que sea").ok).toBe(false);
  });
});
