import { isOpaqueMailBlock, type MailBlock, type MailCheck, type MailProblem, type MailRecipients, type MailRecipientView, type MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ArrowDown, ArrowUp, Image, Trash2 } from "../../../vendor/lucide-react";
import { PropRow, Segmented } from "../../xlsformEditor/kit";
import { ajustesDe, conAjuste, valorDeAjuste } from "./ajustesDeBloque";
import { CampoDeTexto } from "./CampoDeTexto";
import type { Dialecto } from "./comoSaleEnLaPlataforma";
import { PanelDeImagen } from "./PanelDeImagen";
import { ChequeosDelBloque, TarjetaDidactica } from "./TarjetaDidactica";
import { EnlaceDeLaPersona } from "./EnlaceDeLaPersona";
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
  /** Modo didáctico: la tarjeta «Qué hace» y «Cómo sale en la plataforma». */
  explicaciones?: boolean;
  dialecto?: Dialecto;
  /** Chequeos de la revisión que nombran el bloque elegido (`targets`). */
  chequeos?: readonly MailCheck[];
  /** Lo que ya se ve de la imagen del bloque (blob recién subido o src de la vista previa). */
  vistaDeImagen?: string | null;
  ocupado?: boolean;
  onSubirImagen?: (blockId: string, file: File) => void;
  /** La lista cargada en Personas: de ahí sale la columna del saludo por sexo (C8). */
  destinatarios?: MailRecipients | null;
  onIrAPersonas?: () => void;
};

const AYUDA_DE_PROP: Partial<Record<PropDeTexto, string>> = {
  text: "Puedes usar negrita, cursiva y campos; el formato lo pone la plantilla.",
  url: "https://…, mailto:… o un campo como {{enlace}}.",
  note: "Una línea por renglón.",
  items: "Un punto por línea.",
  lines: "Una línea por renglón.",
};

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
  explicaciones = false,
  dialecto = "mailchimp",
  chequeos = [],
  vistaDeImagen = null,
  ocupado = false,
  onSubirImagen,
  destinatarios = null,
  onIrAPersonas,
}: Props) {
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
    return (
      <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
        <Encabezado
          titulo={rotuloDeCabecera(header)}
          descripcion={header.kind === "banner"
            ? "El banner de mailing que entrega el cliente, a todo el ancho del correo."
            : "Logos de las instituciones del estudio sobre la franja; se alojan como imágenes, no incrustadas."}
        />
        <div className="rec-mail-props">
          <PropRow label="Tipo">{header.kind === "banner" ? "Banner de mailing" : "Franja de logos"}</PropRow>
          {header.kind === "logos" ? (
            <>
              <PropRow label="Logos" mono>{header.logo_ids.join(" · ") || "ninguno"}</PropRow>
              <PropRow label="Fondo">{header.background === "dark" ? "Oscuro, con el acento" : "Claro"}</PropRow>
            </>
          ) : (
            <PropRow label="Imagen" mono>{header.image_ref}</PropRow>
          )}
          <PropRow label="Texto alternativo">
            {(header.kind === "banner" ? [header.image_ref] : header.logo_ids).every((id) => template.images[id]?.alt?.trim())
              ? "Sí"
              : "Falta en alguna"}
          </PropRow>
        </div>
        <ChequeosDelBloque chequeos={chequeos} />
        {problemas.cabecera.length ? (
          <ul className="rec-mail-problemas">
            {problemas.cabecera.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
          </ul>
        ) : null}
        <PulsoButton variant="secondary" size="sm" onClick={onAbrirIdentidad}>
          <Image size={14} aria-hidden /> Editar la identidad
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
    return !prop || !(props as readonly string[]).includes(prop);
  });
  const editar = (update: (b: MailBlock) => MailBlock, grupo?: string) => onEditarBloque(block.block_id, update, grupo);

  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
      <Encabezado titulo={rotuloDeBloque(block)} descripcion={descripcionDeBloque(block)} />
      <ChequeosDelBloque chequeos={chequeos} />
      {block.type === "image" ? (
        <PanelDeImagen
          template={template}
          block={block}
          vista={vistaDeImagen}
          problemas={propios}
          ocupado={ocupado}
          onEditarBloque={(update, grupo) => onEditarBloque(block.block_id, update, grupo)}
          onEditar={onEditar}
          onSubir={(file) => onSubirImagen?.(block.block_id, file)}
        />
      ) : null}
      {block.type !== "image" ? ajustesDe(block).map((ajuste) => (
        <div className="rec-mail-ajuste" key={ajuste.clave}>
          <span>{ajuste.rotulo}</span>
          <Segmented
            aria-label={`${ajuste.rotulo} del bloque`}
            size="sm"
            value={valorDeAjuste(block, ajuste)}
            options={ajuste.opciones.map((o) => ({ value: o.valor, label: o.rotulo }))}
            onChange={(valor) => editar((b) => conAjuste(b, ajuste.clave, valor))}
          />
        </div>
      )) : null}
      {block.type === "image" ? null : props.map((prop) => (
        <CampoDeTexto
          key={`${block.block_id}-${prop}`}
          label={ROTULO_DE_PROP[prop]}
          valor={textoDe(block, prop)}
          multilinea={esPropDeLista(prop) || (prop === "text" && block.type !== "greeting" && block.type !== "button")}
          filas={prop === "text" && block.type === "paragraph" ? 7 : 4}
          mono={prop === "url"}
          ayuda={AYUDA_DE_PROP[prop]}
          problemas={problemasDe(propios, prop)}
          onCambio={(valor) => editar((b) => conTexto(b, prop, valor), `${block.block_id}.${prop}`)}
          onCursor={(cursor) => onDestino({ objetivo: block.block_id, prop, cursor })}
        />
      ))}
      {explicaciones ? <TarjetaDidactica block={block} template={template} dialecto={dialecto} /> : null}
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
