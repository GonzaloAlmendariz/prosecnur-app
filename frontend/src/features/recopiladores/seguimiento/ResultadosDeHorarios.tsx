// Prueba de horarios, paso 6: resultados. Por recordatorio, el grupo A contra
// el grupo B a igualdad de horas desde el envío de cada grupo: la tasa de cada
// uno con su base, la diferencia con su intervalo, el p de Cochran-Mantel-
// Haenszel, la lectura y la tabla por público. Debajo, si se repite la hora que
// gana con los grupos cruzados, el texto del cruce. El informe sale en PDF.
//
// Las cifras y las frases las calcula el backend; aquí sólo se muestran.

import { useEffect } from "react";

import { apiInformeDeHorario, apiResultadosDeHorario, type ResultadoDeRonda, type ResultadosDeHorario } from "../../../api/mailSeguimiento";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoField } from "../../../components/PulsoField";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { formatoConteo, formatoDecimal } from "../../../lib/formatoNumero";
import { BarChart3, FileText, Loader2, RefreshCw } from "../../../vendor/lucide-react";
import { MODULO_MATERIAL } from "../entregas/modeloEntrega";
import { HORIZONTES, conteoConPct, fechaHoraLegible, formatoPct, formatoPuntos } from "./modeloSeguimiento";
import { anchosComparados, veredictoDeRonda } from "./modeloTablero";
import { Chip } from "./piezas";
import { TablaDeComparacion } from "./TablaDeComparacion";
import { useSeguimientoStore } from "./store";
import { useOperacion } from "./useOperacion";

const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

