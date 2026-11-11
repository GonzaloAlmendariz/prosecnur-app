// Las cifras de la cabecera de una pestaña de Procesamiento (ADR 0142, plan de
// fidelidad de Validación, V0): una tira con divisores, sin píldoras. Cada cifra
// es su número, con su base cuando la tiene ("97/101"), un punto de estado si lo
// pide y, debajo, lo que cuenta. Promovida desde
// `features/analitica/tablas/CifrasDeCabecera.tsx` para que el módulo tenga una
// sola forma.
//
// Cuando el ancho no alcanza, las cifras se recogen a un menú con la regla de
// supervivencia de la cabecera del kit (`repartirChips` de TabHeading): a 1024
// quedan dos de tres, como en el prototipo. Las recogidas se leen en el menú.

import { Link, type To } from "react-router-dom";

import { Popover } from "../Popover";
import { PulsoButton } from "../PulsoButton";
import { repartirChips, type TabHeadingChip, type TabHeadingChipRank, type TabHeadingDensidad } from "../TabHeading";
import { MoreHorizontal } from "../../vendor/lucide-react";
import "./mesa-procesamiento.css";

export type TonoDeCifraDePestana = "neutral" | "ok" | "alerta";

export type CifraDePestana = {
  clave: string;
  /** La cifra ya escrita por quien la conoce (`formatoConteo`, una fecha corta). */
  valor: string;
  /** El denominador: "101" en "97/101". Una cifra con base la declara. */
  base?: string;
  /** Lo que cuenta la cifra: "reglas activas", "casos con algún hallazgo". */
  rotulo: string;
  /** Un punto junto al valor: `ok` conforme, `alerta` pendiente. */
  tono?: TonoDeCifraDePestana;
  /** A dónde lleva la cifra, si se decide en otro lugar. */
  enlace?: To;
  /** Lo que la cifra no dice a la vista y conviene saber. */
  titulo?: string;
  /** 1 = nunca se recoge; 2 por defecto; 3 = lo primero en irse al menú. */
  rango?: TabHeadingChipRank;
};

/** El número y su base van juntos en una pieza: "18/178", sin el aire que separa el punto de estado. */
function Numero({ cifra }: { cifra: CifraDePestana }) {
  return (
    <span className="pulso-cifra-pestana-numero">
      {cifra.valor}
      {cifra.base ? <span className="pulso-cifra-pestana-base">/{cifra.base}</span> : null}
    </span>
  );
}

function Cifra({ cifra }: { cifra: CifraDePestana }) {
  const tono = cifra.tono ?? "neutral";
  return (
    <div className="pulso-cifra-pestana" data-tono={tono} title={cifra.titulo}>
      <dt>{cifra.rotulo}</dt>
      <dd>
        {cifra.enlace ? <Link to={cifra.enlace}><Numero cifra={cifra} /></Link> : <Numero cifra={cifra} />}
        {tono !== "neutral" ? <span className="pulso-cifra-pestana-punto" aria-hidden="true" /> : null}
      </dd>
    </div>
  );
}

function MenuDeCifras({ cifras }: { cifras: readonly CifraDePestana[] }) {
  if (cifras.length === 0) return null;
  const nombre = cifras.length === 1 ? "1 cifra más de la pestaña" : `${cifras.length} cifras más de la pestaña`;
  return (
    <Popover
      side="bottom"
      align="end"
      maxWidth={280}
      ariaLabel="Cifras de la pestaña"
      trigger={(
        <PulsoButton variant="icon" size="sm" aria-label={nombre} title={nombre}>
          <MoreHorizontal size={16} aria-hidden />
        </PulsoButton>
      )}
    >
      <ul className="pulso-cifras-pestana-menu" aria-label="Cifras de la pestaña">
        {cifras.map((c) => (
          <li key={c.clave} data-tono={c.tono ?? "neutral"}>
            <b><Numero cifra={c} /></b>
            <span>{c.rotulo}</span>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/** Reparte las cifras entre la tira y el menú, con la misma regla que los chips de TabHeading. */
export function repartirCifras(
  cifras: readonly CifraDePestana[],
  densidad: TabHeadingDensidad,
): { visibles: CifraDePestana[]; recogidas: CifraDePestana[] } {
  const comoChips: TabHeadingChip[] = cifras.map((c) => ({ id: c.clave, label: c.rotulo, valor: c.valor, base: c.base, rank: c.rango }));
  const { visibles, recogidos } = repartirChips(comoChips, densidad);
  const porClave = new Map(cifras.map((c) => [c.clave, c]));
  const de = (lista: TabHeadingChip[]) => lista.map((chip) => porClave.get(chip.id)).filter((c): c is CifraDePestana => c !== undefined);
  return { visibles: de(visibles), recogidas: de(recogidos) };
}

export function CifrasDePestana({ cifras, ariaLabel, densidad = "normal", pendientes }: {
  cifras: readonly CifraDePestana[];
  /** Nombre del grupo para el lector de pantalla: "Cifras de Hallazgos". */
  ariaLabel: string;
  densidad?: TabHeadingDensidad;
  /**
   * El hueco declarado: qué cifras del diseño faltan y por qué (un pedido de
   * motor, una decisión). No se pinta: queda en el marcado para el QA y la
   * tabla de fidelidad, porque un vacío sin causa no se distingue de un olvido.
   */
  pendientes?: string;
}) {
  if (cifras.length === 0) {
    return pendientes ? <div className="pulso-cifras-pestana-zona" data-cifras-pendientes={pendientes} hidden /> : null;
  }
  const { visibles, recogidas } = repartirCifras(cifras, densidad);
  return (
    <div className="pulso-cifras-pestana-zona" data-cifras-pendientes={pendientes}>
      {visibles.length > 0 ? (
        <dl
          className="pulso-cifras-pestana"
          aria-label={ariaLabel}
          // C1: cada cifra mide lo que su texto necesita; no son marcos pares.
          data-qa-geometry-group="procesamiento/cifras-de-pestana"
          data-qa-geometry-contract="intrinsic"
        >
          {visibles.map((c) => <Cifra key={c.clave} cifra={c} />)}
        </dl>
      ) : null}
      <MenuDeCifras cifras={recogidas} />
    </div>
  );
}
