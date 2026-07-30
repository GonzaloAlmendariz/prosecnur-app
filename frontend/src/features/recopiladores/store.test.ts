// Lo que se prueba no son los setters —eso sería probar zustand— sino las
// invalidaciones: las transiciones que SIEMPRE van juntas y que antes dependían
// de que cada handler se acordara de todas.

import { beforeEach, describe, expect, it } from "vitest";
import { KOBO_DEFAULT_BASE_URL, type ManualLinkRecord } from "./aulas";
import { useRecopiladoresStore } from "./store";

const enlace = (key: string): ManualLinkRecord => ({
  key, surveyLink: `https://kf/x?u=${key}`, qr: "", word: "", pdf: "", sample: "Kobo",
});

const mapa = (...keys: string[]) => new Map(keys.map((k) => [k, enlace(k)]));
const s = () => useRecopiladoresStore.getState();

beforeEach(() => {
  s().resetForSession();
});

describe("elegir perfil de Kobo", () => {
  it("descarta todo lo que era del perfil anterior", () => {
    s().setKoboAssets([{ uid: "a1", name: "Form", version_id: "v1", date_modified: null, deployment_active: true }]);
    s().elegirAssetKobo("a1");
    s().setKoboBaseLink("https://kf/x/a1");
    s().setKoboError("algo falló");

    s().elegirPerfilKobo("profile-2", "https://eu.kobotoolbox.org");

    // Assets, asset, enlace y error eran del perfil viejo: arrastrarlos mostraría
    // formularios de otro servidor como si fueran del nuevo.
    expect(s().koboAssets).toEqual([]);
    expect(s().koboAssetUid).toBe("");
    expect(s().koboBaseLink).toBe("");
    expect(s().koboResolvedFrom).toBe("");
    expect(s().koboError).toBe("");
    expect(s().koboProfileId).toBe("profile-2");
    expect(s().koboBaseUrl).toBe("https://eu.kobotoolbox.org");
  });
});

describe("sembrar la conexión", () => {
  it("no pisa un perfil ya elegido ni una base ya cambiada", () => {
    s().elegirPerfilKobo("elegido-a-mano", "https://mi.kobo.org");
    s().sembrarConexionKobo("default-del-servidor", "https://kf.kobotoolbox.org");
    expect(s().koboProfileId).toBe("elegido-a-mano");
    expect(s().koboBaseUrl).toBe("https://mi.kobo.org");
  });

  it("siembra cuando no hay nada elegido", () => {
    s().sembrarConexionKobo("default-del-servidor", "https://eu.kobotoolbox.org");
    expect(s().koboProfileId).toBe("default-del-servidor");
    expect(s().koboBaseUrl).toBe("https://eu.kobotoolbox.org");
  });

  it("la base por defecto no cuenta como elección del usuario", () => {
    expect(s().koboBaseUrl).toBe(KOBO_DEFAULT_BASE_URL);
    s().sembrarConexionKobo("p", "https://eu.kobotoolbox.org");
    expect(s().koboBaseUrl).toBe("https://eu.kobotoolbox.org");
  });
});

describe("elegir formulario", () => {
  it("conserva un enlace de captura válido y descarta el que no captura", () => {
    // El válido lo puso el usuario a mano y no se pierde por cambiar de
    // formulario. El que no captura sí se limpia: no debe llegar al QR.
    s().setKoboBaseLink("https://kf.kobotoolbox.org/x/aXbYcZ");
    s().elegirAssetKobo("a2");
    expect(s().koboBaseLink).toBe("https://kf.kobotoolbox.org/x/aXbYcZ");

    s().setKoboBaseLink("https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing");
    s().elegirAssetKobo("a3");
    expect(s().koboBaseLink).toBe("");
  });

  it("siempre descarta la procedencia del anterior", () => {
    s().terminarResolucionKobo({ link: "https://kf/x/a1", resolvedFrom: "deployment" });
    expect(s().koboResolvedFrom).toBe("deployment");
    s().elegirAssetKobo("a2");
    expect(s().koboResolvedFrom).toBe("");
  });
});

describe("resolución de enlace", () => {
  it("arrancar limpia error y procedencia previos", () => {
    s().setKoboError("error viejo");
    s().terminarResolucionKobo({ resolvedFrom: "deployment" });
    s().empezarResolucionKobo();
    expect(s().koboResolving).toBe(true);
    expect(s().koboError).toBe("");
    expect(s().koboResolvedFrom).toBe("");
  });

  it("terminar sin link conserva el que había", () => {
    s().setKoboBaseLink("https://kf/x/previo");
    s().empezarResolucionKobo();
    s().terminarResolucionKobo({ error: "se cayó la red" });
    expect(s().koboResolving).toBe(false);
    expect(s().koboBaseLink).toBe("https://kf/x/previo");
    expect(s().koboError).toBe("se cayó la red");
  });
});

