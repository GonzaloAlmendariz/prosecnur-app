// Formato, Lógica y Contenido de la pestaña «Impreso». Los controles son los del diálogo «Configurar PDF» que la
// pestaña reemplaza (2026-10-15), repartidos en tarjetas; el estado y su persistencia no cambian.

import { useState } from "react";
import {
  ChevronDown,
  Columns2,
  GitBranch,
  LayoutTemplate,
  Route,
  ShieldCheck,
  Square,
  Table2,
  type LucideIcon,
} from "../../../vendor/lucide-react";
import type { ConsentQuestion } from "../parsing/detectConsentQuestions";
import {
  MIN_MAX_OPTIONS_PER_QUESTION,
  parseMaxOptionsPerQuestion,
  type PdfDialogState,
} from "../shell/pdfExportPreference";
import { InterruptorImpreso, TarjetaImpreso } from "./TarjetaImpreso";

type Actualizar = (patch: Partial<PdfDialogState>) => void;

type OpcionTarjeta<V> = { valor: V; icono: LucideIcon; titulo: string; detalle: string; ancha?: boolean };

function Opciones<V extends string | number>({ etiqueta, valor, opciones, onElegir }: {
  etiqueta: string;
  valor: V;
  opciones: readonly OpcionTarjeta<V>[];
  onElegir: (v: V) => void;
}) {
  return (
    <div className="pulso-xf-pdf-cards" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => {
        const Icono = o.icono;
        const activa = o.valor === valor;
        return (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={activa}
            className={`pulso-xf-pdf-card${o.ancha ? " pulso-xf-pdf-card--ancha" : ""}${activa ? " is-active" : ""}`}
            onClick={() => onElegir(o.valor)}
          >
            <span className="pulso-xf-pdf-card-icon"><Icono size={18} /></span>
            <span className="pulso-xf-pdf-card-text">
              <strong>{o.titulo}</strong>
              <em>{o.detalle}</em>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const COLUMNAS: readonly OpcionTarjeta<1 | 2 | "auto">[] = [
  { valor: 1, icono: Square, titulo: "Una columna", detalle: "Preguntas a lo ancho de la página." },
  { valor: 2, icono: Columns2, titulo: "Dos columnas", detalle: "Compacto, más preguntas por hoja." },
  { valor: "auto", icono: LayoutTemplate, titulo: "Automáticas", detalle: "Una o dos según el tramo: las baterías anchas a toda la página.", ancha: true },
];

const ANCHO_MATRICES: readonly OpcionTarjeta<"full" | "column">[] = [
  { valor: "full", icono: Table2, titulo: "Ancho completo", detalle: "Las tablas ocupan todo el ancho de la página." },
  { valor: "column", icono: Columns2, titulo: "Una columna", detalle: "Las matrices fluyen dentro de una columna." },
];

const LOGICA: readonly OpcionTarjeta<"saltos" | "condiciones">[] = [
  { valor: "saltos", icono: Route, titulo: "Saltos", detalle: "Instrucciones en las opciones — «Salto a la 15»." },
  { valor: "condiciones", icono: GitBranch, titulo: "Condiciones", detalle: "Apertura antes de la pregunta — «En caso…»." },
];

export function DetalleFormato({ estado, actualizar }: { estado: PdfDialogState; actualizar: Actualizar }) {
  return (
    <>
      <TarjetaImpreso id="imp-columnas" titulo="Columnas" ayuda="Cómo se reparte el cuestionario en la página.">
        <Opciones etiqueta="Columnas" valor={estado.columns} opciones={COLUMNAS} onElegir={(columns) => actualizar({ columns })} />
      </TarjetaImpreso>
      <TarjetaImpreso id="imp-cabecera" titulo="Cabecera" ayuda="Lo que se repite arriba de cada página.">
        <InterruptorImpreso
          activo={estado.showQuestionnaireNumber}
          titulo="Número de cuestionario"
          detalle="Imprime los recuadros de N.º en la cabecera."
          onCambiar={(v) => actualizar({ showQuestionnaireNumber: v })}
        />
        <InterruptorImpreso
          activo={estado.showHeaderTitle}
          titulo="Título en la cabecera"
          detalle="Repite el título del formulario arriba de cada página."
          onCambiar={(v) => actualizar({ showHeaderTitle: v })}
        />
      </TarjetaImpreso>
      <TarjetaImpreso id="imp-ancho" titulo="Ancho de matrices" ayuda="Vale para todas las tablas del cuestionario.">
        <Opciones etiqueta="Ancho de matrices" valor={estado.matrixLayout} opciones={ANCHO_MATRICES} onElegir={(matrixLayout) => actualizar({ matrixLayout })} />
      </TarjetaImpreso>
    </>
  );
}

export function DetalleLogica({ estado, actualizar, consentimiento }: {
  estado: PdfDialogState;
  actualizar: Actualizar;
  consentimiento: readonly ConsentQuestion[];
}) {
  const valorConsent = consentimiento.some((q) => q.name === estado.consentVar) ? estado.consentVar : "";
  return (
    <>
      <TarjetaImpreso id="imp-logica" titulo="Cómo se escribe la lógica" ayuda="Los saltos y condiciones del formulario, en papel.">
        <Opciones etiqueta="Lógica" valor={estado.logicLanguage} opciones={LOGICA} onElegir={(logicLanguage) => actualizar({ logicLanguage })} />
      </TarjetaImpreso>
      <TarjetaImpreso
        id="imp-consentimiento"
        titulo="Consentimiento"
        ayuda="Se asume que todo el formulario depende del consentimiento: sus condiciones no se repiten y su rechazo marca «Termina la encuesta»."
      >
        <div className="pulso-xf-pdf-control pulso-xf-pdf-control--consent">
          <label htmlFor="pulso-xf-imp-consent">
            <ShieldCheck size={14} aria-hidden="true" /> Variable de consentimiento
          </label>
          <div className="pulso-xf-pdf-select-wrap">
            <select
              id="pulso-xf-imp-consent"
              className="pulso-xf-pdf-select"
              value={valorConsent}
              onChange={(e) => actualizar({ consentVar: e.target.value })}
            >
              <option value="">Ninguna</option>
              {consentimiento.map((q) => (
                <option key={q.name} value={q.name}>{q.name} — {q.label}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" className="pulso-xf-pdf-select-caret" />
          </div>
        </div>
      </TarjetaImpreso>
    </>
  );
}

export function DetalleContenido({ estado, actualizar }: { estado: PdfDialogState; actualizar: Actualizar }) {
  const [borrador, setBorrador] = useState(String(estado.maxOptionsPerQuestion));
  return (
    <>
      <TarjetaImpreso id="imp-instrucciones" titulo="Instrucciones" ayuda="La banda que abre el cuestionario.">
        <InterruptorImpreso
          activo={estado.defaultIntro}
          titulo="Instrucciones al inicio"
          detalle="Banda «INSTRUCCIONES» si el formulario no trae introducción propia."
          onCambiar={(v) => actualizar({ defaultIntro: v })}
        />
      </TarjetaImpreso>
      <TarjetaImpreso id="imp-opciones" titulo="Opciones por pregunta" ayuda="Con más opciones, la pregunta sale con casilla de código.">
        <div className="pulso-xf-pdf-switch-row pulso-xf-pdf-number-row">
          <label className="pulso-xf-pdf-switch-text" htmlFor="pulso-xf-imp-max-options">
            <strong>Máximo de opciones impresas</strong>
            <em>Mínimo {MIN_MAX_OPTIONS_PER_QUESTION}.</em>
          </label>
          <input
            id="pulso-xf-imp-max-options"
            type="number"
            inputMode="numeric"
            min={MIN_MAX_OPTIONS_PER_QUESTION}
            step={1}
            className="pulso-xf-pdf-input pulso-xf-pdf-number"
            value={borrador}
            onChange={(e) => {
              setBorrador(e.target.value);
              const n = parseMaxOptionsPerQuestion(e.target.value);
              if (n !== null) actualizar({ maxOptionsPerQuestion: n });
            }}
            onBlur={() => setBorrador(String(estado.maxOptionsPerQuestion))}
          />
        </div>
      </TarjetaImpreso>
    </>
  );
}