export function ResultadosDeHorarios() {
  const estado = useSeguimientoStore((s) => s.estado);
  const r = useSeguimientoStore((s) => s.resultados);
  const pedido = useSeguimientoStore((s) => s.horizonte);
  const sorteado = Boolean(estado?.horario.sorteado_en);
  const horizonte = pedido ?? estado?.horario.horizonte_h ?? 24;
  const op = useOperacion<ResultadosDeHorario>();
  const { correr } = op;
  const gen = useGeneracion({ titulo: "Informe de la prueba de horarios", modulo: MODULO_MATERIAL, formato: "pdf", articulo: "el" });

  const leer = (h: number) => correr(async () => {
    const res = await apiResultadosDeHorario(h);
    useSeguimientoStore.getState().setResultados(res);
    return res;
  }, "No se pudieron leer los resultados.");

  useEffect(() => {
    if (!sorteado) return;
    // La pestaña ya los leyó (y los vuelve a leer al cambiar las horas): no se piden dos veces.
    if (useSeguimientoStore.getState().resultados) return;
    void correr(async () => {
      const res = await apiResultadosDeHorario(horizonte);
      useSeguimientoStore.getState().setResultados(res);
      return res;
    }, "No se pudieron leer los resultados.");
  }, [correr, horizonte, sorteado]);

  if (!estado) return null;
  if (!sorteado) return <p className="rec-seg-nota">Los resultados aparecen después de asignar los grupos y del primer envío.</p>;

  const opcionesDeHoras = [...new Set([...HORIZONTES, horizonte])].sort((a, b) => a - b);
  const generando = gen.estado.fase === "en_curso";

  return (
    <>
      <div className="rec-seg-fila">
        <PulsoField label="Horas desde el envío">
          <PulsoSelect
            value={String(horizonte)}
            options={opcionesDeHoras.map((h) => ({ value: String(h), label: `${formatoConteo(h)} ${plural(h, "hora", "horas")}` }))}
            onValueChange={(v) => useSeguimientoStore.getState().setHorizonte(Number(v))}
          />
        </PulsoField>
        <span className="rec-seg-acciones">
          <PulsoButton variant="secondary" size="sm" disabled={op.corriendo} onClick={() => void leer(horizonte)}>
            {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />} Actualizar resultados
          </PulsoButton>
          <PulsoButton variant="primary" size="sm" disabled={generando || !r?.rondas.length} onClick={() => { void gen.ejecutar(() => apiInformeDeHorario(horizonte)); }}>
            <FileText size={14} aria-hidden /> Descargar informe (PDF)
          </PulsoButton>
        </span>
      </div>
      <ContenedorEntregable estado={gen.estado} forma="bloque" onCerrar={gen.cerrar} />
      {op.error ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}

      {r ? (
        <>
          <p className="rec-seg-nota">
            {formatoConteo(r.personas)} {plural(r.personas, "persona", "personas")} en la prueba, {conteoConPct(r.con_completa, r.personas)} con la encuesta completa.
            {r.respuestas_leidas_en ? ` Respuestas leídas el ${fechaHoraLegible(r.respuestas_leidas_en)}.` : " Todavía no se leyó quién respondió."}
            {r.horas_del_plan ? ` ${formatoConteo(r.horas_del_plan)} ${plural(r.horas_del_plan, "hora de envío sale", "horas de envío salen")} del plan, no de Mailchimp.` : ""}
          </p>
          {r.cruce.texto ? <p className="rec-seg-cruce">{r.cruce.texto}</p> : null}
          {r.rondas.length ? (
            <div className="rec-seg" data-qa-geometry-group="material-campo/correo/seguimiento/horarios/resultados" data-qa-geometry-contract="intrinsic">
              {r.rondas.map((ronda) => <TarjetaDeRonda key={ronda.ronda} ronda={ronda} />)}
            </div>
          ) : (
            <div className="rec-seg-vacio-caja" data-qa-geometry-capacity="owned">
              <EstadoVacio
                icono={<BarChart3 size={18} />}
                titulo="Todavía no salió ningún recordatorio del plan"
                descripcion='Los resultados se leen cuando un envío sale en Mailchimp: usa "Leer envíos de Mailchimp" en el paso 5.'
              />
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

/** Un grupo en la tarjeta: su hora, la tasa grande, "x de n" y una barra comparada con el otro. */
function Brazo({ grupo, hora, pct, x, n, ancho }: { grupo: "A" | "B"; hora: string; pct: number | null; x: number; n: number; ancho: number }) {
  return (
    <div className={`rec-seg-brazo is-${grupo.toLowerCase()}`}>
      <dt>Grupo {grupo}{hora ? `, ${hora}` : ""}</dt>
      <dd>{formatoPct(pct)}</dd>
      <small>{formatoConteo(x)} de {formatoConteo(n)}</small>
      <span className="rec-seg-brazo-pista" aria-hidden><span style={{ width: `${ancho}%` }} /></span>
    </div>
  );
}

export function TarjetaDeRonda({ ronda }: { ronda: ResultadoDeRonda }) {
  const t = ronda.total;
  const titulo = `${ronda.etiqueta}${ronda.fecha ? `, ${ronda.fecha}` : ""}`;
  const excluidos = ronda.excluidos.map((e) => `${e.publico} (${e.motivo})`).join("; ");
  const veredicto = veredictoDeRonda(ronda);
  const anchos = anchosComparados(t?.pctA ?? null, t?.pctB ?? null);
  return (
    <section className="rec-seg-tarjeta rec-seg-ronda" aria-label={titulo}>
      <header className="rec-seg-cabeza">
        <h4 className="rec-seg-titulo">{titulo}</h4>
        <span className="rec-seg-acciones">
          {ronda.en_curso ? <Chip tono="aviso">En curso</Chip> : null}
          {ronda.comparable && ronda.horizonte_h != null ? (
            <Chip>A {formatoDecimal(ronda.horizonte_h, 1)} {plural(ronda.horizonte_h, "hora", "horas")} de cada envío</Chip>
          ) : null}
          <span className={`rec-seg-veredicto is-${veredicto.tono} is-grande`}>{veredicto.texto}</span>
        </span>
      </header>
      {ronda.comparable && t ? (
        <>
          <dl className="rec-seg-ab">
            <Brazo grupo="A" hora={ronda.horaA} pct={t.pctA} x={t.xA} n={t.nA} ancho={anchos.A} />
            <Brazo grupo="B" hora={ronda.horaB} pct={t.pctB} x={t.xB} n={t.nB} ancho={anchos.B} />
          </dl>
          <p className="rec-seg-nota">
            Diferencia A menos B: {formatoPuntos(t.dif_pp)}
            {t.dif_li != null && t.dif_ls != null ? ` (IC 95 %: ${formatoPuntos(t.dif_li)} a ${formatoPuntos(t.dif_ls)})` : ""}
            {ronda.cmh?.p_txt ? `, ${ronda.cmh.p_txt}` : ""}.
          </p>
        </>
      ) : null}
      {ronda.lectura ? <p className="rec-seg-lectura">{ronda.lectura}</p> : null}
      {ronda.comparable ? (
        <TablaDeComparacion
          ariaLabel={`Comparación por público, ${ronda.etiqueta.toLocaleLowerCase("es-PE")}`}
          filas={ronda.publicos}
          total={t ? { ...t, horaA: t.horaA || ronda.horaA, horaB: t.horaB || ronda.horaB } : null}
          nombreA="Grupo A"
          nombreB="Grupo B"
          rotuloDiferencia="Diferencia A menos B"
          conHoras
        />
      ) : null}
      {excluidos ? <p className="rec-seg-nota">Fuera de la comparación: {excluidos}.</p> : null}
    </section>
  );
}
