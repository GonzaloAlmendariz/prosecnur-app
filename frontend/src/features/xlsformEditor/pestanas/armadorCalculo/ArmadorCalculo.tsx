// Armador de cálculos por intención (E19-3 = E17b editor-conjoint, 2026-11-06). Pedido de Gonzalo: «la construcción de
// bloques o funciones tiene que quedar aún más clara, aún más intuitiva». Se elige QUÉ se quiere calcular (cinco
// tarjetas con su ejemplo), se completa una frase eligiendo preguntas y valores, y la fórmula XLSForm se ve mientras se
// arma; «Probar con respuestas», debajo, la evalúa en vivo porque el borrador sube a la pestaña. Sin triángulos (E20).

import { useEffect, useId, useState, type ReactNode } from "react";
import { Calculator, GitBranch, Link2, ListChecks, Plus, Shuffle, Sigma, X } from "../../../../vendor/lucide-react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { SelectorPregunta, type OpcionPregunta } from "../../kit/SelectorPregunta";
import { stripMarkdown } from "../../helpers/markdown";
import type { LogicScope } from "../../logic/builderTypes";
import {
  aFormula,
  faltantes,
  filasAuxiliares,
  INTENCIONES,
  intencionVacia,
  type Caso,
  type Intencion,
  type Operador,
  type TipoIntencion,
} from "./modeloCalculo";
import "../armador/armador.css";
import "./armadorCalculo.css";

const ICONO: Record<TipoIntencion, ReactNode> = {
  segun: <GitBranch />,
  operar: <Sigma />,
  contar: <ListChecks />,
  sortear: <Shuffle />,
  unir: <Link2 />,
};

const OPERADORES: { value: Operador; label: string }[] = [
  { value: "=", label: "es" },
  { value: "!=", label: "no es" },
  { value: "<", label: "es menor que" },
  { value: "<=", label: "es menor o igual que" },
  { value: ">", label: "es mayor que" },
  { value: ">=", label: "es mayor o igual que" },
  { value: "marcó", label: "marcó" },
];

const OPERACIONES = [
  { value: "sumar", label: "Sumar" },
  { value: "restar", label: "Restar" },
  { value: "multiplicar", label: "Multiplicar" },
  { value: "promedio", label: "Promedio" },
] as const;

type Props = {
  scope: LogicScope;
  /** Nombre del cálculo que se arma: no se ofrece como pregunta y da nombre al azar de un sorteo. */
  nombre: string;
  /** La fórmula armada mientras se completa (null si falta algo), para que «Probar con respuestas» la evalúe. */
  onBorrador: (formula: string | null) => void;
  /** La intención de una fórmula ya escrita, para editarla con el armador (E17). */
  inicial?: Intencion | null;
  /** Escribe la fórmula y sus filas auxiliares; devuelve el motivo si no se pudo. */
  onAplicar: (formula: string, auxiliares: { name: string; calculation: string }[]) => string | null;
};

