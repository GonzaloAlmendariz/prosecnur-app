import { useId } from "react";

import type { MailCheck, MailPlatform, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertCircle, Check, CheckCircle2, ImagePlus, Link2, Trash2 } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { EstiloDelCorreo } from "./EstiloDelCorreo";
import { srcDeImagenDelBloque } from "./estructuraCorreo";
import { FranjaDeLogos } from "./FranjaDeLogos";
import { nombreDeImagen } from "./nombresDeImagen";
import { SubirArchivo } from "./SubirArchivo";
import {
  BANNER_ID,
  MAX_LOGOS,
  idLibre,
  logosDeLaFranja,
  slugDeImagen,
  usarBanner,
  usarLogos,
  altPendiente,
  CABECERA,
  CUERPO_DEL_INSPECTOR,
} from "./modeloCorreo";
import type { ChequeoDeEstilo } from "./modeloEstilo";

type Props = {
  template: MailTemplate;
  imagenesLocales: Record<string, string>;
  /** HTML de la vista previa del borrador: de ahí salen los logos que ya están en el proyecto. */
  htmlDeLaVista: string | null;
  /** Ids que la revisión dice que no tienen archivo ni URL. */
  sinArchivo: readonly string[];
  bannerCheck: MailCheck | null;
  /** Chequeos `campana_*` de la revisión (E1n). */
  chequeosDeEstilo?: Partial<Record<ChequeoDeEstilo, MailCheck>>;
  ocupado: boolean;
  onEditar: (update: (t: MailTemplate) => MailTemplate) => void;
  /** Sube el PNG o JPEG con el id de la imagen; si ya tenía archivo, lo reemplaza. */
  onSubir: (id: string, file: File) => void;
  /** Imagen cuyo texto alternativo se pide (tras importar un correo): su campo toma el foco. */
  pedirAlt?: string | null;
  onAltListo?: () => void;
  /**
   * Plataforma de la campaña. En Mailchimp cada imagen viaja dentro del ZIP y
   * no se pide URL; SurveyMonkey no recibe archivos y exige su URL https.
   */
  plataforma?: MailPlatform;
};

function Imagen({ src, alt, banner }: { src: string | undefined; alt: string; banner?: boolean }) {
  return (
    <span className={`rec-mail-img${banner ? " rec-mail-img--banner" : ""}${src ? "" : " is-vacia"}`}>
      {src ? <img src={src} alt={alt} /> : <ImagePlus size={banner ? 20 : 15} aria-hidden />}
    </span>
  );
}

/**
 * El enlace de una imagen. En Mailchimp la imagen viaja en el ZIP y no se pide
 * URL: si ya trae una (de un correo importado) se muestra, sin invitar a
 * alojar. SurveyMonkey no recibe archivos: ahí la URL https es el dato.
 */
function EnlaceDeLaImagen({ nombre, url, plataforma, onCambio }: { nombre: string; url: string | undefined; plataforma: MailPlatform; onCambio: (url: string) => void }) {
  if (plataforma === "surveymonkey") {
    return (
      <input
        className="rec-mail-input rec-mail-input--sm"
        aria-label={`URL https de ${nombre}`}
        placeholder="URL https: SurveyMonkey no recibe archivos"
        value={url ?? ""}
        onChange={(e) => onCambio(e.target.value.trim())}
      />
    );
  }
  if (!url) return null;
  return (
    <span className="rec-mail-ayuda" title={url}>
      <Link2 size={12} aria-hidden /> Viene con enlace del correo importado
    </span>
  );
}

