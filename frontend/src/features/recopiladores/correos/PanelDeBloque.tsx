import type { MailBlock, MailProblem, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ArrowDown, ArrowUp, Image, Trash2 } from "../../../vendor/lucide-react";
import { PropRow, Segmented } from "../../xlsformEditor/kit";
import { CampoDeTexto } from "./CampoDeTexto";
import {
  CABECERA,
  DESCRIPCION_DE_BLOQUE,
  ROTULO_DE_BLOQUE,
  ROTULO_DE_PROP,
  SOBRE,
  conTexto,
  esPropDeLista,
  propDelProblema,
  propsDeTexto,
  puedeMover,
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
  onEditar: (update: (t: MailTemplate) => MailTemplate) => void;
  onEditarBloque: (blockId: string, update: (b: MailBlock) => MailBlock) => void;
  onDestino: (destino: DestinoDelCampo) => void;
  onMover: (blockId: string, delta: -1 | 1) => void;
  onQuitar: (blockId: string) => void;
  onAbrirIdentidad: () => void;
};

const AYUDA_DE_PROP: Partial<Record<PropDeTexto, string>> = {
  text: "**negrita** y {{campo}}; el formato lo pone la plantilla.",
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

/** Pestaña «Bloque» del inspector: el sobre, la cabecera o el bloque elegido. */
export function PanelDeBloque({
  template,
  seleccion,
  problemas,
  onEditar,
  onEditarBloque,
  onDestino,
  onMover,
  onQuitar,
  onAbrirIdentidad,
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
          onCambio={(subject) => onEditar((t) => ({ ...t, subject }))}
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
          onCambio={(preheader) => onEditar((t) => ({ ...t, preheader }))}
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
          <PropRow label="Tipo">{header.kind === "banner" ? "Banner 1200 × 600" : "Franja de logos"}</PropRow>
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
  const props = propsDeTexto(block.type);
  const sueltos = propios.filter((p) => {
    const prop = propDelProblema(p.path);
    return !prop || !(props as readonly string[]).includes(prop);
  });
  const editar = (update: (b: MailBlock) => MailBlock) => onEditarBloque(block.block_id, update);

  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
      <Encabezado titulo={ROTULO_DE_BLOQUE[block.type]} descripcion={DESCRIPCION_DE_BLOQUE[block.type]} />
      {block.type === "paragraph" ? (
        <div className="rec-mail-ajuste">
          <span>Alineación</span>
          <Segmented
            aria-label="Alineación del párrafo"
            size="sm"
            value={block.align ?? "left"}
            options={[
              { value: "left", label: "Izquierda" },
              { value: "justify", label: "Justificado" },
              { value: "center", label: "Centrado" },
            ]}
            onChange={(align) => editar((b) => ({ ...b, align }) as MailBlock)}
          />
        </div>
      ) : null}
      {block.type === "callout" ? (
        <div className="rec-mail-ajuste">
          <span>Estilo</span>
          <Segmented
            aria-label="Estilo del recuadro"
            size="sm"
            value={block.variant ?? "box"}
            options={[
              { value: "box", label: "Borde fino" },
              { value: "bar", label: "Franja lateral" },
            ]}
            onChange={(variant) => editar((b) => ({ ...b, variant }) as MailBlock)}
          />
        </div>
      ) : null}
      {block.type === "list" ? (
        <div className="rec-mail-ajuste">
          <span>Tipo</span>
          <Segmented
            aria-label="Tipo de lista"
            size="sm"
            value={block.ordered ? "si" : "no"}
            options={[
              { value: "no", label: "Viñetas" },
              { value: "si", label: "Numerada" },
            ]}
            onChange={(v) => editar((b) => ({ ...b, ordered: v === "si" }) as MailBlock)}
          />
        </div>
      ) : null}
      {props.map((prop) => (
        <CampoDeTexto
          key={`${block.block_id}-${prop}`}
          label={ROTULO_DE_PROP[prop]}
          valor={textoDe(block, prop)}
          multilinea={esPropDeLista(prop) || (prop === "text" && block.type !== "greeting" && block.type !== "button")}
          filas={prop === "text" && block.type === "paragraph" ? 7 : 4}
          mono={prop === "url"}
          ayuda={AYUDA_DE_PROP[prop]}
          problemas={problemasDe(propios, prop)}
          onCambio={(valor) => editar((b) => conTexto(b, prop, valor))}
          onCursor={(cursor) => onDestino({ objetivo: block.block_id, prop, cursor })}
        />
      ))}
      {sueltos.length ? (
        <ul className="rec-mail-problemas">
          {sueltos.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
        </ul>
      ) : null}
      <div className="rec-mail-insp-acciones" role="group" aria-label="Mover o quitar el bloque">
        <PulsoButton
          variant="icon"
          size="sm"
          aria-label="Subir el bloque"
          title="Subir"
          disabled={!puedeMover(template, block.block_id, -1)}
          onClick={() => onMover(block.block_id, -1)}
        >
          <ArrowUp size={14} aria-hidden />
        </PulsoButton>
        <PulsoButton
          variant="icon"
          size="sm"
          aria-label="Bajar el bloque"
          title="Bajar"
          disabled={!puedeMover(template, block.block_id, 1)}
          onClick={() => onMover(block.block_id, 1)}
        >
          <ArrowDown size={14} aria-hidden />
        </PulsoButton>
        <PulsoButton
          variant="ghost"
          size="sm"
          disabled={template.blocks.length <= 1}
          onClick={() => onQuitar(block.block_id)}
        >
          <Trash2 size={14} aria-hidden /> Quitar el bloque
        </PulsoButton>
      </div>
    </div>
  );
}
