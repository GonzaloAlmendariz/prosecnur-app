import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Toda superficie del perfil de aulas declara su contrato de geometría.
 *
 * **Por qué un contrato sin grupo es peor que ninguno.** `ui-quick-check.mjs`
 * recorre `document.querySelectorAll("[data-qa-geometry-group]")` y lee el
 * contrato DE AHÍ. Una sección con `data-qa-geometry-contract` y sin
 * `data-qa-geometry-group` parece declarada al leer el código y es invisible
 * para el gate: no sale conforme ni no conforme, sencillamente no se mide. Es
 * la forma más cara de verde por ausencia, porque además tranquiliza.
 *
 * Medido el 2026-08-29 al escribir esto: tres secciones de
 * `AulasSeccionFuentes` estaban así —el embudo, las fuentes y el criterio de
 * efectiva— y una de `AulasHistoriaCadena` no declaraba nada. Ninguna venía de
 * los cortes del page-file: se comprobó contra el commit anterior.
 */
const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * Sin comentarios, y por una razón medida: la primera versión de este test
 * señaló cinco falsos positivos, tres de ellos comentarios que EXPLICAN por qué
 * no hay contrato ahí y contienen el nombre del atributo. Un detector que no
 * distingue código de prosa acusa justo a quien documentó la decisión.
 *
 * Se sustituyen por líneas en blanco en vez de borrarse, para que los números
 * de línea del informe sigan siendo los del archivo.
 */
const sinComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .split("\n")
  .map((l) => (l.trim().startsWith("//") ? "" : l))
  .join("\n");

const fuentes = fs.readdirSync(aqui)
  .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
  .map((f) => ({
    archivo: f,
    texto: sinComentarios(fs.readFileSync(path.join(aqui, f), "utf8")),
  }));

describe("el contrato de superficie del perfil de aulas", () => {
  it("todo `group` lleva su `contract` en el MISMO elemento", () => {
    // Ésta es la dirección que el runner sí consume: recorre
    // `[data-qa-geometry-group]` y lee el contrato de ese mismo elemento, con
    // `equal` por defecto si falta. Un grupo sin contrato explícito se mide
    // como `equal` sin haberlo decidido nadie.
    //
    // LA DIRECCIÓN CONTRARIA NO SE EXIGE, y no por olvido: hay contratos sin
    // grupo que son INERTES —el runner no los ve— y aun así deliberados,
    // porque `AulasCompactWorkbenchLayout.test.ts` pide que todo panel declare
    // su contrato en su etiqueta mientras el grupo vive en el contenedor de
    // datos, para que la cabecera no entre como miembro y sus px de holgura no
    // salgan como `capacity-drift`. Dos convenciones que conviven; forzar la
    // simetría rompería la otra.
    // Se mira la ETIQUETA DE APERTURA, no una ventana de líneas. Con ventana
    // de ocho, un bloque de comentario de nueve entre el grupo y su contrato
    // daba un falso positivo: el atributo estaba, sólo lejos. La apertura va
    // del `<` que abre la etiqueta al `>` que la cierra, que es exactamente el
    // alcance donde el runner los lee juntos.
    const sinContrato = fuentes.flatMap(({ archivo, texto }) => (
      [...texto.matchAll(/data-qa-geometry-group/g)].flatMap((m) => {
        const desde = texto.lastIndexOf("<", m.index ?? 0);
        const hasta = texto.indexOf(">", m.index ?? 0);
        const apertura = texto.slice(desde, hasta);
        if (apertura.includes("data-qa-geometry-contract")) return [];
        const linea = texto.slice(0, m.index ?? 0).split("\n").length;
        return [`${archivo}:${linea}`];
      })
    ));
    expect(sinContrato, `grupo sin contrato: ${sinContrato.join(" · ")}`).toEqual([]);
  });

  it("el contrato declarado es `equal` o `intrinsic`, nunca otra cosa", () => {
    // El runner rechaza cualquier otro valor y lo reporta como no conforme.
    const raros = fuentes.flatMap(({ archivo, texto }) => (
      [...texto.matchAll(/data-qa-geometry-contract="([^"]*)"/g)]
        .map((m) => m[1])
        .filter((v) => v !== "equal" && v !== "intrinsic")
        .map((v) => `${archivo}: «${v}»`)
    ));
    expect(raros, `contrato inválido: ${raros.join(" · ")}`).toEqual([]);
  });

  it("la cobertura NO baja: se cuenta, no se supone", () => {
    // Tres números, como pide el contrato de superficie: no vale un booleano.
    // Si este total baja, alguien quitó una declaración o añadió una superficie
    // sin declararla, y las dos cosas se ven igual desde fuera.
    const grupos = fuentes.reduce(
      (n, { texto }) => n + (texto.match(/data-qa-geometry-group=/g) ?? []).length, 0,
    );
    expect(grupos).toBeGreaterThanOrEqual(52);
  });
});
