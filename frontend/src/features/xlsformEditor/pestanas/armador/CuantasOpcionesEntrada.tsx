// «Cuántas opciones» en una selección múltiple (E19 paso 2 editor-conjoint, 2026-11-06): al menos, máximo, entre o
// exactamente, con el número que se escriba. Misma forma que «Opciones que van solas»: entrada plegada con la lectura,
// panel con la frase que se arma y Aplicar, que conserva lo demás que la restricción exija.

import { useId, useState } from "react";
import { Hash } from "../../../../vendor/lucide-react";
import { PulsoInput } from "../../../../components/PulsoInput";
import {
  escribirCuantas,
  leerCuantas,
  mensajeCuantas,
  MODOS_CUANTAS,
  problemaCuantas,
  type LimiteCuantas,
  type ModoCuantas,
} from "./cuantasOpcionesModelo";

type Props = {
  constraint: string;
  totalOpciones: number;
  /** Escribe la restricción nueva y, si no había mensaje, el propuesto. */
  onAplicar: (constraint: string, mensaje: string) => void;
};

const numero = (v: string): number | null =>
  v.trim() === "" || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v));

export function CuantasOpcionesEntrada({
  constraint,
  totalOpciones,
  onAplicar,
}: Props) {
  const tituloId = useId();
  const vigente = leerCuantas(constraint).limite;
  const [borrador, setBorrador] = useState<LimiteCuantas | null>(null);
  const l = borrador ?? vigente;
  const cambiarModo = (modo: ModoCuantas) => {
    const n = l.max ?? l.min ?? 2;
    const lim: LimiteCuantas =
      modo === "libre"
        ? { modo, min: null, max: null }
        : modo === "maximo"
          ? { modo, min: null, max: n }
          : modo === "entre"
            ? {
                modo,
                min: l.min ?? 1,
                max: Math.max(l.max ?? n, (l.min ?? 1) + 1),
              }
            : { modo, min: n, max: modo === "exactamente" ? n : null };
    setBorrador(lim);
  };
  const cambiarNumero = (campo: "min" | "max", v: string) => {
    const n = numero(v);
    setBorrador(
      l.modo === "exactamente"
        ? { ...l, min: n, max: n }
        : { ...l, [campo]: n },
    );
  };
  const problema = problemaCuantas(l, totalOpciones);
  const siguiente = problema ? null : escribirCuantas(constraint, l);
  const cambio =
    siguiente !== null && siguiente !== escribirCuantas(constraint, vigente);
  const usaMin =
    l.modo === "alMenos" || l.modo === "entre" || l.modo === "exactamente";
  const usaMax = l.modo === "maximo" || l.modo === "entre";

  return (
    // Siempre abierta: Gonzalo no quiere triángulos que despliegan (2026-11-06).
    <section
      className="xfa-bloque"
      data-testid="cuantas-opciones"
      aria-labelledby={tituloId}
    >
      <header className="xfa-bloque__cabeza">
        <span className="xfa-bloque__icono" aria-hidden="true">
          <Hash />
        </span>
        <div className="xfa-bloque__titulos">
          <h4 id={tituloId} className="xfa-bloque__titulo">
            Cuántas opciones
          </h4>
          <p className="xfa-bloque__sub">
            Límite de opciones que puede marcar
            {totalOpciones ? `, de ${totalOpciones}` : ""}.
          </p>
        </div>
      </header>
      <div
        className="xfa-cuantas__modos"
        role="radiogroup"
        aria-label="Cuántas opciones puede marcar"
      >
        {MODOS_CUANTAS.map((m) => (
          <button
            key={m.modo}
            type="button"
            role="radio"
            aria-checked={l.modo === m.modo}
            className={`xfa-cuantas__modo${l.modo === m.modo ? " is-on" : ""}`}
            onClick={() => cambiarModo(m.modo)}
          >
            {m.nombre}
          </button>
        ))}
      </div>
      {l.modo !== "libre" ? (
        <div className="xfa-cuantas__frase">
          <span>
            Marca{" "}
            {MODOS_CUANTAS.find((m) => m.modo === l.modo)?.nombre.toLowerCase()}
          </span>
          {usaMin ? (
            <PulsoInput
              size="sm"
              type="number"
              min={1}
              max={totalOpciones || undefined}
              aria-label={l.modo === "entre" ? "Desde" : "Número de opciones"}
              className="xfa-cuantas__numero"
              value={l.min ?? ""}
              onChange={(e) => cambiarNumero("min", e.target.value)}
            />
          ) : null}
          {l.modo === "entre" ? <span>y</span> : null}
          {usaMax ? (
            <PulsoInput
              size="sm"
              type="number"
              min={1}
              max={totalOpciones || undefined}
              aria-label={l.modo === "entre" ? "Hasta" : "Número de opciones"}
              className="xfa-cuantas__numero"
              value={l.max ?? ""}
              onChange={(e) => cambiarNumero("max", e.target.value)}
            />
          ) : null}
          <span>opciones.</span>
        </div>
      ) : null}
      {problema ? (
        <p className="xfa-bloque__resultado is-aviso" role="status">
          <span>{problema}</span>
        </p>
      ) : null}
      {cambio ? (
        <div className="xfa-bloque__acciones">
          <button type="button" onClick={() => setBorrador(null)}>
            Deshacer
          </button>
          <button
            type="button"
            className="pulso-primary"
            disabled={!cambio}
            onClick={() => {
              if (siguiente === null) return;
              onAplicar(siguiente, mensajeCuantas(l));
              setBorrador(null);
            }}
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </section>
  );
}
