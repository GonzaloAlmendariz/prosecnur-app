// Una lámina propuesta del mazo «Resumen ejecutivo» (maqueta graficos-sintesis, Mazo): su lugar, los públicos que lee, el
// nombre de la lámina, la miniatura del gráfico y la regla con su conteo en vivo desde el motor (POST
// /api/graficos/resumenes/regla, la misma firma anti-bucle de useConteoRegla). Nace sin elegir: la casilla de la esquina
// (un botón con rol de casilla; K1 no admite la casilla nativa) la marca, y su `::after` cubre la tarjeta para que todo el
// cuerpo alterne. El conteo se pide elegida o no: es lo que el analista mira para decidir. «Editar» abre la Regla de
// preguntas en el lateral del diálogo (EdicionReglaMazo.tsx) y la tarjeta queda marcada con una banda en su borde (sin
// insignia: a 1024 con el lateral abierto partía el texto letra por letra).

import { useId, type ReactNode } from "react";
import { Check } from "../../../../vendor/lucide-react";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import { SLIDE_GRAF_SLOTS } from "../../store";
import { GRAFICADORES_CON_REGLA, reglaEfectiva, textoConteo } from "../reglaPreguntas/modeloReglaPreguntas";
import { useConteoRegla } from "../reglaPreguntas/useConteoRegla";
import { listaPublicos, nombreAccesible, type PropuestaMazo } from "./modeloMazo";

type Props = {
  numero: number;
  propuesta: PropuestaMazo;
  elegida: boolean;
  editando: boolean;
  scope: "active" | "consolidated";
  /** El id del lateral de edición (aria-controls de «Editar»). */
  idLateral: string;
  /** El asa para ordenar arrastrando (ListaTarjetasMazo); sin ella la tarjeta no se mueve. */
  asa?: ReactNode;
  /** La miniatura real de la lámina (useMiniaturasMazo); sin ella, el glifo del tipo. */
  miniatura?: string | null;
  onAlternar: () => void;
  onEditar: () => void;
};

export function TarjetaMazo({ numero, propuesta: p, elegida, editando, scope, idLateral, asa, miniatura, onAlternar, onEditar }: Props) {
  const id = useId();
  // M4: con el público, para que las tres «Fortalezas y alertas» no se llamen igual.
  const nombre = nombreAccesible(p);
  const conRegla = !!p.graficador && GRAFICADORES_CON_REGLA.has(p.graficador);
  const regla = conRegla && p.graficador ? reglaEfectiva(p.graficador, p.args, p.args.regla) : null;
  // Mientras se edita, el conteo lo pide la Regla de preguntas del lateral: dos pedidos iguales serían el mismo número.
  const { conteo, cargando, error } = useConteoRegla(p.graficador ?? "", p.args, scope, !!regla && !editando && !p.falta);
  // El texto del motor ya trae sus cifras («Se muestran las 13 de mayor diferencia, de 47 preguntas comunes»).
  const textoRegla = conteo && !cargando
    ? conteo.texto_regla || `${textoConteo(conteo)}: ${p.reglaEnPalabras}`
    : p.reglaEnPalabras;

  return (
    <Panel
      className={`pulso-f6-mazo-tarjeta${elegida ? " is-elegida" : ""}${editando ? " is-editando" : ""}`}
      aria-label={nombre}
      data-propuesta-mazo={p.id}
      data-elegida={elegida ? "true" : "false"}
    >
      <div className="pulso-f6-mazo-tarjeta-cabeza">
        {asa}
        <span className="pulso-f6-mazo-numero" aria-hidden="true">{numero}</span>
        {/* Q2-2: los públicos arriba y, debajo, el tipo con su clase. En dos columnas partían palabras («ESTUDIANTE S»). */}
        <span className="pulso-f6-mazo-cabeza-texto">
          <span className="pulso-f6-mazo-lee">{listaPublicos(p.publicos)}</span>
          <span className="pulso-f6-mazo-tipo" data-clase-tarjeta={p.claseTarjeta}>
            <span id={`${id}-nombre`} className="pulso-f6-mazo-tipo-nombre">{p.nombre}</span>
          </span>
        </span>
        <button type="button" role="checkbox" aria-checked={elegida} aria-label={nombre}
          className="pulso-f6-mazo-elegir" onClick={onAlternar}>
          <span className="pulso-f6-mazo-elegir-caja" aria-hidden="true">{elegida && <Check size={13} strokeWidth={2.5} />}</span>
        </button>
      </div>
      <span className={`pulso-f6-mazo-miniatura${miniatura ? " has-imagen" : ""}`}>
        {miniatura
          ? <img src={miniatura} alt="" loading="lazy" decoding="async" />
          : p.graficador
          ? <GlifoGrafico tipo={p.graficador} />
          : <ComposicionLamina tipo={p.tipo} slots={SLIDE_GRAF_SLOTS[p.tipo] ?? []} />}
      </span>
      {p.falta ? (
        <span className="pulso-f6-mazo-falta" role="note">{p.falta}</span>
      ) : (
        <span className="pulso-f6-mazo-regla" aria-busy={cargando || undefined}>{textoRegla}</span>
      )}
      {error && !p.falta && <span className="pulso-f6-mazo-falta" role="note">{error}</span>}
      {conRegla && !p.falta && (
        <div className="pulso-f6-mazo-acciones">
          <PulsoButton variant="ghost" size="sm" onClick={onEditar} aria-expanded={editando}
            aria-controls={editando ? idLateral : undefined} aria-label={`Editar ${nombre}`} data-editar-mazo={p.id}>
            Editar
          </PulsoButton>
        </div>
      )}
    </Panel>
  );
}
