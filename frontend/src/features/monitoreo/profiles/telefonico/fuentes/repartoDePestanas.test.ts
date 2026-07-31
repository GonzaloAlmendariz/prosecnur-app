import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { repartoDeFuentes, type PestanaDeFuentes } from "./repartoDePestanas";

// El defecto que estas pruebas vigilan, medido en `acnur_pdm` el 2026-07-29: las
// tres pestañas de Fuentes se llamaban por preguntas distintas y mostraban lo
// mismo. «Encuestas» ofrecía configurar hojas de cálculo, «Universo y barrido»
// ofrecía seleccionar Kobo, y «Fuentes activas» era la unión literal de las dos.

const PESTANAS: PestanaDeFuentes[] = ["activas", "sheets", "survey"];

describe("cada pestaña de Fuentes muestra sólo lo suyo", () => {
  it("Universo y barrido no ofrece configurar Kobo", () => {
    const reparto = repartoDeFuentes("sheets", true);
    expect(reparto.decisionKobo).toBe(false);
    expect(reparto.slots).toEqual(["universo", "barrido"]);
  });

  it("Encuestas no ofrece hojas de cálculo", () => {
    const reparto = repartoDeFuentes("survey", true);
    expect(reparto.slots).toEqual(["plataforma"]);
  });

  it("Fuentes activas no repite las tarjetas de las otras dos", () => {
    // Era su defecto de fondo: con los tres slots pintados, la pestaña de
    // resumen no aportaba nada que no estuviera ya en las otras dos.
    const reparto = repartoDeFuentes("activas", true);
    expect(reparto.slots).toEqual([]);
    expect(reparto.cadena).toBe(true);
    expect(reparto.listaConfigurada).toBe(true);
  });

  it("ninguna decisión aparece en dos pestañas a la vez", () => {
    const cuenta = (campo: "decisionKobo") => (
      PESTANAS.filter((pestana) => repartoDeFuentes(pestana, true)[campo]).length
    );
    expect(cuenta("decisionKobo")).toBe(1);
  });

  it("el bloque de lectura de Sheets no vuelve por la puerta de atrás", () => {
    // Decía «Sheets listos para operación» y repetía universo, barrido y último
    // sync de las tarjetas de arriba. Si alguien lo reintroduce, esto lo ve.
    const page = readFileSync(resolve(__dirname, "..", "TelefonicoMonitoreoPage.tsx"), "utf8");
    expect(page).not.toContain("AcreditacionPhoneSheetsDecision");
    expect(page).not.toContain("Sheets listos para operación");
  });

  it("el nombre de la encuesta se dice una vez en la pestaña Encuestas", () => {
    // Medido en pantalla sobre acnur_pdm: «Post-Distribution Monitoring -
    // Espacios de Protección 2026 Q2» aparecía cuatro veces —la tarjeta, la
    // cabecera del bloque de instrumento, su «Instrumento activo» y el paso 1 de
    // su tira—, dos de ellas recortadas. Las tres últimas eran del mismo bloque,
    // que además repetía el filtro del editor de abajo y dedicaba un paso a las
    // hojas, que se deciden en otra pestaña.
    const page = readFileSync(resolve(__dirname, "..", "TelefonicoMonitoreoPage.tsx"), "utf8");
    expect(page).not.toContain("AcreditacionPhoneInstrumentDecision");
    expect(page).not.toContain("3 · Contraste telefónico");
    // `sourceTitle` era la variable que las tres copias pintaban.
    expect(page).not.toContain("const sourceTitle = primary");
    // Quien lo dice es la tarjeta de la fuente, con su enlace.
    expect(page).toContain("AcreditacionPhoneSourceSlotCard");
  });

  it("el filtro de efectiva se lee una vez, donde se cambia", () => {
    // El título del editor componía «Intro/Consent = Yes» y las tres celdas de
    // abajo lo vuelven a componer campo a campo, a 40 px de distancia.
    const page = readFileSync(resolve(__dirname, "..", "TelefonicoMonitoreoPage.tsx"), "utf8");
    expect(page).not.toContain("const displayLabel = configured");
    // Y el párrafo que describía los propios controles rotulados.
    expect(page).not.toContain("Selecciona la pregunta de consentimiento");
  });

  it("cada slot se pinta en una sola pestaña", () => {
    const todos = PESTANAS.flatMap((pestana) => repartoDeFuentes(pestana, true).slots);
    expect(todos).toHaveLength(new Set(todos).size);
    expect(new Set(todos)).toEqual(new Set(["universo", "barrido", "plataforma"]));
  });
});

