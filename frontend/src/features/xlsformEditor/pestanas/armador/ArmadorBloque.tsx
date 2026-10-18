import type { ChangeEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, X } from "../../../../vendor/lucide-react";
import { conector, type Bloque, type ClaseLetras, type ModoBloque } from "./armadorModelo";

// Una parte del patrón, escrita como frase editable: «Empieza con [8] dígitos», «luego [:]», «termina con …».

type Props = {
  bloque: Bloque;
  indice: number;
  total: number;
  onCambiar: (cambios: Partial<Bloque>) => void;
  onMover: (delta: -1 | 1) => void;
  onQuitar: () => void;
};

const LIMITES = { n: [1, 30], min: [0, 30], max: [1, 30], desde: [0, 9999], hasta: [0, 9999] } as const;
type CampoNum = keyof typeof LIMITES;

const CLASES: [ClaseLetras, string][] = [
  ["ambas", "letras"],
  ["mayus", "mayúsculas"],
  ["minus", "minúsculas"],
  ["tildes", "letras con tildes"],
  ["espacios", "letras con tildes y espacios"],
];

export function ArmadorBloque({ bloque: b, indice, total, onCambiar, onMover, onQuitar }: Props) {
  const num = (campo: CampoNum, etiqueta: string) => (
    <input
      type="number"
      inputMode="numeric"
      className="xfa-bloque__num"
      value={b[campo]}
      min={LIMITES[campo][0]}
      max={LIMITES[campo][1]}
      aria-label={etiqueta}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        if (e.target.value === "" || !Number.isFinite(v)) return;
        onCambiar({ [campo]: Math.max(LIMITES[campo][0], Math.min(LIMITES[campo][1], Math.round(v))) });
      }}
    />
  );
  const modo = (opciones: [ModoBloque, string][], etiqueta: string) => (
    <select className="xfa-bloque__sel" value={b.modo} aria-label={etiqueta} onChange={(e) => onCambiar({ modo: e.target.value as ModoBloque })}>
      {opciones.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
  const texto = (campo: "texto" | "opciones", etiqueta: string, ancho: "corto" | "largo") => (
    <input
      className={`xfa-bloque__txt xfa-bloque__txt--${ancho}`}
      value={b[campo]}
      aria-label={etiqueta}
      spellCheck={false}
      onChange={(e) => onCambiar({ [campo]: e.target.value })}
    />
  );

  let cuerpo: ReactNode;
  switch (b.tipo) {
    case "digitos":
      cuerpo = (
        <>
          {b.modo === "exacto" && <>{num("n", "Cantidad de dígitos")} dígitos</>}
          {b.modo === "entre" && <>de {num("min", "Mínimo de dígitos")} a {num("max", "Máximo de dígitos")} dígitos</>}
          {b.modo === "mas" && <>dígitos</>}
          {b.modo === "rango" && <>un número de {num("desde", "Desde")} a {num("hasta", "Hasta")}</>}
          {modo([["exacto", "cantidad fija"], ["entre", "cantidad variable"], ["mas", "uno o más"], ["rango", "número en rango"]], "Forma de los dígitos")}
        </>
      );
      break;
    case "letras":
      cuerpo = (
        <>
          {b.modo === "exacto" && num("n", "Cantidad de letras")}
          {b.modo === "entre" && <>de {num("min", "Mínimo de letras")} a {num("max", "Máximo de letras")}</>}
          <select className="xfa-bloque__sel" value={b.clase} aria-label="Tipo de letras" onChange={(e) => onCambiar({ clase: e.target.value as ClaseLetras })}>
            {CLASES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          {modo([["exacto", "cantidad fija"], ["entre", "cantidad variable"], ["mas", "una o más"]], "Cantidad de letras")}
        </>
      );
      break;
    case "fijo":
      cuerpo = texto("texto", "Texto fijo", "corto");
      break;
    case "lista":
      cuerpo = <>uno de {texto("opciones", "Opciones separadas por comas", "largo")}</>;
      break;
    case "opcional":
      cuerpo = <>{texto("texto", "Texto opcional", "corto")} opcional</>;
      break;
    case "avanzado":
      cuerpo = <b>{b.nombre}</b>;
      break;
  }

  return (
    <li className={`xfa-bloque xfa-tono-${(indice % 5) + 1}`} data-qa-geometry-member="">
      <p className="xfa-bloque__dice">
        <span className="xfa-bloque__pre">{conector(indice, total)}</span> {cuerpo}
      </p>
      <div className="xfa-bloque__acciones">
        <button type="button" className="xfa-ico" aria-label={`Subir parte ${indice + 1}`} disabled={indice === 0} onClick={() => onMover(-1)}>
          <ArrowUp aria-hidden="true" />
        </button>
        <button type="button" className="xfa-ico" aria-label={`Bajar parte ${indice + 1}`} disabled={indice === total - 1} onClick={() => onMover(1)}>
          <ArrowDown aria-hidden="true" />
        </button>
        <button type="button" className="xfa-ico" aria-label={`Quitar parte ${indice + 1}`} onClick={onQuitar}>
          <X aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
