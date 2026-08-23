// Un atajo lleva a donde dice que lleva.
//
// «Abrir fichas QR» apuntaba a `/recopiladores` —el módulo a secas— y
// Recopiladores aterriza en su primera sección, que es el plan de recolección.
// Medido el 2026-08-23: el botón prometía fichas y dejaba al usuario en la lista
// de las 193 aulas, dos secciones antes de donde se preparan.
//
// Estaba igual en los dos sitios que lo ofrecen —Cálculo de muestra y
// Monitoreo—, que es la señal de que no fue un descuido de uno: un destino sin
// sección se copia tal cual.
//
// El test mira el fuente y no el render porque los dos componentes viven detrás
// de un estudio cargado, y lo que hay que fijar es el DESTINO, que es una
// constante del código.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const ATAJOS = [
  {
    donde: "features/calcMuestra/universidad/aulas/ClassroomAuditPanels.tsx",
    label: "Abrir fichas QR",
    seccion: "seccion=materiales",
  },
  {
    donde: "features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx",
    label: "Abrir fichas QR",
    seccion: "seccion=materiales",
  },
];

describe("los atajos entre módulos llevan a su sección, no al módulo pelado", () => {
  for (const atajo of ATAJOS) {
    it(`«${atajo.label}» desde ${path.basename(atajo.donde)}`, () => {
      const fuente = fs.readFileSync(path.join(raiz, atajo.donde), "utf8");
      // La línea del atajo: el `to` y el `label` viajan juntos en el mismo
      // objeto, así que se busca la ventana que los contiene a los dos.
      const linea = fuente
        .split("\n")
        .find((l) => l.includes(atajo.label) && l.includes("to:"));
      expect(linea, `no se encontró el atajo «${atajo.label}»`).toBeDefined();
      expect(linea).toContain(atajo.seccion);
      // Y el control que hace que el test valga: sin él, un destino que
      // volviera a «/recopiladores» a secas seguiría conteniendo la palabra
      // «materiales» en cualquier otra parte de la línea y pasaría.
      expect(linea).not.toMatch(/to:\s*"\/[a-z-]+"/);
    });
  }

  it("la dirección con sección es la que el contrato de navegación declara", () => {
    // Si el slug cambiara, este test seguiría verde mientras el atajo apuntara
    // a una sección inexistente. El manifiesto es quien manda.
    const manifiesto = fs.readFileSync(path.join(raiz, "lib/modules.ts"), "utf8");
    expect(manifiesto).toContain("materiales");
  });
});
