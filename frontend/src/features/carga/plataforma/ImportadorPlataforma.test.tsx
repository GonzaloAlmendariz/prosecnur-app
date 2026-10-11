import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImportadorPlataforma, type ImportadorPlataformaProps } from "./ImportadorPlataforma";
import type { ResultadoImport } from "./modeloPlataforma";
import type { ImportTerminado, ImportVivo } from "./usePlataformaStore";

const noop = async () => {};

function importacion(over: Partial<ImportadorPlataformaProps["importacion"]>): ImportadorPlataformaProps["importacion"] {
  return {
    estado: "inactivo",
    lanzando: null,
    vivo: null,
    terminado: null,
    transcurridoMs: 0,
    cancelar: noop,
    descartar: () => {},
    ...over,
  };
}

const vivo: ImportVivo = {
  clave: "surveymonkey:separada",
  proveedor: "surveymonkey",
  estrategia: "separada",
  etiqueta: "Percepción comunidad de acogida",
  iniciadoEn: 0,
  cancelSolicitado: false,
  jobId: "j1",
  progreso: { fase: 1, percent: 62, actual: 1183, total: 1900, mensaje: "Descargando respuestas" },
  reintentando: false,
};

function terminado(resultado: ResultadoImport): ImportTerminado {
  return {
    clave: "surveymonkey:separada",
    proveedor: "surveymonkey",
    estrategia: "separada",
    etiqueta: "Percepción comunidad de acogida",
    jobId: "j1",
    iniciadoEn: 0,
    terminadoEn: 1,
    resultado,
    notificado: true,
  };
}

const exito = {
  baseNombre: "acogida",
  nFilas: 1900,
  nColumnas: 80,
  nBases: 2,
  basesHijas: [],
  estudio: null,
  separado: null,
  unico: null,
};

function render(props: Partial<ImportadorPlataformaProps> & Pick<ImportadorPlataformaProps, "importacion">) {
  return renderToStaticMarkup(
    <ImportadorPlataforma proveedor="surveymonkey" estrategia="separada" onIrABase={() => {}} onReintentar={() => {}} {...props} />,
  );
}

describe("ImportadorPlataforma", () => {
  it("inactivo no ocupa espacio", () => {
    expect(render({ importacion: importacion({}) })).toBe("");
  });

  it("en curso: cuatro fases, avance, tiempo transcurrido, Cancelar y C1 declarado", () => {
    const html = render({ importacion: importacion({ estado: "en-curso", vivo, transcurridoMs: 48_000 }) });
    expect(html).toContain("Importación en curso");
    expect(html).toContain("Descargando respuestas · 1,183 de 1,900 · 0:48 transcurridos");
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="62"/);
    expect(html.match(/data-fase-estado=/g)).toHaveLength(4);
    expect(html).toContain('data-fase-estado="hecha"');
    expect(html).toMatch(/data-fase-estado="actual" aria-current="step">Descargar respuestas/);
    expect(html).toContain("Materializar base");
    expect(html).toContain(">Cancelar</button>");
    expect(html).toContain('data-qa-geometry-group="carga-importador-job"');
    expect(html).toContain('data-qa-geometry-group="carga-importador-fases"');
    expect(html).toContain("la importación sigue y te avisamos al terminar");
  });

  it("cancelando: el botón se deshabilita y lo dice", () => {
    const html = render({ importacion: importacion({ estado: "en-curso", vivo: { ...vivo, cancelSolicitado: true } }) });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Cancelando…<\/button>/);
  });

  it("importado: nombra la base y ofrece abrirla con flecha (nunca «Ir →»)", () => {
    const html = render({ importacion: importacion({ estado: "terminado", terminado: terminado({ tipo: "importado", ...exito }) }) });
    expect(html).toContain("quedó en la base acogida");
    expect(html).toContain("1,900 registros · 80 columnas");
    expect(html).toContain("Abrir base acogida");
    expect(html).toContain("pulso-button--nav");
    expect(html).not.toMatch(/Ir\s*→/);
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Reintentar");
  });

  it("cancelado pero importado: avisa que la base quedó", () => {
    const html = render({ importacion: importacion({ estado: "terminado", terminado: terminado({ tipo: "cancelado-importado", ...exito }) }) });
    expect(html).toContain("Cancelaste, pero la importación ya había terminado");
    expect(html).toContain("La base acogida quedó en el estudio");
    expect(html).toContain('data-tono="aviso"');
  });

  it("cancelado: el estudio no cambió y se puede reintentar", () => {
    const html = render({ importacion: importacion({ estado: "terminado", terminado: terminado({ tipo: "cancelado" }) }) });
    expect(html).toContain("Importación cancelada");
    expect(html).toContain("El estudio no cambió.");
    expect(html).toContain("Reintentar");
  });

  it("error: título, mensaje y código al final; role=alert", () => {
    const html = render({
      importacion: importacion({
        estado: "terminado",
        terminado: terminado({ tipo: "error", codigo: "E_BASE_DUP", titulo: "Ya existe una base con ese nombre", mensaje: "Ya existe 'acogida'." }),
      }),
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Ya existe una base con ese nombre");
    expect(html).toMatch(/Ya existe &#x27;acogida&#x27;\.<code[^>]*>E_BASE_DUP<\/code>/);
    expect(html).toContain('aria-label="Cerrar aviso de importación"');
  });

  it("sesión obsoleta: descarta con copy propio y su código", () => {
    const html = render({
      importacion: importacion({ estado: "terminado", terminado: terminado({ tipo: "sesion-obsoleta", mensaje: "El proyecto cambió." }) }),
    });
    expect(html).toContain("Importación descartada");
    expect(html).toContain("E_CARGA_JOB_STALE_SESSION");
  });

  it("CSS propio solo con tokens --pulso-* (sin hex)", () => {
    const css = fs.readFileSync(fileURLToPath(new URL("./importador-plataforma.css", import.meta.url)), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toContain("prefers-reduced-motion");
  });
});
