// El selector de la cabecera de la vista previa: salta a la tabla de una
// pregunta. Es el select del kit, con teclado y búsqueda por tecleo. Cada
// opción se lee por su pregunta con el código delante.

import { PulsoSelect, type PulsoSelectOption } from "../../../components/PulsoSelect";

export type PreguntaParaIr = { variable: string; codigo: string; etiqueta: string };

export function IrAPregunta({ preguntas, elegida, onElegir }: {
  preguntas: readonly PreguntaParaIr[];
  elegida: string | null;
  onElegir: (variable: string) => void;
}) {
  const opciones: PulsoSelectOption[] = preguntas.map((p) => ({
    value: p.variable,
    textValue: `${p.codigo} ${p.etiqueta}`,
    label: (
      <span className="tablas-ir-a-opcion">
        <code className="tablas-codigo">{p.codigo}</code>
        <span>{p.etiqueta}</span>
      </span>
    ),
  }));
  // La cadena vacía es "sin selección" para el select: muestra el rótulo.
  const vigente = elegida && preguntas.some((p) => p.variable === elegida) ? elegida : "";
  return (
    <div className="tablas-ir-a">
      <PulsoSelect
        size="sm"
        ariaLabel="Ir a una pregunta"
        placeholder="Ir a una pregunta"
        value={vigente}
        options={opciones}
        onValueChange={onElegir}
      />
    </div>
  );
}
