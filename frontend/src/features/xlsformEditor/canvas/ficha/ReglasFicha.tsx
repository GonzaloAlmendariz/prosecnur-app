// Reglas de una pregunta, nota, cálculo o sección en la ficha (C15, I7, S8). Cada regla es una fila del mismo orden
// que el riel (obligatoria, condición, restricción, cálculo, filtro) con la misma forma por marca. TODO lo que dice
// sobre una regla sale del motor (leerRegla); aquí sólo se decide qué fila mostrar y a qué pestaña lleva.

import { useEffect, useState, type ReactNode } from "react";
import { INFO_MARCA, marcasNodo, type MarcasNodo } from "../../kit";
import { corto } from "../../kit/CuerpoPanelMarca";
import type { LogicScope } from "../../logic";
import { repeticionesDe } from "../../logic";
import { leerRegla } from "../../reglas/leerRegla";
import { textoDePiezas, type ColumnaRegla, type LecturaRegla } from "../../reglas/piezas";
import type { EditorFormulariosPestanaId } from "../../shell/pestanaEditor";
import type { BuilderNode, BuilderStructure } from "../../types";
import { FilaRegla } from "./FilaRegla";
import { DESTINO_REGLA, esSeleccion, focoParaPestana, type ClaveReglaFicha } from "./modeloFicha";
import { BotonIr, CodigoXlsform, Lectura } from "./piezasFicha";

export type FilaVisible = "oblig" | "cond" | "regla" | "calc" | "filtro" | "repite";

export type ReglasFichaProps = {
  node: BuilderNode;
  structure: BuilderStructure | null;
  scope: LogicScope;
  requiredRaw?: string;
  filas: readonly FilaVisible[];
  onObligatoria?: (si: boolean) => void;
  onIr: (pestana: EditorFormulariosPestanaId, foco: string | null) => void;
  onSeleccionarFila: (rowIndex: number) => void;
};

const plano = (l: LecturaRegla) => (l.tecnica ? `${l.raw}` : textoDePiezas(l.piezas));

