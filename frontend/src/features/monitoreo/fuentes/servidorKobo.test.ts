import { describe, expect, it } from "vitest";

import type { ConnectionTokenState } from "../../../api/multiIntegrado";
import { KOBO_SERVIDOR_PUBLICO, perfilKoboActivo, servidorKoboActivo } from "./servidorKobo";

// El wizard tenía el servidor público escrito a mano, así que con una cuenta en
// un servidor propio mandaba el token al lugar equivocado y volvía
// E_KOBO_TOKEN_REJECTED: un error de credenciales para lo que era una dirección.

const conexion = (extra: Partial<ConnectionTokenState>): ConnectionTokenState => ({
  ok: true,
  provider: "kobo",
  label: "KoboToolbox",
  has_token: true,
  masked_token: "",
  persisted: true,
  ephemeral: false,
  ...extra,
} as ConnectionTokenState);

describe("servidorKoboActivo", () => {
  it("usa el servidor del perfil conectado", () => {
    const conexiones = [
      conexion({ provider: "surveymonkey", label: "SurveyMonkey" }),
      conexion({ active_profile_base_url: "https://kobo.unhcr.org" }),
    ];
    expect(servidorKoboActivo(conexiones)).toBe("https://kobo.unhcr.org");
  });

  it("sin perfil configurado el público es el destino correcto", () => {
    expect(servidorKoboActivo([conexion({ active_profile_base_url: "" })])).toBe(KOBO_SERVIDOR_PUBLICO);
    expect(servidorKoboActivo([])).toBe(KOBO_SERVIDOR_PUBLICO);
    expect(servidorKoboActivo(null)).toBe(KOBO_SERVIDOR_PUBLICO);
  });

  it("no se queda con la barra final, que duplicaría la del path", () => {
    expect(servidorKoboActivo([conexion({ active_profile_base_url: "https://kobo.unhcr.org/" })]))
      .toBe("https://kobo.unhcr.org");
  });

  it("ignora el servidor de otro proveedor", () => {
    // Un base_url de SurveyMonkey no puede convertirse en el servidor de Kobo.
    const conexiones = [conexion({ provider: "surveymonkey", active_profile_base_url: "https://api.surveymonkey.com/v3" })];
    expect(servidorKoboActivo(conexiones)).toBe(KOBO_SERVIDOR_PUBLICO);
  });
});

describe("perfilKoboActivo", () => {
  it("acompaña al servidor: el token tiene que ser el de ese perfil", () => {
    expect(perfilKoboActivo([conexion({ active_profile_id: "perfil_unhcr_d0991580" })]))
      .toBe("perfil_unhcr_d0991580");
  });

  it("sin perfil activo devuelve vacío y el backend elige el suyo", () => {
    expect(perfilKoboActivo([conexion({})])).toBe("");
    expect(perfilKoboActivo(null)).toBe("");
  });
});
