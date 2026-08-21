import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lo que una acción responde tiene que poder LEERSE.
 *
 * La vista se pinta como `{loading ? <EmptyPanel/> : <lo de verdad/>}`, así que
 * cualquier recarga que encienda `loading` desmonta el subárbol y se lleva por
 * delante el estado de sus componentes. Medido el 2026-08-17: al activar un
 * reemplazo el motor devolvía «CH 6 pasa a reemplazada y entra R 6.1 en su
 * lugar» y quien pulsó el botón no lo leía nunca, porque la recarga posterior
 * remontaba el registro de campo en el mismo tic. Lo mismo con «Guardar
 * registro» y con la publicación a Sheets, que además pierde el id del
 * spreadsheet — lo único que dice DÓNDE quedó publicado.
 *
 * Estos asertos son de código porque el defecto es de composición y no de
 * cálculo: no hay función que probar, hay una forma de montar la vista.
 */

const dir = path.dirname(new URL(import.meta.url).pathname);
const page = fs.readFileSync(path.join(dir, "AulasMonitoreoPage.tsx"), "utf8");

describe("los resultados de una acción sobreviven a su recarga", () => {
  it("las recargas que siguen a una acción con mensaje son silenciosas", () => {
    // El tercer argumento es `silencioso`: no toca `loading`, así que no
    // desmonta. Si alguien lo quita, el mensaje vuelve a durar un tic.
    expect(page).toContain("onGuardado={() => { void loadView(seccionActiva, true, true); }}");
    expect(page).toContain("onPublished={() => { void loadView(seccionActiva, true, true); }}");
  });

  it("«Recargar» SÍ blanquea, porque ahí el blanqueo es la respuesta", () => {
    // El aserto que evita la sobrecorrección: silenciar TODAS las recargas
    // dejaría el botón explícito sin ninguna señal de que hizo algo.
    expect(page).toContain("onSyncAll={() => { void loadView(seccionActiva, true); }}");
  });

  it("`silencioso` no toca `loading` ni al entrar ni al salir", () => {
    expect(page).toContain("if (!silencioso) setLoading(true);");
    expect(page).toContain("if (!silencioso) setLoading(false);");
  });

  it("el aviso se pinta FUERA de la compuerta de carga", () => {
    // Ancla a la clase y no al JSX entero: el nodo gano un `data-tono` y el
            // literal exacto dejo de existir sin que cambiara nada de lo que este
            // test protege.
    const posAviso = page.indexOf('className="aulas-aviso"');
    const posGate = page.indexOf("{loading ? (");
    expect(posAviso).toBeGreaterThan(-1);
    expect(posGate).toBeGreaterThan(-1);
    // Dentro de la compuerta, el aviso se desmontaría con todo lo demás.
    expect(posAviso).toBeLessThan(posGate);
  });

  it("el aviso del libro no viaja como error", () => {
    // «El libro no traía X. Lo demás se leyó» es una importación que FUNCIONÓ.
    // Iba en `setError` —rojo— y además `loadView` limpia `error` al terminar
    // bien, así que el propio import lo borraba con su recarga.
    // La frase se mudó a `avisoLibroImportado` —tiene reglas y se prueba en su
    // propio test—, pero lo que este aserto protege sigue igual: el resultado
    // de una importación que funcionó va al aviso, nunca al error.
    expect(page).toContain("avisoLibroImportado(res)");
    expect(page).toContain("setAviso(anuncio.texto)");
    expect(page).not.toMatch(/setError\(\s*avisoLibro/);
    expect(page).not.toContain("setError(`El libro");
  });

  it("los íconos entran por el shim, no por el barrel de lucide", () => {
    expect(page).not.toMatch(/from "lucide-react"/);
    expect(page).toContain('from "../../../../vendor/lucide-react"');
  });
});

/**
 * El mismo defecto vivía en telefónico y en acreditación.
 *
 * Los dos se pintan tras `seccionCargando = loading || …` y los dos hacían
 * `onPublished: refreshCurrentView` → `loadView(view, true)` → `setLoading(true)`,
 * así que publicar a Sheets desmontaba el workbench con su «N pestañas
 * actualizadas» y el id del spreadsheet dentro. Territorial no tiene compuerta
 * de carga y por eso no aparece aquí: comprobado, no omitido.
 *
 * Las dos páginas están **congeladas a crecimiento** (`agentic/manifest.json`),
 * así que la reparación no añadió ni una línea: el tercer parámetro y las dos
 * guardas caben en las líneas que ya existían. Este archivo es donde vive la
 * explicación que allí no cabía.
 */
const otrosPerfiles = [
  { nombre: "telefónico", ruta: "../telefonico/TelefonicoMonitoreoPage.tsx" },
  { nombre: "acreditación", ruta: "../acreditacion/AcreditacionMonitoreoPage.tsx" },
];

describe.each(otrosPerfiles)("$nombre publica sin perder su confirmación", ({ ruta }) => {
  const fuente = fs.readFileSync(path.join(dir, ruta), "utf8");

  it("acepta el tercer parámetro y lo respeta en las dos guardas", () => {
    expect(fuente).toContain("force = false, silencioso = false");
    expect(fuente).toContain("if (!silencioso) setLoading(true);");
    expect(fuente).toContain("if (!silencioso && seq === loadSeqRef.current");
  });

  it("la recarga que sigue a publicar es silenciosa", () => {
    expect(fuente).toContain("void loadView(seccionActiva, true, true);");
  });
});
