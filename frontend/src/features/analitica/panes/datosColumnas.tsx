// Columnas de Analítica › Datos sobre PulsoTable (L28, D-L28).
//
// Una fila de 36 px por variable: incluir, código, tipo, con dato, etiqueta y
// opciones. Antes cada variable era una tarjeta de ~80 px y cabían cinco por
// pantalla; las etiquetas de opciones se desplegaban dentro de la tarjeta. Hoy
// se abren en el inspector, que lee la variable de `?foco=`.

import type { DataReviewVariable } from "../../../api/client";
import type { PulsoTableColumna } from "../../../components/PulsoTable";
import { Switch } from "../../../components/Switch";
import { formatoConteo } from "../../../lib/formatoNumero";
import { describirCobertura } from "../coberturaVariable";

export type DatosColumnasContexto = {
  excluded: Set<string>;
  /** La sección está oculta: sus variables no se pueden incluir. */
  bloqueada: boolean;
  padresRepartidos: Set<string>;
  etiquetaDe: (variable: DataReviewVariable) => string;
  /** Opciones con detalles de redacción, para avisarlo sin abrir el inspector. */
  detallesDe: (variable: DataReviewVariable) => number;
  editables: (variable: DataReviewVariable) => boolean;
  onToggleVariable: (name: string) => void;
  onSetVariableLabel: (name: string, label: string) => void;
  onAbrir: (name: string) => void;
};

/** El tipo que se lee en la fila: el de XLSForm, o de qué pregunta es opción. */
export function tipoDeFila(variable: Pick<DataReviewVariable, "tipo_xlsform" | "dummy_parent">): string {
  if (variable.dummy_parent) return `opción de ${variable.dummy_parent}`;
  return variable.tipo_xlsform || "data";
}

/** La columna ya se llama «Con dato»: la celda no lo repite («1,241 de 1,283»). */
export function textoDeCobertura(texto: string): string {
  return texto.replace(/ con dato$/, "");
}

export function columnasDeDatos(ctx: DatosColumnasContexto): PulsoTableColumna<DataReviewVariable>[] {
  return [
    {
      id: "incluir",
      encabezado: "Incluir",
      ancho: 64,
      celda: (variable) => (
        <Switch
          checked={ctx.bloqueada ? false : !ctx.excluded.has(variable.name)}
          disabled={ctx.bloqueada}
          ariaLabel={ctx.bloqueada ? `${variable.name}: sección oculta` : `Incluir ${variable.name}`}
          className="analitica-interruptor"
          onToggle={() => ctx.onToggleVariable(variable.name)}
        />
      ),
    },
    {
      id: "codigo",
      encabezado: "Código",
      ancho: 160,
      valor: (variable) => variable.name,
      celda: (variable) => <code className="pulso-datos-codigo">{variable.name}</code>,
    },
    {
      id: "tipo",
      encabezado: "Tipo",
      ancho: 120,
      valor: (variable) => tipoDeFila(variable),
      celda: (variable) => <span className="pulso-datos-tipo">{tipoDeFila(variable)}</span>,
    },
    {
      id: "con-dato",
      encabezado: "Con dato",
      ancho: 110,
      valor: (variable) => describirCobertura(variable, ctx.padresRepartidos.has(variable.name)).texto,
      celda: (variable) => {
        const cobertura = describirCobertura(variable, ctx.padresRepartidos.has(variable.name));
        return (
          <span className="pulso-datos-cobertura" data-estado={cobertura.estado} title={cobertura.aviso?.detalle ?? cobertura.texto}>
            {textoDeCobertura(cobertura.texto)}
          </span>
        );
      },
    },
    {
      id: "etiqueta",
      encabezado: "Etiqueta",
      // 734 px en total: cabe junto al inspector a 1280 (barrido 2026-11-02:
      // con 834 «Opciones» quedaba 88 px fuera). La etiqueta es un campo y su
      // texto se desplaza dentro; no necesita el ancho de la frase entera.
      ancho: 190,
      celda: (variable) => {
        const etiqueta = ctx.etiquetaDe(variable);
        return (
          <input
            type="text"
            value={etiqueta}
            onChange={(e) => ctx.onSetVariableLabel(variable.name, e.target.value)}
            className={`pulso-data-review-input pulso-datos-etiqueta${etiqueta.trim() ? "" : " is-empty"}`}
            aria-label={`Etiqueta de ${variable.name}`}
            title={etiqueta}
          />
        );
      },
    },
    {
      id: "opciones",
      encabezado: "Opciones",
      ancho: 90,
      tipo: "cifra",
      celda: (variable) => {
        if (!ctx.editables(variable)) return <span className="pulso-datos-sin-opciones">—</span>;
        const detalles = ctx.detallesDe(variable);
        const n = variable.opciones.length;
        return (
          <button
            type="button"
            className="pulso-datos-opciones"
            data-detalles={detalles > 0 ? "true" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              ctx.onAbrir(variable.name);
            }}
            aria-label={`Etiquetas de opciones de ${variable.name}: ${formatoConteo(n)} ${n === 1 ? "código" : "códigos"}${detalles > 0 ? `, ${formatoConteo(detalles)} con detalles de redacción` : ""}`}
            title={detalles > 0 ? `${formatoConteo(detalles)} con detalles de redacción` : "Abrir en el inspector"}
          >
            {formatoConteo(n)} {n === 1 ? "código" : "códigos"}
          </button>
        );
      },
    },
  ];
}
