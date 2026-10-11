// Candado «Lo fija el recetario» del índice en Inspector › Contenido (decisión 32, A10 W-B). Mismo patrón que
// `LineaFijadaRecetario`: rótulo, lo que sale y por qué, sin control editable; si el proyecto guarda otro valor, la nota
// lo dice sin borrarlo. La lógica vive en `fijadosIndice.ts`.

import { useId } from "react";
import { Lock } from "../../../vendor/lucide-react";
import type { ArgMetadata, Slide } from "../../../api/graficos";
import { lineasFijadasIndice, type LineaFijadaIndice } from "./fijadosIndice";
import "./fijadosIndice.css";

export function FijadosIndice({ slide, args }: { slide: Slide; args: readonly ArgMetadata[] }) {
  const idTitulo = useId();
  const lineas = lineasFijadasIndice(slide, args);
  return (
    <section className="pulso-f6-fijados" aria-labelledby={idTitulo}
      data-qa-geometry-group="graficos/f6-indice-fijados" data-qa-geometry-contract="intrinsic">
      <h3 id={idTitulo} className="pulso-f6-subtitulo">
        <Lock size={13} aria-hidden="true" />
        Lo fija el recetario
      </h3>
      {lineas.map((l) => <LineaFijada key={l.arg} linea={l} />)}
    </section>
  );
}

function LineaFijada({ linea }: { linea: LineaFijadaIndice }) {
  const id = useId();
  const rotuloId = `${id}-rotulo`;
  const motivoId = `${id}-motivo`;
  const notaId = `${id}-nota`;
  return (
    <div
      className="pulso-f6-fijado"
      role="group"
      data-arg-name={linea.arg}
      data-arg-state="fijado"
      data-sin-efecto={linea.sinEfecto}
      aria-labelledby={rotuloId}
      aria-describedby={linea.nota ? `${motivoId} ${notaId}` : motivoId}
      data-qa-geometry-member
    >
      <span className="pulso-f6-fijado-cabecera">
        <span id={rotuloId} className="pulso-f6-fijado-rotulo">{linea.rotulo}</span>
        <span className="pulso-f6-fijado-sello">
          <Lock size={11} aria-hidden="true" />
          Fijado
        </span>
      </span>
      <span className={`pulso-f6-fijado-valor${linea.sinEfecto ? " is-sin-efecto" : ""}`}>
        <span className="pulso-sr-only">En el PowerPoint: </span>
        {linea.valor}
      </span>
      <span id={motivoId} className="pulso-f6-fijado-motivo">{linea.motivo}</span>
      {linea.nota && <span id={notaId} className="pulso-f6-fijado-nota">{linea.nota}</span>}
    </div>
  );
}
