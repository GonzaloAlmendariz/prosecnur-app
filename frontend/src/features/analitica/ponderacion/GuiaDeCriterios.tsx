// Criterios para ponderar: se ve mientras la ponderación está apagada, que es
// cuando se decide si hace falta. Sus respuestas no se guardan.

import { useState } from "react";

import { Alert } from "../../../components/Alert";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { HelpCircle } from "../../../vendor/lucide-react";
import { recomendacion } from "./criteriosModelo";
import { PreguntaDeCriterio } from "./PreguntaDeCriterio";

export function GuiaDeCriterios() {
  const [describe, setDescribe] = useState<boolean | null>(null);
  const [cifras, setCifras] = useState<boolean | null>(null);
  const veredicto = recomendacion(describe, cifras);
  return (
    <PanelDeMesa
      zona="criterios"
      titulo="Criterios para ponderar"
      icono={<HelpCircle size={16} aria-hidden="true" />}
    >
      <div className="pond-panel-cuerpo">
        <p className="pond-texto">Ponderar reduce el sesgo en las variables de ajuste y suele restar precisión.</p>
        {/* C1: dos preguntas independientes; cada una mide lo que su rótulo necesita. */}
        <div className="pond-criterios" data-qa-geometry-group="analitica/ponderacion-criterios" data-qa-geometry-contract="intrinsic">
          <PreguntaDeCriterio
            rotulo="Objetivo del análisis"
            si="Describir a la población"
            no="Comparar grupos"
            valor={describe}
            onCambio={setDescribe}
          />
          <PreguntaDeCriterio
            rotulo="Cifras de la población (censo, padrón)"
            si="Confiables"
            no="Sin cifras confiables"
            valor={cifras}
            onCambio={setCifras}
          />
        </div>
        <div role="status">
          {veredicto ? <Alert kind={veredicto.tono === "conviene" ? "info" : "warn"}>{veredicto.texto}</Alert> : null}
        </div>
      </div>
    </PanelDeMesa>
  );
}
