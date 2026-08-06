import { describe, expect, it } from "vitest";
import { graficosBodyLoadingLabel, graficosBodyState } from "./graficosBodyState";

describe("cuerpo de Gráficos", () => {
  const base = {
    hydrated: true,
    hydrationRetrying: false,
    isSharedReport: false,
    prepOk: true,
  };

  it("dice que está cargando en vez de pintar un lienzo vacío", () => {
    // El defecto medido: `hydrated` existía pero sólo alimentaba `canExport` y
    // `auditReady`. Mientras cargaba, el editor se pintaba vacío y eso se lee
    // como «este proyecto no tiene láminas», que es lo contrario de lo que pasa.
    expect(graficosBodyState({ ...base, hydrated: false })).toBe("cargando");
  });

  it("distingue el reintento del primer intento", () => {
    // La carga reintenta con backoff hasta 15 s. Esperar ese tiempo sin
    // distinguir «cargando» de «falló y lo estoy reintentando» deja al usuario
    // sin saber si esperar o irse.
    expect(graficosBodyState({ ...base, hydrated: false, hydrationRetrying: true }))
      .toBe("reintentando");
    expect(graficosBodyLoadingLabel("reintentando")).toMatch(/Reintentando/);
    expect(graficosBodyLoadingLabel("cargando")).toMatch(/Cargando/);
  });

  it("la hidratación gana a prepOk, y el orden no es intercambiable", () => {
    // `prepOk` sale del estado de sesión y es `false` mientras carga. Con la
    // precedencia invertida, el usuario veía «Primero prepara los datos en
    // Analítica» aunque ya los hubiera preparado: un aviso que lo acusa de algo
    // que sí hizo.
    expect(graficosBodyState({
      hydrated: false, hydrationRetrying: false, isSharedReport: false, prepOk: false,
    })).toBe("cargando");
  });

  it("hidratado sin preparar sigue avisando de Analítica", () => {
    expect(graficosBodyState({ ...base, prepOk: false })).toBe("prep-bloqueado");
    // El informe conjunto no depende de la preparación de una base concreta.
    expect(graficosBodyState({ ...base, prepOk: false, isSharedReport: true })).toBe("editor");
  });

  it("hidratado y preparado abre el editor", () => {
    expect(graficosBodyState(base)).toBe("editor");
  });
});
