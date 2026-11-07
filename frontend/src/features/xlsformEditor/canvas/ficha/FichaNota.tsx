// Ficha de una nota (C24): texto que ve el encuestado, sin respuesta. Puede tener condición (y heredarla). Si la
// nota la arma un experimento (la tabla de un par, C9; el escenario de una viñeta, C11), se ve como la ve el
// encuestado y se edita en Experimentos.

import { useMemo } from "react";
import { leerConjoint } from "../../conjoint/leerConjoint";
import { leerVinetas } from "../../conjoint/leerVinetas";
import { NotaExperimentoFicha } from "./NotaExperimentoFicha";
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
  const lecturaV = useMemo(() => (survey ? leerVinetas({ survey }) : null), [survey]);
  const par = lectura?.pares.find((p) => p.tabla === node.rowIndex) ?? null;
  const vineta = lecturaV?.vinetas.find((v) => v.nota === node.rowIndex) ?? null;
  const delExperimento = par
    ? { titulo: `Tabla del par ${par.tarea}`, foco: "pares" }
    : vineta ? { titulo: `Escenario de la viñeta ${vineta.vineta}`, foco: "vinetas" } : null;
  return (
    <>
      <section className="xfh-caja" data-qa-geometry-group="xlsform/ficha-bloques" data-qa-geometry-contract="intrinsic">
        <CabeceraDesdeDatos datos={datos} posicion={`Sin respuesta, ${donde}`} conTipo />
        <AvisosFicha avisos={avisos} />
        {delExperimento ? (
          <NotaExperimentoFicha node={node} structure={structure} titulo={delExperimento.titulo} onEditarDiseno={() => acciones.irPestana("experimentos", delExperimento.foco)} />
        ) : null}
        <BloqueFicha titulo={delExperimento ? "Ayuda y código" : "Texto"}>
          {delExperimento ? null : (
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
