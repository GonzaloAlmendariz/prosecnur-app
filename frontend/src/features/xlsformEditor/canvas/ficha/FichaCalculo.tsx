// Ficha de un cálculo (C24, S17): no es una pregunta que vea el encuestado. Muestra la fórmula leída por el motor,
// dónde se usa el valor y lleva a «Cálculos» para editarla.

import { useMemo } from "react";
import { TypeIcon } from "../../kit";
import { TituloLegible, corto } from "../../kit/CuerpoPanelMarca";
import { DONDE_SE_USA, usosDeVariable } from "../../logic/usos";
import { leerRegla } from "../../reglas/leerRegla";
import { AvisosFicha } from "./AvisosFicha";
import { CabeceraDesdeDatos, dondeEsta } from "./CabeceraFicha";
import { CampoCodigo } from "./CampoCodigo";
import { plural } from "./modeloFicha";
import { BloqueFicha, BotonIr, CampoTexto, CodigoXlsform, Lectura } from "./piezasFicha";
import { ReglasFicha } from "./ReglasFicha";
import type { DatosFicha } from "./tiposFicha";

export function FichaCalculo({ datos }: { datos: DatosFicha }) {
  const { node, structure, survey, scope, requiredRaw, catalogs, avisos, acciones } = datos;
  const formula = node.calculation.trim();
  const lectura = formula ? leerRegla("calculation", formula, node, scope) : null;
  const usos = useMemo(() => usosDeVariable(node.name, structure, catalogs), [node.name, structure, catalogs]);
  const irCalculos = () => acciones.irPestana("calculos", node.name || null);
  return (
    <section className="xfh-caja" data-qa-geometry-group="xlsform/ficha-bloques" data-qa-geometry-contract="intrinsic">
      <CabeceraDesdeDatos datos={datos} posicion={`No lo ve el encuestado · ${dondeEsta(node, structure)}`} conTipo />
      <AvisosFicha avisos={avisos} />
      <BloqueFicha titulo="Fórmula">
        {lectura ? (
          <>
            <p className="xfh-lectura is-grande"><Lectura lectura={lectura} /></p>
            {lectura.tecnica && lectura.depende.length ? (
              <p className="xfh-det__sub">Depende de {lectura.depende.map((d, i) => <span key={d.name}>{i ? ", " : ""}«{corto(d.etiqueta || d.name, 36)}»</span>)}.</p>
            ) : null}
            <div className="xfh-det__pie">
              <BotonIr onClick={irCalculos}>Editar en Cálculos</BotonIr>
              <CodigoXlsform lineas={[{ columna: "calculation", raw: formula }]} abierto={lectura.tecnica} />
            </div>
          </>
        ) : (
          <>
            <p className="xfh-det__p">Este cálculo todavía no tiene fórmula. Obtiene un valor a partir de otras respuestas.</p>
            <div className="xfh-det__pie"><BotonIr primario onClick={irCalculos}>Crear en Cálculos</BotonIr></div>
          </>
        )}
      </BloqueFicha>
      <BloqueFicha titulo="Dónde se usa">
        {usos.length ? (
          <ul className="xfh-usos" aria-label="Dónde se usa" data-qa-geometry-group="xlsform/ficha-usos" data-qa-geometry-contract="intrinsic">
            {usos.map((u, i) => (
              <li key={`${u.node.rowIndex}-${u.columna}-${i}`} data-qa-geometry-member="">
                <button type="button" onClick={() => acciones.seleccionarFila(u.node.rowIndex)}>
                  <TypeIcon baseType={u.node.typeInfo.base} size={12} />
                  <span className="xfh-usos__txt">{u.node.label ? <TituloLegible texto={u.node.label} /> : u.node.name}</span>
                  <span className="xfh-usos__donde">{u.columna === "opcion" && u.opcion ? `en la opción «${corto(u.opcion.etiqueta, 24)}»` : DONDE_SE_USA[u.columna]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="xfh-aviso-suave">Ninguna pregunta usa este valor todavía. Se guarda igual en la base.</p>
        )}
        {usos.length ? <small className="xfh-det__sub">{plural(usos.length, "uso", "usos")} en el formulario</small> : null}
      </BloqueFicha>
      <BloqueFicha titulo="Nombre">
        <div className="xfh-dos-campos">
          <CampoTexto etiqueta="Nombre para reconocerlo" valor={node.label} onCambio={(v) => acciones.campo("label", v)} placeholder="Opcional" />
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
  );
}
