import { Plus } from "lucide-react";
import { EstadoChip } from "../../../../../components/EstadoChip";
import { PesasReferenciales } from "../../../core/PesasReferenciales";
import type { VariableDeControl } from "./composicionModelo";

const UNA_DECIMAL = (valor: number) => valor.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function pp(valor: number | null) {
  if (valor == null) return "—";
  return `${valor > 0 ? "+" : ""}${UNA_DECIMAL(valor)} pp`;
}

/**
 * Composición de una referencial —variable de control sin meta o cuota
 * declarada referencial—: su cabecera de acreditación y, dentro, las pesas
 * comunes del núcleo (ADR 0126), con el % del universo escrito al lado.
 */
export function PesasDeComposicion({ variable, onDefinirCuota }: { variable: VariableDeControl; onDefinirCuota: () => void }) {
  return (
    <section className="acr-av-panel acr-ps-tabla acr-pc-detalle" aria-label={`Composición de ${variable.actor} por ${variable.variable}`}>
      <header className="acr-av-panel-cabecera">
        <h3>
          <span className="acr-pc-titulo">
            <small className="acr-av-antetitulo">{variable.actor}</small>
            <span>{variable.variable}</span>
          </span>
          <EstadoChip label="Referencial" tone="neutral" />
          <span className="acr-av-tenue" title="Mayor diferencia entre el % de las efectivas y el % del universo">{`Máx. ${pp(variable.maxDelta)}`}</span>
        </h3>
        <button type="button" className="acr-av-boton" onClick={onDefinirCuota}><Plus size={14} aria-hidden="true" /> Definir cuota en Modelo</button>
      </header>
      <div className="acr-pr-cola-marco acr-pc-pesas" data-qa-geometry-capacity="owned">
        {/* La gramática común de las referenciales (ADR 0126): la misma pieza en
            telefónico y territorial, con el % del universo escrito al lado. */}
        <PesasReferenciales
          titulo={`% del universo frente a % de las efectivas por ${variable.variable}`}
          referencia="universo"
          grupo="acreditacion-referenciales-pesas"
          filas={variable.filas.map((fila) => ({
            clave: fila.categoria,
            nombre: fila.categoria,
            n: fila.efectivas,
            obtenida: fila.pctEfectivas,
            esperada: fila.pctBase,
            celdaVacia: fila.universo > 0 && fila.efectivas <= 0,
          }))}
        />
      </div>
    </section>
  );
}
