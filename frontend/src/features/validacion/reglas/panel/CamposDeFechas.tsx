/**
 * Las filas de "Fecha fuera del operativo" y "Dos fechas u horas que deben
 * cuadrar" en la caja "Condiciones" del panel de regla: de dónde se lee cada
 * fecha u hora (una pregunta con su formato, o varias preguntas que la arman),
 * los límites o la duración, y si se marcan las que no se pueden leer. Lo que
 * se guarda lo arma `paramsDeComparar` (o los parámetros de `rango_fecha` tal
 * cual); el motor es `api/R/validacion_regla_fechas.R`.
 */
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { ExploradorVariable } from "../../types";
import type { AccionDeBorrador, Borrador } from "../borradorDeRegla";
import { CampoOpciones } from "../campos/CampoOpciones";
import { CampoPregunta } from "../campos/CampoPregunta";
import {
  FORMATOS_DE_FECHA,
  FORMATOS_DE_HORA,
  N_PARTES,
  PARTES_POR_UNIDAD,
  ROTULO_DE_PARTES,
  ROTULOS_DE_PARTES,
  momentoDe,
  momentoDeRango,
  patronDeFechas,
  unidadDeDuracion,
  unidadDeFechas,
  type Momento,
  type PartesDeMomento,
  type PatronDeFechas,
  type UnidadDeFechas,
} from "../modeloFechas";
import { nullableNumber } from "../modeloRegla";
import { Fila } from "./FilaDeRegla";
import { Segmentado } from "./Segmentado";
import "./camposDeFechas.css";

const UNIDADES: ReadonlyArray<{ valor: UnidadDeFechas; rotulo: string }> = [
  { valor: "fecha", rotulo: "Fechas" },
  { valor: "hora", rotulo: "Horas" },
];

const PATRONES: ReadonlyArray<{ valor: PatronDeFechas; rotulo: string }> = [
  { valor: "orden", rotulo: "Orden" },
  { valor: "duracion", rotulo: "Duración" },
];

/** "auto" y los formatos de la unidad, en el orden del motor. */
export function opcionesDeFormato(unidad: UnidadDeFechas): { value: string; label: string }[] {
  const formatos: readonly string[] = unidad === "hora" ? FORMATOS_DE_HORA : FORMATOS_DE_FECHA;
  return [
    { value: "auto", label: "Detectar en cada respuesta" },
    ...formatos.map((f) => ({ value: f, label: f === "mm/dd/aaaa" ? "mm/dd/aaaa (mes primero)" : f })),
  ];
}

/** Las preguntas de un momento con el nuevo reparto: se conserva la primera. */
function conPartes(m: Momento, partes: PartesDeMomento): Momento {
  const variables = Array.from({ length: N_PARTES[partes] }, (_, i) => (i === 0 ? m.variables[0] ?? "" : ""));
  return { ...m, partes, variables, formato: "auto", am: [], pm: [] };
}

function CamposDeMomento({
  cual,
  momento,
  unidad,
  variables,
  onCambio,
}: {
  /** "Inicio", "Fin" o "Fecha": prefijo de los nombres accesibles y rótulo del reparto. */
  cual: string;
  momento: Momento;
  unidad: UnidadDeFechas;
  variables: readonly ExploradorVariable[];
  onCambio: (m: Momento) => void;
}) {
  const rotulos = ROTULOS_DE_PARTES[momento.partes];
  const filas = [
    <Fila key={`${cual}-partes`} variante="campo" rotulo={cual === "Fecha" ? "Se lee de" : cual}>
      <Segmentado<PartesDeMomento>
        etiqueta={`${cual}: de qué preguntas se lee`}
        valor={momento.partes}
        opciones={PARTES_POR_UNIDAD[unidad].map((p) => ({ valor: p, rotulo: ROTULO_DE_PARTES[p] }))}
        ancho
        onCambio={(p) => onCambio(conPartes(momento, p))}
      />
    </Fila>,
    ...momento.variables.map((nombre, i) => (
      <Fila key={`${cual}-var-${i}`} variante="campo" rotulo={rotulos[i]}>
        <CampoPregunta
          variables={variables}
          valor={nombre}
          ariaLabel={`${cual}: ${rotulos[i].toLowerCase()}`}
          onCambio={(v) => onCambio({ ...momento, variables: momento.variables.map((x, j) => (j === i ? v : x)) })}
        />
      </Fila>
    )),
  ];
  if (momento.partes === "una") {
    filas.push(
      <Fila key={`${cual}-formato`} variante="campo" rotulo="Formato">
        <PulsoSelect
          value={momento.formato}
          onValueChange={(formato) => onCambio({ ...momento, formato })}
          ariaLabel={`${cual}: formato`}
          options={opcionesDeFormato(unidad)}
        />
      </Fila>,
    );
  }
  if (momento.partes === "hora_minutos_ampm") {
    const ampm = momento.variables[2] || undefined;
    filas.push(
      <Fila key={`${cual}-am`} variante="campo" rotulo="Código de a.m.">
        <CampoOpciones variable={ampm} valor={momento.am} onCambio={(am) => onCambio({ ...momento, am })} ariaLabel={`${cual}: código de a.m.`} />
      </Fila>,
      <Fila key={`${cual}-pm`} variante="campo" rotulo="Código de p.m.">
        <CampoOpciones variable={ampm} valor={momento.pm} onCambio={(pm) => onCambio({ ...momento, pm })} ariaLabel={`${cual}: código de p.m.`} />
      </Fila>,
    );
  }
  return <>{filas}</>;
}