describe("cambiar el conjunto de enlaces", () => {
  it("invalida el feedback del guardado anterior en los tres caminos", () => {
    // Un "12 enlaces guardados" que sobrevive a un pegado describe otro conjunto.
    for (const cambiar of [
      () => s().aplicarPegado(mapa("a")),
      () => s().limpiarPegado(),
      () => s().aplicarEnlacesGenerados(mapa("b")),
    ]) {
      s().guardadoConExito("12 enlaces guardados en Monitoreo.");
      expect(s().returnSaveMessage).not.toBe("");
      cambiar();
      expect(s().returnSaveMessage).toBe("");
      expect(s().returnSaveError).toBe("");
    }
  });

  it("aplicar lo pegado CONSERVA el textarea", () => {
    // El operador tiene que poder ver qué pegó; el conteo de ignoradas solo se
    // entiende junto al texto que las produjo.
    s().setLinkPaste("A-1\thttps://x/1");
    s().aplicarPegado(mapa("a1"));
    expect(s().linkPaste).toBe("A-1\thttps://x/1");
    expect(s().manualLinks.size).toBe(1);
  });

  it("limpiar vacía el textarea y el mapa", () => {
    s().setLinkPaste("algo");
    s().aplicarPegado(mapa("a1"));
    s().limpiarPegado();
    expect(s().linkPaste).toBe("");
    expect(s().manualLinks.size).toBe(0);
  });

  it("generar desde Kobo no toca el textarea y limpia el error de Kobo", () => {
    s().setLinkPaste("pegado a mano");
    s().setKoboError("error previo");
    s().aplicarEnlacesGenerados(mapa("g1"));
    expect(s().linkPaste).toBe("pegado a mano");
    expect(s().koboError).toBe("");
  });
});

describe("guardado a Monitoreo", () => {
  it("el éxito descarta el overlay local de enlaces", () => {
    // Ya están en el servidor: mantener el mapa sería una segunda copia que puede
    // contradecir a la agenda que acaba de volver del backend.
    s().aplicarPegado(mapa("a", "b"));
    s().empezarGuardado();
    s().guardadoConExito("2 enlaces guardados en Monitoreo.");
    expect(s().manualLinks.size).toBe(0);
    expect(s().returnSaving).toBe(false);
    expect(s().returnSaveError).toBe("");
  });

  it("el error conserva el overlay para poder reintentar", () => {
    s().aplicarPegado(mapa("a", "b"));
    s().empezarGuardado();
    s().guardadoConError("500 del backend");
    expect(s().manualLinks.size).toBe(2);
    expect(s().returnSaving).toBe(false);
    expect(s().returnSaveMessage).toBe("");
  });

  it("mensaje y error nunca conviven", () => {
    s().guardadoConExito("ok");
    expect(s().returnSaveError).toBe("");
    s().guardadoConError("falló");
    expect(s().returnSaveMessage).toBe("");
  });
});

describe("resetForSession", () => {
  it("no deja nada del proyecto anterior", () => {
    s().setSelectedFaculty("Facultad A");
    s().setQuery("mat146");
    s().setSelectedKey("AULA 1-M1-0");
    s().setLinkPaste("pegado");
    s().aplicarPegado(mapa("a"));
    s().elegirPerfilKobo("profile-1", "https://mi.kobo.org");
    s().setPrintPreparedAt("2026-07-29T10:00:00Z");
    s().guardadoConExito("guardado");

    s().resetForSession();

    expect(s().selectedFaculty).toBe("todas");
    expect(s().query).toBe("");
    expect(s().selectedKey).toBe("");
    expect(s().linkPaste).toBe("");
    expect(s().manualLinks.size).toBe(0);
    expect(s().koboProfileId).toBe("");
    expect(s().koboBaseUrl).toBe(KOBO_DEFAULT_BASE_URL);
    expect(s().printPreparedAt).toBe("");
    expect(s().returnSaveMessage).toBe("");
  });

  it("entrega un Map nuevo y no el mismo compartido entre sesiones", () => {
    const antes = s().manualLinks;
    s().aplicarPegado(mapa("a"));
    s().resetForSession();
    expect(s().manualLinks.size).toBe(0);
    expect(s().manualLinks).not.toBe(antes);
  });
});
