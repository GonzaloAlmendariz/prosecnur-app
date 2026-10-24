import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

import type { MailTemplate } from "../../../api/materialMail";
import type { MailSavedSection, MailSectionsImportResult } from "../../../api/materialMailMisSecciones";
import { X, type LucideIcon } from "../../../vendor/lucide-react";
import { ImportarSecciones, resumenDeImportacion } from "./ImportarSecciones";
import { tipoDisponible } from "./estructuraCorreo";
import { ICONO_DE_BLOQUE, ICONO_DE_IMAGEN_DECORATIVA, ICONO_DE_IMAGEN_Y_TEXTO } from "./iconos";
import { ROTULO_DE_BLOQUE } from "./modeloCorreo";
import { IMAGEN_DECORATIVA, IMAGEN_Y_TEXTO, PIEZAS_GRAFICAS, type TipoInsertable } from "./piezasGraficas";
import { useMisSecciones } from "./misSeccionesStore";
import { useCabezaSinLugar } from "./topeDeLaBarra";
import "./correosBiblioteca.css";

/** Tipo MIME del arrastre: lo lee la capa para saber qué bloque se suelta. */
export const ARRASTRE_DE_BLOQUE = "application/x-pulso-bloque";

/**
 * Grupos de la biblioteca, en el orden en que se lee un correo. Las piezas
 * gráficas (E1o) muestran a la vista su «cuándo usarla»; el resto, qué es.
 */
export const GRUPOS: readonly { titulo: string; tipos: readonly TipoInsertable[]; cuandoALaVista?: boolean }[] = [
  // Secciones armadas (GOAL editor profesional): una foto, un título, un texto y un botón.
  { titulo: "Secciones", tipos: ["feature", IMAGEN_Y_TEXTO, "steps", "deadline", "benefits", "quote", "faq", "contact"] },
  { titulo: "Texto", tipos: ["greeting", "heading", "paragraph", "list", "callout"] },
  { titulo: "Acción e imagen", tipos: ["button", "image", "divider"] },
  { titulo: "Piezas gráficas", tipos: PIEZAS_GRAFICAS, cuandoALaVista: true },
  { titulo: "Cierre", tipos: ["signature", "footer_legal"] },
];

/** Nombre, descripción e ícono de una entrada de la biblioteca. */
export function rotuloDeInsertable(tipo: TipoInsertable): string {
  if (tipo === IMAGEN_Y_TEXTO) return "Imagen + texto";
  return tipo === IMAGEN_DECORATIVA ? "Imagen decorativa" : ROTULO_DE_BLOQUE[tipo];
}

