import { describe, expect, it } from "vitest";
import { searchDePiezaIdentidad } from "./direccionIdentidad";

describe("searchDePiezaIdentidad", () => {
  it("abre la pieza en Identidad, sin panel ni el foco de la lámina, y conserva el resto", () => {
    const s = new URLSearchParams(searchDePiezaIdentidad("?seccion=graficos&pestana=laminas&panel=avisos&foco=s3:g1&ambito=consolidated", "colores"));
    expect(s.get("pestana")).toBe("identidad");
    expect(s.get("foco")).toBe("colores");
    expect(s.get("panel")).toBeNull();
    expect(s.get("seccion")).toBe("graficos");
    expect(s.get("ambito")).toBe("consolidated");
  });

  it("los rótulos cortos del estudio tienen su propia dirección", () => {
    expect(new URLSearchParams(searchDePiezaIdentidad("", "rotulos")).get("foco")).toBe("rotulos");
  });
});
