import { useId, useRef, useState } from "react";

import { extensionDeImagen, type MailBlock, type MailImageBlock, type MailProblem, type MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Switch } from "../../../components/Switch";
import { ImagePlus, Upload } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { ajustesDe, anchoDeImagen, conAjuste, valorDeAjuste } from "./ajustesDeBloque";
import { CampoDeTexto } from "./CampoDeTexto";
import { propDelProblema } from "./modeloCorreo";

/** Límite de la subida (`mail_image`): el backend rechaza sobre 1 MB. */
export const PESO_MAXIMO_DE_IMAGEN = 1024 * 1024;

/** Lo que se puede saber de un archivo antes de subirlo. */
export function problemaDelArchivo(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!extensionDeImagen(file)) return "La imagen tiene que ser PNG o JPEG.";
  if (file.size > PESO_MAXIMO_DE_IMAGEN) return "La imagen pesa más de 1 MB: redúcela antes de subirla.";
  return null;
}

type Props = {
  template: MailTemplate;
  block: MailImageBlock;
  /** Lo que ya se ve de la imagen: el `blob:` recién subido o el `src` de la vista previa. */
  vista: string | null;
  problemas: readonly MailProblem[];
  ocupado: boolean;
  onEditarBloque: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
  onEditar: (update: (t: MailTemplate) => MailTemplate, grupo?: string) => void;
  onSubir: (file: File) => void;
};

/**
 * Inspector de un bloque `image` (E1g §B): el archivo (PNG o JPEG hasta 1 MB),
 * su texto alternativo —obligatorio—, el ancho, la alineación, a todo el ancho,
 * el enlace y dónde se aloja para el envío.
 */
