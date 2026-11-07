// Una lámina propuesta del mazo «Resumen ejecutivo» (maqueta graficos-sintesis, Mazo): número y antetítulo, el tipo con
// su clase, la miniatura del gráfico, «Título por escribir» (el título lo escribe el analista) y la regla con su conteo
// en vivo desde el motor (POST /api/graficos/resumenes/regla, la misma firma anti-bucle de useConteoRegla). «Quitar»
// la deja fuera del mazo; «Editar» despliega en la misma tarjeta la Regla de preguntas para ajustarla antes de insertar.

import { useId } from "react";
import type { ReglaPreguntas as Regla } from "../../../../api/graficosRegla";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import { SLIDE_GRAF_SLOTS } from "../../store";
import { GRAFICADORES_CON_REGLA, reglaEfectiva, textoConteo } from "../reglaPreguntas/modeloReglaPreguntas";
import { ReglaPreguntas } from "../reglaPreguntas/ReglaPreguntas";
import { useConteoRegla } from "../reglaPreguntas/useConteoRegla";
import { ROTULO_CLASE } from "../selectores/intencionesContar";
import type { PropuestaMazo } from "./modeloMazo";

type Props = {
  numero: number;
  propuesta: PropuestaMazo;
  incluida: boolean;
  editando: boolean;
  scope: "active" | "consolidated";
  onAlternar: () => void;
  onEditar: () => void;
  onRegla: (regla: Regla) => void;
};

export function TarjetaMazo({ numero, propuesta: p, incluida, editando, scope, onAlternar, onEditar, onRegla }: Props) {
  const id = useId();
  const conRegla = !!p.graficador && GRAFICADORES_CON_REGLA.has(p.graficador);
  const regla = conRegla && p.graficador ? reglaEfectiva(p.graficador, p.args, p.args.regla) : null;
  // Mientras se edita, el conteo lo pide la Regla de preguntas: dos pedidos iguales serían el mismo número dos veces.
  const { conteo, cargando, error } = useConteoRegla(p.graficador ?? "", p.args, scope, !!regla && incluida && !editando && !p.falta);
  // El texto del motor ya trae sus cifras («Se muestran las 13 de mayor diferencia, de 47 preguntas comunes»).
  const textoRegla = conteo && !cargando
    ? conteo.texto_regla || `${textoConteo(conteo)}: ${p.reglaEnPalabras}`
    : p.reglaEnPalabras;

  return (
    <Panel
      className={`pulso-f6-mazo-tarjeta${incluida ? "" : " is-quitada"}`}
      aria-labelledby={`${id}-nombre`}
      data-propuesta-mazo={p.id}
      data-incluida={incluida ? "true" : "false"}
    >
      <div className="pulso-f6-mazo-tarjeta-cabeza">
        <span className="pulso-f6-mazo-numero" aria-hidden="true">{numero}</span>
        {/* Q2-2: el antetítulo arriba y, debajo, el tipo con su clase. En dos columnas partían palabras («ESTUDIANTE S»). */}
        <span className="pulso-f6-mazo-cabeza-texto">
          <span className="pulso-f6-mazo-antetitulo">{p.antetitulo}</span>
          <span className="pulso-f6-mazo-tipo" data-clase-tarjeta={p.claseTarjeta}>
            <span id={`${id}-nombre`} className="pulso-f6-mazo-tipo-nombre">{p.nombre}</span>
            <span className="pulso-f6-mazo-tipo-clase">{ROTULO_CLASE[p.claseTarjeta]}</span>
          </span>
        </span>
      </div>
      <span className="pulso-f6-mazo-miniatura">
        {p.graficador
          ? <GlifoGrafico tipo={p.graficador} />
          : <ComposicionLamina tipo={p.tipo} slots={SLIDE_GRAF_SLOTS[p.tipo] ?? []} />}
      </span>
      <span className="pulso-f6-mazo-titulo">Título por escribir</span>
      {p.falta ? (
        <span className="pulso-f6-mazo-falta" role="note">{p.falta}</span>
      ) : (
        <span className="pulso-f6-mazo-regla" aria-busy={cargando || undefined}>{textoRegla}</span>
      )}
      {error && !p.falta && <span className="pulso-f6-mazo-falta" role="note">{error}</span>}
      <div className="pulso-f6-mazo-acciones">
        <PulsoButton variant="secondary" size="sm" className={incluida ? undefined : "is-volver"} onClick={onAlternar}
          aria-describedby={`${id}-nombre`}>
          {incluida ? "Quitar" : "Volver a incluir"}
        </PulsoButton>
        {conRegla && incluida && !p.falta && (
          <PulsoButton variant="ghost" size="sm" onClick={onEditar} aria-expanded={editando} aria-controls={`${id}-regla`}
            aria-describedby={`${id}-nombre`}>
            {editando ? "Listo" : "Editar"}
          </PulsoButton>
        )}
      </div>
      {editando && p.graficador && incluida && !p.falta && (
        <div id={`${id}-regla`} className="pulso-f6-mazo-edicion">
          <ReglaPreguntas
            rotulo="Regla de preguntas"
            ayuda="Cómo se eligen las preguntas de esta lámina. Se puede cambiar después en Datos."
            graficador={p.graficador}
            args={p.args}
            valor={p.args.regla}
            scope={scope}
            onCambio={onRegla}
          />
        </div>
      )}
    </Panel>
  );
}
