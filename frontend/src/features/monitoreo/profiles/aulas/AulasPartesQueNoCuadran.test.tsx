import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasPartesQueNoCuadran } from "./AulasPartesQueNoCuadran";
import type { MonitoreoRow } from "../../../../api/monitoreo";

const fila = (p: Record<string, unknown>) => p as unknown as MonitoreoRow;
const pinta = (filas: MonitoreoRow[]) => renderToStaticMarkup(<AulasPartesQueNoCuadran filas={filas} />);

describe("los partes que no cuadran se leen como una resta", () => {
  it("dice la aritmética entera y el saldo", () => {
    const html = pinta([fila({
      operational_code: "CH 31", actual_room: "A206", observed_students: 48,
      refusals: 2, duplicates: 1, esperado: 45, effective_surveys: 39,
      // `diferencia = efectivas − esperado` (el motor): 39 − 45 = −6.
      diferencia: -6, cuadra: false,
    })]);
    expect(html).toContain("CH 31");
    expect(html).toContain("48");
    expect(html).toContain("rechazos");
    expect(html).toContain("duplicado");
    expect(html).toContain("declaró");
    expect(html).toContain("faltan 6");
  });

  it("de más dice «sobran», que es otro problema", () => {
    // De menos son encuestas que no llegaron; de más, encuestas sin quien las
    // respondiera en esa aula. Llamarlo igual escondería la diferencia.
    // 26 declaradas − 20 esperadas = +6.
    const html = pinta([fila({
      operational_code: "CH 9", observed_students: 20, esperado: 20,
      effective_surveys: 26, diferencia: 6, cuadra: false,
    })]);
    expect(html).toContain("sobran 6");
  });

  it("el signo es el del MOTOR, no el que uno supone", () => {
    // `diferencia = efectivas − esperado` (monitoreo_aulas_reconciliacion.R:51).
    // Este caso es literal del operativo: CH 76, 50 en el aula, 23 declaradas.
    // La primera versión decía «sobran 27» y el test lo daba por bueno porque
    // la fixture llevaba dentro la misma suposición equivocada.
    const html = pinta([fila({
      operational_code: "CH 76", observed_students: 50, esperado: 50,
      effective_surveys: 23, diferencia: 23 - 50, cuadra: false,
    })]);
    expect(html).toContain("faltan 27");
    expect(html).not.toContain("sobran");
  });

  it("sólo entra lo que el motor marcó como descuadrado", () => {
    const html = pinta([
      fila({ operational_code: "CH 1", cuadra: true, diferencia: 0 }),
      fila({ operational_code: "CH 2", cuadra: null }),
      fila({ operational_code: "CH 3", cuadra: false, diferencia: 2 }),
    ]);
    expect(html).toContain("CH 3");
    expect(html).not.toContain("CH 1");
    expect(html).not.toContain("CH 2");
  });

  it("sin descuadres no pinta un marco vacío", () => {
    expect(pinta([fila({ operational_code: "CH 1", cuadra: true })])).toBe("");
  });

  it("un rechazo o duplicado en cero no ensucia la cuenta", () => {
    // «48 en el aula − 0 rechazos − 0 duplicados» es ruido: si no cayó nadie,
    // no hay resta que mostrar.
    const html = pinta([fila({
      operational_code: "CH 5", observed_students: 48, refusals: 0, duplicates: 0,
      esperado: 48, effective_surveys: 40, diferencia: 40 - 48, cuadra: false,
    })]);
    expect(html).not.toContain("rechazo");
    expect(html).not.toContain("duplicado");
    expect(html).toContain("faltan 8");
  });
});
