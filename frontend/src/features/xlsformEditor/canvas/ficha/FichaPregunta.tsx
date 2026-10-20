// Ficha de una pregunta (C9–C11, C13, C15, C19–C23, S8): lo básico se edita aquí (texto, ayuda, código, tipo,
// obligatoria, la lista y la apariencia en la plataforma); condición, restricción, cálculo y filtro se leen con el
// motor y llevan a su pestaña.

import { AparienciaFicha } from "./AparienciaFicha";
import { AvisosFicha } from "./AvisosFicha";
import { CabeceraDesdeDatos, dondeEsta } from "./CabeceraFicha";
import { CampoCodigo } from "./CampoCodigo";
import { avisosDeFicha, numeroDePregunta } from "./modeloFicha";
import { BloqueFicha, CampoTexto } from "./piezasFicha";
import { ReglasFicha } from "./ReglasFicha";
import { RespuestaFicha } from "./RespuestaFicha";
import type { DatosFicha } from "./tiposFicha";
import { VistaPregunta } from "./VistaPregunta";

export function FichaPregunta({ datos }: { datos: DatosFicha }) {
  const { node, structure, survey, scope, requiredRaw, choices, catalogs, usosPorLista, avisos, acciones } = datos;
  const numero = numeroDePregunta(structure, node.rowIndex);
  const donde = dondeEsta(node, structure);
  const posicion = numero != null ? `Pregunta ${numero} · ${donde}` : donde;
  return (
    <>
      <section className="xfh-caja" data-qa-geometry-group="xlsform/ficha-bloques" data-qa-geometry-contract="intrinsic">
        <CabeceraDesdeDatos datos={datos} posicion={posicion} conTipo />
        <AvisosFicha avisos={avisosDeFicha(avisos, node.typeInfo.base)} />
        <BloqueFicha titulo="Texto">
          <CampoTexto etiqueta="Pregunta" valor={node.label} onCambio={(v) => acciones.campo("label", v)} multilinea grande placeholder="¿Qué se le pregunta al encuestado?" />
          <div className="xfh-dos-campos">
            <CampoTexto etiqueta="Ayuda para quien responde" valor={node.hint} onCambio={(v) => acciones.campo("hint", v)} multilinea placeholder="Opcional" />
            <CampoCodigo valor={node.name} survey={survey} onCambio={(v) => acciones.campo("name", v)} />
          </div>
        </BloqueFicha>
        <BloqueFicha titulo="Respuesta">
          <RespuestaFicha
            node={node}
            choices={choices}
            catalogs={catalogs}
            usosDeLaLista={usosPorLista.get(node.typeInfo.listName) ?? 0}
            onAsignarLista={acciones.asignarLista}
            onCrearLista={acciones.crearLista}
            onIrListas={(lista) => acciones.irPestana("opciones", lista)}
          />
        </BloqueFicha>
        <BloqueFicha titulo="Reglas">
          <ReglasFicha
            node={node}
            structure={structure}
            scope={scope}
            requiredRaw={requiredRaw}
            filas={["oblig", "cond", "regla", "calc", "filtro", "repite"]}
            onObligatoria={acciones.obligatoria}
            onIr={acciones.irPestana}
            onSeleccionarFila={acciones.seleccionarFila}
          />
        </BloqueFicha>
        <BloqueFicha titulo="Apariencia en la plataforma">
          <AparienciaFicha
            base={node.typeInfo.base}
            appearance={node.appearance}
            onCambio={(v) => acciones.campo("appearance", v)}
            onIrImpreso={() => acciones.irPestana("impreso", null)}
          />
        </BloqueFicha>
      </section>
      <VistaPregunta node={node} choices={choices} numero={numero} requiredRaw={requiredRaw} />
    </>
  );
}
