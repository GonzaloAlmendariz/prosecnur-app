// Batería `table-list` en «Probar formulario» (E3 editor-conjoint): la nota que la presenta y una tabla con una fila
// por pregunta y una columna por opción, como la pinta la plataforma. La tabla es la del kit (PulsoTable, L28).

import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { stripMarkdown } from "../../helpers/markdown";
import { TextoPregunta } from "../../helpers/markdownTexto";
import type { LectorReferencias } from "../../helpers/markdownPregunta";
import type { BuilderNode } from "../../types";
import type { GrillaPrueba as Grilla } from "./modeloGrilla";
import "./grillaPrueba.css";

type Valor = string | string[];

export function GrillaPrueba({ grilla, valores, onAnswer, lector, visible }: {
  grilla: Grilla;
  valores: Record<string, Valor | undefined>;
  onAnswer: (name: string, value: Valor) => void;
  lector: LectorReferencias;
  visible: (node: BuilderNode) => boolean;
}) {
  const filas = grilla.filas.filter(visible);
  const elegido = (n: BuilderNode, c: string) => {
    const v = valores[n.name];
    return Array.isArray(v) ? v.includes(c) : v === c;
  };
  const marcar = (n: BuilderNode, c: string) => {
    const v = valores[n.name];
    if (grilla.multiple) {
      const actual = Array.isArray(v) ? v : [];
      onAnswer(n.name, actual.includes(c) ? actual.filter((x) => x !== c) : [...actual, c]);
    } else {
      onAnswer(n.name, v === c ? "" : c);
    }
  };
  // Cabecera con el código de cada opción y la leyenda arriba: los rótulos largos no caben en una columna de radios.
  const codigo = (o: { name: string }, i: number) => (o.name.length <= 3 ? o.name : String(i + 1));
  const columnas: PulsoTableColumna<BuilderNode>[] = [
    {
      id: "pregunta",
      encabezado: grilla.multiple ? "Marque todas las que apliquen" : "Una respuesta por fila",
      ancho: 170,
      celda: (n) => (
        <span className="pulso-xfsim-grilla-fila">
          <TextoPregunta texto={n.label || n.name} lector={lector} />
          {n.required ? <span className="pulso-xfsim-grilla-obligatoria" aria-label="Obligatoria" /> : null}
        </span>
      ),
    },
    ...grilla.opciones.map((o, i): PulsoTableColumna<BuilderNode> => ({
      id: `op-${o.name}`,
      encabezado: codigo(o, i),
      ancho: 64,
      celda: (n) => {
        const si = elegido(n, o.name);
        return (
          <span className="pulso-xfsim-grilla-centro" data-pregunta-prueba={n.name}>
            <button
              type="button"
              role={grilla.multiple ? "checkbox" : "radio"}
              aria-checked={si}
              aria-label={`${stripMarkdown(n.label || n.name)}: ${stripMarkdown(o.label || o.name)}`}
              className={`pulso-xfsim-grilla-celda${si ? " is-selected" : ""}${grilla.multiple ? " is-multi" : ""}`}
              onClick={() => marcar(n, o.name)}
            />
          </span>
        );
      },
    })),
  ];
  return (
    <section className="pulso-xfsim-grilla" data-grilla-prueba={grilla.filas[0]?.name}>
      {grilla.intro ? <TextoPregunta como="p" className="pulso-xfsim-grilla-intro" texto={grilla.intro.label} lector={lector} /> : null}
      <ul className="pulso-xfsim-grilla-leyenda" aria-label="Opciones de respuesta">
        {grilla.opciones.map((o, i) => (
          <li key={o.name}>
            <span className="pulso-xfsim-grilla-codigo">{codigo(o, i)}</span>
            <TextoPregunta texto={o.label || o.name} lector={lector} />
          </li>
        ))}
      </ul>
      <PulsoTable
        columnas={columnas}
        filas={filas}
        idDeFila={(n) => String(n.rowIndex)}
        ariaLabel={stripMarkdown(grilla.intro?.label ?? "Batería de preguntas")}
        vacio="Ninguna fila de esta batería aplica con las respuestas dadas."
      />
    </section>
  );
}
