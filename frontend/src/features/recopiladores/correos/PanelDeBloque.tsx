import { useState } from "react";

import { isOpaqueMailBlock, tieneEntradas, tieneFoto, type TipoConEntradas, type MailBlock, type MailCheck, type MailImageBlock, type MailProblem, type MailRecipients, type MailRecipientView, type MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ArrowDown, ArrowUp, Palette, Trash2 } from "../../../vendor/lucide-react";
import { PropRow } from "../../xlsformEditor/kit";
import { AjusteDeBloque } from "./AjusteDeBloque";
import { AJUSTES_CON_CONTROL_PROPIO, ajustesDe, conAjuste, sigueAIdentidad, valorDeAjuste } from "./ajustesDeBloque";
import { ColorDePieza } from "./ColorDePieza";
import { EstiloDelBloque, SelectorDeVista, type VistaDelBloque } from "./EstiloDelBloque";
import { admiteCaja } from "./modeloCaja";
import { PanelDeDosImagenes } from "./PanelDeDosImagenes";
import { EntradasDeSeccion } from "./EntradasDeSeccion";
import { FotoDeLaSeccion } from "./FotoDeLaSeccion";
import { ROTULO_DE_ICONO, chequeoDeContraste, conColor, idDelIcono, tieneColor, type LadoDelPar } from "./piezasGraficas";
import { SelectorDeIcono } from "./SelectorDeIcono";
import { CampoDeTexto } from "./CampoDeTexto";
import { CampoConCampos } from "./CampoConCampos";
import { rotulosDeCampos } from "./rotulosDeCampos";
import { admiteEnlaces, type Dialecto } from "./comoSaleEnLaPlataforma";
import { esMultilinea } from "./estructuraCorreo";
import { LoQueFaltaSubir } from "./LoQueFaltaSubir";
import { fraseDeLoQueFalta, idsSinArchivo, nombreDeImagen } from "./nombresDeImagen";
import { fraseDeNitidez } from "./nitidez";
import { PanelDeImagen } from "./PanelDeImagen";
import { ChequeosDelBloque } from "./TarjetaDidactica";
import { ListaDePuntos } from "./ListaDePuntos";
import { EnlaceDeLaPersona } from "./EnlaceDeLaPersona";
import { causaDelChequeo } from "./comoArreglar";
import { esProblemaDelTrato } from "./modeloTrato";
import { SaludoSegunLaPersona } from "./SaludoSegunLaPersona";
import {
  CABECERA,
  ROTULO_DE_PROP,
  SOBRE,
  conTexto,
  descripcionDeBloque,
  esPropDeLista,
  propDelProblema,
  propsDeTexto,
  puedeMover,
  rotuloDeBloque,
  rotuloDeCabecera,
  textoDe,
  type ProblemasPorDestino,
  type PropDeTexto,
  CUERPO_DEL_INSPECTOR,
} from "./modeloCorreo";
import type { DestinoDelCampo } from "./store";

type Props = {
  template: MailTemplate;
  seleccion: string;
  problemas: ProblemasPorDestino;
  /** La persona que se está mirando en la vista previa, sin su correo. */
  persona: MailRecipientView | null;
  /** Con `grupo` (`bloque.prop`) el cambio es de texto y se agrupa en el historial. */
  onEditar: (update: (t: MailTemplate) => MailTemplate, grupo?: string) => void;
  onEditarBloque: (blockId: string, update: (b: MailBlock) => MailBlock, grupo?: string) => void;
  onDestino: (destino: DestinoDelCampo) => void;
  onMover: (blockId: string, delta: -1 | 1) => void;
  onQuitar: (blockId: string) => void;
  onAbrirIdentidad: () => void;
  /** Elige otra zona del correo (la cabecera, un bloque) en el lienzo y aquí. */
  onSeleccionar?: (id: string) => void;
  /**
   * Ya no pinta nada aquí: la tarjeta «Qué hace» / «Cómo sale» salió del
   * inspector (ítem 2 de checklist-inspector-correo-2026-10-23). Se acepta
   * mientras quien lo pasa no lo suelte.
   */
  explicaciones?: boolean;
  dialecto?: Dialecto;
  /** Chequeos de la revisión que nombran el bloque elegido (`targets`). */
  chequeos?: readonly MailCheck[];
  /** Lo que ya se ve de la imagen del bloque (blob recién subido o src de la vista previa). */
  vistaDeImagen?: string | null;
  /** Lo mismo para cada lado de un par de imágenes. */
  vistasDelPar?: Record<LadoDelPar, string | null> | null;
  ocupado?: boolean;
  /** Con `lado`, el archivo es de un lado de un par. */
  onSubirImagen?: (blockId: string, file: File, lado?: LadoDelPar) => void;
  /** Sube una imagen de la cabecera (logo o banner) con su id, como en Identidad. */
  onSubirLogo?: (id: string, file: File) => void;
  /** La lista cargada en Personas: de ahí sale la columna del saludo por sexo (C8). */
  destinatarios?: MailRecipients | null;
  onIrAPersonas?: () => void;
  /** Los colores de la marca (banner o logo) para el fondo del bloque (L3). */
  coloresDeLaMarca?: readonly string[];
};