/** Pestaña «Identidad»: banner de mailing del cliente o franja de logos del estudio. */
export function PanelIdentidad({ template, imagenesLocales, htmlDeLaVista, sinArchivo, bannerCheck, chequeosDeEstilo = {}, ocupado, onEditar, onSubir, pedirAlt = null, onAltListo, plataforma = "mailchimp" }: Props) {
  const ids = useId();
  const conBanner = template.header.kind === "banner";
  const bannerId = template.header.kind === "banner" ? template.header.image_ref : BANNER_ID;
  const logos = logosDeLaFranja(template);
  const tieneArchivo = (id: string) => Boolean(imagenesLocales[id]) || (!sinArchivo.includes(id) && id in template.images);
  const fondo = template.header.kind === "logos" ? template.header.background : "dark";
  // El banner que ya se ve: el recién subido, el de la vista previa o su URL pública.
  const srcDelBanner = conBanner
    ? imagenesLocales[bannerId] ?? srcDeImagenDelBloque(htmlDeLaVista, CABECERA) ?? template.images[bannerId]?.url ?? null
    : null;

  const editarImagen = (id: string, patch: { alt?: string; url?: string }) => onEditar((t) => {
    const actual = t.images[id] ?? { alt: "" };
    const next = { ...actual, ...patch };
    if (!next.url) delete next.url;
    return { ...t, images: { ...t.images, [id]: next } };
  });

  const quitarLogo = (id: string) => onEditar((t) => {
    if (t.header.kind !== "logos") return t;
    const images = { ...t.images };
    delete images[id];
    return { ...t, images, header: { ...t.header, logo_ids: t.header.logo_ids.filter((x) => x !== id) } };
  });

  const agregarLogo = (file: File) => {
    const id = idLibre(slugDeImagen(file.name), Object.keys(template.images));
    onEditar((t) => {
      const base = t.header.kind === "logos" ? t : usarLogos(t, fondo);
      if (base.header.kind !== "logos") return base;
      return {
        ...base,
        images: { ...base.images, [id]: { alt: "" } },
        header: { ...base.header, logo_ids: [...base.header.logo_ids, id] },
      };
    });
    onSubir(id, file);
  };

  const subirBanner = (file: File) => {
    if (!conBanner) onEditar((t) => usarBanner(t, bannerId));
    onSubir(bannerId, file);
  };

  // Tras importar un correo cuyo banner no traía descripción, se pide arriba de todo.
  const altArriba = conBanner && pedirAlt === bannerId;
  const datosDelBanner = (
    <span className="rec-mail-logo-datos rec-ident-banner-datos">
      <label htmlFor={`${ids}-alt`} className="rec-mail-campo-rotulo"><span>Texto alternativo del banner</span></label>
      <input
        id={`${ids}-alt`}
        className={`rec-mail-input rec-mail-input--sm${altPendiente(template.images[bannerId]?.alt) ? " is-error" : ""}`}
        placeholder="Qué muestra el banner"
        aria-invalid={altPendiente(template.images[bannerId]?.alt) || undefined}
        aria-describedby={altPendiente(template.images[bannerId]?.alt) ? `${ids}-alt-falta` : undefined}
        // Se pide tras importar un correo cuyo banner no traía descripción.
        autoFocus={pedirAlt === bannerId}
        value={template.images[bannerId]?.alt ?? ""}
        onChange={(e) => editarImagen(bannerId, { alt: e.target.value })}
        onBlur={() => { if (pedirAlt === bannerId && !altPendiente(template.images[bannerId]?.alt)) onAltListo?.(); }}
      />
      {altPendiente(template.images[bannerId]?.alt) ? (
        <span className="rec-mail-problema-linea" id={`${ids}-alt-falta`}>
          Describe el banner: es lo que lee quien no ve imágenes y lo que muestra el correo si no carga.
        </span>
      ) : null}
      <EnlaceDeLaImagen nombre="el banner" url={template.images[bannerId]?.url} plataforma={plataforma} onCambio={(url) => editarImagen(bannerId, { url })} />
    </span>
  );

  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
      <div className="rec-mail-insp-cabeza">
        <h3>Identidad del correo</h3>
        <p>El cuerpo lo arma Pulso; el banner lo entrega el cliente.</p>
      </div>
      {altArriba ? (
        // F15: al llenarlo, el recuadro pasa a resuelto (y lo dice), sin esperar a salir del campo.
        <section
          className={`rec-ident-pide-alt${altPendiente(template.images[bannerId]?.alt) ? "" : " is-resuelto"}`}
          aria-label={altPendiente(template.images[bannerId]?.alt) ? "Falta describir el banner" : "Banner descrito"}
        >
          {datosDelBanner}
          {!altPendiente(template.images[bannerId]?.alt) ? (
            <span className="rec-ident-alt-listo" role="status"><Check size={13} aria-hidden /> Descrito: lo leen quienes no ven imágenes.</span>
          ) : null}
        </section>
      ) : null}

      <section className={`rec-mail-banner${conBanner ? " is-active" : ""}`} aria-label="Banner de mailing">
        <Imagen src={imagenesLocales[bannerId] ?? template.images[bannerId]?.url} alt={template.images[bannerId]?.alt || "Banner de mailing"} banner />
        <span className="rec-mail-banner-fila">
          <b>Banner de mailing</b>
          <span className="xfk-mono">1200 × 600 px</span>
        </span>
        <span className="rec-mail-ayuda">
          {conBanner
            ? "Va arriba del correo, a todo el ancho, en lugar de los logos."
            : "Lo envía el cliente. Si lo usas, ocupa la cabecera del correo en lugar de los logos."}
        </span>
        {conBanner && !altArriba ? datosDelBanner : null}
        {bannerCheck && conBanner ? (
          <span className={`rec-mail-estado-linea is-${bannerCheck.status}`}>
            {bannerCheck.status === "ok" ? <CheckCircle2 size={13} aria-hidden /> : <AlertCircle size={13} aria-hidden />}
            {bannerCheck.detail}
          </span>
        ) : null}
        <span className="rec-mail-botones">
          <SubirArchivo etiqueta={tieneArchivo(bannerId) ? "Cambiar banner" : "Cargar banner"} disabled={ocupado} onArchivo={subirBanner} />
          <PulsoButton
            variant="secondary"
            size="sm"
            onClick={() => onEditar((t) => (conBanner ? usarLogos(t, fondo) : usarBanner(t, bannerId)))}
          >
            {conBanner ? "Volver a los logos" : "Poner el banner en lugar de los logos"}
          </PulsoButton>
        </span>
      </section>

      <section className="rec-mail-franja" aria-label="Franja de logos">
        <span className="rec-mail-col-titulo">
          <span className="xfk-over">Franja de logos</span>
          {!conBanner ? (
            <Segmented
              aria-label="Fondo de la franja"
              size="sm"
              value={fondo}
              options={[{ value: "dark", label: "Oscuro" }, { value: "light", label: "Claro" }]}
              onChange={(background) => onEditar((t) => (t.header.kind === "logos" ? { ...t, header: { ...t.header, background } } : t))}
            />
          ) : null}
        </span>
{logos.length ? (
        <FranjaDeLogos
          logoIds={logos}
          images={template.images}
          fondo={fondo}
          acento={template.theme.accent}
          imagenesLocales={imagenesLocales}
          htmlDeLaVista={conBanner ? null : htmlDeLaVista}
          enReserva={conBanner}
        />
        ) : (
          <p className="rec-mail-vacio">La cabecera es el banner. Si vuelves a la franja, aquí van los logos del estudio.</p>
        )}
        <span className="rec-mail-ayuda">Cuando no hay banner, las instituciones del estudio van en la franja.</span>
        {/* C3: sin logos (cabecera de banner) no queda una lista vacía reclamando alto. */}
        {logos.length ? <ul className="rec-mail-logos" data-qa-geometry-group="material-campo/correo/logos" data-qa-geometry-contract="equal">
          {logos.map((id) => {
            const img = template.images[id] ?? { alt: "" };
            const nombre = nombreDeImagen(template, id);
            const falta = !tieneArchivo(id) && !img.url;
            return (
              <li key={id} className="rec-mail-logo">
                <Imagen src={imagenesLocales[id]} alt={img.alt} />
                <span className="rec-mail-logo-id">
                  <b title={nombre}>{nombre}</b>
                  {falta ? <span className="rec-mail-chip is-warning">falta subirlo</span> : null}
                </span>
                <span className="rec-mail-logo-acciones">
                  <SubirArchivo
                    etiqueta={falta ? "Subir logo" : "Cambiar"}
                    ariaLabel={`${falta ? "Subir" : "Cambiar"} el logo ${nombre}`}
                    disabled={ocupado || conBanner}
                    onArchivo={(file) => onSubir(id, file)}
                  />
                  <PulsoButton
                    variant="icon"
                    size="sm"
                    aria-label={`Quitar el logo ${nombre}`}
                    title="Quitar"
                    disabled={conBanner || logos.length <= 1}
                    onClick={() => quitarLogo(id)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </PulsoButton>
                </span>
                <span className="rec-mail-logo-datos">
                  <input
                    className={`rec-mail-input rec-mail-input--sm${altPendiente(img.alt) ? " is-error" : ""}`}
                    aria-label={`Texto alternativo del logo ${nombre}`}
                    aria-invalid={altPendiente(img.alt) || undefined}
                    placeholder="Texto alternativo"
                    autoFocus={pedirAlt === id}
                    value={img.alt}
                    onChange={(e) => editarImagen(id, { alt: e.target.value })}
                  />
                  <EnlaceDeLaImagen nombre={`el logo ${nombre}`} url={img.url} plataforma={plataforma} onCambio={(url) => editarImagen(id, { url })} />
                </span>
              </li>
            );
          })}
        </ul> : null}
        {!conBanner && logos.length < MAX_LOGOS ? (
          <SubirArchivo etiqueta="Agregar un logo" disabled={ocupado} onArchivo={agregarLogo} />
        ) : null}
      </section>

      <div className="rec-mail-ajuste">
        <span>Color de acento</span>
        <span className="rec-mail-acento">
          <input
            type="color"
            aria-label="Color de acento del correo"
            value={template.theme.accent}
            onChange={(e) => onEditar((t) => ({ ...t, theme: { ...t.theme, accent: e.target.value } }))}
          />
          <span className="xfk-mono">{template.theme.accent}</span>
        </span>
      </div>

      <EstiloDelCorreo
        theme={template.theme}
        srcDelBanner={srcDelBanner}
        chequeos={chequeosDeEstilo}
        onTema={(update) => onEditar((t) => ({ ...t, theme: update(t.theme) }))}
      />

      <p className="rec-mail-nota">
        La app revisa que el banner recibido mida al menos 1200 px de ancho, tenga forma de banner y no pese de más.
        El banner de la encuesta se carga directo en SurveyMonkey y no pasa por aquí.
      </p>
    </div>
  );
}
