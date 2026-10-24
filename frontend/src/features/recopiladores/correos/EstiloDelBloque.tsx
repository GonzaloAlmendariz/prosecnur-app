// «Estilo» del bloque en el inspector (GOAL editor profesional, L4): fondo de la
// paleta del correo o libre, borde, esquinas, espaciado y color del texto. Es
// la maqueta aprobada del panel Estilo; los valores son los de collection_mail_box.R.
//
// El fondo se elige entre la paleta (que sigue al acento) y los colores de la
// marca (banner o logo, L3); «Otro» abre el selector y el cuentagotas. Debajo,
// una línea dice si el texto se lee sobre ese fondo.

import { useId } from "react";

import type { MailBlock, MailTheme } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertCircle, CheckCircle2, Paintbrush } from "../../../vendor/lucide-react";
import { AjusteDeBloque } from "./AjusteDeBloque";
import { Cuentagotas } from "./Cuentagotas";
import {
  AJUSTES_DE_CAJA,
  CAJA_INICIAL,
  cajaDe,
  cajaEfectiva,
  conCaja,
  fondoDeCaja,
  lecturaDeCaja,
  hexDeCaja,
  paletaDelCorreo,
} from "./modeloCaja";
import { mismoColor } from "./modeloEstilo";
import "./correosCaja.css";

export type VistaDelBloque = "contenido" | "estilo";

/** «Contenido | Estilo» arriba del inspector del bloque: dos vistas del mismo bloque, como pestañas. */
export function SelectorDeVista({ vista, onVista }: { vista: VistaDelBloque; onVista: (v: VistaDelBloque) => void }) {
  return (
    <div className="rec-caja-vistas" role="tablist" aria-label="Qué editar del bloque">
      {(["contenido", "estilo"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={vista === v}
          className={`rec-caja-vista${vista === v ? " is-on" : ""}`}
          onClick={() => onVista(v)}
        >
          {v === "contenido" ? "Contenido" : "Estilo"}
        </button>
      ))}
    </div>
  );
}

type Props = {
  block: MailBlock;
  theme: MailTheme;
  /** Los colores que más pesan en el banner o en el logo (vacío si no hay o no se leen). */
  deLaMarca?: readonly string[];
  onEditar: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
};

export function EstiloDelBloque({ block, theme, deLaMarca = [], onEditar }: Props) {
  const id = useId();
  const box = cajaDe(block);
  if (!box) {
    return (
      <div className="rec-caja rec-caja--sin">
        <p className="rec-caja-sin">Usa el estilo del correo.</p>
        <PulsoButton variant="secondary" size="sm" onClick={() => onEditar((b) => conCaja(b, CAJA_INICIAL))}>
          <Paintbrush size={14} aria-hidden /> Darle estilo propio
        </PulsoButton>
      </div>
    );
  }
  const efectiva = cajaEfectiva(box);
  const paleta = paletaDelCorreo(theme, deLaMarca);
  const fondo = fondoDeCaja(box, theme);
  const libre = !paleta.some((c) => c.valor === efectiva.bg);
  const lectura = lecturaDeCaja(box, theme);
  const cambiar = (cambio: Parameters<typeof conCaja>[1], grupo?: string) => onEditar((b) => conCaja(b, cambio), grupo);

  return (
    <div className="rec-caja">
      <div className="rec-mail-ajuste rec-caja-fondo">
        <span id={`${id}-fondo`} className="rec-ajuste-rotulo">Fondo</span>
        <span role="radiogroup" aria-labelledby={`${id}-fondo`} className="rec-caja-muestras">
          {paleta.map((c) => {
            const on = c.valor === efectiva.bg;
            return (
              <button
                key={c.valor}
                type="button"
                role="radio"
                aria-checked={on}
                title={`${c.rotulo} · ${c.hex}`}
                className={`rec-caja-muestra${on ? " is-on" : ""}`}
                onClick={() => cambiar({ bg: c.valor })}
              >
                {/* El color real del correo: viene de su paleta, no es un token de la app. */}
                <span className="rec-caja-punto" style={{ background: c.hex }} aria-hidden />
                <span className="rec-caja-muestra-rotulo">{c.origen === "marca" ? "Marca" : c.rotulo}</span>
              </button>
            );
          })}
          <span className={`rec-caja-muestra rec-caja-otro${libre ? " is-on" : ""}`}>
            <input
              type="color"
              aria-label="Otro color de fondo"
              value={fondo}
              onChange={(e) => cambiar({ bg: hexDeCaja(e.target.value) }, `${block.block_id}.box.bg`)}
            />
            <span className="rec-caja-muestra-rotulo">Otro</span>
          </span>
        </span>
        <span className="rec-caja-pie">
          <span className="xfk-mono">{fondo}</span>
          <Cuentagotas nombre="el fondo del bloque" onChange={(c) => cambiar({ bg: hexDeCaja(c) })} />
          {efectiva.bg === "tinte" || efectiva.bg === "acento" ? <span>Sigue al acento del correo</span> : null}
        </span>
      </div>

      {AJUSTES_DE_CAJA.map((ajuste) => (
        <AjusteDeBloque
          key={ajuste.clave}
          ajuste={ajuste}
          valor={efectiva[ajuste.clave]}
          acento={theme.accent}
          onCambio={(valor) => {
            if (valor === efectiva[ajuste.clave] && ajuste.clave in box) return;
            cambiar({ [ajuste.clave]: valor });
          }}
        />
      ))}

      <span
        className={`rec-mail-estado-linea is-${lectura.seLee ? "ok" : "warning"}`}
        role="status"
        title={lectura.razon !== null ? `Contraste ${lectura.razon.toFixed(1)}:1` : undefined}
      >
        {lectura.seLee ? <CheckCircle2 size={13} aria-hidden /> : <AlertCircle size={13} aria-hidden />}
        {lectura.seLee
          ? `Se lee bien: ${lectura.razon?.toFixed(1)} : 1`
          : "Casi no se lee: elige otro color de texto o de fondo"}
      </span>
      {mismoColor(fondo, hexDeCaja(theme.accent)) && block.type === "button" ? (
        <span className="rec-caja-nota">El botón invierte sus colores para distinguirse del fondo.</span>
      ) : null}

      <button type="button" className="rec-mail-link rec-caja-quitar" onClick={() => cambiar(null)}>
        Quitar el estilo propio
      </button>
    </div>
  );
}