export function ArmadorCalculo({ scope, nombre, inicial, onBorrador, onAplicar }: Props) {
  const tituloId = useId();
  const [intencion, setIntencion] = useState<Intencion | null>(inicial ?? null);
  const [error, setError] = useState<string | null>(null);
  const formula = intencion ? aFormula(intencion) : null;
  const falta = intencion ? faltantes(intencion) : [];
  useEffect(() => { onBorrador(formula); }, [formula, onBorrador]);

  const preguntas: OpcionPregunta[] = scope.variables
    .filter((v) => v.name !== nombre)
    .map((v, i) => ({ valor: v.name, numero: String(i + 1), texto: stripMarkdown(v.label || v.name), baseType: v.baseType }));
  const variable = (n: string) => scope.variables.find((v) => v.name === n);
  const elegir = (tipo: TipoIntencion) => {
    const nueva = intencionVacia(tipo);
    setIntencion(nueva.tipo === "sortear" ? { ...nueva, azar: `azar_${nombre}` } : nueva);
    setError(null);
  };
  const cambiar = (i: Intencion) => { setIntencion(i); setError(null); };

  return (
    <section className="xfa-bloque xfc-armador" aria-labelledby={tituloId} data-testid="armador-calculo">
      <header className="xfa-bloque__cabeza">
        <span className="xfa-bloque__icono" aria-hidden="true"><Calculator /></span>
        <div className="xfa-bloque__titulos">
          <h4 id={tituloId} className="xfa-bloque__titulo">Armador de cálculos</h4>
        </div>
      </header>

      <div className="xfc-intenciones" role="radiogroup" aria-label="Tipo de cálculo">
        {INTENCIONES.map((it) => (
          <button
            key={it.tipo}
            type="button"
            role="radio"
            aria-checked={intencion?.tipo === it.tipo}
            className={`xfc-intencion${intencion?.tipo === it.tipo ? " is-on" : ""}`}
            onClick={() => elegir(it.tipo)}
          >
            <span className="xfc-intencion__icono" aria-hidden="true">{ICONO[it.tipo]}</span>
            <strong>{it.nombre}</strong>
            <span>{it.ejemplo}</span>
          </button>
        ))}
      </div>

      {intencion ? (
        <div className="xfc-frase">
          {intencion.tipo === "segun" ? <FraseSegun i={intencion} preguntas={preguntas} variable={variable} scope={scope} onCambio={cambiar} /> : null}
          {intencion.tipo === "operar" ? <FraseOperar i={intencion} preguntas={preguntas.filter((p) => p.baseType === "integer" || p.baseType === "decimal" || p.baseType === "calculate")} onCambio={cambiar} /> : null}
          {intencion.tipo === "contar" ? (
            <div className="xfc-linea">
              <span>Cuántas opciones marcó en</span>
              <SelectorPregunta opciones={preguntas.filter((p) => p.baseType === "select_multiple")} valor={intencion.pregunta} onCambio={(v) => cambiar({ ...intencion, pregunta: v })} placeholder="Elige una pregunta de opción múltiple" etiqueta="Pregunta de opción múltiple" />
            </div>
          ) : null}
          {intencion.tipo === "sortear" ? <FraseSortear i={intencion} onCambio={cambiar} /> : null}
          {intencion.tipo === "unir" ? <FraseUnir i={intencion} preguntas={preguntas} onCambio={cambiar} /> : null}
        </div>
      ) : null}

      {intencion ? (
        <div className="xfa-codigo">
          <span className="xfa-codigo__rot">Expresión en XLSForm</span>
          <pre>{formula ?? "…"}</pre>
        </div>
      ) : null}
      {intencion && falta.length ? (
        <ul className="xfc-faltan" aria-label="Lo que falta">
          {falta.map((f) => <li key={f}>{f}</li>)}
        </ul>
      ) : null}
      {error ? <p className="xfa-bloque__resultado is-aviso" role="alert"><span>{error}</span></p> : null}
      {intencion ? (
        <div className="xfa-bloque__acciones">
          <button type="button" onClick={() => { setIntencion(null); setError(null); }}>Descartar</button>
          <button
            type="button"
            className="pulso-primary"
            disabled={!formula}
            onClick={() => {
              if (!formula) return;
              const motivo = onAplicar(formula, filasAuxiliares(intencion));
              if (motivo) setError(motivo);
              else setIntencion(null);
            }}
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Quitar({ onQuitar, que }: { onQuitar: () => void; que: string }) {
  return (
    <button type="button" className="xfc-quitar" aria-label={`Quitar ${que}`} onClick={onQuitar}>
      <X aria-hidden="true" />
    </button>
  );
}

function Agregar({ onAgregar, children }: { onAgregar: () => void; children: ReactNode }) {
  return (
    <button type="button" className="xfa-bloque__accion xfc-agregar" onClick={onAgregar}>
      <Plus aria-hidden="true" /> {children}
    </button>
  );
}

function ValorDe({ pregunta, valor, scope, variable, onCambio, etiqueta }: {
  pregunta: string;
  valor: string;
  scope: LogicScope;
  variable: (n: string) => LogicScope["variables"][number] | undefined;
  onCambio: (v: string) => void;
  etiqueta: string;
}) {
  const v = variable(pregunta);
  const catalogo = v?.listName ? scope.catalogsByListName.get(v.listName) : undefined;
  if (catalogo?.items.length) {
    return (
      <PulsoSelect
        size="sm"
        ariaLabel={etiqueta}
        value={valor || undefined}
        onValueChange={onCambio}
        placeholder="Elige una opción"
        options={catalogo.items.filter((o) => o.name).map((o) => ({ value: o.name, label: stripMarkdown(o.label || o.name), textValue: stripMarkdown(o.label || o.name) }))}
      />
    );
  }
  return <PulsoInput size="sm" aria-label={etiqueta} value={valor} onChange={(e) => onCambio(e.target.value)} placeholder="valor" />;
}

function FraseSegun({ i, preguntas, variable, scope, onCambio }: {
  i: Extract<Intencion, { tipo: "segun" }>;
  preguntas: OpcionPregunta[];
  variable: (n: string) => LogicScope["variables"][number] | undefined;
  scope: LogicScope;
  onCambio: (i: Intencion) => void;
}) {
  const caso = (k: number, c: Partial<Caso>) => onCambio({ ...i, casos: i.casos.map((x, j) => (j === k ? { ...x, ...c } : x)) });
  return (
    <>
      {i.casos.map((c, k) => (
        <div key={k} className="xfc-caso">
          <span className="xfc-caso__si">{k === 0 ? "Si" : "Si no, si"}</span>
          <SelectorPregunta opciones={preguntas} valor={c.pregunta} onCambio={(v) => caso(k, { pregunta: v, valor: "" })} placeholder="Elige una pregunta" etiqueta={`Pregunta del caso ${k + 1}`} />
          <PulsoSelect
            size="sm"
            ariaLabel={`Comparación del caso ${k + 1}`}
            value={c.operador}
            onValueChange={(v) => caso(k, { operador: v as Operador })}
            options={OPERADORES.filter((o) => o.value !== "marcó" || variable(c.pregunta)?.baseType === "select_multiple")}
          />
          <ValorDe pregunta={c.pregunta} valor={c.valor} scope={scope} variable={variable} onCambio={(v) => caso(k, { valor: v, codigo: Boolean(variable(c.pregunta)?.listName) })} etiqueta={`Valor del caso ${k + 1}`} />
          <span className="xfc-caso__vale">vale</span>
          <PulsoInput size="sm" className="xfc-caso__resultado" aria-label={`Resultado del caso ${k + 1}`} value={c.resultado} onChange={(e) => caso(k, { resultado: e.target.value })} placeholder="resultado" />
          {i.casos.length > 1 ? <Quitar que={`el caso ${k + 1}`} onQuitar={() => onCambio({ ...i, casos: i.casos.filter((_, j) => j !== k) })} /> : <span />}
        </div>
      ))}
      <Agregar onAgregar={() => onCambio({ ...i, casos: [...i.casos, { pregunta: "", operador: "=", valor: "", resultado: "" }] })}>Agregar otro caso</Agregar>
      <div className="xfc-linea">
        <span>En otro caso, vale</span>
        <PulsoInput size="sm" aria-label="Valor por defecto" value={i.siNo} onChange={(e) => onCambio({ ...i, siNo: e.target.value })} placeholder="resultado" />
      </div>
    </>
  );
}

function FraseOperar({ i, preguntas, onCambio }: { i: Extract<Intencion, { tipo: "operar" }>; preguntas: OpcionPregunta[]; onCambio: (i: Intencion) => void }) {
  return (
    <>
      <div className="xfa-cuantas__modos" role="radiogroup" aria-label="Operación">
        {OPERACIONES.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={i.operacion === o.value} className={`xfa-cuantas__modo${i.operacion === o.value ? " is-on" : ""}`} onClick={() => onCambio({ ...i, operacion: o.value })}>
            {o.label}
          </button>
        ))}
      </div>
      {i.preguntas.map((p, k) => (
        <div key={k} className="xfc-linea">
          <span className="xfc-linea__n">{k + 1}.</span>
          <SelectorPregunta opciones={preguntas} valor={p} onCambio={(v) => onCambio({ ...i, preguntas: i.preguntas.map((x, j) => (j === k ? v : x)) })} placeholder="Elige una pregunta numérica" etiqueta={`Término ${k + 1}`} />
          {i.preguntas.length > 1 ? <Quitar que={`el término ${k + 1}`} onQuitar={() => onCambio({ ...i, preguntas: i.preguntas.filter((_, j) => j !== k) })} /> : null}
        </div>
      ))}
      <Agregar onAgregar={() => onCambio({ ...i, preguntas: [...i.preguntas, ""] })}>Agregar otra pregunta</Agregar>
      <div className="xfc-linea">
        <span>Número fijo (opcional)</span>
        <PulsoInput size="sm" className="xfa-cuantas__numero" aria-label="Número fijo" value={i.constante} onChange={(e) => onCambio({ ...i, constante: e.target.value })} placeholder="—" />
      </div>
    </>
  );
}

function FraseSortear({ i, onCambio }: { i: Extract<Intencion, { tipo: "sortear" }>; onCambio: (i: Intencion) => void }) {
  const valor = (k: number, c: Partial<{ valor: string; peso: string }>) => onCambio({ ...i, valores: i.valores.map((x, j) => (j === k ? { ...x, ...c } : x)) });
  return (
    <>
      <p className="xfa-bloque__sub">Un sorteo por entrevista. Sin pesos, equiprobable; los pesos van en porcentaje.</p>
      {i.valores.map((v, k) => (
        <div key={k} className="xfc-linea">
          <span className="xfc-linea__n">{k + 1}.</span>
          <PulsoInput size="sm" aria-label={`Valor ${k + 1}`} value={v.valor} onChange={(e) => valor(k, { valor: e.target.value })} placeholder="valor" />
          <PulsoInput size="sm" className="xfa-cuantas__numero" aria-label={`Peso del valor ${k + 1}`} value={v.peso} onChange={(e) => valor(k, { peso: e.target.value })} placeholder="%" />
          {i.valores.length > 2 ? <Quitar que={`el valor ${k + 1}`} onQuitar={() => onCambio({ ...i, valores: i.valores.filter((_, j) => j !== k) })} /> : null}
        </div>
      ))}
      <Agregar onAgregar={() => onCambio({ ...i, valores: [...i.valores, { valor: "", peso: "" }] })}>Agregar otro valor</Agregar>
      <div className="xfc-linea">
        <span>Número al azar</span>
        <PulsoInput size="sm" aria-label="Nombre del cálculo con el número al azar" value={i.azar} onChange={(e) => onCambio({ ...i, azar: e.target.value.replace(/\s+/g, "_") })} />
        <span className="xfa-bloque__sub">fila nueva antes de este cálculo</span>
      </div>
    </>
  );
}

function FraseUnir({ i, preguntas, onCambio }: { i: Extract<Intencion, { tipo: "unir" }>; preguntas: OpcionPregunta[]; onCambio: (i: Intencion) => void }) {
  const parte = (k: number, c: Partial<{ tipo: "texto" | "pregunta"; valor: string }>) => onCambio({ ...i, partes: i.partes.map((x, j) => (j === k ? { ...x, ...c } : x)) });
  return (
    <>
      {i.partes.map((p, k) => (
        <div key={k} className="xfc-linea">
          <span className="xfc-linea__n">{k + 1}.</span>
          <div className="xfa-cuantas__modos" role="radiogroup" aria-label={`Parte ${k + 1}`}>
            {(["texto", "pregunta"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={p.tipo === t} className={`xfa-cuantas__modo${p.tipo === t ? " is-on" : ""}`} onClick={() => parte(k, { tipo: t, valor: "" })}>
                {t === "texto" ? "Texto" : "Respuesta"}
              </button>
            ))}
          </div>
          {p.tipo === "texto"
            ? <PulsoInput size="sm" aria-label={`Texto de la parte ${k + 1}`} value={p.valor} onChange={(e) => parte(k, { valor: e.target.value })} placeholder="texto, con sus espacios" />
            : <SelectorPregunta opciones={preguntas} valor={p.valor} onCambio={(v) => parte(k, { valor: v })} placeholder="Elige una pregunta" etiqueta={`Pregunta de la parte ${k + 1}`} />}
          {i.partes.length > 2 ? <Quitar que={`la parte ${k + 1}`} onQuitar={() => onCambio({ ...i, partes: i.partes.filter((_, j) => j !== k) })} /> : null}
        </div>
      ))}
      <Agregar onAgregar={() => onCambio({ ...i, partes: [...i.partes, { tipo: "texto", valor: "" }] })}>Agregar otra parte</Agregar>
    </>
  );
}
