import { useId } from "react";

import type { MailCheck, MailTheme, MailWidth } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Undo2 } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { LineaDeLectura, Muestras } from "./EstiloDelCorreo";
import {
  ANCHO_RECOMENDADO,
  ANCHOS,
  anchoDe,
  conAncho,
  conFondo,
  fondoDeLaPagina,
  lecturaDelPie,
  muestrasDeFondo,
  nombreDelFondo,
} from "./modeloAjustes";
import { estiloDe, focoDelEstilo, lecturaConRevision, lecturaDelFondo, type ChequeoDeEstilo } from "./modeloEstilo";
import { useColoresDelBanner } from "./useColoresDelBanner";

import "./correosAjustes.css";

type Props = {
  theme: MailTheme;
  /** La imagen del banner que ya se ve; `null` sin banner. */
  srcDelBanner: string | null;
  /** Chequeos `campana_*` de la revisión: cuando llegan, mandan sobre el cálculo local. */
  chequeos: Partial<Record<ChequeoDeEstilo, MailCheck>>;
  onTema: (update: (theme: MailTheme) => MailTheme) => void;
};

type ValorDeAncho = `${MailWidth}`;

const OPCIONES_DE_ANCHO = ANCHOS.map((a) => ({
  value: String(a) as ValorDeAncho,
  label: a === ANCHO_RECOMENDADO ? `${a} px (recomendado)` : `${a} px`,
}));

/**
 * «Ajustes del correo» (E1p), dentro de Identidad: el ancho en computadora y
 * el fondo de la página, que vale en los dos estilos. En Campaña este es el
 * único «Fondo de la página» (antes vivía en Estilo).
 */
export function AjustesDelCorreo({ theme, srcDelBanner, chequeos, onTema }: Props) {
  const id = useId();
  const campana = estiloDe(theme).estilo === "campana";
  const banner = useColoresDelBanner(srcDelBanner);
  const delBanner = banner.estado === "listo" ? banner.colores : null;
  const fondo = fondoDeLaPagina(theme);
  const muestras = muestrasDeFondo(theme, delBanner);
  const ancho = anchoDe(theme);

  const lecturaTexto = campana ? lecturaConRevision(lecturaDelFondo(fondo.color), chequeos.campana_text_contrast) : null;
  // Sobrio con el gris de siempre: el pie es el de siempre y la revisión no lo mide.
  const lecturaPie = campana || fondo.declarado ? lecturaDelPie(fondo.color, chequeos.campana_footer_contrast) : null;

  return (
    // C1: dos ajustes independientes, cada uno con lo suyo; no son pares.
    <section
      className="rec-ajustes"
      aria-labelledby={`${id}-titulo`}
      data-qa-geometry-group="material-campo/correo/ajustes"
      data-qa-geometry-contract="intrinsic"
    >
      <span className="rec-mail-col-titulo">
        <span className="xfk-over" id={`${id}-titulo`}>Ajustes del correo</span>
      </span>

      <div className="rec-estilo-campo">
        <span className="rec-estilo-rotulo">Ancho en computadora</span>
        <Segmented
          aria-label="Ancho en computadora"
          size="sm"
          value={String(ancho) as ValorDeAncho}
          options={OPCIONES_DE_ANCHO}
          onChange={(v) => onTema((t) => conAncho(t, Number(v) as MailWidth))}
        />
        <span className="rec-mail-ayuda">En el teléfono el correo ocupa toda la pantalla y los márgenes bajan a 20 px.</span>
      </div>

      <div className="rec-estilo-campo">
        <span className="rec-ajustes-fila">
          <span className="rec-estilo-rotulo">Fondo de la página</span>
          {!campana && fondo.declarado ? (
            <PulsoButton variant="ghost" size="sm" onClick={() => onTema((t) => conFondo(t, null))}>
              <Undo2 size={13} aria-hidden /> Volver al gris
            </PulsoButton>
          ) : null}
        </span>
        <Muestras
          foco={focoDelEstilo("page_bg")}
          nombreDelColor="el fondo de la página"
          rotulo="Fondo de la página"
          colores={muestras}
          elegido={fondo.color}
          nombreDe={(c) => nombreDelFondo(c, theme)}
          onElegir={(c) => onTema((t) => conFondo(t, c))}
        />
        {lecturaTexto ? <LineaDeLectura lectura={lecturaTexto} /> : null}
        {lecturaPie ? <LineaDeLectura lectura={lecturaPie} /> : null}
        {!campana && banner.estado === "ilegible" ? <span className="rec-mail-ayuda">No se pudieron leer los colores del banner: queda la cabecera u otro color.</span> : null}
      </div>
    </section>
  );
}