function CampoDeDuracion({
  clave,
  rotulo,
  valor,
  unidad,
  onCambio,
}: {
  clave: string;
  rotulo: string;
  valor: unknown;
  unidad: UnidadDeFechas;
  onCambio: (valor: string) => void;
}) {
  const texto = typeof valor === "number" || typeof valor === "string" ? String(valor) : "";
  return (
    <Fila key={clave} variante="campo" rotulo={rotulo}>
      <span className="pulso-regla-fechas-duracion">
        <PulsoInput type="number" step={1} value={texto} onChange={(e) => onCambio(e.target.value)} aria-label={`${rotulo} (${unidadDeDuracion(unidad, null)})`} />
        <span>{unidadDeDuracion(unidad, nullableNumber(valor))}</span>
      </span>
    </Fila>
  );
}

function SwitchDeIlegibles({ unidad, valor, onCambio }: { unidad: UnidadDeFechas; valor: unknown; onCambio: (v: boolean) => void }) {
  return (
    <Fila key="ilegibles" variante="campo" rotulo="Ilegibles">
      <PulsoSwitch
        size="sm"
        checked={valor !== false}
        onCheckedChange={onCambio}
        label={unidad === "hora" ? "Marcar las horas que no se pueden leer" : "Marcar las fechas que no se pueden leer"}
      />
    </Fila>
  );
}

export function CamposDeFechas({
  borrador: b,
  despachar,
  variables,
}: {
  borrador: Borrador;
  despachar: (accion: AccionDeBorrador) => void;
  variables: readonly ExploradorVariable[];
}) {
  const setParam = (clave: string, valor: unknown) => despachar({ tipo: "param", clave, valor });

  if (b.tipo === "rango_fecha") {
    const m = momentoDeRango(b.params, b.variables);
    const fecha = (clave: "min" | "max", rotulo: string) => (
      <Fila key={clave} variante="campo" rotulo={rotulo}>
        <PulsoInput
          type="date"
          value={typeof b.params[clave] === "string" ? String(b.params[clave]) : ""}
          onChange={(e) => setParam(clave, e.target.value)}
          aria-label={rotulo}
        />
      </Fila>
    );
    return (
      <>
        <CamposDeMomento
          cual="Fecha"
          momento={m}
          unidad="fecha"
          variables={variables}
          onCambio={(siguiente) => {
            despachar({ tipo: "variables", valor: siguiente.variables });
            const { formato: _f, partes: _p, ...resto } = b.params;
            despachar({
              tipo: "params",
              valor: {
                ...resto,
                ...(siguiente.partes === "una" ? {} : { partes: siguiente.partes }),
                ...(siguiente.partes === "una" && siguiente.formato !== "auto" ? { formato: siguiente.formato } : {}),
              },
            });
          }}
        />
        {fecha("min", "Inicio del operativo")}
        {fecha("max", "Cierre del operativo")}
        <Fila key="timezone" variante="campo" rotulo="Zona horaria">
          <PulsoInput
            value={(b.params.timezone as string | undefined) ?? "America/Lima"}
            onChange={(e) => setParam("timezone", e.target.value)}
            placeholder="America/Lima"
            aria-label="Zona horaria"
          />
        </Fila>
        <SwitchDeIlegibles unidad="fecha" valor={b.params.marcar_ilegibles} onCambio={(v) => setParam("marcar_ilegibles", v)} />
      </>
    );
  }

  const unidad = unidadDeFechas(b.params.unidad);
  const patron = patronDeFechas(b.params.patron);
  const inicio = momentoDe(b.params.inicio, unidad);
  const fin = momentoDe(b.params.fin, unidad);
  return (
    <>
      <Fila key="unidad" variante="campo" rotulo="Compara">
        <Segmentado<UnidadDeFechas>
          etiqueta="Unidad de comparación"
          valor={unidad}
          opciones={UNIDADES}
          ancho
          onCambio={(u) =>
            despachar({
              tipo: "params",
              valor: { ...b.params, unidad: u, inicio: conPartes(inicio, "una"), fin: conPartes(fin, "una") },
            })
          }
        />
      </Fila>
      <Fila key="patron" variante="campo" rotulo="Revisa">
        <Segmentado<PatronDeFechas> etiqueta="Patrón de las fechas" valor={patron} opciones={PATRONES} ancho onCambio={(p) => setParam("patron", p)} />
      </Fila>
      <CamposDeMomento cual="Inicio" momento={inicio} unidad={unidad} variables={variables} onCambio={(m) => setParam("inicio", m)} />
      <CamposDeMomento cual="Fin" momento={fin} unidad={unidad} variables={variables} onCambio={(m) => setParam("fin", m)} />
      {patron === "duracion" ? (
        <>
          <CampoDeDuracion clave="minimo" rotulo="Menos de" valor={b.params.minimo} unidad={unidad} onCambio={(v) => setParam("minimo", v)} />
          <CampoDeDuracion clave="maximo" rotulo="Más de" valor={b.params.maximo} unidad={unidad} onCambio={(v) => setParam("maximo", v)} />
        </>
      ) : null}
      <SwitchDeIlegibles unidad={unidad} valor={b.params.marcar_ilegibles} onCambio={(v) => setParam("marcar_ilegibles", v)} />
    </>
  );
}
