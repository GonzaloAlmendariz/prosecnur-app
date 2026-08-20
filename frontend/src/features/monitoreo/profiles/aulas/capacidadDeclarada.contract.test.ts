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
];

describe("capacidad declarada en los paneles del perfil", () => {
  it("los componentes de la lista existen", () => {
    // Si uno se renombra, el guard dejaría de vigilarlo en silencio.
    const hay = new Set(readdirSync(dir));
    expect(CON_BLOQUE_PROPIO.filter((f) => !hay.has(f))).toEqual([]);
  });

  it("todos declaran quién posee su vacío", () => {
    const sinDeclarar = CON_BLOQUE_PROPIO.filter((f) => {
      const src = readFileSync(path.join(dir, f), "utf8");
      return !src.includes('data-qa-geometry-capacity="owned"');
    });
    expect(sinDeclarar).toEqual([]);
  });
});
