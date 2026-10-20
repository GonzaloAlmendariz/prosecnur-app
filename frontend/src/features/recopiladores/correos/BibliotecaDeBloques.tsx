import { useEffect, useRef, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

import { MAIL_BLOCK_TYPES, type MailBlockType, type MailTemplate } from "../../../api/materialMail";
import { X } from "../../../vendor/lucide-react";
import { tipoDisponible } from "./estructuraCorreo";
import { ICONO_DE_BLOQUE } from "./iconos";
import { DESCRIPCION_DE_BLOQUE, ROTULO_DE_BLOQUE } from "./modeloCorreo";
import "./correosBiblioteca.css";

/** Tipo MIME del arrastre: lo lee la capa para saber qué bloque se suelta. */
export const ARRASTRE_DE_BLOQUE = "application/x-pulso-bloque";

/** Grupos de la biblioteca, en el orden en que se lee un correo. */
const GRUPOS: { titulo: string; tipos: MailBlockType[] }[] = [
  { titulo: "Texto", tipos: ["greeting", "heading", "paragraph", "list", "callout"] },
  { titulo: "Acción e imagen", tipos: ["button", "image", "divider"] },
  { titulo: "Cierre", tipos: ["signature", "footer_legal"] },
];

const L = "rec-bib-l";
const A = "rec-bib-a";
const S = "rec-bib-s";

/** Esquema de cada tipo: cómo se ve en el correo, en miniatura y sin texto. */
const ESQUEMA: Record<MailBlockType, ReactNode> = {
  greeting: (
    <>
      <rect className={L} x="8" y="12" width="22" height="5" rx="2.5" />
      <rect className={A} x="32" y="12" width="16" height="5" rx="2.5" />
      <rect className={S} x="8" y="24" width="48" height="3" rx="1.5" />
      <rect className={S} x="8" y="31" width="36" height="3" rx="1.5" />
    </>
  ),
  heading: (
    <>
      <rect className={L} x="8" y="11" width="42" height="8" rx="2" />
      <rect className={S} x="8" y="25" width="48" height="3" rx="1.5" />
      <rect className={S} x="8" y="32" width="40" height="3" rx="1.5" />
    </>
  ),
  paragraph: (
    <>
      <rect className={S} x="8" y="9" width="48" height="3" rx="1.5" />
      <rect className={S} x="8" y="16" width="48" height="3" rx="1.5" />
      <rect className={L} x="8" y="23" width="18" height="3" rx="1.5" />
      <rect className={A} x="28" y="22" width="14" height="5" rx="2" />
      <rect className={S} x="44" y="23" width="12" height="3" rx="1.5" />
      <rect className={S} x="8" y="30" width="34" height="3" rx="1.5" />
    </>
  ),
  list: (
    <>
      <circle className={A} cx="11" cy="12" r="2" />
      <rect className={S} x="16" y="10.5" width="38" height="3" rx="1.5" />
      <circle className={A} cx="11" cy="21" r="2" />
      <rect className={S} x="16" y="19.5" width="32" height="3" rx="1.5" />
      <circle className={A} cx="11" cy="30" r="2" />
      <rect className={S} x="16" y="28.5" width="36" height="3" rx="1.5" />
    </>
  ),
  callout: (
    <>
      <rect className="rec-bib-caja" x="7" y="7" width="50" height="30" rx="2" />
      <rect className={A} x="7" y="7" width="3" height="30" />
      <rect className={L} x="14" y="12" width="20" height="4" rx="2" />
      <rect className={S} x="14" y="21" width="38" height="3" rx="1.5" />
      <rect className={S} x="14" y="28" width="30" height="3" rx="1.5" />
    </>
  ),
  button: (
    <>
      <rect className={A} x="16" y="13" width="32" height="12" rx="2" />
      <rect className="rec-bib-claro" x="22" y="17.5" width="20" height="3" rx="1.5" />
      <rect className={S} x="20" y="31" width="24" height="2.5" rx="1.25" />
    </>
  ),
  image: (
    <>
      <rect className="rec-bib-img" x="4" y="7" width="56" height="30" rx="2" />
      <path className="rec-bib-montana" d="M8 33 L22 19 L31 27 L39 21 L56 33 Z" />
      <circle className="rec-bib-sol" cx="46" cy="14" r="3.5" />
    </>
  ),
  divider: (
    <>
      <rect className={S} x="8" y="9" width="48" height="3" rx="1.5" />
      <rect className={A} x="8" y="21.5" width="48" height="1.5" />
      <rect className={S} x="8" y="32" width="40" height="3" rx="1.5" />
    </>
  ),
  signature: (
    <>
      <rect className={S} x="8" y="9" width="22" height="3" rx="1.5" />
      <rect className={L} x="8" y="19" width="28" height="5" rx="2" />
      <rect className={S} x="8" y="27" width="40" height="2.5" rx="1.25" />
      <rect className={A} x="8" y="33" width="24" height="2.5" rx="1.25" />
    </>
  ),
  footer_legal: (
    <>
      <rect className="rec-bib-franja" x="0" y="4" width="64" height="5" />
      <rect className={S} x="12" y="16" width="40" height="2.5" rx="1.25" />
      <rect className={S} x="16" y="22" width="32" height="2.5" rx="1.25" />
      <rect className={A} x="22" y="30" width="20" height="2.5" rx="1.25" />
    </>
  ),
};

/** Más que la descripción corta: para qué sirve cada tipo, en la voz de quien escribe. */
export const CUANDO_USARLO: Record<MailBlockType, string> = {
  greeting: "El primer renglón. Usa {{nombre}} y escribe el respaldo para quien no tenga el dato.",
  heading: "Para separar partes en un correo largo: fechas, pasos, «Qué tienes que hacer».",
  paragraph: "El cuerpo del correo. Admite negrita, campos y enlaces dentro del texto.",
  list: "Pasos o requisitos que se leen de un vistazo.",
  callout: "Lo que no puede pasarse por alto: plazos, sesiones, advertencias.",
  button: "La acción principal; suele haber una sola. El enlace puede ser distinto por persona.",
  image: "Un banner o imagen de la línea gráfica. Siempre con texto alternativo.",
  divider: "Aire o una línea fina entre dos partes.",
  signature: "Quién escribe: despedida, nombre e institución.",
  footer_legal: "Por qué recibe el correo. La baja y la dirección las agrega la app.",
};

type Props = {
  template: Pick<MailTemplate, "blocks">;
  /** Dónde se ancla, en el espacio de la capa. */
  estilo?: CSSProperties;
  /** Título de la cabecera: «Insertar aquí» o «Agregar un bloque». */
  titulo?: string;
  /** Se abre hacia arriba del punto de inserción (cerca del final del correo). */
  arriba?: boolean;
  onElegir: (type: MailBlockType) => void;
  onCerrar: () => void;
};

/**
 * Biblioteca de bloques (E1g §2): una cuadrícula de tipos con su ícono, su
 * nombre, para qué sirve y un esquema de cómo se ve. Se elige con un clic o se
 * arrastra a un punto del correo. Nunca está vacía; el pie es único.
 */
export function BibliotecaDeBloques({ template, estilo, titulo = "Agregar un bloque", arriba = false, onElegir, onCerrar }: Props) {
  const raiz = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    raiz.current?.querySelector<HTMLButtonElement>("button.rec-bib-tipo:not([disabled])")?.focus({ preventScroll: true });
    raiz.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCerrar();
      return;
    }
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    const botones = Array.from(raiz.current?.querySelectorAll<HTMLButtonElement>("button.rec-bib-tipo:not([disabled])") ?? []);
    const i = botones.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    event.preventDefault();
    const columnas = Number(getComputedStyle(raiz.current!).getPropertyValue("--rec-bib-columnas")) || 2;
    const paso = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? columnas : -columnas;
    botones[Math.max(0, Math.min(botones.length - 1, i + paso))]?.focus();
  };

  const alArrastrar = (type: MailBlockType) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(ARRASTRE_DE_BLOQUE, type);
    event.dataTransfer.setData("text/plain", ROTULO_DE_BLOQUE[type]);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      ref={raiz}
      className={`rec-bib${arriba ? " is-arriba" : ""}`}
      style={estilo}
      role="dialog"
      aria-label={titulo}
      onKeyDown={onKeyDown}
    >
      <div className="rec-bib-cabeza">
        <span className="rec-bib-titulo">{titulo}</span>
        <span className="rec-bib-pista">Clic para insertar, o arrástralo al correo</span>
        <button type="button" className="rec-bib-cerrar" aria-label="Cerrar la biblioteca" onClick={onCerrar}>
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="rec-bib-cuerpo">
        {GRUPOS.map((grupo) => (
          <section key={grupo.titulo} className="rec-bib-grupo" aria-label={grupo.titulo}>
            <h4 className="rec-bib-grupo-titulo">{grupo.titulo}</h4>
            <div
              className="rec-bib-rejilla"
              data-qa-geometry-group="material-campo/catalogo/correos-biblioteca"
              data-qa-geometry-contract="equal"
            >
              {grupo.tipos.filter((t) => MAIL_BLOCK_TYPES.includes(t)).map((type) => {
                const Icono = ICONO_DE_BLOQUE[type];
                const disponible = tipoDisponible(template, type);
                return (
                  <button
                    key={type}
                    type="button"
                    className="rec-bib-tipo"
                    data-qa-geometry-member
                    data-tipo={type}
                    disabled={!disponible}
                    draggable={disponible}
                    onDragStart={alArrastrar(type)}
                    title={disponible ? CUANDO_USARLO[type] : "Ya hay un pie legal: es único en el correo."}
                    onClick={() => onElegir(type)}
                  >
                    <svg className="rec-bib-esquema" viewBox="0 0 64 44" aria-hidden focusable="false">
                      <rect className="rec-bib-papel" x="0.5" y="0.5" width="63" height="43" rx="3" />
                      {ESQUEMA[type]}
                    </svg>
                    <span className="rec-bib-texto">
                      <span className="rec-bib-nombre">
                        <Icono size={13} aria-hidden /> {ROTULO_DE_BLOQUE[type]}
                      </span>
                      <span className="rec-bib-desc">{disponible ? DESCRIPCION_DE_BLOQUE[type] : "Ya está en el correo: el pie es único."}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
