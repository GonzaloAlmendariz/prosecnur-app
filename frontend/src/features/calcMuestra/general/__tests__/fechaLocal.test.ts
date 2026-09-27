/**
 * L8 del loop de mejoras (2026-09-27): el marco declarado y el sorteo se
 * fechaban en UTC («13:25 UTC» a las 08:25 de Lima). La mesa pinta la hora
 * local del equipo; el ISO UTC queda para el registro.
 */
import { describe, expect, it } from "vitest";

import { formatearFechaLocal } from "../modelo";

function localEsperado(iso: string): string {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

describe("formatearFechaLocal", () => {
  it("pinta el ISO del motor en la hora local, sin «UTC»", () => {
    const iso = "2026-09-27T13:25:00Z";
    expect(formatearFechaLocal(iso)).toBe(localEsperado(iso));
    expect(formatearFechaLocal(iso)).not.toContain("UTC");
  });

  it("en Lima, 13:25 UTC son las 08:25 (cifra literal, no espejo)", () => {
    const previa = process.env.TZ;
    process.env.TZ = "America/Lima";
    try {
      expect(formatearFechaLocal("2026-09-27T13:25:00Z")).toBe("2026-09-27 08:25");
      expect(formatearFechaLocal("2026-09-28T02:10:00Z")).toBe("2026-09-27 21:10");
    } finally {
      process.env.TZ = previa;
    }
  });

  it("con un desfase conocido cruza el día bien", () => {
    const iso = "2026-09-28T02:10:00Z";
    expect(formatearFechaLocal(iso)).toBe(localEsperado(iso));
  });

  it("lo que no es fecha lo devuelve tal cual, y vacío es «—»", () => {
    expect(formatearFechaLocal("ayer")).toBe("ayer");
    expect(formatearFechaLocal("")).toBe("—");
  });
});