function iconoDeInsertable(tipo: TipoInsertable): LucideIcon {
  if (tipo === IMAGEN_Y_TEXTO) return ICONO_DE_IMAGEN_Y_TEXTO;
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
  feature: (
    <>
      <rect className={S} x="3" y="6" width="58" height="32" rx="3" />
      <rect className="rec-bib-img" x="7" y="10" width="22" height="24" rx="2" />
      <path className="rec-bib-montana" d="M9 32 L16 23 L21 28 L27 32 Z" />
      <rect className={A} x="33" y="12" width="14" height="3" rx="1.5" />
      <rect className={L} x="33" y="18" width="24" height="4" rx="2" />
      <rect className={L} x="33" y="27" width="16" height="5" rx="2" />
    </>
  ),
  [IMAGEN_Y_TEXTO]: (
    <>
      <rect className="rec-bib-img" x="5" y="10" width="24" height="18" rx="2" />
      <path className="rec-bib-montana" d="M7 26 L14 19 L19 23 L27 26 Z" />
      <rect className={L} x="33" y="11" width="24" height="4" rx="2" />
      <rect className={S} x="33" y="19" width="24" height="3" rx="1.5" />
      <rect className={S} x="33" y="25" width="18" height="3" rx="1.5" />
    </>
  ),
  steps: (
    <>
      <rect className={L} x="6" y="8" width="26" height="4" rx="2" />
      {[6, 26, 46].map((x) => (
        <g key={x}>
          <circle className={A} cx={x + 4} cy="21" r="4" />
          <rect className={L} x={x} y="28" width="13" height="3" rx="1.5" />
          <rect className={S} x={x} y="33" width="11" height="2.5" rx="1.25" />
        </g>
      ))}
    </>
  ),
  deadline: (
    <>
      <rect className={A} x="3" y="6" width="58" height="32" rx="3" />
      <rect className="rec-bib-claro" x="22" y="11" width="20" height="2.5" rx="1.25" />
      <rect className="rec-bib-claro" x="12" y="17" width="40" height="6" rx="2" />
      <rect className="rec-bib-claro" x="24" y="28" width="16" height="5" rx="2.5" />
    </>
  ),
  benefits: (
    <>
      <rect className={L} x="16" y="7" width="32" height="4" rx="2" />
      {[6, 26, 46].map((x) => (
        <g key={x}>
          <rect className={S} x={x} y="15" width="12" height="10" rx="3" />
          <rect className={L} x={x} y="29" width="12" height="3" rx="1.5" />
          <rect className={S} x={x + 1} y="34" width="10" height="2.5" rx="1.25" />
        </g>
      ))}
    </>
  ),
  quote: (
    <>
      <circle className="rec-bib-img" cx="13" cy="20" r="8" />
      <rect className={A} x="27" y="9" width="6" height="5" rx="1" />
      <rect className={L} x="27" y="17" width="30" height="3.5" rx="1.75" />
      <rect className={L} x="27" y="23" width="24" height="3.5" rx="1.75" />
      <rect className={S} x="27" y="31" width="14" height="3" rx="1.5" />
    </>
  ),
  faq: (
    <>
      <rect className={L} x="6" y="7" width="30" height="4" rx="2" />
      {[15, 27].map((y) => (
        <g key={y}>
          <rect className={S} x="6" y={y - 2} width="52" height="0.8" />
          <rect className={L} x="6" y={y} width="34" height="3" rx="1.5" />
          <rect className={S} x="6" y={y + 5} width="46" height="2.5" rx="1.25" />
        </g>
      ))}
    </>
  ),
  contact: (
    <>
      <rect className={S} x="3" y="6" width="58" height="32" rx="3" />
      <circle className={A} cx="16" cy="22" r="8" />
      <rect className={L} x="29" y="14" width="22" height="4" rx="2" />
      <rect className={S} x="29" y="21" width="18" height="3" rx="1.5" />
      <rect className={A} x="29" y="27" width="24" height="3" rx="1.5" />
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
  feature: "Para lo que tiene que verse primero: el sorteo, el incentivo, el anuncio.",
  [IMAGEN_Y_TEXTO]: "Para dar contexto: el campus, el aula, quién hace el estudio.",
  steps: "Para explicar cómo se responde, en tres pasos o menos a lo ancho.",
  deadline: "Para que nadie pase por alto el día en que cierra la encuesta.",
  benefits: "Para decir por qué vale la pena responder: confidencial, corto, útil.",
  quote: "Para que hable alguien del estudio: una autoridad, una docente.",
  faq: "Para las dudas de siempre, antes de que escriban al equipo.",
  contact: "Para decir a quién escribir: nombre, cargo, correo y horario.",
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
  feature: "Foto, título y botón: el sorteo o el anuncio.",
  [IMAGEN_Y_TEXTO]: "Una foto a un lado y su texto: el contexto.",
  steps: "Cómo responder, en pasos numerados.",
  deadline: "El día en que cierra, grande y con su botón.",
  benefits: "Por qué responder, con un ícono cada razón.",
  quote: "La voz de alguien, con su nombre y su cargo.",
  faq: "Las dudas de siempre, con su respuesta.",
  contact: "A quién escribir si hay dudas.",
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
  /** «Mis secciones» (L9, ADR 0113): sin esta prop, la biblioteca no las ofrece. */
  onElegirGuardada?: (seccion: MailSavedSection) => void;
  onCerrar: () => void;
};

/** «24 oct» de una fecha ISO; vacío si no se lee. */
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "");
}

/** Las secciones guardadas del estudio, primero en la biblioteca (lee el store). */
function MisSecciones({ onElegir }: { onElegir: (seccion: MailSavedSection) => void }) {
  const { secciones, estado, error, cargar, borrar, importar } = useMisSecciones();
  // Se relee al abrir: el store es de la app y otro proyecto trae sus propias secciones (ver misSeccionesStore).
  useEffect(() => { void cargar(); }, [cargar]);
  return <ListaDeMisSecciones secciones={secciones} cargando={estado === "cargando"} error={error} onElegir={onElegir} onBorrar={(id) => { void borrar(id); }} onImportar={importar} />;
}

