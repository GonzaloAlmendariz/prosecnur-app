import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Un panel nuevo declara quién posee su vacío.
 *
 * Los `<section>` del perfil declaran `data-qa-geometry-group`, y si nadie
 * dentro declara `data-qa-geometry-capacity="owned"`, el runner elige un
 * candidato por su cuenta: le toca el `mon-profile-panel-head` y lee 4-5 px de
 * padding de encabezado como capacidad sin dueño (`capacity-drift`).
 *
 * **Este guard existe porque es el tercer olvido de la misma cosa en un día**:
 * pasó al añadir «Lo que falta para cerrar», y otra vez con los tres paneles de
 * Validación a la vez. La trampa está descrita en el propio contrato de
 * superficie y aun así se repite, porque el panel funciona perfectamente sin
 * ella y sólo lo caza el gate visual —que tarda cuatro minutos y no siempre se
 * corre antes de commitear—.
 *
 * Se comprueba lo barato: que todo componente del perfil que dibuja un bloque de
 * datos propio lo declare. No sustituye al gate, lo adelanta.
 */

const dir = __dirname;

/** Componentes que dibujan contenido dentro de un panel del perfil. */
const CON_BLOQUE_PROPIO = [
  "AulasObservacionesDeCampo.tsx",
  "AulasTrabajoDeLosEquipos.tsx",
  "AulasParteContraPlataforma.tsx",
  "AulasLoQueFalta.tsx",
  "AulasAlcanceDelBanco.tsx",
  // Cuarto olvido, 2026-09-12, y con una vuelta de tuerca: su rama de VACÍO
  // declaraba la capacidad y la rama CON DATOS no. El guard de entonces miraba
  // si la cadena aparecía en algún sitio del archivo, así que lo habría dado
  // por bueno aunque hubiera estado en esta lista. Por eso el criterio cambió.
  "AulasEfectividadPorDia.tsx",
];

/**
 * Los retornos que devuelven el bloque del componente, con su etiqueta raíz.
 *
 * Se buscan por indentación —el `return (` del cuerpo de la función, y los de
 * sus guardas tempranas— y se salta el comentario que suele ir delante. Nada
 * más: los `return` de los helpers internos y de los `map` viven más adentro y
 * NO se miran, que es lo que mantiene el guard sin ruido. Medido sobre los seis
 * archivos: 2, 2, 4, 4, 2 y 2 raíces, ninguna falsa.
 */
const RAICES = /^ {2,6}return \(\s*\n(?:\s*(?:\{\/\*(?:.|\n)*?\*\/\}|\/\/[^\n]*)\s*\n)*\s*(<[a-zA-Z][^>]*?>)/gm;

describe("capacidad declarada en los paneles del perfil", () => {
  it("los componentes de la lista existen", () => {
    // Si uno se renombra, el guard dejaría de vigilarlo en silencio.
    const hay = new Set(readdirSync(dir));
    expect(CON_BLOQUE_PROPIO.filter((f) => !hay.has(f))).toEqual([]);
  });

  it("lo declara CADA rama, no el archivo en algún sitio", () => {
    // **El criterio viejo era un `includes` sobre el archivo entero, y eso no
    // es un guard: es una coartada.** `AulasEfectividadPorDia` lo contenía —en
    // su rama de «todavía no hay partes»— y su rama CON DATOS no lo declaraba,
    // que es la que se pinta siempre que hay operativo. El gate visual lo cazó
    // como `capacity-drift` de 5 px sobre el encabezado del panel; este guard
    // no lo habría visto.
    const sinDeclarar: string[] = [];
    for (const f of CON_BLOQUE_PROPIO) {
      const src = readFileSync(path.join(dir, f), "utf8");
      const raices = [...src.matchAll(RAICES)].map((m) => m[1]);
      // Un componente de esta lista dibuja un bloque: si no se le encuentra
      // ninguna raíz, el que se quedó ciego es el guard, no el componente.
      if (!raices.length) sinDeclarar.push(`${f} (sin raíces reconocibles)`);
      for (const raiz of raices) {
        if (!raiz.includes("data-qa-geometry-capacity")) {
          sinDeclarar.push(`${f} → ${raiz.replace(/\s+/g, " ").slice(0, 60)}`);
        }
      }
    }
    expect(sinDeclarar).toEqual([]);
  });
});
