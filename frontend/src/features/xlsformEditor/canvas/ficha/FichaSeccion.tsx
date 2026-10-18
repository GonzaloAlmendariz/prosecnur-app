// Ficha de una sección o repetición (C14): su título, su condición (vale para todas sus preguntas), si se repite y
// cómo se muestra en la plataforma. Debajo, lo que contiene.

import { useState } from "react";
import { INFO_MARCA } from "../../kit";
import { TituloLegible } from "../../kit/CuerpoPanelMarca";
import { ContenidoSeccion } from "../ContenidoSeccion";
import { AparienciaFicha } from "./AparienciaFicha";
import { AvisosFicha } from "./AvisosFicha";
import { CabeceraDesdeDatos } from "./CabeceraFicha";
import { CampoCodigo } from "./CampoCodigo";
import { FilaRegla } from "./FilaRegla";
import { contenidoDeBloque, plural } from "./modeloFicha";
import { BloqueFicha, CampoTexto, CodigoXlsform } from "./piezasFicha";
import { ReglasFicha } from "./ReglasFicha";
import type { DatosFicha } from "./tiposFicha";

export function FichaSeccion({ datos }: { datos: DatosFicha }) {
  const { node, structure, survey, scope, avisos, acciones } = datos;
  const [repiteAbierta, setRepiteAbierta] = useState(false);
  const esRep = node.kind === "repeat";
  const { preguntas, notas } = contenidoDeBloque(structure, node.rowIndex);
  const posicion = [plural(preguntas, "pregunta", "preguntas"), notas ? plural(notas, "nota", "notas") : ""].filter(Boolean).join(" y ");
  const titulo = (node.label ?? "").trim();
  const tecnico = !titulo || titulo === node.name;
  const cuenta = (node.repeat_count ?? "").trim();
  return (
    <>
      <section className="xfh-caja" data-qa-geometry-group="xlsform/ficha-bloques" data-qa-geometry-contract="intrinsic">
        <CabeceraDesdeDatos datos={datos} posicion={posicion} conTipo={false} />
        <AvisosFicha avisos={avisos} />
        <BloqueFicha titulo="Título">
          <CampoTexto
            etiqueta="Lo que ve el encuestado al entrar"
            valor={node.label}
            onCambio={(v) => acciones.campo("label", v)}
            multilinea
            grande
            placeholder="Ej. Datos de la vivienda"
            ayuda={tecnico ? "El título actual es técnico: el encuestado lo verá tal cual." : undefined}
          />
          <div className="xfh-dos-campos is-solo-codigo">
            <CampoCodigo valor={node.name} survey={survey} onCambio={(v) => acciones.campo("name", v)} />
          </div>
        </BloqueFicha>
        <BloqueFicha titulo="Reglas">
          <ReglasFicha
            node={node}
            structure={structure}
            scope={scope}
            filas={["cond"]}
            onIr={acciones.irPestana}
            onSeleccionarFila={acciones.seleccionarFila}
          />
          <ul className="xfh-reglas is-continua" aria-label="Repetición">
            <FilaRegla
              glifo="repite"
              tono={INFO_MARCA.repite.tono}
              nombre="Se repite"
              estado={esRep ? "on" : "off"}
              resumen={esRep ? (cuenta ? <>Veces: <TituloLegible texto={cuenta} /></> : "Las veces que elija el encuestador") : "Una sola vez"}
              abierta={repiteAbierta}
              onAlternar={() => setRepiteAbierta((v) => !v)}
            >
              {esRep ? (
                <>
                  <p className="xfh-det__p">Las preguntas de la sección se piden varias veces, una por cada caso.</p>
                  {cuenta ? (
                    <>
                      <span className="xfh-det__sub">Cuántas veces: <TituloLegible texto={cuenta} /></span>
                      <CodigoXlsform lineas={[{ columna: "repeat_count", raw: cuenta }]} />
                    </>
                  ) : <span className="xfh-det__sub">Cuántas veces lo decide el encuestador al llenar.</span>}
                  <div className="xfh-det__pie"><button type="button" className="xfh-boton" onClick={acciones.alternarRepeticion}>Volver a sección simple</button></div>
                </>
              ) : (
                <>
                  <p className="xfh-det__p">Una repetición pide estas preguntas varias veces, por ejemplo una vez por cada miembro del hogar.</p>
                  <div className="xfh-det__pie"><button type="button" className="xfh-boton is-primario" onClick={acciones.alternarRepeticion}>Convertir en repetición</button></div>
                </>
              )}
            </FilaRegla>
          </ul>
        </BloqueFicha>
        <BloqueFicha titulo="Apariencia en la plataforma">
          <AparienciaFicha base="begin_group" appearance={node.appearance} onCambio={(v) => acciones.campo("appearance", v)} />
        </BloqueFicha>
      </section>
      <section className="xfh-caja xfh-contenido">
        <ContenidoSeccion structure={structure} filaSeccion={node.rowIndex} onSelectRow={acciones.seleccionarFila} />
      </section>
    </>
  );
}
