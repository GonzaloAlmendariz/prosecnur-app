// La tabla de «Revisar emparejado» (ADR 0135 §7): una fila por pregunta, una columna por público, «Cómo se emparejó» con
// sus cuatro estados y las acciones de la fila. Es la PulsoTable del kit; el dueño del scroll vertical es el cuerpo del
// diálogo (la tabla crece con sus filas).

import type { VariableDeBase } from "../../../../api/equivalencias";
import type { PreguntaDeBase } from "../../../../api/graficosEmparejado";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { nombrePublico } from "../../multiapiladas/temasPublicos";
import { AccionesEmparejado } from "./AccionesEmparejado";
import { BuscarPar } from "./BuscarPar";
import { ROTULO_ESTADO, type FilaEmparejado } from "./modeloEmparejado";

type Props = {
  filas: readonly FilaEmparejado[];
  bases: readonly string[];
  vacio: string;
  buscando: string | null;
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

function textoDe(fila: FilaEmparejado, base: string): PreguntaDeBase | null {
  if (fila.pregunta.base === base) return fila.pregunta;
  return fila.par?.base === base ? fila.par : null;
}

export function TablaEmparejado(p: Props) {
  const columnaBase = (base: string): PulsoTableColumna<FilaEmparejado> => ({
    id: `base-${base}`,
    encabezado: nombrePublico(base),
    ancho: 240,
    valor: (f) => textoDe(f, base)?.etiqueta ?? null,
    celda: (f) => {
      if (f.otraBase === base && p.buscando === f.clave) {
        return (
          <BuscarPar
            base={base}
            opciones={p.opcionesDe(f)}
            valor={f.estado === "sugerido" ? "" : f.par?.var ?? ""}
            contexto={f.pregunta.etiqueta}
            tomadas={p.tomadasDe(f)}
            onElegir={(v) => p.onElegir(f, v)}
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

  const columnas: PulsoTableColumna<FilaEmparejado>[] = [
    ...p.bases.map(columnaBase),
    {
      id: "estado",
      encabezado: "Cómo se emparejó",
      ancho: 170,
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
      ancho: 240,
      celda: (f) => (
        <AccionesEmparejado
          fila={f}
          buscando={p.buscando === f.clave}
          onConfirmar={() => f.par && p.onConfirmar(f, f.par)}
          onBuscar={() => p.onBuscar(f)}
          onCancelar={() => p.onBuscar(null)}
          onDescartar={() => p.onDescartar(f)}
          onQuitar={() => p.onQuitar(f)}
        />
      ),
    },
  ];

  return (
    <PulsoTable
      columnas={columnas}
      filas={p.filas}
      idDeFila={(f) => f.clave}
      ariaLabel="Emparejado entre públicos"
      densidad="compacta"
      altoMaximo={100000}
      vacio={p.vacio}
    />
  );
}
