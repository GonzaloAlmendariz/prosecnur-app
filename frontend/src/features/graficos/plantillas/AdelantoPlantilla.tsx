// Adelanto visual de una plantilla: sus láminas tipo dibujadas con la identidad de la plantilla y lo que declara de
// estilo, formato y contenido. No lee el estudio (modeloAdelanto.ts).

import type { CSSProperties } from "react";
import type { PlantillaInforme } from "./catalogoPlantillas";
import { laminasDeEjemplo, rasgosDePlantilla, type TipoLaminaEjemplo } from "./modeloAdelanto";

function Dibujo({ tipo }: { tipo: TipoLaminaEjemplo }) {
  if (tipo === "portada") return <><i className="is-titulo-grande" /><i className="is-subtitulo" /></>;
  if (tipo === "indice") return <><i className="is-titulo" /><i className="is-linea" /><i className="is-linea" /><i className="is-linea" /></>;
  if (tipo === "seccion") return <><i className="is-banda" /><i className="is-titulo-grande" /></>;
  if (tipo === "mapa") return <><i className="is-titulo" /><span className="is-mapa"><b /><b /><b /><b /></span></>;
  return <><i className="is-titulo" /><b /><b /><b /><b /></>;
}

export function AdelantoPlantilla({ plantilla }: { plantilla: PlantillaInforme }) {
  const laminas = laminasDeEjemplo(plantilla);
  const estilo = { "--lamina-barras": plantilla.muestra.barras, "--lamina-titulo": plantilla.muestra.titulo } as CSSProperties;
  return (
    <div className="pulso-plantillas-adelanto">
      <ol
        className="pulso-plantillas-laminas"
        aria-label={`Láminas de ejemplo de ${plantilla.nombre}`}
        style={estilo}
        data-qa-geometry-group="graficos/plantillas-laminas-ejemplo"
        data-qa-geometry-contract="equal"
      >
        {laminas.map((l) => (
          <li key={l.tipo} className="pulso-plantillas-lamina" data-tipo={l.tipo}>
            <span className="pulso-plantillas-lamina-dibujo" aria-hidden="true" data-qa-geometry-exento="trazos decorativos de la miniatura"><Dibujo tipo={l.tipo} /></span>
            <span className="pulso-plantillas-lamina-rotulo">{l.rotulo}</span>
          </li>
        ))}
      </ol>
      <dl className="pulso-plantillas-rasgos">
        {rasgosDePlantilla(plantilla).map((r) => (
          <div key={r.clave}>
            <dt>{r.rotulo}</dt>
            <dd>{r.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
