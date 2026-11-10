import { Download, Shuffle } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { apiCalcMuestraGeneralExportar, type CalcMuestraGeneralCorrida } from "../../../api/calcMuestraGeneral";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { Panel } from "../../../components/Panel";
import { EmptyState } from "../../../components/States";
import { fmtDec, fmtInt } from "../sharedCore";
import { AvisoModulo } from "../universidad/shared/AvisoModulo";
import { CifraFila, CifraMotor } from "../universidad/ui";
import { useValorSwap } from "../universidad/ui/useValorSwap";
import { MODULO_CALC_MUESTRA } from "../entregas/modeloEntrega";
import {
  MOTIVO_SIN_CORRIDA_EXPORT,
  TEXTO_COBERTURA_CENSAL,
  formatearFechaLocal,
  formatearPi,
  hashCorto,
} from "./modelo";
import { vigenciaSorteo } from "./bandaDisenoModelo";
import { filasDesdeCorrida } from "./repartoEstratos";
import { RepartoEstratosGrafico } from "./RepartoEstratosGrafico";
import { corridaEstratificada, nombreDeCorrida } from "./tituloCorrida";
import { useMuestraGeneralStore } from "./store";
import { guardarEstudioPendiente } from "./useMuestraGeneral";
import "./mesa.css";

/**
 * La corrida vigente: qué se sorteó, con qué y cómo repetirlo, más el libro de
 * entrega. Sin corrida conserva su caja, dice qué falta y deja la descarga
 * deshabilitada con su motivo a la vista.
 */
