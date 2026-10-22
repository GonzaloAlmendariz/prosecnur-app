import { useId, type CSSProperties } from "react";

import type { MailCheck, MailEstilo, MailOnda, MailTextAlign, MailTheme } from "../../../api/materialMail";
import { AlertCircle, CheckCircle2 } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import {
  estiloDe,
  conEstilo,
  focoDelEstilo,
  hexCanonico,
  lecturaConRevision,
  lecturaDelBoton,
  mismoColor,
  razonLegible,
  sugerenciasDeBoton,
  textoSobre,
  type ChequeoDeEstilo,
  type Lectura,
} from "./modeloEstilo";
import { useColoresDelBanner } from "./useColoresDelBanner";
import { Cuentagotas } from "./Cuentagotas";

import "./correosEstilo.css";

type Props = {
  theme: MailTheme;
  /** La imagen del banner que ya se ve; `null` sin banner. */
  srcDelBanner: string | null;
  /** Chequeos `campana_*` de la revisión: cuando llegan, mandan sobre el cálculo local. */
  chequeos: Partial<Record<ChequeoDeEstilo, MailCheck>>;
  onTema: (update: (theme: MailTheme) => MailTheme) => void;
};

// Sobrio va primero y es el recomendado: es el de siempre y el que traen las plantillas.
const ESTILOS: { value: MailEstilo; nombre: string; ayuda: string; recomendado?: boolean }[] = [
  { value: "sobrio", nombre: "Sobrio", ayuda: "Tarjeta blanca", recomendado: true },
  { value: "campana", nombre: "Campaña", ayuda: "Color a todo el ancho" },
];

const ALINEACIONES: { value: MailTextAlign; label: string }[] = [
  { value: "justify", label: "Justificado" },
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centrado" },
];

const ONDAS: { value: MailOnda; label: string }[] = [
  { value: "ninguna", label: "No" },
  { value: "pie", label: "Sí" },
];

type Variables = CSSProperties & Record<`--rec-estilo-${string}`, string>;

/** Las dos miniaturas: dibujadas con CSS y los colores del correo, sin imágenes. */
function Miniatura({ tipo, fondo, boton, acento }: { tipo: MailEstilo; fondo: string; boton: string; acento: string }) {
  const vars: Variables = {
    "--rec-estilo-fondo": fondo,
    "--rec-estilo-tinta": textoSobre(fondo),
    "--rec-estilo-boton": boton,
    "--rec-estilo-acento": acento,
  };
  return (
    <span className={`rec-estilo-mini is-${tipo}`} style={vars} aria-hidden>
      <span className="rec-estilo-mini-col">
        <span className="rec-estilo-mini-cabeza" />
        {/* Los renglones van en una sola pieza (gradientes): decoración, no una colección. */}
        <span className="rec-estilo-mini-texto" />
        <span className="rec-estilo-mini-boton" />
      </span>
    </span>
  );
}

export function LineaDeLectura({ lectura }: { lectura: Lectura }) {
  return (
    <span
      className={`rec-mail-estado-linea is-${lectura.tono}`}
      role="status"
      title={lectura.detalle ?? (lectura.razon !== null ? `Contraste ${razonLegible(lectura.razon)}` : undefined)}
    >
      {lectura.tono === "ok" ? <CheckCircle2 size={13} aria-hidden /> : <AlertCircle size={13} aria-hidden />}
      {lectura.frase}
    </span>
  );
}

