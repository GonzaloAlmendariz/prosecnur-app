// De dónde sale un segmento en una base (ADR 0107): la variable de origen, sus
// códigos y la categoría estándar de cada uno. Misma sección, barra de
// asignación en masa y tabla que la armonización de una fila. La lógica vive
// en `segmentosModel`; aquí sólo hay render y eventos.

import { useState } from "react";
import type { VariableDeBase } from "../../../api/equivalencias";
import type { CategoriaSegmento, SegmentoEnBase as SegmentoEnBaseGuardado } from "../../../api/segmentos";
import { PulsoButton } from "../../../components/PulsoButton";
import { CalendarRange, Ruler, Wand2 } from "../../../vendor/lucide-react";
import { ArmonizacionAsignarEnMasa } from "../ArmonizacionAsignarEnMasa";
import { DESTINO_SIN_MAPA, textoMarcados } from "../armonizacionMasaModel";
import { PreguntaOrigen } from "../variablesBase/SelectorPreguntas";
import { AyudaMapa } from "./AyudaMapa";
import { EstadoChip } from "./EstadoChip";
import {
  TEXTO_ESTADO_BORRADOR,
  ayudasDisponibles,
  codigosConocidos,
  estadoDeEntrada,
  filasDeCodigos,
  mapaPorEtiqueta,
  resumenMapa,
  textoResumenMapa,
  type AccionSegmento,
  type AyudaMapa as TipoAyuda,
  type DestinoCodigo,
  type EntradaBorrador,
} from "./segmentosModel";

/** Valor del selector que significa «sin dato» explícito (destino `""`). */
const VALOR_SIN_DATO = "__sin_dato__";

function valorDeDestino(d: DestinoCodigo): string {
  return d === null ? "" : d === "" ? VALOR_SIN_DATO : d;
}

function destinoDeValor(v: string): DestinoCodigo {
  return v === "" || v === DESTINO_SIN_MAPA ? null : v === VALOR_SIN_DATO ? "" : v;
}

export type SegmentoEnBaseProps = {
  base: string;
  anclaId: string;
  /** `null` mientras llega el catálogo. */
  opciones: readonly VariableDeBase[] | null;
  catalogoError: boolean;
  entrada: EntradaBorrador;
  guardado: SegmentoEnBaseGuardado | undefined;
  escala: readonly CategoriaSegmento[];
  anio: number | null;
  despachar: (a: AccionSegmento) => void;
};

