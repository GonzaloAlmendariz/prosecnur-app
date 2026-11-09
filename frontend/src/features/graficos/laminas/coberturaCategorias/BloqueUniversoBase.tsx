// El universo de una base (ADR 0140): «Conteos / Porcentajes», el total (en conteos) y una fila por categoría con su n
// de la muestra (sólo lectura) y el universo tecleado. El aviso de la suma va en vivo y no bloquea. Un universo viejo
// (otra variable, otras categorías) se muestra tal cual con su aviso y «Rellenar»; nunca se borra en silencio.

import { useId } from "react";
import type { CategoriasDeBase } from "../../../../api/graficosCoberturaCategorias";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import { nombrePublico } from "../gruposPadron/modeloPadron";
import {
  avisoDeBase, baseAGuardar, filasDeBase, rellenarBase, sumaDeBase, universoViejo,
  type FilaUniverso, type ModoUniverso, type UniversoBase,
} from "./modeloUniversoCategorias";
import { NumeroUniverso } from "./NumeroUniverso";

type Props = {
  base: string;
  variableLamina: string;
  guardado: UniversoBase | undefined;
  deLaBase: CategoriasDeBase | undefined;
  onCambio: (bloque: UniversoBase) => void;
};

const MODOS = [
  { clave: "conteos", rotulo: "Conteos" },
  { clave: "porcentajes", rotulo: "Porcentajes" },
] as const;

export function BloqueUniversoBase({ base, variableLamina, guardado, deLaBase, onCambio }: Props) {
  const id = useId();
  const publico = nombrePublico(base);
  const viejo = universoViejo(guardado, variableLamina, deLaBase);
  const filas = filasDeBase(guardado, deLaBase, viejo);
  const modo: ModoUniverso = guardado?.modo ?? "conteos";
  const total = guardado?.total ?? null;
  // Con el universo viejo se conserva la variable con que se tecleó; si no, la que se contó.
  const variable = viejo ? guardado?.variable ?? null : deLaBase?.variable_usada || guardado?.variable || null;
  const escribir = (f: readonly FilaUniverso[], m: ModoUniverso, t: number | null) => onCambio(baseAGuardar(f, m, t, variable));
  const aviso = avisoDeBase(filas, modo, total);
  const suma = sumaDeBase(filas);
  const unidad = modo === "porcentajes" ? "%" : "casos";
  const idTitulo = `${id}-titulo`;
  const columnas: PulsoTableColumna<FilaUniverso>[] = [
    { id: "categoria", encabezado: "Categoría", ancho: 150, celda: (f) => f.etiqueta, valor: (f) => f.etiqueta },
    { id: "n", encabezado: "n", ancho: 52, tipo: "cifra", celda: (f) => (f.n === null ? "—" : formatoConteo(f.n)) },
    {
      id: "universo", encabezado: `Universo (${unidad})`, ancho: 112, tipo: "cifra",
      celda: (f) => (
        <NumeroUniverso valor={f.valor} ariaLabel={`Universo de ${f.etiqueta} en ${publico}`} placeholder="—"
          onCambio={(v) => escribir(filas.map((x) => (x.codigo === f.codigo ? { ...x, valor: v } : x)), modo, total)} />
      ),
    },
  ];

  return (
    <Panel variant="subtle" noPadding className="pulso-f6-universo-base" data-qa-geometry-member aria-labelledby={idTitulo}>
      <div className="pulso-f6-universo-cabeza">
        <span className="pulso-f6-universo-publico" id={idTitulo}>{publico}</span>
        {deLaBase && deLaBase.n_validos !== null && (
          <span className="pulso-f6-dato-ayuda is-nota">{formatoConteo(deLaBase.n_validos)} válidos</span>
        )}
      </div>
      <RadioSegmentado etiqueta={`Universo de ${publico} en`} ancho valor={modo} opciones={MODOS}
        onCambiar={(m) => escribir(filas, m, total)} />
      {modo === "conteos" && (
        <div className="pulso-f6-padron">
          <label className="pulso-f6-padron-rotulo" htmlFor={`${id}-total`}>Total del universo</label>
          <NumeroUniverso id={`${id}-total`} valor={total} ariaLabel={`Total del universo de ${publico}`} placeholder="Sin total"
            onCambio={(t) => escribir(filas, modo, t)} />
        </div>
      )}
      {viejo && deLaBase && (
        <div className="pulso-f6-universo-viejo" role="note">
          <span className="pulso-f6-dato-ayuda is-aviso">
            Universo viejo: se tecleó para "{guardado?.variable ?? "otra variable"}" y la lámina usa "{deLaBase.variable_usada || variableLamina}".
          </span>
          <PulsoButton variant="secondary" size="sm" onClick={() => onCambio(rellenarBase(deLaBase, modo))}>
            Rellenar con las categorías actuales
          </PulsoButton>
        </div>
      )}
      <div className="pulso-f6-universo-tabla" data-qa-scroll-owner="universo-categorias">
        <PulsoTable columnas={columnas} filas={filas} idDeFila={(f) => f.codigo} ariaLabel={`Universo de ${publico} por categoría`}
          densidad="compacta" altoMaximo={320}
          vacio={deLaBase ? "La variable no tiene categorías en esta base." : "Sin categorías leídas."} />
      </div>
      {filas.length > 0 && (
        <p className="pulso-f6-dato-ayuda is-nota pulso-f6-universo-suma">
          Suma: {suma === null ? "sin cifras" : modo === "porcentajes" ? `${formatoDecimal(suma, 1)} %` : `${formatoDecimal(suma, 2)} casos`}
          {deLaBase && deLaBase.n_validos !== null ? `, n = ${formatoConteo(deLaBase.n_validos)}` : ""}
        </p>
      )}
      {filas.some((f) => f.n === null) && !viejo && deLaBase && (
        <p className="pulso-f6-dato-ayuda is-nota" role="note">Las filas sin n no están en la variable: la lámina las avisa.</p>
      )}
      <p className="pulso-f6-dato-ayuda is-aviso pulso-f6-universo-aviso" role="status" aria-live="polite">{aviso ?? ""}</p>
    </Panel>
  );
}
