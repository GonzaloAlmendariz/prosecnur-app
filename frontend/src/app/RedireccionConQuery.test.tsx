import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes, type NavigateProps, type To } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `<Navigate>` navega en un efecto, y el render estático no corre efectos: se
// captura el destino que la redirección le pide, que es lo que importa aquí.
const pedido: { to: To | null; replace: boolean | undefined } = { to: null, replace: undefined };

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    Navigate: (props: NavigateProps) => {
      pedido.to = props.to;
      pedido.replace = props.replace;
      return null;
    },
  };
});

const { RedireccionConQuery } = await import("./RedireccionConQuery");

function redirigir(entrada: string): To | null {
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/recopiladores" element={<RedireccionConQuery to="/material-campo" />} />
      </Routes>
    </MemoryRouter>,
  );
  return pedido.to;
}

describe("RedireccionConQuery", () => {
  beforeEach(() => {
    pedido.to = null;
    pedido.replace = undefined;
  });

  it("cambia el pathname y conserva la query y el hash", () => {
    expect(redirigir("/recopiladores?seccion=accesos&pestana=vinculacion#x")).toEqual({
      pathname: "/material-campo",
      search: "?seccion=accesos&pestana=vinculacion",
      hash: "#x",
    });
    expect(pedido.replace).toBe(true);
  });

  it("sin query aterriza en el módulo", () => {
    expect(redirigir("/recopiladores")).toEqual({ pathname: "/material-campo", search: "", hash: "" });
  });

  it("App monta /material-campo y redirige /recopiladores sin perder la query", () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const app = fs.readFileSync(path.join(aqui, "App.tsx"), "utf8");
    expect(app).toContain('<Route path="/material-campo" element={<RecopiladoresPage />} />');
    expect(app).toContain('<Route path="/recopiladores" element={<RedireccionConQuery to="/material-campo" />} />');
  });
});