/** ¿La edición convirtió el bloque imagen en la cabecera (banner) y lo quitó de la lista? */
export function pasoALaCabecera(despues: Pick<MailTemplate, "header" | "blocks">, block: Pick<MailImageBlock, "block_id" | "image_ref">): boolean {
  return despues.header.kind === "banner"
    && despues.header.image_ref === block.image_ref
    && !despues.blocks.some((b) => b.block_id === block.block_id);
}

const AYUDA_DE_PROP: Partial<Record<PropDeTexto, string>> = {
  url: "Dirección web o de correo, o un campo de cada persona.",
};

/**
 * Lo que se escribe como texto del correo: con chips y formato. La dirección
 * de un enlace, el texto alternativo de una imagen y el respaldo del nombre
 * son datos sin formato y siguen en una caja simple.
 */
const SIN_FORMATO: ReadonlySet<PropDeTexto> = new Set(["url", "alt", "alt_left", "alt_right", "fallback"]);
// (La dirección, aun sin formato, muestra sus campos como chips: va aparte, abajo.)
const conFormato = (prop: PropDeTexto) => !SIN_FORMATO.has(prop);

function problemasDe(lista: readonly MailProblem[], prop: string): MailProblem[] {
  return lista.filter((p) => propDelProblema(p.path) === prop);
}

function Encabezado({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="rec-mail-insp-cabeza">
      <h3>{titulo}</h3>
      <p>{descripcion}</p>
    </div>
  );
}

function AccionesDelBloque({
  template,
  blockId,
  onMover,
  onQuitar,
}: Pick<Props, "template" | "onMover" | "onQuitar"> & { blockId: string }) {
  return (
    <div className="rec-mail-insp-acciones" role="group" aria-label="Mover o quitar el bloque">
      <PulsoButton
        variant="icon"
        size="sm"
        aria-label="Subir el bloque"
        title="Subir"
        disabled={!puedeMover(template, blockId, -1)}
        onClick={() => onMover(blockId, -1)}
      >
        <ArrowUp size={14} aria-hidden />
      </PulsoButton>
      <PulsoButton
        variant="icon"
        size="sm"
        aria-label="Bajar el bloque"
        title="Bajar"
        disabled={!puedeMover(template, blockId, 1)}
        onClick={() => onMover(blockId, 1)}
      >
        <ArrowDown size={14} aria-hidden />
      </PulsoButton>
      <PulsoButton
        variant="ghost"
        size="sm"
        disabled={template.blocks.length <= 1}
        onClick={() => onQuitar(blockId)}
      >
        <Trash2 size={14} aria-hidden /> Quitar el bloque
      </PulsoButton>
    </div>
  );
}

