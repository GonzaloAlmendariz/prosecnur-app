// La tabla de «Revisar emparejado» (ADR 0135 §7): una fila por pregunta, una columna por público, «Cómo se emparejó» con
// sus cuatro estados y las acciones de la fila. Es la PulsoTable del kit; el dueño del scroll vertical es el cuerpo del
// diálogo (la tabla crece con sus filas).

import { useMemo, useRef, type MutableRefObject, type SyntheticEvent } from "react";
import type { VariableDeBase } from "../../../../api/equivalencias";
import type { PreguntaDeBase } from "../../../../api/graficosEmparejado";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { nombrePublico } from "../../multiapiladas/temasPublicos";
import { AccionesEmparejado } from "./AccionesEmparejado";
import { BuscarPar } from "./BuscarPar";
import { ChipCoincidencia } from "./ChipCoincidencia";
import { ROTULO_COINCIDENCIA, type CoincidenciaDePar } from "./coincidencia";
import { ROTULO_ESTADO, type FilaEmparejado } from "./modeloEmparejado";

type Props = {
  filas: readonly FilaEmparejado[];
  bases: readonly string[];
  vacio: string;
  /** La coincidencia de cada fila por `clave` (coincidencia.ts). */
  coincidencias: ReadonlyMap<string, CoincidenciaDePar | null>;
  buscando: string | null;
  /** La fila activa (su evidencia se ve bajo la tabla). */
  activa: string | null;
  /** Un clic o el foco dentro de una fila la vuelve activa. */
  onActivar: (clave: string) => void;
  /** Opciones del buscador para la fila que busca su par. */
  opcionesDe: (fila: FilaEmparejado) => VariableDeBase[];
  /** Preguntas de la otra base ya confirmadas en la lámina: elegirlas las mueve. */
  tomadasDe: (fila: FilaEmparejado) => ReadonlySet<string>;
  onConfirmar: (fila: FilaEmparejado, par: PreguntaDeBase) => void;
  onElegir: (fila: FilaEmparejado, variable: string) => void;
  onBuscar: (fila: FilaEmparejado | null) => void;
  onDescartar: (fila: FilaEmparejado) => void;
  onQuitar: (fila: FilaEmparejado) => void;
};

// Q4-5: la suma (900) cabe en el cuerpo del diálogo `lg` a 1440 y a 1024 sin desplazamiento horizontal (C4). El estado
// más largo, «Confirmado en esta lámina», entra entero en su columna; las acciones, con «Confirmar» y dos íconos. La
// columna de coincidencia (X6) sale de los textos, que se leen enteros en la evidencia del par.
export const ANCHO_BASE = 200;
export const ANCHO_COINCIDENCIA = 100;
export const ANCHO_ESTADO = 210;
export const ANCHO_ACCIONES = 190;

function textoDe(fila: FilaEmparejado, base: string): PreguntaDeBase | null {
  if (fila.pregunta.base === base) return fila.pregunta;
  return fila.par?.base === base ? fila.par : null;
}

// Las columnas se arman una vez por par de bases y sus celdas leen las props vigentes por `ref`. La tabla del kit
// monta cada celda como componente con la función de la columna: columnas nuevas en cada render remontaban las celdas
// y el foco de un botón o del ancla se perdía al activar la fila (X6, teclado).
function columnasDe(ref: MutableRefObject<Props>, bases: readonly string[]): PulsoTableColumna<FilaEmparejado>[] {
  const columnaBase = (base: string): PulsoTableColumna<FilaEmparejado> => ({
    id: `base-${base}`,
    encabezado: nombrePublico(base),
    ancho: ANCHO_BASE,
    valor: (f) => textoDe(f, base)?.etiqueta ?? null,
    celda: (f) => {
      if (f.otraBase === base && ref.current.buscando === f.clave) {
        return (
          <BuscarPar
            base={base}
            opciones={ref.current.opcionesDe(f)}
            valor={f.estado === "sugerido" ? "" : f.par?.var ?? ""}
            contexto={f.pregunta.etiqueta}
            tomadas={ref.current.tomadasDe(f)}
            onElegir={(v) => ref.current.onElegir(f, v)}
          />
        );
      }
      const q = textoDe(f, base);
      if (!q) return <span className="pulso-f6-emp-sin">Sin par</span>;
      const sugerida = f.estado === "sugerido" && f.par?.base === base;
      return (
        <span className={sugerida ? "pulso-f6-emp-pregunta is-sugerida" : "pulso-f6-emp-pregunta"}>
          <span className="pulso-f6-emp-texto">{q.etiqueta}</span>
          <span className="pulso-f6-emp-codigo">{q.var}</span>
        </span>
      );
    },
  });

  return [
    ...bases.map(columnaBase),
    {
      id: "coincidencia",
      encabezado: "Coincidencia",
      ancho: ANCHO_COINCIDENCIA,
      valor: (f) => {
        const c = ref.current.coincidencias.get(f.clave);
        return c ? ROTULO_COINCIDENCIA[c.clase] : null;
      },
      celda: (f) => (
        <span className="pulso-f6-emp-ancla" data-emp-fila={f.clave} tabIndex={-1}>
          <ChipCoincidencia coincidencia={ref.current.coincidencias.get(f.clave) ?? null} />
        </span>
      ),
    },
    {
      id: "estado",
      encabezado: "Cómo se emparejó",
      ancho: ANCHO_ESTADO,
      valor: (f) => ROTULO_ESTADO[f.estado],
      celda: (f) => (
        <span className="pulso-f6-emp-estado" data-estado={f.estado}>
          <span className="pulso-f6-emp-punto" aria-hidden="true" />
          {ROTULO_ESTADO[f.estado]}
        </span>
      ),
    },
    {
      id: "acciones",
      encabezado: "Acciones",
      ancho: ANCHO_ACCIONES,
      celda: (f) => (
        <AccionesEmparejado
          fila={f}
          buscando={ref.current.buscando === f.clave}
          activa={ref.current.activa === f.clave}
          onConfirmar={() => f.par && ref.current.onConfirmar(f, f.par)}
          onBuscar={() => ref.current.onBuscar(f)}
          onCancelar={() => ref.current.onBuscar(null)}
          onDescartar={() => ref.current.onDescartar(f)}
          onQuitar={() => ref.current.onQuitar(f)}
        />
      ),
    },
  ];
}

export function TablaEmparejado(p: Props) {
  const ultimo = useRef(p);
  ultimo.current = p;
  const basesClave = p.bases.join("\u0000");
  const columnas = useMemo(() => columnasDe(ultimo, basesClave.split("\u0000")), [basesClave]);

  // La fila se reconoce por su ancla (la celda de coincidencia): la tabla del kit no nombra sus filas.
  const activarDesde = (e: SyntheticEvent<HTMLDivElement>) => {
    const clave = (e.target as Element).closest("tr")?.querySelector("[data-emp-fila]")?.getAttribute("data-emp-fila");
    if (clave && clave !== p.activa) p.onActivar(clave);
  };

  return (
    <div className="pulso-f6-emp-tabla" onClick={activarDesde} onFocus={activarDesde}>
      <PulsoTable
        columnas={columnas}
        filas={p.filas}
        idDeFila={(f) => f.clave}
        ariaLabel="Emparejado entre públicos"
        densidad="compacta"
        seleccionada={p.activa}
        altoMaximo={100000}
        vacio={p.vacio}
      />
    </div>
  );
}
