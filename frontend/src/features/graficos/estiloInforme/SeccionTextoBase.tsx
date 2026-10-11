// C48: el texto automático de la base («Base: 120 respuestas») que heredan todos los gráficos del informe. Vive en el
// preset `base`. Cada campo se confirma al salir o con Enter; un formato que el motor no puede componer no se guarda.

import { useId, useState } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { RotateCcw } from "../../../vendor/lucide-react";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";
import { errorFormato, N_EJEMPLO, type CampoBase, type TextoBase } from "./modeloEstiloInforme";

function CampoTexto({
  campo,
  etiqueta,
  ayuda,
  validar,
  onCambiar,
  onVolver,
}: {
  campo: CampoBase;
  etiqueta: string;
  ayuda: string;
  validar?: (texto: string) => string | null;
  onCambiar: (texto: string) => void;
  onVolver: () => void;
}) {
  const id = useId();
  const [borrador, setBorrador] = useState(campo.valor);
  const error = validar ? validar(borrador) : null;
  const confirmar = () => {
    if (error || borrador === campo.valor) return;
    onCambiar(borrador);
  };
  return (
    <div className="pulso-f6-informe-campo" data-qa-geometry-member>
      <div className="pulso-f6-informe-campo-cabecera">
        <label htmlFor={`${id}-input`} className="pulso-f6-informe-campo-etiqueta">{etiqueta}</label>
        <SelloProcedencia procedencia={campo.procedencia} />
        {campo.procedencia === "propio" ? (
          <PulsoButton variant="icon" size="sm" onClick={onVolver} aria-label={`Volver al recetario en ${etiqueta.toLowerCase()}`} title="Volver al recetario">
            <RotateCcw size={14} aria-hidden="true" />
          </PulsoButton>
        ) : null}
      </div>
      <input
        id={`${id}-input`}
        className="pulso-f6-informe-input"
        type="text"
        value={borrador}
        placeholder={campo.porDefecto || "(vacío)"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-ayuda ${id}-error` : `${id}-ayuda`}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") setBorrador(campo.valor);
        }}
      />
      <p id={`${id}-ayuda`} className="pulso-f6-informe-ayuda">
        {ayuda} El recetario pone {campo.porDefecto ? <strong>«{campo.porDefecto}»</strong> : "nada"}.
      </p>
      {error ? <p id={`${id}-error`} className="pulso-f6-informe-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function SeccionTextoBase({
  texto,
  onCambiar,
  onVolver,
  onVolverTodo,
}: {
  texto: TextoBase;
  onCambiar: (arg: string, valor: string) => void;
  onVolver: (arg: string) => void;
  onVolverTodo: () => void;
}) {
  const tituloId = useId();
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member>
      <CabeceraSeccion
        id={tituloId}
        titulo="Texto de la base"
        modificado={texto.modificado}
        etiquetaVolver="Volver al texto de la base del recetario"
        onVolver={onVolverTodo}
      />
      <p className="pulso-f6-informe-ayuda">El conteo que acompaña a cada gráfico. Vale para todas las láminas del informe.</p>
      <div className="pulso-f6-informe-campos" data-qa-geometry-group="graficos/f6-estilo-informe-texto-base" data-qa-geometry-contract="intrinsic">
        {/* `key` con el valor guardado: al deshacer o volver al recetario, el borrador se repone. */}
        <CampoTexto
          key={`formato:${texto.formato.valor}`}
          campo={texto.formato}
          etiqueta="Formato"
          ayuda="%s es el conteo."
          validar={errorFormato}
          onCambiar={(v) => onCambiar(texto.formato.arg, v)}
          onVolver={() => onVolver(texto.formato.arg)}
        />
        <CampoTexto
          key={`sufijo:${texto.sufijo.valor}`}
          campo={texto.sufijo}
          etiqueta="Sufijo del conteo"
          ayuda="Se escribe después del número; vacío, no se añade nada."
          onCambiar={(v) => onCambiar(texto.sufijo.arg, v)}
          onVolver={() => onVolver(texto.sufijo.arg)}
        />
      </div>
      <p className="pulso-f6-informe-ejemplo">
        <span className="pulso-f6-informe-ejemplo-rotulo">Con {N_EJEMPLO} casos se lee:</span>{" "}
        <output className="pulso-f6-informe-ejemplo-texto">{texto.ejemplo}</output>
      </p>
    </section>
  );
}
