// "Códigos especiales" del libro: códigos como "No sabe" o "No responde" que
// traen las preguntas del estudio. Uno encendido sale en cada pregunta solo
// cuando alguien lo eligió. Cada código es un interruptor (antes, casilla) y se
// puede agregar uno propio. El plan 5.4 los lleva a Categorías; mientras esa
// pestaña no se rehaga, siguen aquí.

import { useState } from "react";

import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { Hash, Plus } from "../../../vendor/lucide-react";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { codigoEscrito, textoEfecto, textoPorBase, textoUso, type OpcionCodigoEspecial } from "../panes/codigosEspecialesModel";

export function CodigosEspeciales({ opciones, leyendo, onAlternar }: {
  opciones: OpcionCodigoEspecial[];
  leyendo: boolean;
  onAlternar: (code: number) => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const agregar = () => {
    const n = codigoEscrito(nuevo);
    if (n === null) return;
    if (!opciones.some((o) => o.code === n && o.marcado)) onAlternar(n);
    setNuevo("");
  };
  const marcados = opciones.filter((o) => o.marcado).length;

  return (
    <PanelDeMesa zona="codigos" titulo="Códigos especiales" icono={<Hash size={16} aria-hidden="true" />} conteo={leyendo ? undefined : marcados}>
      <div className="libro-codigos-cuerpo">
        {leyendo ? <p className="libro-nota">Revisando las preguntas del estudio</p> : null}
        {!leyendo && opciones.length === 0 ? <p className="libro-nota">Las preguntas del estudio no usan códigos de este tipo.</p> : null}
        {opciones.length > 0 ? (
          <div className="libro-codigos-lista" data-qa-geometry-group="analitica/libro-codigos" data-qa-geometry-contract="intrinsic">
            {opciones.map((o) => (
              <InterruptorOpcion
                key={o.code}
                variante="linea"
                checked={o.marcado}
                onToggle={() => onAlternar(o.code)}
                titulo={`${o.code} ${o.label}${o.otras.length > 0 ? ` (y ${o.otras.length} ${o.otras.length === 1 ? "etiqueta más" : "etiquetas más"})` : ""}`}
                descripcion={[textoUso(o), textoEfecto(o)].filter(Boolean).join(". ") || (o.origen === "configurado" ? "No aparece en las preguntas del estudio" : undefined)}
                title={[
                  o.ambiguo ? `Etiquetas según la pregunta: ${[o.label, ...o.otras].join(" / ")}. Si lo enciendes, se aplica en todas.` : o.label,
                  textoPorBase(o),
                ].filter(Boolean).join("\n")}
              />
            ))}
          </div>
        ) : null}
        <div className="libro-codigos-agregar">
          <PulsoInput
            size="sm"
            value={nuevo}
            inputMode="numeric"
            placeholder="Código"
            aria-label="Agregar otro código especial"
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") agregar(); }}
          />
          <PulsoButton variant="secondary" size="sm" disabled={codigoEscrito(nuevo) === null} onClick={agregar}>
            <Plus size={13} aria-hidden="true" />
            Agregar
          </PulsoButton>
        </div>
      </div>
    </PanelDeMesa>
  );
}
