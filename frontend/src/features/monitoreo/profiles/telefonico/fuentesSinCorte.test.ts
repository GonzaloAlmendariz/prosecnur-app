import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CORTE_VACIO } from "../../core/corteVacio";
import { buildAcreditacionPhoneSourceContract } from "./TelefonicoSourcesModel";
import { repartoDeFuentes } from "./fuentes/repartoDePestanas";

// Fuentes existe antes que el corte.
//
// Los dos perfiles renderizan sus secciones desde el último corte y cortaban en
// seco cuando no había ninguno: `if (!reports) return <EmptyPanel "Resumen
// pendiente" />`. Para Avance o Consultas eso es correcto. Para Fuentes era un
// candado cerrado por dentro: el corte sale de sincronizar las fuentes, las
// fuentes se conectan en Fuentes, y un estudio recién abierto se encontraba
// «0/3 · Sin corte» con un panel vacío donde va el botón de conectar.
//
// El arreglo es de orden —la rama de Fuentes va por delante del guardia, con un
// corte neutro—, así que el test vigila el orden. Un test de render no lo
// alcanzaría sin montar la página entera con router y sesión.

const PERFILES = [
  ["telefonico", resolve(__dirname, "TelefonicoMonitoreoPage.tsx")],
  ["acreditacion", resolve(__dirname, "..", "acreditacion", "AcreditacionMonitoreoPage.tsx")],
] as const;

const DESPACHADOR = "function renderAcreditacionView(";
const RAMA_DE_FUENTES = 'if (view === "fuentes")';
const GUARDIA_DEL_CORTE = "if (!reports) {";

describe("Fuentes se puede usar sin corte", () => {
  it.each(PERFILES)("%s monta Fuentes antes del guardia del corte", (_perfil, ruta) => {
    const fuente = readFileSync(ruta, "utf8");
    // Ambos literales aparecen antes en helpers sueltos; lo que se ordena es el
    // despachador de secciones, así que la búsqueda arranca ahí.
    const desde = fuente.indexOf(DESPACHADOR);
    expect(desde, "no se encontró el despachador de secciones").toBeGreaterThan(-1);
    const rama = fuente.indexOf(RAMA_DE_FUENTES, desde);
    const guardia = fuente.indexOf(GUARDIA_DEL_CORTE, desde);
    expect(rama, "no se encontró la rama de Fuentes").toBeGreaterThan(-1);
    expect(guardia, "no se encontró el guardia del corte").toBeGreaterThan(-1);
    expect(rama, "el guardia del corte volvió a tapar Fuentes").toBeLessThan(guardia);
  });

  it("el corte neutro no finge datos", () => {
    expect(CORTE_VACIO.sheets).toEqual([]);
    expect(CORTE_VACIO.client_report).toBeNull();
    expect(CORTE_VACIO.generated_at).toBe("");
  });

  // Que la sección se monte solo sirve si trae con qué actuar: sin ninguna
  // fuente conectada, el resumen tiene que ofrecer las tres piezas del contrato
  // —cada tarjeta es la puerta al panel de conexión—, no una lista vacía.
  it("sin fuentes conectadas el resumen ofrece las tres piezas del contrato", () => {
    const contrato = buildAcreditacionPhoneSourceContract([]);
    expect(contrato.ready).toBe(false);
    expect(contrato.missing).toEqual(["universo", "barrido", "plataforma"]);
    expect(repartoDeFuentes("activas", contrato.ready).slots).toEqual([
      "universo",
      "barrido",
      "plataforma",
    ]);
  });
});