/** Pestaña «Bloque» del inspector: el sobre, la cabecera o el bloque elegido. */
export function PanelDeBloque({
  template,
  seleccion,
  problemas,
  persona,
  onEditar,
  onEditarBloque,
  onDestino,
  onMover,
  onQuitar,
  onAbrirIdentidad,
  onSeleccionar,
  dialecto = "mailchimp",
  chequeos = [],
  vistaDeImagen = null,
  vistasDelPar = null,
  ocupado = false,
  onSubirImagen,
  onSubirLogo,
  destinatarios = null,
  onIrAPersonas,
  coloresDeLaMarca = [],
}: Props) {
  // Antes de cualquier return: un hook bajo una guarda rompe al cambiar de selección (React #310).
  const [vista, setVista] = useState<VistaDelBloque>("contenido");
  if (seleccion === SOBRE) {
    return (
      <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
        <Encabezado
          titulo="Asunto y vista previa"
          descripcion="Lo primero que ve la persona en su bandeja, antes de abrir el correo."
        />
        <CampoDeTexto
          label="Asunto"
          valor={template.subject}
          maximo={80}
          onCambio={(subject) => onEditar((t) => ({ ...t, subject }), "__sobre.subject")}
          onCursor={(cursor) => onDestino({ objetivo: SOBRE, prop: "subject", cursor })}
          problemas={problemas.sobre.filter((p) => p.path.startsWith("template.subject"))}
        />
        <CampoDeTexto
          label="Texto de vista previa"
          valor={template.preheader}
          maximo={140}
          multilinea
          filas={3}
          ayuda="Va junto al asunto en la bandeja. Sin él, el cliente muestra el inicio del cuerpo."
          onCambio={(preheader) => onEditar((t) => ({ ...t, preheader }), "__sobre.preheader")}
          onCursor={(cursor) => onDestino({ objetivo: SOBRE, prop: "preheader", cursor })}
          problemas={problemas.sobre.filter((p) => p.path.startsWith("template.preheader"))}
        />
      </div>
    );
  }

  if (seleccion === CABECERA) {
    const header = template.header;
    const idsDeLaCabecera = header.kind === "banner" ? [header.image_ref] : header.logo_ids;
    // H7: lo que falta subir se dice con el nombre de cada logo y se sube aquí;
    // el resto de los chequeos sigue en su lista.
    const disponibles = chequeos.find((c) => c.code === "images_available" && c.status !== "ok");
    const faltan = disponibles ? idsSinArchivo(disponibles.items).filter((id) => idsDeLaCabecera.includes(id)) : [];
    const otros = faltan.length ? chequeos.filter((c) => c !== disponibles) : chequeos;
    return (
      <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
        <Encabezado
          titulo={rotuloDeCabecera(header)}
          descripcion={header.kind === "banner"
            ? "El banner que entrega el cliente, a todo el ancho del correo."
            : "Los logos de las instituciones del estudio, arriba del correo. Cada uno va como imagen aparte dentro del archivo para Mailchimp."}
        />
        <div className="rec-mail-props">
          <PropRow label="Tipo">{header.kind === "banner" ? "Banner" : "Franja de logos"}</PropRow>
          {header.kind === "logos" ? (
            <>
              <PropRow label="Logos">{header.logo_ids.map((id) => nombreDeImagen(template, id)).join(" · ") || "ninguno"}</PropRow>
              <PropRow label="Fondo">{header.background === "dark" ? "Oscuro, con el acento" : "Claro"}</PropRow>
            </>
          ) : (
            <PropRow label="Imagen">{nombreDeImagen(template, header.image_ref)}</PropRow>
          )}
          <PropRow label="Texto alternativo">
            {idsDeLaCabecera.every((id) => template.images[id]?.alt?.trim())
              ? "Sí"
              : "Falta en alguna"}
          </PropRow>
        </div>
        {onSubirLogo ? <LoQueFaltaSubir template={template} ids={faltan} ocupado={ocupado} onSubir={onSubirLogo} /> : null}
        <ChequeosDelBloque chequeos={onSubirLogo ? otros : chequeos} />
        {problemas.cabecera.length ? (
          <ul className="rec-mail-problemas">
            {problemas.cabecera.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
          </ul>
        ) : null}
        <PulsoButton variant="secondary" size="sm" onClick={onAbrirIdentidad}>
          <Palette size={14} aria-hidden /> Cambiar logos, banner y colores
        </PulsoButton>
      </div>
    );
  }

  const block = template.blocks.find((b) => b.block_id === seleccion);
  if (!block) {
    return <div className="rec-mail-insp-cuerpo rec-mail-vacio">Elige un bloque de la lista o del correo.</div>;
  }
  const propios = problemas.porBloque[block.block_id] ?? [];
  if (isOpaqueMailBlock(block)) {
    return (
      <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
        <Encabezado titulo={rotuloDeBloque(block)} descripcion={descripcionDeBloque(block)} />
        <div className="rec-mail-props">
          <PropRow label="Tipo" mono>{block.original_type}</PropRow>
          <PropRow label="Id" mono>{block.block_id}</PropRow>
        </div>
        {propios.length ? (
          <ul className="rec-mail-problemas">
            {propios.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
          </ul>
        ) : null}
        <AccionesDelBloque template={template} blockId={block.block_id} onMover={onMover} onQuitar={onQuitar} />
      </div>
    );
  }
  const props = propsDeTexto(block.type);
  const sueltos = propios.filter((p) => !esProblemaDelTrato(p)).filter((p) => {
    const prop = propDelProblema(p.path);
    // La descripción de la foto de una sección la muestra su propio panel; las entradas, el suyo.
    if (tieneFoto(block) && prop === "alt") return false;
    if (tieneEntradas(block.type) && p.path.includes(".entries")) return false;
    return !prop || !(props as readonly string[]).includes(prop);
  });
  const editar = (update: (b: MailBlock) => MailBlock, grupo?: string) => onEditarBloque(block.block_id, update, grupo);
  const conEstilo = admiteCaja(block);

  if (conEstilo && vista === "estilo") {
    return (
      <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
        <Encabezado titulo={rotuloDeBloque(block)} descripcion={descripcionDeBloque(block)} />
        <SelectorDeVista vista={vista} onVista={setVista} />
        <EstiloDelBloque block={block} theme={template.theme} deLaMarca={coloresDeLaMarca} onEditar={editar} />
        <AccionesDelBloque template={template} blockId={block.block_id} onMover={onMover} onQuitar={onQuitar} />
      </div>
    );
  }

  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
      <Encabezado titulo={rotuloDeBloque(block)} descripcion={descripcionDeBloque(block)} />
      {conEstilo ? <SelectorDeVista vista={vista} onVista={setVista} /> : null}
      <ChequeosDelBloque
        chequeos={chequeos}
        detalleDe={(c) => {
          if (c.code === "images_available") return fraseDeLoQueFalta(template, idsSinArchivo(c.items));
          // #11: la misma frase corta que la Revisión, sin partes en cero ni paréntesis.
          if (c.code === "greeting_trato") return causaDelChequeo(c);
          return fraseDeNitidez(c, block);
        }}
      />
      {block.type === "image" ? (
        <PanelDeImagen
          template={template}
          block={block}
          vista={vistaDeImagen}
          problemas={propios}
          ocupado={ocupado}
          onEditarBloque={(update, grupo) => onEditarBloque(block.block_id, update, grupo)}
          onEditar={(update, grupo) => {
            onEditar(update, grupo);
            // «Quitar la franja de logos»: el bloque pasa a ser la cabecera. Se
            // elige la cabecera para que se vea el resultado, no un inspector vacío.
            if (pasoALaCabecera(update(template), block)) onSeleccionar?.(CABECERA);
          }}
          onSubir={(file) => onSubirImagen?.(block.block_id, file)}
        />
      ) : null}
      {block.type === "two_images" ? (
        <PanelDeDosImagenes
          block={block}
          vistas={vistasDelPar}
          problemas={propios}
          ocupado={ocupado}
          onEditarBloque={editar}
          onSubir={(lado, file) => onSubirImagen?.(block.block_id, file, lado)}
        />
      ) : null}
      {tieneEntradas(block.type) ? (
        <EntradasDeSeccion
          block={block as MailBlock & { type: TipoConEntradas }}
          opciones={rotulosDeCampos(template)}
          problemas={propios}
          onEditarBloque={editar}
          onIrAPersonas={onIrAPersonas}
        />
      ) : null}
      {tieneFoto(block) ? (
        <FotoDeLaSeccion
          block={block}
          vista={vistaDeImagen}
          problemas={propios}
          ocupado={ocupado}
          onEditarBloque={editar}
          onSubir={(file) => onSubirImagen?.(block.block_id, file)}
        />
      ) : null}
      {block.type === "icon_text" ? (
        <SelectorDeIcono valor={block.icon} onElegir={(icon) => editar((b) => conAjuste(b, "icon", icon))} />
      ) : null}
      {block.type !== "image" ? ajustesDe(block).filter((a) => !AJUSTES_CON_CONTROL_PROPIO.has(a.clave)).map((ajuste) => (
        <AjusteDeBloque
          key={ajuste.clave}
          ajuste={ajuste}
          valor={valorDeAjuste(block, ajuste, template.theme)}
          sigueAIdentidad={sigueAIdentidad(block, ajuste, template.theme)}
          acento={template.theme.accent}
          onCambio={(valor) => {
            // Elegir lo que ya hereda no escribe nada: ni la clave ni una edición vacía.
            if (conAjuste(block, ajuste.clave, valor, template.theme) === block) return;
            editar((b) => conAjuste(b, ajuste.clave, valor, template.theme));
          }}
        />
      )) : null}
      {tieneColor(block) ? (
        <ColorDePieza
          block={block}
          theme={template.theme}
          chequeo={chequeoDeContraste(chequeos, block.block_id)}
          onColor={(color) => editar((b) => conColor(b, color), `${block.block_id}.color`)}
        />
      ) : null}
      {block.type === "image" || block.type === "two_images" ? null : props.map((prop) => (prop === "items" && (block.type === "callout" || block.type === "list") ? (
        // Ítem 3: un punto por fila, cada uno con su campo con formato.
        <ListaDePuntos
          key={`${block.block_id}-${prop}`}
          label={ROTULO_DE_PROP[prop]}
          items={block.items}
          numerada={block.type === "list" && Boolean(block.ordered)}
          opciones={rotulosDeCampos(template)}
          enlaces={admiteEnlaces(block.type, prop)}
          problemas={problemasDe(propios, prop)}
          onCambio={(items) => editar((b) => (b.type === "callout" || b.type === "list" ? { ...b, items } : b), `${block.block_id}.${prop}`)}
          onCursor={(cursor) => onDestino({ objetivo: block.block_id, prop, cursor })}
          onIrAPersonas={onIrAPersonas}
        />
      ) : conFormato(prop) ? (
        // #4 y #1 (re-QA e10-2): el texto se ve como en el lienzo, con chips
        // «Nombre» y la negrita como negrita; nunca asteriscos ni llaves.
        <CampoConCampos
          key={`${block.block_id}-${prop}`}
          label={ROTULO_DE_PROP[prop]}
          valor={textoDe(block, prop)}
          opciones={rotulosDeCampos(template)}
          multilinea={esPropDeLista(prop) || esMultilinea(block.type, prop)}
          enlaces={admiteEnlaces(block.type, prop)}
          filas={prop === "text" && block.type === "paragraph" ? 7 : 3}
          normalizar={(texto) => textoDe(conTexto(block, prop, texto), prop)}
          ayuda={AYUDA_DE_PROP[prop]}
          problemas={problemasDe(propios, prop)}
          onCambio={(valor) => editar((b) => conTexto(b, prop, valor), `${block.block_id}.${prop}`)}
          onCursor={(cursor) => onDestino({ objetivo: block.block_id, prop, cursor })}
          onIrAPersonas={onIrAPersonas}
        />
      ) : prop === "url" ? (
        // La dirección: sin formato, con el campo como chip («Enlace»), nunca `{{enlace}}`.
        <CampoConCampos
          key={`${block.block_id}-${prop}`}
          label={ROTULO_DE_PROP[prop]}
          valor={textoDe(block, prop)}
          opciones={rotulosDeCampos(template)}
          formato={false}
          ayuda={AYUDA_DE_PROP[prop]}
          problemas={problemasDe(propios, prop)}
          onCambio={(valor) => editar((b) => conTexto(b, prop, valor), `${block.block_id}.${prop}`)}
          onCursor={(cursor) => onDestino({ objetivo: block.block_id, prop, cursor })}
          onIrAPersonas={onIrAPersonas}
        />
      ) : (
        <CampoDeTexto
          key={`${block.block_id}-${prop}`}
          label={ROTULO_DE_PROP[prop]}
          valor={textoDe(block, prop)}
          ayuda={AYUDA_DE_PROP[prop]}
          problemas={problemasDe(propios, prop)}
          onCambio={(valor) => editar((b) => conTexto(b, prop, valor), `${block.block_id}.${prop}`)}
          onCursor={(cursor) => onDestino({ objetivo: block.block_id, prop, cursor })}
        />
      )))}
      {block.type === "icon_text" && block.icon && dialecto === "surveymonkey" ? (
        <CampoDeTexto
          label="Dirección web del ícono"
          valor={template.images[idDelIcono(block.icon, template.theme)]?.url ?? ""}
          mono
          placeholder="https://…/icono.png (opcional)"
          ayuda="SurveyMonkey no lleva el ícono dentro del correo: con una URL https se muestra; sin ella, el texto sale solo."
          onCambio={(valor) => {
            const iconId = idDelIcono(block.icon!, template.theme);
            onEditar((t) => {
              const images = { ...t.images };
              const url = valor.trim();
              if (url) images[iconId] = { ...(images[iconId] ?? { alt: ROTULO_DE_ICONO[block.icon!] }), url };
              else delete images[iconId];
              return { ...t, images };
            }, `${block.block_id}.icon_url`);
          }}
        />
      ) : null}
      {block.type === "button" ? <EnlaceDeLaPersona url={block.url} persona={persona} campos={template.fields} /> : null}
      {block.type === "greeting" ? (
        <SaludoSegunLaPersona
          block={block}
          destinatarios={destinatarios}
          plataforma={dialecto === "surveymonkey" ? "surveymonkey" : "mailchimp"}
          problemas={propios.filter(esProblemaDelTrato)}
          onEditar={(update, grupo) => editar((b) => (b.type === "greeting" ? update(b) : b), grupo)}
          onIrAPersonas={() => onIrAPersonas?.()}
        />
      ) : null}
      {sueltos.length ? (
        <ul className="rec-mail-problemas">
          {sueltos.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
        </ul>
      ) : null}
      <AccionesDelBloque template={template} blockId={block.block_id} onMover={onMover} onQuitar={onQuitar} />
    </div>
  );
}
