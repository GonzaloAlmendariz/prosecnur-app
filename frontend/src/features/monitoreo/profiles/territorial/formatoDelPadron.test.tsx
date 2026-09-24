import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claveDelPadron, formatoDelPadron, formatoVigente, useFormatoDelPadron } from "./formatoDelPadron";

// Un padrón en DNI recargado en la consola tiene que seguir en DNI: si el
// selector nace en PXXX, la siguiente subida manda PXXX y el motor regenera
// todos los códigos (contrato del campo en
// api/tests/testthat/test-http-contract-monitoreo-roster-campos.R).

const padronDni = { code_format: "DNI", uploaded_at: "2026-09-24T10:00:00Z", generated_at: "2026-09-24T10:00:00Z", source_file_id: "f1" };
const padronPxxx = { code_format: "PXXX", uploaded_at: "2026-09-24T11:00:00Z", generated_at: "2026-09-24T11:00:00Z", source_file_id: "f2" };

function Selector({ roster }: { roster: Parameters<typeof useFormatoDelPadron>[0] }) {
  const [formato] = useFormatoDelPadron(roster);
  return <span>{formato}</span>;
}

describe("formatoDelPadron", () => {
  it("lee el formato como el motor", () => {
    expect(formatoDelPadron("DNI")).toBe("DNI");
    expect(formatoDelPadron(" documento ")).toBe("DNI");
    expect(formatoDelPadron("PXXX")).toBe("PXXX");
    expect(formatoDelPadron("")).toBe("PXXX");
    expect(formatoDelPadron(undefined)).toBe("PXXX");
  });
});

describe("useFormatoDelPadron", () => {
  it("un padrón guardado en DNI abre el selector en DNI", () => {
    expect(renderToStaticMarkup(<Selector roster={padronDni} />)).toBe("<span>DNI</span>");
  });

  it("sin padrón abre en PXXX", () => {
    expect(renderToStaticMarkup(<Selector roster={null} />)).toBe("<span>PXXX</span>");
  });
});

describe("formatoVigente", () => {
  it("la elección del usuario manda mientras el padrón no cambie", () => {
    const eleccion = { padron: claveDelPadron(padronDni), formato: "PXXX" as const };
    expect(formatoVigente(padronDni, eleccion)).toBe("PXXX");
  });

  it("un padrón nuevo descarta la elección hecha sobre el anterior", () => {
    const eleccion = { padron: claveDelPadron(padronPxxx), formato: "PXXX" as const };
    expect(formatoVigente(padronDni, eleccion)).toBe("DNI");
  });

  it("la clave cambia con cada subida aunque el formato sea el mismo", () => {
    expect(claveDelPadron(padronDni)).not.toBe(claveDelPadron({ ...padronDni, uploaded_at: "2026-09-25T09:00:00Z" }));
  });
});