export function ReglasFicha({ node, structure, scope, requiredRaw, filas, onObligatoria, onIr, onSeleccionarFila }: ReglasFichaProps) {
  const [abierta, setAbierta] = useState<FilaVisible | null>(null);
  useEffect(() => setAbierta(null), [node.rowIndex]);
  const m: MarcasNodo = marcasNodo(node, structure, requiredRaw);
  const leer = (col: ColumnaRegla, raw: string, n: BuilderNode = node) => leerRegla(col, raw, n, scope);
  const alternar = (k: FilaVisible) => setAbierta((a) => (a === k ? null : k));
  const esSec = node.kind === "section" || node.kind === "repeat";
  const sujeto = esSec ? "esta sección" : "esta pregunta";

  const crear = (k: ClaveReglaFicha) => {
    const d = DESTINO_REGLA[k];
    return (
      <>
        <p className="xfh-det__p">{k === "cond" && esSec ? "Decide cuándo aparece la sección entera según otra respuesta. Vale para todas sus preguntas." : d.queHace}</p>
        <div className="xfh-det__pie">
          <BotonIr primario onClick={() => onIr(d.pestana, focoParaPestana(d.pestana, node))}>Crear en {d.nombrePestana}</BotonIr>
          <small>La pestaña abre con {sujeto} elegida.</small>
        </div>
      </>
    );
  };
  const editar = (k: ClaveReglaFicha, codigo: { columna: string; raw: string }[], tecnica: boolean) => {
    const d = DESTINO_REGLA[k];
    return (
      <div className="xfh-det__pie">
        <BotonIr onClick={() => onIr(d.pestana, focoParaPestana(d.pestana, node))}>Editar en {d.nombrePestana}</BotonIr>
        <CodigoXlsform lineas={codigo} abierto={tecnica} />
      </div>
    );
  };

  const out: ReactNode[] = [];
  for (const k of filas) {
    if (k === "oblig") {
      const on = m.oblig !== null;
      const lect = m.oblig && !m.oblig.siempre ? leer("required", m.oblig.raw) : null;
      const resumen = lect ? <Lectura lectura={lect} corta /> : on ? "La encuesta no se puede finalizar sin esta respuesta." : "Se puede dejar en blanco.";
      out.push(
        <FilaRegla
          key={k}
          glifo="oblig"
          tono={INFO_MARCA.oblig.tono}
          nombre="Obligatoria"
          estado={on ? "on" : "off"}
          resumen={resumen}
          resumenPlano={lect ? plano(lect) : undefined}
          control={
            <button
              type="button"
              role="switch"
              className="xfh-switch"
              aria-checked={lect ? "mixed" : on}
              aria-label="Obligatoria"
              title={lect ? "Hoy es obligatoria sólo en algunos casos. Al tocar pasa a obligatoria siempre." : undefined}
              onClick={() => onObligatoria?.(lect ? true : !on)}
            >
              <span className="xfh-switch__pista" aria-hidden="true" />
            </button>
          }
        />,
      );
    } else if (k === "cond") {
      const propia = m.cond ? leer("relevant", m.cond) : null;
      const heredadas = m.hered.map((h) => ({ h, l: leer("relevant", h.raw, h.nodo) }));
      const on = !!propia || heredadas.length > 0;
      const primera = heredadas[0];
      const resumen = propia
        ? <Lectura lectura={propia} corta />
        : primera
          ? `Heredada de «${corto(primera.h.etiqueta, 38)}»`
          : esSec ? "La sección aparece siempre" : "Aparece siempre";
      const codigo = [
        ...(m.cond ? [{ columna: "relevant", raw: m.cond }] : []),
        ...heredadas.map(({ h }) => ({ columna: "relevant de la sección", raw: h.raw })),
      ];
      out.push(
        <FilaRegla
          key={k}
          glifo={propia || !primera ? "cond" : "hered"}
          tono={INFO_MARCA.cond.tono}
          nombre="Condición"
          estado={on ? "on" : "off"}
          resumen={resumen}
          resumenPlano={propia ? plano(propia) : undefined}
          abierta={abierta === k}
          onAlternar={() => alternar(k)}
        >
          {on ? (
            <>
              {propia ? (
                <>
                  <span className="xfh-det__sub">{esSec ? "La sección aparece si" : "Aparece si"}</span>
                  <p className="xfh-lectura"><Lectura lectura={propia} /></p>
                  {esSec ? <span className="xfh-det__sub">Vale para todas sus preguntas: si no se cumple, la sección entera se salta.</span> : null}
                </>
              ) : null}
              {heredadas.map(({ h, l }, i) => (
                <div key={i} className="xfh-det__heredada">
                  <span className="xfh-det__sub">Heredada de la sección «{corto(h.etiqueta, 48)}»</span>
                  <p className="xfh-lectura"><Lectura lectura={l} /></p>
                </div>
              ))}
              {editar("cond", codigo, !!propia?.tecnica || heredadas.some(({ l }) => l.tecnica))}
              {!propia ? <div className="xfh-det__pie"><BotonIr onClick={() => onIr("logica", focoParaPestana("logica", node))}>Agregar una condición propia en Mapa de lógica</BotonIr></div> : null}
            </>
          ) : crear("cond")}
        </FilaRegla>,
      );
    } else if (k === "regla") {
      const lect = m.regla ? leer("constraint", m.regla.raw) : null;
      out.push(
        <FilaRegla
          key={k}
          glifo="regla"
          tono={INFO_MARCA.regla.tono}
          nombre="Restricción"
          estado={lect ? "on" : "off"}
          resumen={lect ? <Lectura lectura={lect} corta /> : "Acepta cualquier respuesta de su tipo"}
          resumenPlano={lect ? plano(lect) : undefined}
          abierta={abierta === k}
          onAlternar={() => alternar(k)}
        >
          {lect && m.regla ? (
            <>
              <p className="xfh-lectura"><Lectura lectura={lect} /></p>
              <span className="xfh-det__sub">
                {m.regla.mensaje ? <>Mensaje del formulario: «{m.regla.mensaje}»</> : "El formulario no trae mensaje para quien se equivoca."}
              </span>
              {editar("regla", [{ columna: "constraint", raw: m.regla.raw }], lect.tecnica)}
            </>
          ) : crear("regla")}
        </FilaRegla>,
      );
    } else if (k === "calc") {
      const aplica = node.kind === "calculate" || !!m.calc;
      const lect = m.calc ? leer("calculation", m.calc) : null;
      out.push(
        <FilaRegla
          key={k}
          glifo="calc"
          tono={INFO_MARCA.calc.tono}
          nombre="Cálculo"
          estado={!aplica ? "na" : lect ? "on" : "off"}
          resumen={!aplica ? "Solo en campos de cálculo" : lect ? <Lectura lectura={lect} corta /> : "Sin fórmula"}
          resumenPlano={lect ? plano(lect) : undefined}
          abierta={abierta === k}
          onAlternar={() => alternar(k)}
        >
          {lect && m.calc ? (
            <>
              <span className="xfh-det__sub">Se calcula como</span>
              <p className="xfh-lectura"><Lectura lectura={lect} /></p>
              {editar("calc", [{ columna: "calculation", raw: m.calc }], lect.tecnica)}
            </>
          ) : crear("calc")}
        </FilaRegla>,
      );
    } else if (k === "filtro") {
      const aplica = esSeleccion(node.typeInfo.base);
      const lect = m.filtro ? leer("choice_filter", m.filtro.raw) : null;
      const lista = lect?.lista || m.filtro?.lista || node.typeInfo.listName;
      out.push(
        <FilaRegla
          key={k}
          glifo="filtro"
          tono={INFO_MARCA.filtro.tono}
          nombre="Filtro"
          estado={!aplica ? "na" : lect ? "on" : "off"}
          resumen={!aplica ? "Solo en preguntas con opciones" : lect ? <Lectura lectura={lect} corta /> : "Muestra todas sus opciones"}
          resumenPlano={lect ? plano(lect) : undefined}
          abierta={abierta === k}
          onAlternar={() => alternar(k)}
        >
          {lect && m.filtro ? (
            <>
              <p className="xfh-lectura"><Lectura lectura={lect} /></p>
              {lista ? <span className="xfh-det__sub">Opciones de la lista <code className="xfh-code">{lista}</code></span> : null}
              {editar("filtro", [{ columna: "choice_filter", raw: m.filtro.raw }], lect.tecnica)}
            </>
          ) : crear("filtro")}
        </FilaRegla>,
      );
    } else if (k === "repite") {
      const reps = repeticionesDe(node, structure);
      const interna = reps[reps.length - 1];
      if (!interna) continue;
      out.push(
        <FilaRegla
          key={k}
          glifo="repite"
          tono={INFO_MARCA.repite.tono}
          nombre="Se repite"
          estado="on"
          resumen={`Por cada fila de «${corto(interna.etiqueta, 44)}»`}
          resumenPlano={`Se repite por cada fila de «${interna.etiqueta}»`}
          abierta={abierta === k}
          onAlternar={() => alternar(k)}
        >
          <p className="xfh-det__p">Se repite por cada fila de «{interna.etiqueta}»: la respuesta se guarda una vez por fila.</p>
          {interna.rowIndex != null ? (
            <div className="xfh-det__pie">
              <BotonIr onClick={() => onSeleccionarFila(interna.rowIndex!)}>Ver la repetición</BotonIr>
            </div>
          ) : null}
        </FilaRegla>,
      );
    }
  }

  return (
    <ul className="xfh-reglas" aria-label="Reglas" data-qa-geometry-group="xlsform/ficha-reglas" data-qa-geometry-contract="intrinsic">
      {out}
    </ul>
  );
}