/** La lista de «Mis secciones»: cada una inserta una copia; su ✕ la borra. */
export function ListaDeMisSecciones({ secciones, cargando, error, onElegir, onBorrar, onImportar }: {
  secciones: readonly MailSavedSection[];
  cargando: boolean;
  error: string | null;
  onElegir: (seccion: MailSavedSection) => void;
  onBorrar: (sectionId: string) => void;
  /** «Importar de otro estudio…»: sin esta prop, la lista no lo ofrece. */
  onImportar?: (path: string, sectionIds: string[]) => Promise<MailSectionsImportResult | null>;
}) {
  // Borrar pide un segundo clic: no hay deshacer y la sección puede servir en otros correos.
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resumen, setResumen] = useState<string | null>(null);
  // Al cerrar el panel, el foco vuelve al botón que lo abrió.
  const botonImportar = useRef<HTMLButtonElement | null>(null);
  const abierto = useRef(false);
  useEffect(() => {
    if (abierto.current && !importando) botonImportar.current?.focus();
    abierto.current = importando;
  }, [importando]);
  return (
    <section className="rec-bib-grupo" aria-label="Mis secciones">
      <span className="rec-bib-grupo-cabeza">
        <h4 className="rec-bib-grupo-titulo">Mis secciones · de este estudio</h4>
        {onImportar && !importando ? (
          <button ref={botonImportar} type="button" className="rec-bib-importar" onClick={() => { setResumen(null); setImportando(true); }}>Importar de otro estudio…</button>
        ) : null}
      </span>
      {onImportar && importando ? (
        <ImportarSecciones
          onImportar={onImportar}
          onListo={(r) => { setImportando(false); setResumen(resumenDeImportacion(r)); }}
          onCerrar={() => setImportando(false)}
        />
      ) : null}
      {resumen ? <p className="rec-bib-importado" role="status">{resumen}</p> : null}
      {cargando && !secciones.length ? <p className="rec-bib-vacio">Leyendo las secciones del estudio…</p> : null}
      {!cargando && !secciones.length ? (
        <p className="rec-bib-vacio">Aún no hay. Elige una sección del correo y usa «Guardar» en su barra: queda aquí para los otros correos de este estudio.</p>
      ) : null}
      {error ? <p className="rec-mail-problemas" role="alert">{error}</p> : null}
      {secciones.length ? (
        <div className="rec-bib-rejilla" data-qa-geometry-group="material-campo/correo/biblioteca" data-qa-geometry-contract="equal">
          {secciones.map((s) => {
            const tipo = s.block.type === "__no_reconocido" ? null : s.block.type;
            const Icono = tipo ? ICONO_DE_BLOQUE[tipo] : null;
            const detalle = [tipo ? ROTULO_DE_BLOQUE[tipo] : "", fechaCorta(s.created_at)].filter(Boolean).join(" · ");
            return (
              <span key={s.section_id} className="rec-bib-guardada" data-qa-geometry-member>
                <button type="button" className="rec-bib-tipo" data-guardada={s.section_id} title={`Insertar una copia de «${s.name}»`} onClick={() => onElegir(s)}>
                  <svg className="rec-bib-esquema" viewBox="0 0 64 44" aria-hidden focusable="false">
                    <rect className="rec-bib-papel" x="0.5" y="0.5" width="63" height="43" rx="3" />
                    {tipo ? ESQUEMA[tipo] : null}
                  </svg>
                  <span className="rec-bib-texto">
                    <span className="rec-bib-nombre">{Icono ? <Icono size={13} aria-hidden /> : null} {s.name}</span>
                    <span className="rec-bib-desc">{detalle}</span>
                  </span>
                </button>
                {porBorrar === s.section_id ? (
                  <button type="button" className="rec-bib-borrar is-confirmando" aria-label={`Confirmar: borrar «${s.name}» de Mis secciones`} onClick={() => { setPorBorrar(null); onBorrar(s.section_id); }} onBlur={() => setPorBorrar(null)}>
                    ¿Borrar?
                  </button>
                ) : (
                  <button type="button" className="rec-bib-borrar" aria-label={`Borrar «${s.name}» de Mis secciones`} title="Borrar de Mis secciones (los correos que la usan no cambian)" onClick={() => setPorBorrar(s.section_id)}>
                    <X size={12} aria-hidden />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Biblioteca de bloques (E1g §2): una cuadrícula de tipos con su ícono, su
 * nombre, para qué sirve y un esquema de cómo se ve. Se elige con un clic o se
 * arrastra a un punto del correo. Nunca está vacía; el pie es único.
 */
export function BibliotecaDeBloques({ template, estilo, titulo = "Agregar un bloque", arriba = false, onElegir, onElegirGuardada, onCerrar }: Props) {
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
        {onElegirGuardada ? <MisSecciones onElegir={onElegirGuardada} /> : null}
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
