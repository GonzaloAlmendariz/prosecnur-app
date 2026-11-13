/**
 * La caja "Condiciones" del panel de regla (prototipo `pp-rg-caja`, filas
 * `pp-rg-fila`): qué preguntas revisa la regla y con qué condición, más el
 * filtro "Solo revisar cuando".
 *
 * El prototipo dibuja dos variantes: "Dos respuestas que deben cuadrar" (filas
 * "Cuando" y "se espera que") y "Condiciones combinadas" (filas numeradas con
 * "Todas / Alguna"). Los demás tipos usan las mismas filas con sus campos
 * (estado no dibujado; plan de fidelidad, sección 0.4). Los campos salieron
 * del paso 3 del asistente (`components/ReglaEditor.tsx`).
 */
import type { ReactNode } from "react";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { Plus } from "../../../../vendor/lucide-react";
import type { ExploradorVariable, ReglaGateCondition } from "../../types";
import type { AccionDeBorrador, Borrador } from "../borradorDeRegla";
import { CampoOpciones } from "../campos/CampoOpciones";
import { CampoPregunta } from "../campos/CampoPregunta";
import { CampoValor, type Comparacion } from "../campos/CampoValor";
import { EditorDeJerarquia } from "../campos/EditorDeJerarquia";
import {
  condicionesDeParams,
  emptyGateCondition,
  esOperadorSinValor,
  isListOperator,
  modoDeCondiciones,
  operatorOptionsForVariable,
  paramList,
} from "../modeloRegla";
import { opcionesDeOperador, type FormaDelOperador } from "../operadores";
import { metaDeTipo, rangoDePreguntas } from "../tiposDeRegla";
import { esOperadorDeComparacion, type CondicionCombinada, type ModoCondiciones, type OperadorDeCondicion } from "../tiposDelMotor";
import { CamposDeBateria } from "./CamposDeBateria";
import { CamposDeFechas } from "./CamposDeFechas";
import { CamposDeFormato } from "./CamposDeFormato";
import { CamposDeCombinacion } from "./CamposDeCombinacion";
import { Fila } from "./FilaDeRegla";
import { Segmentado } from "./Segmentado";

type Props = {
  borrador: Borrador;
  despachar: (accion: AccionDeBorrador) => void;
  variables: readonly ExploradorVariable[];
};

const CAUSA_SIN_COMPARAR = "Con otra pregunta solo se compara con es, no es, mayor o menor";

function SelectorDeOperador({
  variable,
  valor,
  onCambio,
  forma = "indicativo",
  soloComparacion = false,
  sinVacio = false,
  ariaLabel,
}: {
  variable: ExploradorVariable | undefined;
  valor: string;
  onCambio: (op: OperadorDeCondicion) => void;
  forma?: FormaDelOperador;
  soloComparacion?: boolean;
  /** Sin "está vacía" ni "tiene respuesta": "Dos respuestas que deben cuadrar" compara valores. */
  sinVacio?: boolean;
  ariaLabel: string;
}) {
  const opciones = opcionesDeOperador(variable, forma).filter(
    (o) => (!soloComparacion || esOperadorDeComparacion(o.value)) && (!sinVacio || !esOperadorSinValor(o.value)),
  );
  return (
    <PulsoSelect
      value={valor}
      onValueChange={(v) => onCambio(v as OperadorDeCondicion)}
      placeholder="Operador"
      ariaLabel={ariaLabel}
      className="pulso-regla-operador"
      options={opciones.map((o) => ({ value: o.value, label: o.label }))}
    />
  );
}

/**
 * Las preguntas que el tipo puede revisar. Un rango de números sobre una
 * pregunta de texto cuenta 0 sin avisar (el motor no lo dice): no se ofrece.
 * La pregunta ya guardada se sigue viendo aunque no sea del tipo
 * (`BuscadorDePregunta`).
 */
