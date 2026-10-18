// Ficha de una nota (C24): texto que ve el encuestado, sin respuesta. Puede tener condición (y heredarla).

import { AvisosFicha } from "./AvisosFicha";
import { CabeceraDesdeDatos, dondeEsta } from "./CabeceraFicha";
import { CampoCodigo } from "./CampoCodigo";
import { BloqueFicha, CampoTexto } from "./piezasFicha";
import { ReglasFicha } from "./ReglasFicha";
import type { DatosFicha } from "./tiposFicha";
import { VistaPregunta } from "./VistaPregunta";

export function FichaNota({ datos }: { datos: DatosFicha }) {
  const { node, structure, survey, scope, requiredRaw, avisos, acciones } = datos;
  const donde = dondeEsta(node, structure);
  return (
    <>
      <section className="xfh-caja" data-qa-geometry-group="xlsform/ficha-bloques" data-qa-geometry-contract="intrinsic">
        <CabeceraDesdeDatos datos={datos} posicion={`Sin respuesta · ${donde}`} conTipo />
        <AvisosFicha avisos={avisos} />
        <BloqueFicha titulo="Texto">
          <CampoTexto etiqueta="Texto de la nota" valor={node.label} onCambio={(v) => acciones.campo("label", v)} multilinea grande placeholder="Lo que se lee en pantalla" />
          <div className="xfh-dos-campos">
            <CampoTexto etiqueta="Texto secundario" valor={node.hint} onCambio={(v) => acciones.campo("hint", v)} multilinea placeholder="Opcional" />
            <CampoCodigo valor={node.name} survey={survey} onCambio={(v) => acciones.campo("name", v)} />
          </div>
        </BloqueFicha>
        <BloqueFicha titulo="Reglas">
          <ReglasFicha
            node={node}
            structure={structure}
            scope={scope}
            requiredRaw={requiredRaw}
            filas={["cond", "repite"]}
            onIr={acciones.irPestana}
            onSeleccionarFila={acciones.seleccionarFila}
          />
        </BloqueFicha>
      </section>
      <VistaPregunta node={node} choices={[]} numero={null} requiredRaw={requiredRaw} />
    </>
  );
}
