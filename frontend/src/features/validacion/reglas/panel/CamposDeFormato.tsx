/**
 * Las filas de "Formato de la respuesta" en la caja "Condiciones" del panel de
 * regla: la pregunta, el formato (dígitos, correo o patrón) y lo que pide cada
 * uno. Lo que se guarda lo arma `paramsDeFormato`; el motor es
 * `api/R/validacion_regla_formato.R`. Las respuestas que pasan y las que no,
 * con su motivo, las muestra "Casos que marca hoy" con la lectura del motor.
 */
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { ExploradorVariable } from "../../types";
import type { AccionDeBorrador, Borrador } from "../borradorDeRegla";
import { CampoPregunta } from "../campos/CampoPregunta";
import { modoDeFormato, type ModoDeFormato } from "../modeloFormato";
import { nullableNumber, paramList } from "../modeloRegla";
import { Fila } from "./FilaDeRegla";
import { Segmentado } from "./Segmentado";
import "./camposDeFormato.css";

const MODOS: ReadonlyArray<{ valor: ModoDeFormato; rotulo: string }> = [
  { valor: "digitos", rotulo: "Dígitos" },
  { valor: "correo", rotulo: "Correo" },
  { valor: "expresion", rotulo: "Patrón" },
];

type Cantidad = "exacta" | "rango" | "cualquiera";

const CANTIDADES: ReadonlyArray<{ valor: Cantidad; rotulo: string }> = [
  { valor: "exacta", rotulo: "Exacta" },
  { valor: "rango", rotulo: "Entre" },
  { valor: "cualquiera", rotulo: "Cualquiera" },
];

/** Cómo se lee la cantidad guardada: un mínimo igual al máximo es exacta. */
export function cantidadDe(params: Record<string, unknown>): Cantidad {
  if (params.cantidad === "exacta" || params.cantidad === "rango" || params.cantidad === "cualquiera") return params.cantidad;
  const min = nullableNumber(params.largo_min);
  const max = nullableNumber(params.largo_max);
  if (min === null && max === null) return "cualquiera";
  return min !== null && min === max ? "exacta" : "rango";
}

const PIEZAS_DEL_PATRON: ReadonlyArray<[string, string]> = [
  ["[0-9]", "un dígito"],
  ["[A-Z]", "una letra mayúscula"],
  ["{3}", "repite lo anterior 3 veces"],
  ["{2,4}", "lo repite de 2 a 4 veces"],
  ["( | )", "una de las alternativas"],
];

function texto(valor: unknown): string {
  return typeof valor === "number" || typeof valor === "string" ? String(valor) : "";
}

export function CamposDeFormato({
  borrador: b,
  despachar,
  variables,
}: {
  borrador: Borrador;
  despachar: (accion: AccionDeBorrador) => void;
  variables: readonly ExploradorVariable[];
}) {
  const p = b.params;
  const modo = modoDeFormato(p.modo);
  const cantidad = cantidadDe(p);
  const setParam = (clave: string, valor: unknown) => despachar({ tipo: "param", clave, valor });
  const setCantidad = (c: Cantidad) => {
    const { largo_min: min, largo_max: _max, ...resto } = p;
    if (c === "cualquiera") despachar({ tipo: "params", valor: { ...resto, cantidad: c } });
    else if (c === "exacta") despachar({ tipo: "params", valor: { ...resto, cantidad: c, ...(min === undefined ? {} : { largo_min: min, largo_max: min }) } });
    else despachar({ tipo: "params", valor: { ...resto, cantidad: c, ...(min === undefined ? {} : { largo_min: min }) } });
  };

  const filas = [
    <Fila key="pregunta" variante="campo" rotulo="Pregunta">
      <CampoPregunta
        variables={variables}
        valor={b.variables[0] ?? ""}
        onCambio={(v) => despachar({ tipo: "variables", valor: [v] })}
        ariaLabel="Pregunta cuyo formato se revisa"
      />
    </Fila>,
    <Fila key="modo" variante="campo" rotulo="Formato">
      <Segmentado<ModoDeFormato>
        etiqueta="Qué formato debe tener la respuesta"
        valor={modo}
        opciones={MODOS}
        ancho
        onCambio={(m) => despachar({ tipo: "params", valor: { modo: m } })}
      />
    </Fila>,
  ];

  if (modo === "digitos") {
    filas.push(
      <Fila key="cantidad" variante="campo" rotulo="Cantidad">
        <span className="pulso-regla-formato-cantidad">
          <Segmentado<Cantidad> etiqueta="Cantidad de dígitos" valor={cantidad} opciones={CANTIDADES} onCambio={setCantidad} />
          {cantidad === "exacta" ? (
            <span className="pulso-regla-formato-digitos">
              <PulsoInput
                type="number"
                min={1}
                step={1}
                value={texto(p.largo_min)}
                onChange={(e) => despachar({ tipo: "params", valor: { ...p, cantidad, largo_min: e.target.value, largo_max: e.target.value } })}
                aria-label="Cantidad exacta de dígitos"
              />
              <span>dígitos</span>
            </span>
          ) : cantidad === "rango" ? (
            <span className="pulso-regla-formato-digitos">
              <PulsoInput type="number" min={1} step={1} value={texto(p.largo_min)} onChange={(e) => setParam("largo_min", e.target.value)} aria-label="Mínimo de dígitos" />
              <span>a</span>
              <PulsoInput type="number" min={1} step={1} value={texto(p.largo_max)} onChange={(e) => setParam("largo_max", e.target.value)} aria-label="Máximo de dígitos" />
              <span>dígitos</span>
            </span>
          ) : null}
        </span>
      </Fila>,
      <Fila key="inicio" variante="campo" rotulo="Empieza con">
        <PulsoInput
          value={paramList(p.empieza_con).join(", ")}
          onChange={(e) => setParam("empieza_con", e.target.value)}
          placeholder="Cualquier dígito"
          aria-label="Dígitos con que empieza la respuesta, separados por coma"
        />
      </Fila>,
      <Fila key="separadores" variante="campo" rotulo="Separadores">
        <PulsoSwitch
          size="sm"
          checked={p.sin_separadores === true}
          onCheckedChange={(v) => setParam("sin_separadores", v)}
          label="Quitar espacios, guiones, puntos y paréntesis antes de revisar"
        />
      </Fila>,
    );
  } else if (modo === "expresion") {
    filas.push(
      <Fila key="expresion" variante="campo" rotulo="Patrón">
        <span className="pulso-regla-formato-patron">
          <PulsoInput
            value={texto(p.expresion)}
            onChange={(e) => setParam("expresion", e.target.value)}
            placeholder="[A-Z]{3}[0-9]{4}"
            aria-label="Patrón que debe cumplir la respuesta"
            spellCheck={false}
          />
          <span className="pulso-regla-formato-guia">
            Se compara la respuesta entera. {PIEZAS_DEL_PATRON.map(([pieza, significa], i) => (
              <span key={pieza}>
                <code>{pieza}</code> {significa}
                {i < PIEZAS_DEL_PATRON.length - 1 ? "; " : "."}
              </span>
            ))}{" "}
            Con <code>[A-Z]{"{3}"}[0-9]{"{4}"}</code> pasa ABC1234 y no pasa AB1234.
          </span>
        </span>
      </Fila>,
    );
  }
  return <>{filas}</>;
}
