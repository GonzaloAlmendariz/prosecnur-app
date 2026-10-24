// Las entradas de Pasos, Beneficios y Preguntas en el inspector (GOAL editor
// profesional, L6): una tarjeta por entrada con su título, su texto y, en un
// beneficio, su ícono. Se agregan, quitan y ordenan dentro del rango de la
// sección (modeloSecciones.ts).

import { useState } from "react";

import { RANGO_DE_ENTRADAS, type MailBlock, type MailProblem, type TipoConEntradas } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "../../../vendor/lucide-react";
import { CampoConCampos } from "./CampoConCampos";
import { conEntrada, conEntradaNueva, entradasDe, moverEntrada, puedeAgregar, puedeQuitar, ROTULOS_DE_ENTRADA, sinEntrada } from "./modeloSecciones";
import { ROTULO_DE_ICONO } from "./piezasGraficas";
import type { RotulosDeCampos } from "./rotulosDeCampos";
import { DIBUJO_DE_ICONO, SelectorDeIcono } from "./SelectorDeIcono";
import "./correosSecciones.css";

type Props = {
  block: MailBlock & { type: TipoConEntradas };
  opciones: RotulosDeCampos;
  problemas: readonly MailProblem[];
  onEditarBloque: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
  onIrAPersonas?: () => void;
};

/** Los problemas de la entrada `i` (el contrato numera desde 1: `entries[2].title`). */
function problemasDeEntrada(problemas: readonly MailProblem[], i: number, prop: "title" | "text"): MailProblem[] {
  return problemas.filter((p) => p.path.endsWith(`.entries[${i + 1}].${prop}`));
}

export function EntradasDeSeccion({ block, opciones, problemas, onEditarBloque, onIrAPersonas }: Props) {
  const [iconoAbierto, setIconoAbierto] = useState<number | null>(null);
  const rotulos = ROTULOS_DE_ENTRADA[block.type];
  const entradas = entradasDe(block);
  const [minimo, maximo] = RANGO_DE_ENTRADAS[block.type];
  const delConjunto = problemas.filter((p) => /\.entries$/.test(p.path));
  const conIcono = block.type === "benefits";

  return (
    <section className="rec-sec-entradas" aria-label={`${rotulos.una}s de la sección`}>
      {entradas.map((entrada, i) => {
        const Dibujo = entrada.icon ? DIBUJO_DE_ICONO[entrada.icon] : null;
        return (
          <div key={i} className="rec-pieza-lado rec-sec-entrada">
            <span className="rec-sec-entrada-cabeza">
              <span className="rec-pieza-lado-titulo">{rotulos.una} {i + 1}</span>
              <span className="rec-sec-entrada-acciones">
                <button type="button" className="rec-sec-boton" aria-label={`Subir ${rotulos.una.toLowerCase()} ${i + 1}`} disabled={i === 0}
                  onClick={() => onEditarBloque((b) => moverEntrada(b, i, -1))}>
                  <ArrowUp size={13} aria-hidden />
                </button>
                <button type="button" className="rec-sec-boton" aria-label={`Bajar ${rotulos.una.toLowerCase()} ${i + 1}`} disabled={i === entradas.length - 1}
                  onClick={() => onEditarBloque((b) => moverEntrada(b, i, 1))}>
                  <ArrowDown size={13} aria-hidden />
                </button>
                <button type="button" className="rec-sec-boton" aria-label={`Quitar ${rotulos.una.toLowerCase()} ${i + 1}`} disabled={!puedeQuitar(block)}
                  onClick={() => onEditarBloque((b) => sinEntrada(b, i))}>
                  <Trash2 size={13} aria-hidden />
                </button>
              </span>
            </span>
            {conIcono ? (
              <>
                <button type="button" className="rec-sec-icono" aria-expanded={iconoAbierto === i}
                  onClick={() => setIconoAbierto(iconoAbierto === i ? null : i)}>
                  {Dibujo ? <Dibujo size={15} aria-hidden /> : null}
                  <span>{entrada.icon ? ROTULO_DE_ICONO[entrada.icon] : "Sin ícono"}</span>
                  <span className="rec-sec-icono-accion">{iconoAbierto === i ? "Listo" : "Cambiar"}</span>
                </button>
                {iconoAbierto === i ? (
                  <SelectorDeIcono valor={entrada.icon} onElegir={(icon) => onEditarBloque((b) => conEntrada(b, i, { icon }))} />
                ) : null}
              </>
            ) : null}
            <CampoConCampos
              label={rotulos.titulo}
              valor={entrada.title}
              opciones={opciones}
              problemas={problemasDeEntrada(problemas, i, "title")}
              onCambio={(title) => onEditarBloque((b) => conEntrada(b, i, { title }), `${block.block_id}.entries.${i}.title`)}
              onIrAPersonas={onIrAPersonas}
            />
            <CampoConCampos
              label={rotulos.texto}
              valor={entrada.text ?? ""}
              opciones={opciones}
              enlaces
              multilinea
              filas={2}
              problemas={problemasDeEntrada(problemas, i, "text")}
              onCambio={(text) => onEditarBloque((b) => conEntrada(b, i, { text }), `${block.block_id}.entries.${i}.text`)}
              onIrAPersonas={onIrAPersonas}
            />
          </div>
        );
      })}
      {delConjunto.length ? (
        <ul className="rec-mail-problemas">{delConjunto.map((p, i) => <li key={i}>{p.detail}</li>)}</ul>
      ) : null}
      <span className="rec-sec-agregar">
        <PulsoButton variant="secondary" size="sm" disabled={!puedeAgregar(block)} onClick={() => onEditarBloque(conEntradaNueva)}>
          <Plus size={14} aria-hidden /> Agregar {rotulos.una.toLowerCase()}
        </PulsoButton>
        <span className="rec-capa-img-ayuda">De {minimo} a {maximo}.</span>
      </span>
    </section>
  );
}
