// C48: el texto automático de la base («Base: 120 respuestas») que heredan todos los gráficos del informe. Vive en el
// preset `base`. Cada campo se confirma al salir o con Enter. I6: el usuario escribe lo que va antes y después del
// número; el `%s` que necesita el motor lo arma `formatoDesdePartes`, nunca se pide a mano.

import { useId, useState } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { RotateCcw } from "../../../vendor/lucide-react";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";
import { SufijosPorBase } from "./SufijosPorBase";
import { ExcepcionesRegla } from "./ExcepcionesRegla";
import type { Excepcion } from "./excepcionesPlan";
import { formatoDesdePartes, partesFormato, type CampoBase, type TextoBase } from "./modeloEstiloInforme";

function CampoTexto({
  campo,
  etiqueta,
  ayuda,
  valor,
  porDefecto,
  onCambiar,
  onVolver,
}: {
  campo: CampoBase;
  etiqueta: string;
  ayuda: string;
  valor: string;
  porDefecto: string;
  onCambiar: (texto: string) => void;
  onVolver: () => void;
}) {
  const id = useId();
  const [borrador, setBorrador] = useState(valor);
  const confirmar = () => {
    if (borrador === valor) return;
    onCambiar(borrador);
  };
  return (
    <div className="pulso-f6-informe-campo" data-qa-geometry-member>
      <div className="pulso-f6-informe-campo-cabecera">
        <label htmlFor={`${id}-input`} className="pulso-f6-informe-campo-etiqueta">{etiqueta}</label>
        <SelloProcedencia procedencia={campo.procedencia} />
        {campo.procedencia === "propio" ? (
          <PulsoButton variant="icon" size="sm" onClick={onVolver} aria-label={`Volver al valor por defecto en ${etiqueta.toLowerCase()}`} title="Volver al valor por defecto">
            <RotateCcw size={14} aria-hidden="true" />
          </PulsoButton>
        ) : null}
      </div>
      <input
        id={`${id}-input`}
        className="pulso-f6-informe-input"
        type="text"
        value={borrador}
        placeholder={porDefecto || "(nada)"}
        aria-describedby={`${id}-ayuda`}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") setBorrador(valor);
        }}
      />
      <p id={`${id}-ayuda`} className="pulso-f6-informe-ayuda">
        {ayuda} Por defecto: {porDefecto ? <strong>{porDefecto}</strong> : "nada"}.
      </p>
    </div>
  );
}

export function SeccionTextoBase({
  texto,
  onCambiar,
  onVolver,
  onVolverTodo,
  bases = [],
  sufijosPorBase = {},
  onSufijoDeBase,
  excepciones = [],
}: {
  texto: TextoBase;
  /** R6: gráficos que nombran a sus públicos con otra palabra en su tarjeta. */
  excepciones?: readonly Excepcion[];
  /** Bases del informe; con más de una, cada base lleva su palabra después del número. */
  bases?: readonly string[];
  sufijosPorBase?: Record<string, string>;
  onSufijoDeBase?: (base: string, palabra: string) => void;
  onCambiar: (arg: string, valor: string) => void;
  onVolver: (arg: string) => void;
  onVolverTodo: () => void;
}) {
  const tituloId = useId();
  const partes = partesFormato(texto.formato.valor);
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member>
      <CabeceraSeccion
        id={tituloId}
        titulo="Texto de la base"
        modificado={texto.modificado || Object.keys(sufijosPorBase).length > 0}
        etiquetaVolver="Volver al texto de la base por defecto"
        onVolver={onVolverTodo}
      />
      <p className="pulso-f6-informe-ayuda">El conteo que acompaña a cada gráfico. Vale para todas las láminas del informe.</p>
      <div className="pulso-f6-informe-campos" data-qa-geometry-group="graficos/f6-estilo-informe-texto-base" data-qa-geometry-contract="intrinsic">
        {/* `key` con el valor guardado: al deshacer o volver al recetario, el borrador se repone. */}
        <CampoTexto
          key={`inicio:${texto.formato.valor}`}
          campo={texto.formato}
          etiqueta="Empieza con"
          ayuda="Lo que va antes del número."
          valor={partes.inicio}
          porDefecto={partesFormato(texto.formato.porDefecto).inicio}
          onCambiar={(v) => onCambiar(texto.formato.arg, formatoDesdePartes({ ...partes, inicio: v }))}
          onVolver={() => onVolver(texto.formato.arg)}
        />
        {bases.length > 1 && onSufijoDeBase ? (
          <SufijosPorBase bases={bases} sufijos={sufijosPorBase} formato={texto.formato.valor} onCambiar={onSufijoDeBase} />
        ) : (
          <CampoTexto
          key={`sufijo:${texto.sufijo.valor}`}
          campo={texto.sufijo}
          etiqueta="Después del número"
          ayuda="Por ejemplo, estudiantes o docentes. Vacío, va solo el número."
          valor={texto.sufijo.valor}
          porDefecto={texto.sufijo.porDefecto}
          onCambiar={(v) => onCambiar(texto.sufijo.arg, v)}
          onVolver={() => onVolver(texto.sufijo.arg)}
          />
        )}
      </div>
      <ExcepcionesRegla excepciones={excepciones}
        ayuda="Nombre de cada público, en la tarjeta del gráfico, cambia la palabra solo en ese gráfico." />
    </section>
  );
}
