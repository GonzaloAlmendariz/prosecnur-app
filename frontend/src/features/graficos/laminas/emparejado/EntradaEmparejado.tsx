// La entrada a "Revisar emparejado" en la tarjeta del contraste entre públicos (Datos; ADR 0135 §7): cuántas preguntas
// están en la matriz, cuántas confirmadas en la lámina, cuántas por confirmar y cuántas sin par, y el botón que abre el
// panel (`?panel=emparejado`). El panel se monta aquí porque escribe en el payload de este contraste.

import { useRef } from "react";
import { Link2 } from "../../../../vendor/lucide-react";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import type { TemaPublicos } from "../../multiapiladas/temasPublicos";
import { argsATemas, temasAArgs } from "../../temasEquivalentes/temasEquivalentesModel";
import { useVariables } from "../../useVariables";
import { AyudaGlobo } from "../AyudaGlobo";
import { useEmparejadoUi } from "./emparejadoStore";
import { basesDelContraste, contarEstados, filasEmparejado, resumenEmparejado, variableDe } from "./modeloEmparejado";
import { PANEL_EMPAREJADO } from "./panelEmparejado";
import { RevisarEmparejado } from "./RevisarEmparejado";
import { useEmparejado } from "./useEmparejado";
import "./emparejado.css";
import { PulsoButton } from "../../../../components/PulsoButton";

type Props = {
  args: Readonly<Record<string, unknown>>;
  scope: "active" | "consolidated";
  onCambio: (patch: Record<string, unknown>) => void;
};

const AYUDA = "En la matriz: lo declara Carga, Equivalencias. Una sugerencia por texto entra a la lámina sólo al confirmarla.";

export function EntradaEmparejado({ args, scope, onCambio }: Props) {
  const { sources } = useVariables();
  const panel = usePanelDireccionable(PANEL_EMPAREJADO);
  const boton = useRef<HTMLButtonElement>(null);
  const descartadas = useEmparejadoUi((s) => s.descartadas);
  const basesEstudio = sources.map((s) => s.name);
  const bases = basesDelContraste(args, basesEstudio);
  const remoto = useEmparejado(bases, scope);
  const temas = argsATemas(args);
  const etiquetaDe = (ref: string) => {
    const i = ref.indexOf("$");
    return i < 0 ? undefined : variableDe(sources, ref.slice(0, i), ref.slice(i + 1))?.label;
  };
  const filas = remoto.fase === "lista" ? filasEmparejado(remoto.datos, temas, bases, new Set(Object.keys(descartadas)), etiquetaDe) : [];
  const conteo = contarEstados(filas);
  const escribir = (next: TemaPublicos[]) => onCambio({ ...temasAArgs(next), cruce: null, grupos: null });

  const texto = basesEstudio.length < 2 ? "El estudio tiene un solo público"
    : bases.length !== 2 ? "Elige los dos públicos que se comparan"
      : remoto.fase === "error" ? "No se pudo leer el emparejado"
        : remoto.fase === "lista" ? resumenEmparejado(conteo)
          : "Leyendo el emparejado";

  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-emp-entrada" data-campo="emparejado"
      data-qa-geometry-group="graficos/f6-emparejado-entrada" data-qa-geometry-contract="intrinsic">
      <span className="pulso-f6-dato-rotulo">
        Emparejado entre públicos
        <AyudaGlobo rotulo="Emparejado entre públicos" detalle={AYUDA} />
      </span>
      <div className="pulso-f6-emp-entrada-fila" data-qa-geometry-member>
        <span className="pulso-f6-dato-ayuda" role="status">{texto}</span>
        <PulsoButton variant="secondary" size="sm"
          ref={boton}
          disabled={bases.length !== 2}
          onClick={() => { useEmparejadoUi.getState().preparar(); panel.abrir(); }}
        >
          <Link2 size={14} aria-hidden="true" />
          Revisar emparejado
        </PulsoButton>
      </div>
      <RevisarEmparejado
        bases={bases}
        basesEstudio={basesEstudio.length}
        remoto={remoto}
        recargar={remoto.recargar}
        filas={filas}
        conteo={conteo}
        temas={temas}
        fuentes={sources}
        onTemas={escribir}
        retorno={boton}
      />
    </div>
  );
}