export function FichaCorrida({
  corrida,
  componente,
}: {
  corrida: CalcMuestraGeneralCorrida | null;
  componente: CalcMuestraComponente | null;
}) {
  // El libro de entrega por el kit (ADR 0133): el botón de la cabecera sólo se deshabilita; la espera, el
  // archivo y el fallo van en el contenedor, en bloque bajo la cabecera.
  const libro = useGeneracion({ titulo: "Listado de la selección", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "el" });
  const exportando = libro.estado.fase === "en_curso";
  const componenteId = componente?.id ?? null;
  const c = corrida?.corrida ?? null;
  const esCenso = c?.modalidad === "censo";
  const marco = useMuestraGeneralStore((s) => (componenteId ? s.marcos[componenteId] ?? null : null));
  // La misma vigencia que la banda y el estado de la mesa: marco, cálculo y n.
  const vigencia = vigenciaSorteo({ comp: componente, corrida, marco });
  const desactualizado = vigencia.estado === "desactualizado" ? vigencia : null;
  const nombre = corrida && c ? nombreDeCorrida(corrida, componente) : null;
  // Re-sortear cambia la corrida vigente: su nombre cruza (E16 · M7). «Sin
  // sorteo» no es un nombre: el primer sorteo no cruza, aparece.
  const tituloCambiando = useValorSwap(nombre?.titulo ?? null);
  const estratificada = Boolean(corrida && c && !esCenso && corridaEstratificada(corrida) && corrida.estratos.length > 1);

  function exportar() {
    if (!componenteId || !corrida) return;
    void libro.ejecutar(async () => {
      await guardarEstudioPendiente();
      return apiCalcMuestraGeneralExportar(componenteId);
    });
  }

  return (
    <Panel
      className="cmg-ficha"
      aria-labelledby="cmg-ficha-titulo"
      data-qa-geometry-member
      eyebrow="Selección vigente"
      title={(
        <span id="cmg-ficha-titulo" className="cmv2-uni-swap" data-cambiando={tituloCambiando || undefined}>
          {nombre ? nombre.titulo : "Sin selección"}
        </span>
      )}
      actions={(
        <div className="cmv2-panel-head-actions cmg-exportar">
          <button
            type="button"
            className="cmv2-ghost"
            onClick={exportar}
            disabled={!corrida || exportando}
            aria-describedby="cmg-exportar-estado"
          >
            <Download size={14} aria-hidden="true" />
            Descargar listado (XLSX)
          </button>
          <small id="cmg-exportar-estado">
            {!corrida ? MOTIVO_SIN_CORRIDA_EXPORT : "Selección, memoria de cálculo, estratos y listado."}
          </small>
        </div>
      )}
    >

      <ContenedorEntregable estado={libro.estado} forma="bloque" onCerrar={libro.cerrar} />

      {!corrida || !c ? (
        <EmptyState
          variant="inline"
          icon={<Shuffle size={18} aria-hidden="true" />}
          title="Todavía no hay selección"
          hint="Elige el método y selecciona la muestra: aquí aparecerán la ficha, el reparto por estrato y el listado con π y peso."
        />
      ) : (
        <>
          {esCenso && <p className="cmg-nota cmg-censo">{TEXTO_COBERTURA_CENSAL}</p>}
          {/* Región viva persistente: un aviso que aparece después de montar
              (el n a campo cambió en Método) se anuncia sin robar el foco. */}
          <div className="cmg-avisos-vivos" aria-live="polite">
            {desactualizado && (
              <AvisoModulo tone="warn" role="note" title="La selección quedó desactualizada">
                {desactualizado.texto} Vuelve a sortear.
              </AvisoModulo>
            )}
            {c.piso_incumplible && (
              <AvisoModulo tone="warn" role="note">
                El piso por estrato no alcanza con este n: algunos estratos quedaron por debajo.
              </AvisoModulo>
            )}
            {c.reservas_omitidas_pps && (
              <AvisoModulo tone="info" role="note">Con PPS no se seleccionan reemplazos; se pidieron y se omitieron.</AvisoModulo>
            )}
          </div>

          <CifraFila>
            <CifraMotor
              label={esCenso ? "Unidades a contactar" : "Muestra a contactar usada"}
              value={fmtInt(esCenso ? c.n_titulares : corrida.n_fuente)}
              detalle={esCenso ? "el marco entero" : "del cálculo vigente al seleccionar"}
              tono={desactualizado?.motivo === "n" ? "alerta" : undefined}
              hero
            />
            <CifraMotor label={esCenso ? "π" : "Principales"} value={esCenso ? "1" : fmtInt(c.n_titulares)} detalle={esCenso ? "cada unidad" : "a contactar primero"} />
            <CifraMotor label="Reemplazos" value={fmtInt(c.n_reservas)} detalle={c.n_reservas > 0 ? "se liberan por lotes" : "sin reemplazos"} />
            <CifraMotor label="Tamaño del marco (N)" value={fmtInt(c.N)} detalle={`huella ${hashCorto(c.marco_hash, 8)}`} />
          </CifraFila>

          <dl className="cmg-traza">
            <div><dt>Modalidad</dt><dd>{nombre?.modalidad}</dd></div>
            <div><dt>Semilla</dt><dd className="cmg-traza-tecnico">{c.semilla}</dd></div>
            <div><dt>RNG</dt><dd className="cmg-traza-tecnico">{partirEnBarras(c.rng_kind)}</dd></div>
            <div><dt>R</dt><dd>{partirVersionR(c.r_version)}</dd></div>
            <div><dt>Identificador</dt><dd className="cmg-traza-tecnico" title={c.run_id}>{hashCorto(c.run_id, 12)}</dd></div>
            <div><dt>Marco</dt><dd className="cmg-traza-tecnico" title={c.marco_hash}>{hashCorto(c.marco_hash)}</dd></div>
            <div><dt>Configuración</dt><dd className="cmg-traza-tecnico" title={c.config_hash}>{hashCorto(c.config_hash)}</dd></div>
            <div><dt>Fecha</dt><dd title={corrida.sorteado_at}>{formatearFechaLocal(corrida.sorteado_at)}</dd></div>
          </dl>

          {estratificada && (
            <RepartoEstratosGrafico
              titulo="Reparto de la selección por estrato"
              filas={filasDesdeCorrida(corrida)}
              origen="corrida"
              tablaAlternativa={false}
            />
          )}

          <div className="cmg-tabla-wrap">
            <table className="cmg-tabla">
              <caption className="cmg-sr-only">Reparto por estrato de la selección</caption>
              <thead>
                <tr>
                  <th scope="col">Estrato</th>
                  <th scope="col" className="cmg-num cmg-simbolo">N<sub>h</sub></th>
                  <th scope="col" className="cmg-num cmg-simbolo">n<sub>h</sub> a contactar</th>
                  <th scope="col" className="cmg-num">Reemplazos</th>
                  <th scope="col" className="cmg-num cmg-simbolo">π</th>
                  <th scope="col" className="cmg-num">Peso base</th>
                </tr>
              </thead>
              <tbody>
                {corrida.estratos.map((e) => (
                  <tr key={e.clave}>
                    <th scope="row" className="cmg-fila-estrato">{e.clave}</th>
                    <td className="cmg-num">{fmtInt(e.N_h)}</td>
                    <td className="cmg-num">{fmtInt(e.n_h)}</td>
                    <td className="cmg-num">{fmtInt(e.n_reservas)}</td>
                    <td className="cmg-num" title={e.pi == null ? undefined : String(e.pi)}>
                      {c.metodo === "pps" ? "por unidad" : formatearPi(e.pi)}
                    </td>
                    <td className="cmg-num">
                      {c.metodo === "pps" || e.pi == null || e.pi <= 0 ? "por unidad" : fmtDec(1 / e.pi, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

/** «Mersenne-Twister/Inversion/Rejection» se parte en las barras, no a mitad de palabra. */
function partirEnBarras(texto: string) {
  if (!texto) return "—";
  // La barra cierra el tramo anterior: el corte cae entre tramos, no dentro de «/Inversion».
  const partes = texto.split("/");
  return partes.map((parte, i) => (
    <span key={parte}>{parte}{i < partes.length - 1 && <>/<wbr /></>}</span>
  ));
}

/** «R version 4.5.1 (2025-06-13)»: la fecha no se parte en su guion; el corte va antes del paréntesis. */
function partirVersionR(texto: string) {
  if (!texto) return "—";
  const m = /^(.*?)\s*(\([^)]*\))$/.exec(texto);
  return m ? <>{m[1]} <span className="cmg-traza-sin-corte">{m[2]}</span></> : texto;
}
