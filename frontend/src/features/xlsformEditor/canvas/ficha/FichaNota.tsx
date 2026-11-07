// Ficha de una nota (C24): texto que ve el encuestado, sin respuesta. Puede tener condición (y heredarla). Si la
// nota es la tabla de un par de un experimento de elección por pares, se ve la tabla y se edita en Experimentos (C9).

import { useMemo } from "react";
import { leerConjoint } from "../../conjoint/leerConjoint";
import { TablaParFicha } from "./TablaParFicha";
import { AvisosFicha } from "./AvisosFicha";
import { CabeceraDesdeDatos, dondeEsta } from "./CabeceraFicha";
import { CampoCodigo } from "./CampoCodigo";
import { BloqueFicha, CampoTexto } from "./piezasFicha";
import { ReglasFicha } from "./ReglasFicha";
import type { DatosFicha } from "./tiposFicha";
import { VistaPregunta } from "./VistaPregunta";
import { etiquetaEscrita } from "./modeloFicha";

export function FichaNota({ datos }: { datos: DatosFicha }) {
  const { node, structure, survey, scope, requiredRaw, avisos, acciones } = datos;
  const donde = dondeEsta(node, structure);
  const lectura = useMemo(() => (survey ? leerConjoint({ survey }) : null), [survey]);
  const par = lectura?.pares.find((p) => p.tabla === node.rowIndex) ?? null;
  return (
    <>
      <section className="xfh-caja" data-qa-geometry-group="xlsform/ficha-bloques" data-qa-geometry-contract="intrinsic">
        <CabeceraDesdeDatos datos={datos} posicion={`Sin respuesta, ${donde}`} conTipo />
        <AvisosFicha avisos={avisos} />
        {par ? (
          <TablaParFicha node={node} structure={structure} tarea={par.tarea} onEditarDiseno={() => acciones.irPestana("experimentos", "pares")} />
        ) : null}
        <BloqueFicha titulo={par ? "Ayuda y código" : "Texto"}>
          {par ? null : (
            <CampoTexto etiqueta="Texto de la nota" valor={etiquetaEscrita(survey, node)} onCambio={(v) => acciones.campo("label", v)} multilinea grande placeholder="Lo que se lee en pantalla" />
          )}
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
