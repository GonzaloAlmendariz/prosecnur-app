import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MigaAtlas } from "./AtlasPaneles";
import type { CiudadAtlas } from "./ciudades";

// La ayuda de la miga va entre paréntesis: es un hijo de un contenedor flex con hueco, y una
// coma inicial quedaba suelta («Perú , 26 ciudades…», auditoría a 1366, 4 nov 2026).
const ayuda = (html: string) => html.match(/class="hr-lienzo-miga-ayuda">([\s\S]*?)<\/span>/)?.[1].replace(/<!--.*?-->/g, "").trim() ?? "";
const nada = () => undefined;
const arequipa = { codigo: "arequipa", nombre: "Arequipa", departamento: "Arequipa" } as unknown as CiudadAtlas;

describe("la ayuda de la miga del atlas", () => {
  it("nunca empieza con coma, en ninguna de sus variantes", () => {
    const variantes = [
      renderToStaticMarkup(<MigaAtlas total={26} departamento={null} ciudad={null} distritos={0} cargando={false} onPeru={nada} onDepartamento={nada} />),
      renderToStaticMarkup(<MigaAtlas total={26} departamento="Arequipa" ciudad={null} distritos={0} cargando={false} onPeru={nada} onDepartamento={nada} />),
      renderToStaticMarkup(<MigaAtlas total={26} departamento={null} ciudad={arequipa} distritos={0} cargando onPeru={nada} onDepartamento={nada} />),
      renderToStaticMarkup(<MigaAtlas total={26} departamento={null} ciudad={arequipa} distritos={12} cargando={false} enEstudio onPeru={nada} onDepartamento={nada} />),
    ].map(ayuda);
    expect(variantes).toEqual([
      "(26 ciudades con cartografía)",
      "(clic en una ciudad para ver su ficha)",
      "(cargando sus distritos…)",
      "(12 distritos, en el estudio)",
    ]);
  });
});
