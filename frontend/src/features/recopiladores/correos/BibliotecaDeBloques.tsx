import { useEffect, useRef, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

import type { MailTemplate } from "../../../api/materialMail";
import { X, type LucideIcon } from "../../../vendor/lucide-react";
import { tipoDisponible } from "./estructuraCorreo";
import { ICONO_DE_BLOQUE, ICONO_DE_IMAGEN_DECORATIVA } from "./iconos";
import { ROTULO_DE_BLOQUE } from "./modeloCorreo";
import { IMAGEN_DECORATIVA, PIEZAS_GRAFICAS, type TipoInsertable } from "./piezasGraficas";
import { useCabezaSinLugar } from "./topeDeLaBarra";
import "./correosBiblioteca.css";

/** Tipo MIME del arrastre: lo lee la capa para saber qué bloque se suelta. */
export const ARRASTRE_DE_BLOQUE = "application/x-pulso-bloque";

/**
 * Grupos de la biblioteca, en el orden en que se lee un correo. Las piezas
 * gráficas (E1o) muestran a la vista su «cuándo usarla»; el resto, qué es.
 */
export const GRUPOS: readonly { titulo: string; tipos: readonly TipoInsertable[]; cuandoALaVista?: boolean }[] = [
  { titulo: "Texto", tipos: ["greeting", "heading", "paragraph", "list", "callout"] },
  { titulo: "Acción e imagen", tipos: ["button", "image", "divider"] },
  { titulo: "Piezas gráficas", tipos: PIEZAS_GRAFICAS, cuandoALaVista: true },
  { titulo: "Cierre", tipos: ["signature", "footer_legal"] },
];

/** Nombre, descripción e ícono de una entrada de la biblioteca. */
export function rotuloDeInsertable(tipo: TipoInsertable): string {
  return tipo === IMAGEN_DECORATIVA ? "Imagen decorativa" : ROTULO_DE_BLOQUE[tipo];
}

function iconoDeInsertable(tipo: TipoInsertable): LucideIcon {
  return tipo === IMAGEN_DECORATIVA ? ICONO_DE_IMAGEN_DECORATIVA : ICONO_DE_BLOQUE[tipo];
}

const L = "rec-bib-l";
const A = "rec-bib-a";
const S = "rec-bib-s";

/** Esquema de cada tipo: cómo se ve en el correo, en miniatura y sin texto. */
const ESQUEMA: Record<TipoInsertable, ReactNode> = {
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
  // Piezas gráficas: el mismo papel, con la pieza en el tono del módulo.
  band: (
    <>
      <rect className={S} x="8" y="8" width="44" height="3" rx="1.5" />
      <rect className={A} x="4" y="17" width="56" height="8" />
      <rect className={S} x="8" y="31" width="48" height="3" rx="1.5" />
    </>
  ),
  ornament: (
    <>
      <rect className={S} x="8" y="8" width="44" height="3" rx="1.5" />
      <path className="rec-bib-trazo" d="M9 22 Q 15.5 16 22 22 T 35 22 T 48 22 T 55 20" />
      <rect className={S} x="8" y="32" width="40" height="3" rx="1.5" />
    </>
  ),
  icon_text: (
    <>
      <rect className={A} x="8" y="10" width="9" height="9" rx="2" />
      <rect className={L} x="21" y="12.5" width="30" height="4" rx="2" />
      <rect className={A} x="8" y="25" width="9" height="9" rx="2" />
      <rect className={S} x="21" y="28" width="34" height="3" rx="1.5" />
    </>
  ),
  two_images: (
    <>
      <rect className="rec-bib-img" x="5" y="9" width="25" height="26" rx="2" />
      <path className="rec-bib-montana" d="M7 33 L15 23 L21 29 L28 33 Z" />
      <rect className="rec-bib-img" x="34" y="13" width="25" height="18" rx="2" />
      <circle className="rec-bib-sol" cx="52" cy="18" r="2.5" />
    </>
  ),
  [IMAGEN_DECORATIVA]: (
    <>
      <rect className="rec-bib-img" x="4" y="9" width="56" height="26" rx="2" />
      <path className="rec-bib-trazo" d="M10 28 C 18 14, 26 34, 34 22 S 48 14, 54 20" />
    </>
  ),
};

/** Más que la descripción corta: para qué sirve cada tipo, en la voz de quien escribe. */
export const CUANDO_USARLO: Record<TipoInsertable, string> = {
  greeting: "El primer renglón, con el nombre de cada persona. Para quien no tenga el dato, va el texto de «Si falta el nombre».",
  heading: "Para separar partes en un correo largo: fechas, pasos, «Qué tienes que hacer».",
  paragraph: "El cuerpo del correo. Admite negrita, cursiva, campos y enlaces dentro del texto.",
  list: "Pasos o requisitos que se leen de un vistazo.",
  callout: "Lo que no puede pasarse por alto: plazos, sesiones, advertencias.",
  button: "La acción principal; suele haber una sola. El enlace puede ser distinto por persona.",
  image: "Un banner o imagen de la línea gráfica. Siempre con texto alternativo.",
  divider: "Aire o una línea fina entre dos partes.",
  signature: "Quién escribe: despedida, nombre e institución.",
  footer_legal: "Por qué recibe el correo. La baja y la dirección las agrega la app.",
  // Cortas a propósito: en la tarjeta se leen enteras, en dos líneas.
  band: "Para abrir o cerrar una parte con color.",
  ornament: "Para separar dos partes con un adorno.",
  icon_text: "Para un dato clave: fecha, lugar o premio.",
  two_images: "Para dos fotos o logos, uno junto al otro.",
  [IMAGEN_DECORATIVA]: "Para un adorno: no necesita descripción.",
};

/**
 * Lo que se lee en la tarjeta: una idea de unos 45 caracteres, entera en dos
 * líneas (#6 del QA e10). El `title` repite la misma frase completa.
 */
export const DESCRIPCION_CORTA: Record<TipoInsertable, string> = {
  greeting: "Abre el correo con el nombre de la persona.",
  heading: "Un título para ordenar un correo largo.",
  paragraph: "El cuerpo del correo, con negrita y enlaces.",
  list: "Pasos o requisitos que se leen de un vistazo.",
  callout: "Lo que no debe pasarse: plazos o sesiones.",
  button: "La acción principal: el enlace a la encuesta.",
  image: "Un banner o una imagen de la línea gráfica.",
  divider: "Aire o una línea fina entre dos partes.",
  signature: "Despedida, nombre e institución.",
  footer_legal: "Por qué recibe el correo, con la baja.",
  band: CUANDO_USARLO.band,
  ornament: CUANDO_USARLO.ornament,
  icon_text: CUANDO_USARLO.icon_text,
  two_images: CUANDO_USARLO.two_images,
  [IMAGEN_DECORATIVA]: CUANDO_USARLO[IMAGEN_DECORATIVA],
};

type Props = {
  template: Pick<MailTemplate, "blocks">;
  /** Dónde se ancla, en el espacio de la capa. */
  estilo?: CSSProperties;
  /** Título de la cabecera: «Insertar aquí» o «Agregar un bloque». */
  titulo?: string;
  /** Se abre hacia arriba del punto de inserción (cerca del final del correo). */
  arriba?: boolean;
  onElegir: (type: TipoInsertable) => void;
  onCerrar: () => void;
};

/**
 * Biblioteca de bloques (E1g §2): una cuadrícula de tipos con su ícono, su
 * nombre, para qué sirve y un esquema de cómo se ve. Se elige con un clic o se
 * arrastra a un punto del correo. Nunca está vacía; el pie es único.
 */
export function BibliotecaDeBloques({ template, estilo, titulo = "Agregar un bloque", arriba = false, onElegir, onCerrar }: Props) {
  const raiz = useRef<HTMLDivElement | null>(null);
  // Residuo del #17: al final del desplazamiento, la cabecera no se mete bajo la barra del correo.
  const cabezaFuera = useCabezaSinLugar(raiz, ".rec-bib-cabeza");

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

  const alArrastrar = (type: TipoInsertable) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(ARRASTRE_DE_BLOQUE, type);
    event.dataTransfer.setData("text/plain", rotuloDeInsertable(type));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      ref={raiz}
      className={`rec-bib${arriba ? " is-arriba" : ""}${cabezaFuera ? " is-cabeza-fuera" : ""}`}
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
              data-qa-geometry-group="material-campo/correo/biblioteca"
              data-qa-geometry-contract="equal"
            >
              {grupo.tipos.map((type) => {
                const Icono = iconoDeInsertable(type);
                const disponible = tipoDisponible(template, type);
                const desc = DESCRIPCION_CORTA[type];
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
                    title={disponible ? desc : "Ya hay un pie legal: es único en el correo."}
                    onClick={() => onElegir(type)}
                  >
                    <svg className="rec-bib-esquema" viewBox="0 0 64 44" aria-hidden focusable="false">
                      <rect className="rec-bib-papel" x="0.5" y="0.5" width="63" height="43" rx="3" />
                      {ESQUEMA[type]}
                    </svg>
                    <span className="rec-bib-texto">
                      <span className="rec-bib-nombre">
                        <Icono size={13} aria-hidden /> {rotuloDeInsertable(type)}
                      </span>
                      <span className="rec-bib-desc">{disponible ? desc : "Ya está en el correo: el pie es único."}</span>
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