export function Muestras({
  rotulo,
  colores,
  elegido,
  nombreDe,
  onElegir,
  foco,
  nombreDelColor,
}: {
  foco: string;
  /** Para el cuentagotas: «el fondo de la página», «el botón». */
  nombreDelColor: string;
  rotulo: string;
  colores: readonly string[];
  elegido: string;
  nombreDe: (color: string) => string;
  onElegir: (color: string) => void;
}) {
  const libre = !colores.some((c) => mismoColor(c, elegido));
  return (
    <span className="rec-estilo-muestras">
      <span className="rec-estilo-muestras-lista" role="radiogroup" aria-label={rotulo}>
        {colores.map((c) => {
          const on = mismoColor(c, elegido);
          const vars: Variables = { "--rec-estilo-color": c };
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${nombreDe(c)} ${c}`}
              title={`${nombreDe(c)} · ${c}`}
              className={`rec-estilo-muestra${on ? " is-on" : ""}`}
              style={vars}
              onClick={() => onElegir(c)}
            />
          );
        })}
      </span>
      <span className="rec-mail-acento">
        <input
          type="color"
          data-foco={foco}
          aria-label={`${rotulo}: otro color`}
          title="Otro color"
          className={libre ? "is-on" : undefined}
          value={elegido.toLowerCase()}
          onChange={(e) => onElegir(hexCanonico(e.target.value))}
        />
        <Cuentagotas nombre={nombreDelColor} onChange={(c) => onElegir(hexCanonico(c))} />
        <span className="xfk-mono">{hexCanonico(elegido)}</span>
      </span>
    </span>
  );
}

/**
 * «Estilo del correo» (E1n), dentro de Identidad: Sobrio (la tarjeta blanca)
 * o Campaña (el fondo de color a todo el ancho, el cuerpo directo sobre él y
 * el botón en píldora). El texto justificado vale para los dos. El fondo de
 * la página vale para los dos y vive en «Ajustes del correo» (E1p).
 */
export function EstiloDelCorreo({ theme, srcDelBanner, chequeos, onTema }: Props) {
  const id = useId();
  const efectivo = estiloDe(theme);
  const campana = efectivo.estilo === "campana";
  const banner = useColoresDelBanner(campana ? srcDelBanner : null);
  const delBanner = banner.estado === "listo" ? banner.colores : null;
  const botones = sugerenciasDeBoton(delBanner, theme.accent);
  const nombreDe = (c: string) => (mismoColor(c, theme.accent) ? "Acento" : delBanner?.some((x) => mismoColor(x, c)) ? "Del banner" : "Amarillo de la casa");

  const lecturaBoton = lecturaConRevision(lecturaDelBoton(efectivo.boton, efectivo.textoDelBoton, efectivo.fondo), chequeos.campana_button_contrast);
  const ejemplo: Variables = {
    "--rec-estilo-fondo": efectivo.fondo,
    "--rec-estilo-boton": efectivo.boton,
    "--rec-estilo-tinta-boton": efectivo.textoDelBoton,
  };

  const editar = (cambio: Parameters<typeof conEstilo>[1]) => onTema((t) => conEstilo(t, cambio));

  return (
    // C1: los ajustes son secciones independientes (cada una con lo suyo), no pares.
    <section
      className="rec-estilo"
      aria-labelledby={`${id}-titulo`}
      data-qa-geometry-group="material-campo/correo/estilo-ajustes"
      data-qa-geometry-contract="intrinsic"
    >
      <span className="rec-mail-col-titulo">
        <span className="xfk-over" id={`${id}-titulo`}>Estilo del correo</span>
      </span>
      <span
        className="rec-estilo-opciones"
        role="radiogroup"
        aria-labelledby={`${id}-titulo`}
        data-qa-geometry-group="material-campo/correo/estilos"
        data-qa-geometry-contract="equal"
      >
        {ESTILOS.map((e) => {
          const on = efectivo.estilo === e.value;
          return (
            <button
              key={e.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`rec-estilo-opcion${on ? " is-on" : ""}`}
              onClick={() => editar({ estilo: e.value })}
            >
              <Miniatura tipo={e.value} fondo={efectivo.fondo} boton={efectivo.boton} acento={theme.accent} />
              <span className="rec-estilo-opcion-nombre">
                {e.nombre}
                {e.recomendado ? <span className="rec-estilo-recomendado">Recomendado</span> : null}
              </span>
              <span className="rec-estilo-opcion-ayuda">{e.ayuda}</span>
            </button>
          );
        })}
      </span>

      {campana ? (
        <>
          <div className="rec-estilo-campo">
            <span className="rec-estilo-rotulo">Botón</span>
            <Muestras foco={focoDelEstilo("button_bg")} nombreDelColor="el botón" rotulo="Relleno del botón" colores={botones} elegido={efectivo.boton} nombreDe={nombreDe} onElegir={(c) => editar({ button_bg: c })} />
            <span className="rec-estilo-ejemplo" style={ejemplo} aria-hidden>
              <span className="rec-estilo-ejemplo-boton">Responder la encuesta</span>
            </span>
            <LineaDeLectura lectura={lecturaBoton} />
            {banner.estado === "ilegible" ? <span className="rec-mail-ayuda">No se pudieron leer los colores del banner: queda el acento u otro color.</span> : null}
          </div>
          <div className="rec-mail-ajuste">
            <span>Onda al pie</span>
            <Segmented aria-label="Onda al pie" size="sm" value={efectivo.onda} options={ONDAS} onChange={(onda) => editar({ onda })} />
          </div>
        </>
      ) : null}

      <div className="rec-mail-ajuste">
        <span>Alineación del texto</span>
        <Segmented aria-label="Alineación del texto" size="sm" value={efectivo.alineacion} options={ALINEACIONES} onChange={(text_align) => editar({ text_align })} />
      </div>
    </section>
  );
}