export function preguntasDelTipo(tipo: Borrador["tipo"], variables: readonly ExploradorVariable[]): readonly ExploradorVariable[] {
  switch (tipo) {
    case "rango_num":
    case "outliers_iqr":
    case "outliers_z":
      return variables.filter((v) => v.tipo === "num" || v.tipo === "mixto");
    case "rango_fecha":
    case "comparar_fechas":
      // Una fecha u hora llega como fecha, texto ("08.10.2026", "13.45") o
      // número (sus partes: día, hora, minutos). La opción múltiple no la trae.
      return variables.filter((v) => v.tipo !== "sm");
    case "select_multiple_hierarchy":
    case "select_multiple_exclusive":
    case "select_multiple_cardinality":
    case "select_multiple_selection":
      return variables.filter((v) => v.tipo === "sm");
    case "formato":
      // El formato se lee del texto de la respuesta (o de un número escrito
      // como texto); la opción múltiple reparte la respuesta en columnas.
      return variables.filter((v) => v.tipo !== "sm");
    case "bateria":
      // Una batería compara respuestas de opción única (o sus códigos): la
      // opción múltiple reparte la respuesta en columnas y la fecha no repite.
      return variables.filter((v) => v.tipo !== "sm" && v.tipo !== "fecha");
    default:
      return variables;
  }
}

/** La pregunta con que se compara por defecto: otra del mismo tipo, o la primera distinta. */
function preguntaParaComparar(variables: readonly ExploradorVariable[], propia: string): string {
  const meta = variables.find((v) => v.name === propia);
  const mismoTipo = variables.find((v) => v.name !== propia && v.tipo === meta?.tipo);
  return (mismoTipo ?? variables.find((v) => v.name !== propia))?.name ?? "";
}

/** Al cambiar la pregunta de una condición: su primer operador y el valor vacío (como el asistente). */
function inicioDeCondicion(variable: ExploradorVariable | undefined): { op: OperadorDeCondicion; valor: string | string[] } {
  const op = operatorOptionsForVariable(variable)[0]?.value ?? "==";
  return { op, valor: isListOperator(op) ? [] : "" };
}

