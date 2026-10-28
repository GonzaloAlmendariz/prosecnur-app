// D13 (Gonzalo, 2026-10-11: «Cambiar --danger»): lo destructivo de Monitoreo
// va en el rojo vivo del kit, distinto del carmesí del módulo y del rojo oscuro
// de los avisos. Ese rojo lo pinta SOLO el kit (`PulsoButton variant="danger"`,
// con `confirm` en el botón final): el contrato del kit (`PulsoButton.test.tsx`)
// prohíbe consumir su token fuera de él para que no repinte a nadie. El nombre
// del token se arma por partes para que este archivo no cuente como consumidor.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname);

function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta, ext);
    return ext.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

const rel = (ruta: string) => ruta.slice(RAIZ.length + 1);

const TOKEN_DEL_KIT = ["--pulso", "danger", "solid"].join("-");

/**
 * Los archivos con acciones destructivas de Monitoreo: anular un caso, anular
 * la producción de un aplicador (y su confirmación en el diálogo) y revertir
 * una subsanación. Revertir una ANULACIÓN no destruye —los casos vuelven a
 * contar— y su botón es primario a propósito.
 */
const CON_ACCION_DESTRUCTIVA = [
  "profiles/territorial/control/BandejaTab.tsx",
  "profiles/territorial/control/EquipoTab.tsx",
  "profiles/territorial/control/DialogoDeAnulacion.tsx",
  "profiles/territorial/control/SubsanacionesTab.tsx",
];

describe("D13: lo destructivo de Monitoreo va en el botón de peligro del kit", () => {
  it("ninguna hoja de Monitoreo pinta con el token de peligro del kit ni con un `.is-peligro` propio", () => {
    const hojas = archivos(RAIZ, /\.css$/);
    // Centinela: si el recorrido deja de encontrar hojas, el guard no guarda.
    expect(hojas.length).toBeGreaterThan(50);
    const malas = hojas.filter((ruta) => {
      const css = readFileSync(ruta, "utf8");
      return css.includes(TOKEN_DEL_KIT) || /boton[^,{]*\.is-peligro/.test(css);
    });
    expect(malas.map(rel)).toEqual([]);
  });

  it("cada acción destructiva usa PulsoButton variant=\"danger\"", () => {
    const sinKit = CON_ACCION_DESTRUCTIVA.filter((ruta) => {
      const texto = readFileSync(join(RAIZ, ruta), "utf8");
      return !/<PulsoButton[^>]*variant="danger"/.test(texto);
    });
    expect(sinKit).toEqual([]);
  });
});
