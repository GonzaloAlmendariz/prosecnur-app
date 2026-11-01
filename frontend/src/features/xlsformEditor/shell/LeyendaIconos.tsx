// Botón «?» de la barra del editor: abre la leyenda visual de los íconos (sellos de tipo y marcas del riel). El modelo
// vive en `leyendaIconosModelo.ts`; aquí se pintan con las mismas piezas del kit que usa la Estructura.

import { Popover } from "../../../components/Popover";
import { CircleHelp } from "../../../vendor/lucide-react";
import { GlifoMarca } from "../kit/GlifoMarca";
import { Sello } from "../kit/Sello";
import { gruposDeTipos, marcasDeLaLeyenda } from "./leyendaIconosModelo";
import "../styles/xf-leyenda.css";

export function LeyendaIconos() {
  const grupos = gruposDeTipos();
  const marcas = marcasDeLaLeyenda();
  return (
    <Popover
      align="end"
      maxWidth={560}
      className="xf-leyenda"
      ariaLabel="Qué significa cada ícono"
      trigger={(
        <button
          type="button"
          className="xf-leyenda-boton"
          aria-label="Qué significa cada ícono"
          title="Qué significa cada ícono"
        >
          <CircleHelp size={15} aria-hidden="true" />
        </button>
      )}
    >
      <div className="xf-leyenda-cuerpo">
        <section aria-labelledby="xf-leyenda-marcas">
          <h3 id="xf-leyenda-marcas">Lógica y reglas</h3>
          <p className="xf-leyenda-nota">Las marcas a la derecha de cada pregunta en la Estructura.</p>
          <ul
            className="xf-leyenda-marcas"
            data-qa-geometry-group="xlsform/leyenda-marcas"
            data-qa-geometry-contract="intrinsic"
          >
            {marcas.map((m) => (
              <li key={m.clave}>
                <GlifoMarca clave={m.clave} size={18} />
                <span>
                  <strong>{m.nombre}</strong>
                  <small>{m.significado}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="xf-leyenda-tipos">
          <h3 id="xf-leyenda-tipos">Tipos de pregunta</h3>
          <p className="xf-leyenda-nota">El color dice la familia; la forma, el tipo.</p>
          {grupos.map((g) => (
            <div key={g.grupo} className="xf-leyenda-grupo">
              <h4>{g.nombre}</h4>
              <ul
                className="xf-leyenda-tipos"
                data-qa-geometry-group={`xlsform/leyenda-tipos-${g.grupo}`}
                data-qa-geometry-contract="intrinsic"
              >
                {g.tipos.map((t) => (
                  <li key={t.base}>
                    <Sello baseType={t.base} size={18} />
                    <span>{t.nombre}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </Popover>
  );
}