export function Condiciones({ borrador: b, despachar, variables }: Props) {
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  const meta = metaDeTipo(b.tipo);
  const setParam = (clave: string, valor: unknown) => despachar({ tipo: "param", clave, valor });
  const setVariable = (i: number, nombre: string) => {
    const siguientes = [...b.variables];
    while (siguientes.length <= i) siguientes.push("");
    siguientes[i] = nombre;
    despachar({ tipo: "variables", valor: siguientes });
  };
  const pregunta = (i: number, etiqueta: string) => (
    <CampoPregunta
      variables={preguntasDelTipo(b.tipo, variables)}
      valor={b.variables[i] ?? ""}
      onCambio={(v) => setVariable(i, v)}
      ariaLabel={etiqueta}
    />
  );

  // --- Filtro "Solo revisar cuando" -----------------------------------------
  const filtro = b.gateConditions;
  const setFiltro = (siguiente: ReglaGateCondition[]) => despachar({ tipo: "filtro", valor: siguiente });
  const cambiarFiltro = (i: number, cambio: Partial<ReglaGateCondition>) =>
    setFiltro(filtro.map((c, j) => (j === i ? { ...c, ...cambio } : c)));
  const filasDeFiltro = filtro.map((c, i) => {
    const v = porNombre.get(c.variable);
    return (
      <Fila
        key={`filtro-${i}`}
        clase={i === 0 ? "pulso-regla-fila--filtro-inicio" : undefined}
        rotulo={i === 0 ? "Solo cuando" : <i className="pulso-regla-conector">y</i>}
        quitar={{ etiqueta: `Quitar el filtro ${i + 1}`, onQuitar: () => setFiltro(filtro.filter((_, j) => j !== i)) }}
      >
        <CampoPregunta
          variables={variables}
          valor={c.variable}
          ariaLabel={`Filtro ${i + 1}: pregunta`}
          onCambio={(nombre) => {
            const inicio = inicioDeCondicion(porNombre.get(nombre));
            cambiarFiltro(i, { variable: nombre, op: inicio.op, value: inicio.valor });
          }}
        />
        <SelectorDeOperador
          variable={v}
          valor={c.op}
          ariaLabel={`Filtro ${i + 1}: operador`}
          onCambio={(op) =>
            cambiarFiltro(i, { op, value: isListOperator(op) ? paramList(c.value) : paramList(c.value)[0] ?? "" })
          }
        />
        <CampoValor variable={v} op={c.op} valor={c.value} ariaLabel={`Filtro ${i + 1}: valor`} onCambio={(value) => cambiarFiltro(i, { value })} />
      </Fila>
    );
  });
  const agregarFiltro = (
    <PulsoButton variant="ghost" size="sm" className="pulso-regla-mas" onClick={() => setFiltro([...filtro, emptyGateCondition([...variables])])}>
      <Plus size={13} aria-hidden="true" />
      Solo revisar cuando
    </PulsoButton>
  );

  // --- Filas del tipo --------------------------------------------------------
  let modo: ReactNode = null;
  let filas: ReactNode = null;
  let masDelTipo: ReactNode = null;
  let par = false;

  switch (b.tipo) {
    case "coherencia_2v": {
      par = true;
      modo = <span>La primera se cumple y la segunda no</span>;
      const vx = porNombre.get(b.variables[0] ?? "");
      const vy = porNombre.get(b.variables[1] ?? "");
      const comparada = typeof b.params.valor_y_variable === "string" ? b.params.valor_y_variable : "";
      const opY = String(b.params.op_y ?? "");
      const comparar: Comparacion = {
        comparada,
        variables: variables.filter((v) => v.name !== b.variables[1]),
        onComparada: (nombre) => setParam("valor_y_variable", nombre),
        causaSinComparar: opY && !esOperadorDeComparacion(opY) ? CAUSA_SIN_COMPARAR : undefined,
        onAlternar: (encender) => {
          if (encender) {
            despachar({
              tipo: "params",
              valor: { ...b.params, valor_y_variable: preguntaParaComparar(variables, b.variables[1] ?? "") },
            });
          } else {
            const { valor_y_variable: _comparada, ...resto } = b.params;
            despachar({ tipo: "params", valor: resto });
          }
        },
      };
      const limpiarLado = (lado: "x" | "y") => {
        const { [`op_${lado}`]: _op, [`valor_${lado}`]: _valor, ...resto } = b.params;
        const sinComparada = lado === "y" ? (({ valor_y_variable: _c, ...r }) => r)(resto) : resto;
        despachar({ tipo: "params", valor: sinComparada });
        setVariable(lado === "x" ? 0 : 1, "");
      };
      const elegirLado = (lado: "x" | "y", i: number, nombre: string) => {
        const inicio = inicioDeCondicion(porNombre.get(nombre));
        const siguientes = [...b.variables];
        while (siguientes.length <= i) siguientes.push("");
        siguientes[i] = nombre;
        despachar({ tipo: "variables", valor: siguientes });
        despachar({ tipo: "params", valor: { ...b.params, [`op_${lado}`]: inicio.op, [`valor_${lado}`]: inicio.valor } });
      };
      filas = (
        <>
          <Fila rotulo="Cuando" quitar={{ etiqueta: "Quitar la condición", onQuitar: () => limpiarLado("x") }}>
            <CampoPregunta variables={variables} valor={b.variables[0] ?? ""} onCambio={(n) => elegirLado("x", 0, n)} ariaLabel="Cuando: pregunta" />
            <SelectorDeOperador variable={vx} valor={String(b.params.op_x ?? "")} sinVacio ariaLabel="Cuando: operador" onCambio={(op) => setParam("op_x", op)} />
            <CampoValor
              variable={vx}
              op={String(b.params.op_x ?? "") as OperadorDeCondicion}
              valor={b.params.valor_x}
              ariaLabel="Cuando: valor"
              onCambio={(v) => setParam("valor_x", v)}
            />
          </Fila>
          <Fila rotulo="se espera que" quitar={{ etiqueta: "Quitar lo que se espera", onQuitar: () => limpiarLado("y") }}>
            <CampoPregunta variables={variables} valor={b.variables[1] ?? ""} onCambio={(n) => elegirLado("y", 1, n)} ariaLabel="Se espera que: pregunta" />
            <SelectorDeOperador
              variable={vy}
              valor={opY}
              forma="esperado"
              soloComparacion={!!comparada}
              sinVacio
              ariaLabel="Se espera que: operador"
              onCambio={(op) => setParam("op_y", op)}
            />
            <CampoValor
              variable={vy}
              op={opY as OperadorDeCondicion}
              valor={b.params.valor_y}
              ariaLabel="Se espera que: valor"
              onCambio={(v) => setParam("valor_y", v)}
              comparar={comparar}
            />
          </Fila>
        </>
      );
      break;
    }
    case "condiciones": {
      const condiciones = condicionesDeParams(b.params);
      const modoActual = modoDeCondiciones(b.params.modo);
      const conector = modoActual === "alguna" ? "o" : "y";
      const guardar = (siguientes: CondicionCombinada[]) => despachar({ tipo: "params", valor: { ...b.params, modo: modoActual, condiciones: siguientes } });
      const cambiar = (i: number, cambio: Partial<CondicionCombinada>) => guardar(condiciones.map((c, j) => (j === i ? { ...c, ...cambio } : c)));
      modo = (
        <>
          <span>Se cumple</span>
          <Segmentado<ModoCondiciones>
            etiqueta="Cuántas condiciones deben cumplirse"
            valor={modoActual}
            opciones={[
              { valor: "todas", rotulo: "Todas" },
              { valor: "alguna", rotulo: "Alguna" },
            ]}
            onCambio={(m) => despachar({ tipo: "params", valor: { ...b.params, modo: m, condiciones } })}
          />
        </>
      );
      filas = condiciones.map((c, i) => {
        const v = porNombre.get(c.variable);
        const comparada = c.variable_comparada ?? "";
        const comparar: Comparacion = {
          comparada,
          variables: variables.filter((x) => x.name !== c.variable),
          onComparada: (nombre) => cambiar(i, { variable_comparada: nombre }),
          causaSinComparar: c.op && !esOperadorDeComparacion(c.op) ? CAUSA_SIN_COMPARAR : undefined,
          onAlternar: (encender) => {
            const siguiente: CondicionCombinada = encender
              ? { variable: c.variable, op: c.op, variable_comparada: preguntaParaComparar(variables, c.variable) }
              : { variable: c.variable, op: c.op, valor: "" };
            guardar(condiciones.map((x, j) => (j === i ? siguiente : x)));
          },
        };
        return (
          <Fila
            key={`condicion-${i}`}
            rotulo={i === 0 ? <i className="pulso-regla-numero">1</i> : <i className="pulso-regla-conector">{conector}</i>}
            quitar={{ etiqueta: `Quitar la condición ${i + 1}`, onQuitar: () => guardar(condiciones.filter((_, j) => j !== i)) }}
          >
            <CampoPregunta
              variables={variables}
              valor={c.variable}
              ariaLabel={`Condición ${i + 1}: pregunta`}
              onCambio={(nombre) => {
                const inicio = inicioDeCondicion(porNombre.get(nombre));
                guardar(condiciones.map((x, j) => (j === i ? { variable: nombre, op: inicio.op, valor: inicio.valor } : x)));
              }}
            />
            <SelectorDeOperador
              variable={v}
              valor={c.op}
              soloComparacion={!!comparada}
              ariaLabel={`Condición ${i + 1}: operador`}
              onCambio={(op) =>
                cambiar(i, comparada ? { op } : { op, valor: isListOperator(op) ? paramList(c.valor) : paramList(c.valor)[0] ?? "" })
              }
            />
            <CampoValor
              variable={v}
              op={c.op}
              valor={c.valor}
              ariaLabel={`Condición ${i + 1}: valor`}
              onCambio={(valor) => cambiar(i, { valor })}
              comparar={comparar}
            />
          </Fila>
        );
      });
      masDelTipo = (
        <PulsoButton
          variant="ghost"
          size="sm"
          className="pulso-regla-mas"
          onClick={() => guardar([...condiciones, { variable: "", op: "", valor: "" }])}
        >
          <Plus size={13} aria-hidden="true" />
          Añadir condición
        </PulsoButton>
      );
      break;
    }
    case "bateria": {
      filas = <CamposDeBateria borrador={b} despachar={despachar} variables={preguntasDelTipo("bateria", variables)} />;
      break;
    }
    case "formato": {
      filas = <CamposDeFormato borrador={b} despachar={despachar} variables={preguntasDelTipo("formato", variables)} />;
      break;
    }
    case "combinacion_catalogo": {
      filas = <CamposDeCombinacion borrador={b} despachar={despachar} variables={variables} />;
      break;
    }
    case "rango_fecha":
    case "comparar_fechas": {
      filas = <CamposDeFechas borrador={b} despachar={despachar} variables={preguntasDelTipo(b.tipo, variables)} />;
      break;
    }
    case "duplicados": {
      const [, max] = meta ? rangoDePreguntas(meta) : [1, 5];
      const llaves = b.variables.length ? b.variables : [""];
      filas = llaves.map((nombre, i) => (
        <Fila
          key={`llave-${i}`}
          variante="campo"
          rotulo={i === 0 ? "Preguntas" : <i className="pulso-regla-conector">y</i>}
          quitar={llaves.length > 1 ? { etiqueta: `Quitar la pregunta ${i + 1}`, onQuitar: () => despachar({ tipo: "variables", valor: b.variables.filter((_, j) => j !== i) }) } : undefined}
        >
          <CampoPregunta variables={variables} valor={nombre} onCambio={(v) => setVariable(i, v)} ariaLabel={`Pregunta ${i + 1}`} />
        </Fila>
      ));
      if (llaves.length < max) {
        masDelTipo = (
          <PulsoButton variant="ghost" size="sm" className="pulso-regla-mas" onClick={() => despachar({ tipo: "variables", valor: [...llaves.filter(Boolean), ""] })}>
            <Plus size={13} aria-hidden="true" />
            Añadir pregunta
          </PulsoButton>
        );
      }
      break;
    }
    default: {
      const v = porNombre.get(b.variables[0] ?? "");
      const numero = (clave: string, rotulo: string, tipoDeCampo: "number" | "date" = "number") => (
        <Fila key={clave} variante="campo" rotulo={rotulo}>
          <PulsoInput
            type={tipoDeCampo}
            value={typeof b.params[clave] === "string" || typeof b.params[clave] === "number" ? String(b.params[clave]) : ""}
            onChange={(e) => setParam(clave, e.target.value)}
            aria-label={rotulo}
          />
        </Fila>
      );
      const filasDelTipo: ReactNode[] = [
        <Fila key="pregunta" variante="campo" rotulo="Pregunta">
          {pregunta(0, "Pregunta")}
        </Fila>,
      ];
      if (b.tipo === "rango_num") {
        filasDelTipo.push(numero("min", "Mínimo"), numero("max", "Máximo"));
        filasDelTipo.push(
          <Fila key="inclusive" variante="campo" rotulo="Límites">
            <PulsoSwitch
              size="sm"
              checked={(b.params.inclusive as boolean | undefined) ?? true}
              onCheckedChange={(inclusive) => setParam("inclusive", inclusive)}
              label="El mínimo y el máximo están permitidos"
            />
          </Fila>,
        );
      } else if (b.tipo === "outliers_iqr" || b.tipo === "outliers_z") {
        filasDelTipo.push(
          <Fila key="k" variante="campo" rotulo="Multiplicador">
            <PulsoInput
              type="number"
              step="0.1"
              min="0"
              value={String((b.params.k as number | string | undefined) ?? (b.tipo === "outliers_iqr" ? 1.5 : 3))}
              onChange={(e) => setParam("k", parseFloat(e.target.value))}
              aria-label="Multiplicador"
            />
          </Fila>,
        );
      } else if (b.tipo === "fuera_catalogo") {
        filasDelTipo.push(
          <Fila key="valores" variante="campo" rotulo="Valores permitidos">
            <CampoOpciones variable={v?.name} valor={paramList(b.params.valores)} onCambio={(valores) => setParam("valores", valores)} ariaLabel="Valores permitidos" />
          </Fila>,
        );
      } else if (b.tipo === "select_multiple_exclusive") {
        filasDelTipo.push(
          <Fila key="excluyentes" variante="campo" rotulo="Excluyentes">
            <CampoOpciones
              variable={v?.name}
              valor={paramList(b.params.exclusive_codes)}
              onCambio={(codigos) => setParam("exclusive_codes", codigos)}
              ariaLabel="Opciones excluyentes"
            />
          </Fila>,
        );
      } else if (b.tipo === "select_multiple_cardinality") {
        filasDelTipo.push(numero("min", "Mínimo de opciones"), numero("max", "Máximo de opciones"));
      } else if (b.tipo === "select_multiple_selection") {
        filasDelTipo.push(
          <Fila key="op" variante="campo" rotulo="Se espera que">
            <PulsoSelect
              value={String(b.params.op ?? "contains_any")}
              onValueChange={(op) => setParam("op", op)}
              ariaLabel="Condición sobre las opciones"
              options={opcionesDeOperador({ name: "", label: "", tipo: "sm", n_validos: 0, n_nulos: 0 }, "esperado").map((o) => ({ value: o.value, label: o.label }))}
            />
          </Fila>,
          <Fila key="codes" variante="campo" rotulo="Opciones">
            <CampoOpciones variable={v?.name} valor={paramList(b.params.codes)} onCambio={(codigos) => setParam("codes", codigos)} ariaLabel="Opciones" />
          </Fila>,
        );
      } else if (b.tipo === "select_multiple_hierarchy") {
        filasDelTipo.push(
          <EditorDeJerarquia key="jerarquia" params={b.params} onParams={(p) => despachar({ tipo: "params", valor: p })} variable={v?.name} />,
        );
      }
      filas = filasDelTipo;
    }
  }

  return (
    <Panel
      noPadding
      className={[
        "pulso-regla-caja pulso-regla-condiciones",
        par ? "pulso-regla-condiciones--par" : "",
        // Con rótulos en palabras, la columna del rótulo es ancha; las
        // condiciones numeradas llevan solo su número (y el filtro, su rótulo arriba).
        !par && b.tipo !== "condiciones" ? "pulso-regla-condiciones--rotulos" : "",
      ].filter(Boolean).join(" ")}
      aria-label="Condiciones"
      title="Condiciones"
      actions={modo ? <div className="pulso-regla-modo">{modo}</div> : undefined}
    >
      <div className="pulso-regla-filas" data-qa-geometry-group="validacion/regla-condiciones" data-qa-geometry-contract="intrinsic">
        {filas}
        {filasDeFiltro}
      </div>
      <footer className="pulso-regla-caja-pie">
        {masDelTipo}
        {agregarFiltro}
      </footer>
    </Panel>
  );
}