describe("el resumen abre la puerta cuando falta una pieza", () => {
  it("con el contrato incompleto muestra las tres piezas para conectarlas", () => {
    // Es la pantalla donde se ve que falta; mandar a buscar el formulario a otro
    // sitio es cómo un estudio a medio configurar se queda a medio configurar.
    // Cada tarjeta lleva al panel de conexión sobre su pieza.
    const reparto = repartoDeFuentes("activas", false);
    expect(reparto.slots).toEqual(["universo", "barrido", "plataforma"]);
  });

  it("con el contrato completo el resumen vuelve a ser sólo lectura", () => {
    const reparto = repartoDeFuentes("activas", true);
    expect(reparto.slots).toEqual([]);
  });

  it("las pestañas de decisión no cambian con el estado del contrato", () => {
    for (const pestana of ["sheets", "survey"] as const) {
      expect(repartoDeFuentes(pestana, false)).toEqual(repartoDeFuentes(pestana, true));
    }
  });
});

describe("el papel precargado al conectar corresponde a la pestaña", () => {
  it("desde Encuestas se conecta una fuente de respuestas", () => {
    expect(repartoDeFuentes("survey", true).papelAlConectar).toBe("respuestas");
  });

  it("desde el resumen y desde las hojas lo decide el guion del modo", () => {
    // No hay una respuesta única: en «Universo y barrido» caben las dos, y el
    // guion telefónico ordena el barrido primero. Fijar «universo» aquí haría
    // que el panel se abriera contradiciendo el orden que él mismo enseña.
    expect(repartoDeFuentes("sheets", true).papelAlConectar).toBeUndefined();
    expect(repartoDeFuentes("activas", true).papelAlConectar).toBeUndefined();
  });
});

describe("el page-file dejó de repartir por booleanos sueltos", () => {
  it("los dos bloques de configuración ya no se montan siempre", () => {
    // El síntoma exacto: `showSheetsEditors` y `showKoboEditor` sólo gobernaban
    // el atributo `open` del `<details>`, así que los dos se renderizaban en las
    // tres pestañas. Si vuelven, esto se pone rojo.
    const page = readFileSync(resolve(__dirname, "..", "TelefonicoMonitoreoPage.tsx"), "utf8");
    expect(page).not.toContain("const showSheetsEditors =");
    expect(page).not.toContain("const showKoboEditor =");
    expect(page).toContain("repartoDeFuentes(");
  });
});

describe("Fuentes declara, no cablea", () => {
  // El cableado —dirección del Sheet, pestaña, rango, servidor de Kobo— se
  // decide al conectar la fuente y en ningún otro sitio. Tenerlo también dentro
  // de las pestañas eran dos caminos para lo mismo, y el de Fuentes ignoraba el
  // orden en que el guion del modo pide las piezas.
  const contrato = () => readFileSync(
    resolve(__dirname, "..", "TelefonicoMonitoreoPage.tsx"),
    "utf8",
  ).split("function AcreditacionPhoneSourcesContractPanel")[1] ?? "";

  it("ninguna pestaña monta el editor de hojas ni el selector de Kobo", () => {
    const seccion = contrato();
    expect(seccion).not.toContain("<AcreditacionSheetSourceEditor");
    expect(seccion).not.toContain("<AcreditacionKoboSourcePicker");
  });

  it("no pide la dirección del Sheet ni el rango de celdas", () => {
    const seccion = contrato();
    expect(seccion).not.toContain("Dirección del Google Sheet");
    expect(seccion).not.toContain("Rango de celdas");
    expect(seccion).not.toContain("Leer pestañas");
  });

  it("la puerta al cableado es el panel de conexión", () => {
    expect(contrato()).toContain("abrirParaCambiar");
  });
});
