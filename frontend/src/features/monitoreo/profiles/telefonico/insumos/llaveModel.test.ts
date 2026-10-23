import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import type { EnvioEfectivo } from "../control/respuestasModel";
import { cruceDeLlave, ejemplosDeLlave, enviosPorLlave, filtroDePrueba, llaveDeclarada, llaveSinIdentificador, porRevisarEnLaLlave } from "./llaveModel";

const envio = (codigo: string, llave: EnvioEfectivo["llave"]) => ({ codigo, llave } as EnvioEfectivo);

describe("Insumos › Llave y filtros del telefónico", () => {
  it("lee las columnas de la llave, primero la que declara la encuesta, sin repetir", () => {
    const state = {
      config: { monitoreo_profile: { key_rules: {
        universe_fields: ["CodPulso", "Telefono1"], response_fields: ["Intro/Pulso_code", "CodPulso"],
        use_name_fallback: false, automatic_detection: true,
      } } },
      sources: [
        { id: "k", kind: "kobo", enabled: true, declared_person_code_var: "Intro/Pulso_code" },
        { id: "h", kind: "google_sheets", enabled: true },
      ],
    } as unknown as MonitoreoState;
    expect(llaveDeclarada(state)).toEqual({
      base: ["CodPulso", "Telefono1"],
      respuestas: ["Intro/Pulso_code", "CodPulso"],
      automatica: true,
    });
  });

  it("cuenta el cruce de las efectivas y su tasa", () => {
    const cruce = cruceDeLlave({ envios: [envio("PDM1", "exacta"), envio("PDM2", "exacta"), envio("1218", "normalizada"), envio("123456", "no-cruza")] });
    expect(cruce).toEqual({ exacta: 2, normalizada: 1, noCruza: 1, total: 4, cruzan: 3, tasa: 0.75 });
    expect(cruceDeLlave({ envios: [] }).tasa).toBeNull();
  });

  it("pone primero lo que no cruza y luego lo que cruzó por sus dígitos", () => {
    const orden = enviosPorLlave([envio("PDM10", "exacta"), envio("1218", "normalizada"), envio("123456", "no-cruza"), envio("PDM2", "exacta")]);
    expect(orden.map((item) => item.codigo)).toEqual(["123456", "1218", "PDM2", "PDM10"]);
  });

  it("toma ejemplos de la base sin los casos fuera de base", () => {
    const reports = { sheets: [{ id: "monitoreo_telefonico", blocks: [
      { id: "comparacion_codpulso", rows: [
        { CodPulso: "PDM1042", "Estado telefónico": "Efectivo" },
        { CodPulso: "MVH9999", "Estado telefónico": "Fuera de base" },
        { CodPulso: "PDM1042", "Estado telefónico": "Efectivo" },
      ] },
      { id: "control_tiempo_kobo", rows: [{ CodPulso: "PDM 1212" }, { CodPulso: "1218" }] },
    ] }] } as unknown as MonitoreoAcreditacionReports;
    expect(ejemplosDeLlave(reports)).toEqual({ base: ["PDM1042"], respuestas: ["PDM 1212", "1218"], distintosEnLaBase: 1, filasEnLaBase: 2 });
    expect(llaveSinIdentificador(ejemplosDeLlave(reports))).toBe(false);
  });

  it("avisa cuando todas las filas de la base comparten el mismo código (RMS: el id de la fuente)", () => {
    const rows = Array.from({ length: 800 }, () => ({ CodPulso: "rms_barrido", "Estado telefónico": "No barrido" }));
    const reports = { sheets: [{ id: "monitoreo_telefonico", blocks: [{ id: "comparacion_codpulso", rows }] }] } as unknown as MonitoreoAcreditacionReports;
    const ejemplos = ejemplosDeLlave(reports);
    expect(ejemplos).toMatchObject({ distintosEnLaBase: 1, filasEnLaBase: 800 });
    expect(llaveSinIdentificador(ejemplos)).toBe(true);
  });

  it("dice el filtro de prueba sólo si está encendido", () => {
    const con = { config: { monitoreo_profile: { platform_test_filter: { enabled: true, variable: "Intro/testreal", values: ["test"], label: "Prueba o real" } } } } as unknown as MonitoreoState;
    expect(filtroDePrueba(con)).toBe("Quedan fuera los envíos de prueba: Prueba o real, valor test.");
    expect(filtroDePrueba({ config: { monitoreo_profile: { platform_test_filter: { enabled: false, variable: "" } } } } as unknown as MonitoreoState)).toBeNull();
  });

  it("dice cómo se leyó lo que no cruzó tal cual", () => {
    const lista = porRevisarEnLaLlave([
      { codigo: "PDM1", llave: "exacta", codigoEnHoja: "PDM1" } as EnvioEfectivo,
      { codigo: "1218", llave: "normalizada", codigoEnHoja: "PDM1218" } as EnvioEfectivo,
      { codigo: "123456", llave: "no-cruza", codigoEnHoja: "" } as EnvioEfectivo,
    ]);
    expect(lista.map((item) => [item.codigo, item.lectura])).toEqual([
      ["123456", "no cruza con ningún caso de la hoja"],
      ["1218", "se lee PDM1218"],
    ]);
  });
});