export function PanelDeImagen({ template, block, vista, problemas, ocupado, onEditarBloque, onEditar, onSubir }: Props) {
  const id = useId();
  const archivo = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const declarada = template.images[block.image_ref];
  const [alojamiento, setAlojamiento] = useState<"zip" | "url">(declarada?.url ? "url" : "zip");
  const de = (prop: string) => problemas.filter((p) => propDelProblema(p.path) === prop);
  const alinear = ajustesDe(block).find((a) => a.clave === "align");
  const ancho = block.width ?? null;
  const bleed = block.bleed === true;

  const elegir = (file: File | undefined) => {
    if (!file) return;
    const problema = problemaDelArchivo(file);
    setError(problema);
    if (!problema) onSubir(file);
  };

  const ponerUrl = (url: string) => {
    onEditar((t) => {
      const images = { ...t.images };
      const actual = images[block.image_ref] ?? { alt: block.alt };
      if (url) images[block.image_ref] = { ...actual, url };
      else {
        const { url: _u, ...sinUrl } = actual;
        void _u;
        images[block.image_ref] = sinUrl;
      }
      return { ...t, images };
    }, `${block.block_id}.image_url`);
  };

  return (
    <div className="rec-capa-img-panel">
      <div className={`rec-capa-img-vista${vista ? "" : " is-vacia"}`} data-qa-geometry-capacity="owned">
        {vista ? (
          <img src={vista} alt={block.alt || "Imagen del correo"} />
        ) : (
          <span className="rec-capa-img-vacia">
            <ImagePlus size={20} aria-hidden />
            <span>Sin archivo todavía. En el correo se ve el hueco con el texto alternativo.</span>
          </span>
        )}
      </div>
      <div className="rec-capa-img-subir">
        <PulsoButton variant={vista ? "secondary" : "primary"} size="sm" disabled={ocupado} onClick={() => archivo.current?.click()}>
          <Upload size={14} aria-hidden /> {vista ? "Reemplazar la imagen" : "Subir imagen"}
        </PulsoButton>
        <span className="rec-capa-img-ayuda">PNG o JPEG, hasta 1 MB y de 40 a 1.200 px de ancho. Súbela al doble del ancho que tendrá.</span>
        <input
          ref={archivo}
          type="file"
          accept="image/png,image/jpeg"
          className="pulso-sr-only"
          aria-label="Elegir una imagen PNG o JPEG"
          tabIndex={-1}
          onChange={(event) => {
            elegir(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {error ? <p className="rec-mail-problemas" role="alert">{error}</p> : null}
      </div>

      <CampoDeTexto
        label="Texto alternativo"
        valor={block.alt}
        maximo={160}
        ayuda="Obligatorio. Es lo que se lee con las imágenes bloqueadas y lo que oye un lector de pantalla."
        problemas={de("alt")}
        onCambio={(alt) => onEditarBloque((b) => ({ ...b, alt }) as MailBlock, `${block.block_id}.alt`)}
      />

      <div className="rec-mail-ajuste rec-capa-img-sangre">
        <span id={`${id}-sangre`}>A todo el ancho</span>
        <Switch
          checked={bleed}
          ariaLabel="A todo el ancho, sin margen"
          onToggle={() => onEditarBloque((b) => {
            const next = { ...b } as MailImageBlock;
            if (bleed) delete next.bleed;
            else next.bleed = true;
            return next;
          })}
        />
        <span className="rec-capa-img-ayuda">Para banners: 600 px, sin margen.</span>
      </div>

      <div className={`rec-mail-ajuste rec-capa-img-ancho${bleed ? " is-apagado" : ""}`}>
        <label htmlFor={`${id}-ancho`}>Ancho</label>
        <span className="rec-capa-img-ancho-control">
          <input
            id={`${id}-ancho`}
            type="range"
            min={40}
            max={600}
            step={10}
            disabled={bleed}
            value={ancho ?? 300}
            aria-valuetext={ancho ? `${ancho} px` : "automático"}
            onChange={(event) => {
              const width = anchoDeImagen(event.target.value);
              onEditarBloque((b) => ({ ...b, width }) as MailBlock, `${block.block_id}.width`);
            }}
          />
          <output htmlFor={`${id}-ancho`}>{bleed ? "600 px" : ancho ? `${ancho} px` : "Automático"}</output>
          {ancho && !bleed ? (
            <button
              type="button"
              className="rec-mail-link"
              onClick={() => onEditarBloque((b) => {
                const next = { ...b } as MailImageBlock;
                delete next.width;
                return next;
              })}
            >
              Automático
            </button>
          ) : null}
        </span>
      </div>

      {alinear ? (
        <div className={`rec-mail-ajuste${bleed ? " is-apagado" : ""}`}>
          <span>{alinear.rotulo}</span>
          <Segmented
            aria-label="Alineación de la imagen"
            size="sm"
            value={valorDeAjuste(block, alinear)}
            options={alinear.opciones.map((o) => ({ value: o.valor, label: o.rotulo }))}
            onChange={(valor) => { if (!bleed) onEditarBloque((b) => conAjuste(b, "align", valor)); }}
          />
        </div>
      ) : null}

      <CampoDeTexto
        label="Enlace al hacer clic"
        valor={block.url ?? ""}
        mono
        placeholder="https://… (opcional)"
        ayuda="Opcional. Admite campos, como {{enlace}}."
        problemas={de("url")}
        onCambio={(url) => onEditarBloque((b) => {
          const next = { ...b } as MailImageBlock;
          if (url) next.url = url;
          else delete next.url;
          return next;
        }, `${block.block_id}.url`)}
      />

      <div className="rec-mail-ajuste rec-capa-img-alojar">
        <span>Para el envío</span>
        <Segmented
          aria-label="Dónde se aloja la imagen para el envío"
          size="sm"
          value={alojamiento}
          options={[
            { value: "zip", label: "En el ZIP" },
            { value: "url", label: "URL https" },
          ]}
          onChange={(v) => {
            setAlojamiento(v);
            if (v === "zip" && declarada?.url) ponerUrl("");
          }}
        />
      </div>
      {alojamiento === "url" ? (
        <CampoDeTexto
          label="URL pública de la imagen"
          valor={declarada?.url ?? ""}
          mono
          placeholder="https://…/linea-cierre.png"
          ayuda="Una URL https que no caduque (CDN, GitHub raw). Con ella la imagen no entra al ZIP."
          onCambio={(url) => ponerUrl(url.trim())}
        />
      ) : (
        <p className="rec-capa-img-ayuda">El archivo va en el ZIP importable con el nombre <code>{block.image_ref}</code>; Mailchimp lo sube y reescribe la ruta.</p>
      )}
    </div>
  );
}
