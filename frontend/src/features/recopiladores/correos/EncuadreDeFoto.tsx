// Encuadre de la foto de un Destacado (GOAL editor profesional, L7): la
// proporción, el centro y el acercamiento. Sobre la miniatura se ve, oscurecido,
// lo que el recorte deja fuera; un clic (o las flechas) mueve el centro. El
// render recorta el archivo con los mismos números (collection_mail_recorte.R).

import { useState, type KeyboardEvent, type MouseEvent } from "react";

import type { MailBlock, MailFeatureBlock } from "../../../api/materialMail";
import { AjusteDeBloque } from "./AjusteDeBloque";
import { AJUSTE_DE_PROPORCION, conRecorte, recorteDe, rectDelRecorte } from "./modeloRecorte";
import "./correosRecorte.css";

type Props = {
  block: MailFeatureBlock;
  vista: string;
  onEditarBloque: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
};

const PASO = 0.05;

export function EncuadreDeFoto({ block, vista, onEditarBloque }: Props) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const recorte = recorteDe(block);
  const rect = natural ? rectDelRecorte(natural, recorte) : null;
  const cambiar = (cambio: Parameters<typeof conRecorte>[1], grupo?: string) => onEditarBloque((b) => conRecorte(b, cambio), grupo);

  const alClic = (e: MouseEvent<HTMLButtonElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    if (!caja.width || !caja.height) return;
    cambiar({ x: (e.clientX - caja.left) / caja.width, y: (e.clientY - caja.top) / caja.height });
  };
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const d = { ArrowLeft: [-PASO, 0], ArrowRight: [PASO, 0], ArrowUp: [0, -PASO], ArrowDown: [0, PASO] }[e.key];
    if (!d) return;
    e.preventDefault();
    cambiar({ x: recorte.x + d[0], y: recorte.y + d[1] }, `${block.block_id}.crop`);
  };

  return (
    <div className="rec-recorte">
      <AjusteDeBloque
        ajuste={AJUSTE_DE_PROPORCION}
        valor={recorte.ratio}
        onCambio={(ratio) => cambiar({ ratio: ratio as typeof recorte.ratio })}
      />
      {recorte.ratio === "original" ? null : (
        <>
          <button
            type="button"
            className="rec-recorte-lienzo"
            aria-label="Encuadre: haz clic donde va el centro; las flechas lo mueven"
            onClick={alClic}
            onKeyDown={alTeclear}
          >
            <img src={vista} alt="" onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} />
            {rect && natural ? (
              <span
                className="rec-recorte-marco"
                aria-hidden
                style={{
                  left: `${(rect.x0 / natural.width) * 100}%`,
                  top: `${(rect.y0 / natural.height) * 100}%`,
                  width: `${(rect.w / natural.width) * 100}%`,
                  height: `${(rect.h / natural.height) * 100}%`,
                }}
              />
            ) : null}
          </button>
          <label className="rec-recorte-zoom">
            <span>Acercar</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={recorte.zoom}
              onChange={(e) => cambiar({ zoom: Number(e.target.value) }, `${block.block_id}.crop.zoom`)}
            />
            <span className="xfk-mono">{Math.round(recorte.zoom * 100)} %</span>
          </label>
          {rect ? <span className="rec-capa-img-ayuda">Sale de {rect.w} × {rect.h} px del archivo.</span> : null}
        </>
      )}
    </div>
  );
}