export function SegmentoEnBase({
  base,
  anclaId,
  opciones,
  catalogoError,
  entrada,
  guardado,
  escala,
  anio,
  despachar,
}: SegmentoEnBaseProps) {
  const [ayuda, setAyuda] = useState<TipoAyuda | null>(null);
  const origen = entrada.origen;
  const delOrigen = (opciones ?? []).find((o) => o.name === origen);
  const codigos = codigosConocidos(delOrigen?.opciones ?? [], origen, guardado, entrada.mapa);
  const filas = filasDeCodigos(codigos, entrada.mapa, escala);
  const resumen = resumenMapa(filas);
  const estado = estadoDeEntrada(origen, filas);
  const marcadas = filas.filter((f) => f.codigos.every((c) => entrada.marcados.includes(c)));
  const codigosMarcados = marcadas.flatMap((f) => f.codigos);
  const sinMapa = filas.filter((f) => f.sinMapa).flatMap((f) => f.codigos);
  const porEtiqueta = mapaPorEtiqueta(codigos, entrada.mapa, escala);
  const ayudas = ayudasDisponibles(codigos);
  const ausente = Boolean(guardado?.origen_ausente && guardado.origen === origen);

  return (
    <section className="pulso-armon-seccion pulso-armon-base" aria-labelledby={anclaId} data-qa-geometry-member>
      <div className="pulso-armon-seccion-head">
        <h3 id={anclaId} tabIndex={-1}>
          {base} {origen && <small>{origen}</small>}
        </h3>
        <EstadoChip
          tono={estado === "definido" ? "ok" : estado === "incompleto" ? "aviso" : "neutro"}
          texto={TEXTO_ESTADO_BORRADOR[estado]}
        />
      </div>

      {opciones === null ? (
        <p className="pulso-armon-nota" role="status">Leyendo las variables de {base}…</p>
      ) : catalogoError ? (
        // C5 categoría 3: el catálogo no llegó.
        <p className="pulso-armon-aviso" role="alert">No se pudieron leer las variables de {base}.</p>
      ) : (
        <PreguntaOrigen
          opciones={opciones}
          variable={origen}
          soloConLista={false}
          rotulo={`Variable de origen en ${base}`}
          etiquetaBuscar={`Buscar la variable de origen en ${base}`}
          onElegir={(variable) => { setAyuda(null); despachar({ tipo: "origen", base, variable }); }}
        />
      )}

      {!origen ? (
        // C3: el vacío es de esta base y dice qué significa.
        <p className="pulso-armon-ayuda">Sin origen, el segmento queda vacío en {base}.</p>
      ) : (
        <>
          {ausente && (
            <p className="pulso-armon-aviso" role="status">
              {origen} ya no está en {base}. Elige otra variable o deja la base sin origen.
            </p>
          )}

          <div className="pulso-armon-base-acciones">
            {Object.keys(porEtiqueta).length > 0 && (
              <PulsoButton
                variant="secondary"
                size="sm"
                className="pulso-armon-btn"
                title="Lleva cada código sin mapa a la categoría con su misma etiqueta. No toca lo ya asignado."
                onClick={() => despachar({ tipo: "aplicar-mapa", base, mapa: porEtiqueta })}
              >
                <Wand2 size={13} aria-hidden="true" />
                Emparejar por etiqueta
              </PulsoButton>
            )}
            {ayudas.includes("tramos") && (
              <PulsoButton
                variant="secondary"
                size="sm"
                className="pulso-armon-btn"
                aria-expanded={ayuda === "tramos"}
                onClick={() => setAyuda(ayuda === "tramos" ? null : "tramos")}
              >
                <CalendarRange size={13} aria-hidden="true" />
                Tramos de antigüedad
              </PulsoButton>
            )}
            {ayudas.includes("rangos") && (
              <PulsoButton
                variant="secondary"
                size="sm"
                className="pulso-armon-btn"
                aria-expanded={ayuda === "rangos"}
                onClick={() => setAyuda(ayuda === "rangos" ? null : "rangos")}
              >
                <Ruler size={13} aria-hidden="true" />
                Rangos
              </PulsoButton>
            )}
            {resumen.total > 0 && (
              <span className={`pulso-armon-base-resumen${resumen.sinMapa ? " is-aviso" : ""}`} aria-live="polite">
                {textoResumenMapa(resumen)}
              </span>
            )}
          </div>

          {ayuda && (
            <AyudaMapa
              key={ayuda}
              tipo={ayuda}
              base={base}
              origen={origen}
              anio={anio}
              escala={escala}
              codigos={codigos}
              onAplicar={(mapa) => { despachar({ tipo: "aplicar-mapa", base, mapa }); setAyuda(null); }}
              onCerrar={() => setAyuda(null)}
            />
          )}

          {escala.length === 0 ? (
            <p className="pulso-armon-vacio">Define la escala estándar para asignar los códigos de {origen}.</p>
          ) : filas.length === 0 ? (
            // C5 categoría 1: una numérica sin lista; el backend dirá lo observado al guardar.
            <p className="pulso-armon-vacio">
              {origen} no trae lista de respuestas. Arma el mapa con {ayudas.length > 1 ? "«Rangos» o «Tramos de antigüedad»" : "la ayuda"};
              al guardar, lo que quede sin asignar aparece aquí.
            </p>
          ) : (
            <>
              <ArmonizacionAsignarEnMasa
                base={base}
                escala={escala}
                nMarcados={marcadas.length}
                nSinMapa={sinMapa.length}
                opcionesExtra={[{ valor: VALOR_SIN_DATO, rotulo: "Sin dato" }]}
                onAsignar={(eleccion) => despachar({ tipo: "destino", base, codigos: codigosMarcados, destino: destinoDeValor(eleccion) })}
                onMarcarSinMapa={() => despachar({ tipo: "marcar", base, codigos: sinMapa, marcado: true })}
                onLimpiar={() => despachar({ tipo: "limpiar-marcas", base })}
              />
              <div className="pulso-armon-tabla-wrap">
                <table className="pulso-armon-tabla pulso-vb-recod">
                  <caption className="pulso-sr-only">
                    Códigos de {origen} en {base} y su categoría estándar. {textoMarcados(marcadas.length)}.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col"><span className="pulso-sr-only">Marcar</span></th>
                      <th scope="col">Código</th>
                      <th scope="col">Respuesta en {base}</th>
                      <th scope="col">Categoría estándar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const marcado = f.codigos.every((c) => entrada.marcados.includes(c));
                      return (
                        <tr
                          key={f.codigos[0]}
                          className={[marcado ? "is-marcado" : "", f.sinMapa ? "is-sin-mapa" : ""].filter(Boolean).join(" ") || undefined}
                        >
                          <td className="pulso-armon-marca">
                            <input
                              type="checkbox"
                              checked={marcado}
                              aria-label={`Marcar ${f.codigos.length > 1 ? "los códigos" : "el código"} ${f.rotulo}`}
                              onChange={(e) => despachar({ tipo: "marcar", base, codigos: f.codigos, marcado: e.currentTarget.checked })}
                            />
                          </td>
                          <td className="pulso-armon-codigo">{f.rotulo}</td>
                          <td>{f.etiqueta || <span className="pulso-armon-tenue">{f.codigos.length > 1 ? `${f.codigos.length} valores` : "Sin etiqueta"}</span>}</td>
                          <td>
                            <select
                              value={valorDeDestino(f.destino)}
                              aria-label={`Categoría estándar de ${f.rotulo}`}
                              onChange={(e) => despachar({ tipo: "destino", base, codigos: f.codigos, destino: destinoDeValor(e.target.value) })}
                            >
                              <option value="">Sin mapa</option>
                              {escala.map((c) => (
                                <option key={c.codigo} value={c.codigo}>{c.codigo} {c.etiqueta}</option>
                              ))}
                              <option value={VALOR_SIN_DATO}>Sin dato</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
