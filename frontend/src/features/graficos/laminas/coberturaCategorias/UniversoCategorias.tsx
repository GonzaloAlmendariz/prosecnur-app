// «Universo» de la cobertura por categorías de una variable (ADR 0140): un bloque por base con la tabla del universo,
// prellenada con las categorías de la variable en esa base (también las de n = 0). Se guarda lo tecleado, con la
// variable que se contó. Un universo de una base que ya no está en la lámina se conserva y se dice.

import { useId, type ReactNode } from "react";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { AyudaGlobo } from "../AyudaGlobo";
import { basesDeCobertura, nombrePublico } from "../gruposPadron/modeloPadron";
import { BloqueUniversoBase } from "./BloqueUniversoBase";
import { conBase, leerUniverso } from "./modeloUniversoCategorias";
import { useCategoriasCobertura } from "./useCategoriasCobertura";
import "./universoCategorias.css";

type Props = {
  rotulo: string;
  ayuda: string;
  args: Readonly<Record<string, unknown>>;
  valor: unknown;
  scope: "active" | "consolidated";
  onCambio: (v: unknown) => void;
};

export function UniversoCategorias({ rotulo, ayuda, args, valor, scope, onCambio }: Props) {
  const id = useId();
  const variable = typeof args.variable === "string" ? args.variable.trim() : "";
  const bases = basesDeCobertura(args);
  const estado = useCategoriasCobertura({ variable, bases, filtros: args.filtros, scope });
  const universo = leerUniverso(valor);
  const deLaLamina = estado.fase === "lista" ? estado.datos.bases : [];
  const enLamina = new Set(deLaLamina.map((b) => b.base));
  const fuera = Object.keys(universo).filter((b) => estado.fase === "lista" && !enLamina.has(b));

  let cuerpo: ReactNode;
  if (!variable) {
    cuerpo = <p className="pulso-f6-dato-ayuda" role="note">Elige primero la variable: de ella salen las categorías.</p>;
  } else if (estado.fase === "cargando" || estado.fase === "inactivo") {
    cuerpo = <CargaDeBloque label="Leyendo las categorías" />;
  } else if (estado.fase === "error") {
    cuerpo = <p className="pulso-f6-dato-ayuda is-aviso" role="alert">{estado.mensaje}</p>;
  } else {
    cuerpo = deLaLamina.map((b) => (
      <BloqueUniversoBase key={b.base} base={b.base} variableLamina={variable} guardado={universo[b.base]} deLaBase={b}
        onCambio={(bloque) => onCambio(conBase(universo, b.base, bloque))} />
    ));
  }

  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-universo" data-campo="universo_categorias"
      data-qa-geometry-group="graficos/f6-universo-categorias" data-qa-geometry-contract="intrinsic" aria-labelledby={`${id}-rotulo`} role="group">
      <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>
        {rotulo}
        {ayuda && <AyudaGlobo id={`${id}-ayuda`} rotulo={rotulo} detalle={ayuda} />}
      </span>
      {cuerpo}
      {fuera.length > 0 && (
        <p className="pulso-f6-dato-ayuda is-nota" role="note">
          El universo de {fuera.map(nombrePublico).join(", ")} se conserva, pero no se dibuja: no está entre las bases de la lámina.
        </p>
      )}
    </div>
  );
}
