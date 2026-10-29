import { useState } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { apiHojasRutaBitacoraAnotar, type HojasRutaMarcoElegible, type HojasRutaMarcoElegiblePreview } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { aLonLat, faltaEnArea, MARCO_NUEVO, MOTIVOS, nuevaArea, pideEvidencia, tonoCobertura, type FormularioArea } from "./marcoElegible";

/**
 * Marco elegible en el inspector de Manzanas (U11d, ADR 0115). Con una corrida
 * legacy se ofrece adoptarlo mostrando antes lo que saca; adoptado, se ajusta el
 * mínimo de viviendas y se dibujan áreas en el mapa. Todo va al borrador del
 * sorteo: se guarda al sortear.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (x: number) => `${(x * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`;
const ETIQUETA_MOTIVO = Object.fromEntries(MOTIVOS) as Record<string, string>;
const FORM_VACIO: FormularioArea = { motivo: "no_residencial", detalle: "", fuente: "", fecha: "" };

type Props = {
  marco: HojasRutaMarcoElegible | undefined;
  vista: HojasRutaMarcoElegiblePreview | null;
  cargando: boolean;
  deshabilitado: boolean;
  onCambiar: (me: HojasRutaMarcoElegible) => void;
};

export function MarcoElegiblePanel({ marco, vista, cargando, deshabilitado, onCambiar }: Props) {
  const { dibujoArea, setDibujoArea } = useLienzoHojasRuta();
  const [form, setForm] = useState<FormularioArea>(FORM_VACIO);
  // ADR 0115 §4: con 10 % o más de población excluida en un distrito, el equipo decide y queda registrado (U17).
  const [decision, setDecision] = useState<"" | "redefinir" | "aceptar">("");
  const [justificacion, setJustificacion] = useState("");
  const [decidido, setDecidido] = useState("");
  const [errorDecision, setErrorDecision] = useState("");
  const declarado = marco?.declarado === true;
  const sumar = (k: "manzanas" | "poblacion", campo: "total" | "elegible" | "excluida_minimo" | "excluida_area") => (vista?.por_distrito ?? []).reduce((a, d) => a + d[campo][k], 0);
  const totalPob = sumar("poblacion", "total");
  const excluidasMinimo = sumar("manzanas", "excluida_minimo");
  const sinConteo = (vista?.por_distrito ?? []).reduce((a, d) => a + d.excluida_minimo_sin_conteo, 0);
  const cubierta = totalPob ? sumar("poblacion", "elegible") / totalPob : null;
  const cortas = (vista?.capacidad ?? []).filter((z) => z.falta);
  const decisiones = (vista?.por_distrito ?? []).filter((d) => tonoCobertura(d) === "decision");
  const vertices = dibujoArea ?? [];
  const lonlat = vertices.map(([x, y]) => aLonLat(x, y));
  const falta = dibujoArea ? faltaEnArea(form, lonlat) : null;

  if (!declarado) {
    return (
      <section className="hr-muestra-grupo" aria-label="Marco elegible">
        <h3>Marco elegible</h3>
        <p className="hr-mapa-nota">Este estudio sortea sobre todas las manzanas del marco 2017, también las que no tienen viviendas registradas.</p>
        {vista ? (
          <p className="hr-mapa-nota">
            Adoptarlo saca <b>{fmt(excluidasMinimo)}</b> manzanas sin viviendas registradas{sinConteo ? ` (${fmt(sinConteo)} por falta de conteo en el censo)` : ""} y cubre el {cubierta == null ? "—" : pct(cubierta)} de la población.
          </p>
        ) : cargando ? <p className="hr-mapa-nota">Calculando lo que cambiaría…</p> : null}
        <PulsoButton variant="secondary" size="sm" disabled={deshabilitado} onClick={() => onCambiar(MARCO_NUEVO)}>
          Adoptar el marco elegible
        </PulsoButton>
      </section>
    );
  }

  const me = marco ?? MARCO_NUEVO;
  return (
    <section className="hr-muestra-grupo" aria-label="Marco elegible">
      <h3>Marco elegible</h3>
      <div className="hr-mapa-cifras">
        <div><small>Manzanas</small><strong>{vista ? fmt(sumar("manzanas", "elegible")) : "—"}</strong></div>
        <div><small>Población</small><strong>{cubierta == null ? "—" : pct(cubierta)}</strong></div>
        <div><small>Áreas</small><strong>{me.areas_excluidas.length}</strong></div>
      </div>
      <div className="hr-muestra-campo">
        <small>Mínimo de viviendas por manzana</small>
        <span className="hr-muestra-pasos">
          <PulsoButton variant="icon" size="sm" aria-label="Una vivienda menos" disabled={deshabilitado || me.minimo_viviendas <= 0} onClick={() => onCambiar({ ...me, minimo_viviendas: me.minimo_viviendas - 1 })}>−</PulsoButton>
          <input type="number" min={0} aria-label="Mínimo de viviendas por manzana" value={me.minimo_viviendas} disabled={deshabilitado} onChange={(e) => e.target.value !== "" && onCambiar({ ...me, minimo_viviendas: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          <PulsoButton variant="icon" size="sm" aria-label="Una vivienda más" disabled={deshabilitado} onClick={() => onCambiar({ ...me, minimo_viviendas: me.minimo_viviendas + 1 })}>+</PulsoButton>
        </span>
        <span className="hr-mapa-nota">
          {vista ? `Salen ${fmt(excluidasMinimo)} manzanas${sinConteo ? `, ${fmt(sinConteo)} de ellas sin conteo en el censo` : ""}.` : cargando ? "Calculando…" : ""}
          {me.minimo_viviendas > 1 ? " Con más de 1 la muestra deja de cubrir hogares reales: el informe lo declara." : ""}
        </span>
      </div>

      <div className="hr-muestra-campo">
        <small>Áreas excluidas</small>
        {me.areas_excluidas.length ? (
          <ul className="hr-me-areas">
            {me.areas_excluidas.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>{ETIQUETA_MOTIVO[a.motivo]}</strong>
                  <small>{a.detalle || a.fuente || a.id}</small>
                </span>
                <PulsoButton variant="icon" intent="remove" size="sm" aria-label={`Quitar el área ${a.id}`} disabled={deshabilitado} onClick={() => onCambiar({ ...me, areas_excluidas: me.areas_excluidas.filter((x) => x.id !== a.id) })}>×</PulsoButton>
              </li>
            ))}
          </ul>
        ) : !dibujoArea ? <span className="hr-mapa-nota">Ninguna. Dibuja las zonas industriales, inaccesibles o de riesgo que el equipo no puede trabajar.</span> : null}
        {dibujoArea ? (
          <div className="hr-me-dibujo">
            <p className="hr-mapa-nota">Toca el mapa para marcar los vértices ({vertices.length} marcados). Toca el primero para cerrar.</p>
            <GlidingRadioGroup value={form.motivo} options={MOTIVOS} getOptionValue={(o) => o[0]} onValueChange={(motivo) => setForm({ ...form, motivo })} className="hr-muestra-opciones hr-me-motivos" aria-label="Motivo de la exclusión">
              {(o) => <span>{o[1]}</span>}
            </GlidingRadioGroup>
            <input className="hr-mapa-buscar" aria-label="Detalle del área" placeholder={form.motivo === "otro" ? "Detalle (obligatorio)" : "Detalle (opcional)"} value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} />
            {pideEvidencia(form.motivo) ? (
              <div className="hr-muestra-dos">
                <input className="hr-mapa-buscar" aria-label="Fuente de la evidencia" placeholder="Fuente (p. ej., supervisión 2025)" value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} />
                <input className="hr-mapa-buscar" type="date" aria-label="Fecha de la evidencia" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
            ) : null}
            {falta ? <p className="hr-mapa-nota">{falta}.</p> : null}
            <div className="hr-mapa-acciones">
              <PulsoButton variant="secondary" size="sm" disabled={!vertices.length} onClick={() => setDibujoArea(vertices.slice(0, -1))}>Quitar el último punto</PulsoButton>
              <PulsoButton variant="secondary" size="sm" onClick={() => { setDibujoArea(null); setForm(FORM_VACIO); }}>Cancelar</PulsoButton>
              <PulsoButton
                variant="primary"
                size="sm"
                disabled={Boolean(falta)}
                onClick={() => {
                  onCambiar({ ...me, areas_excluidas: [...me.areas_excluidas, nuevaArea(form, lonlat, me.areas_excluidas, new Date())] });
                  setDibujoArea(null);
                  setForm(FORM_VACIO);
                }}
              >
                Guardar el área
              </PulsoButton>
            </div>
          </div>
        ) : (
          <PulsoButton variant="secondary" size="sm" disabled={deshabilitado} onClick={() => setDibujoArea([])}>Dibujar un área</PulsoButton>
        )}
      </div>

      {cortas.length ? (
        <div className="hr-me-cortas">
          <p className="hr-mapa-aviso">
            {cortas.length === 1 ? "1 zona no alcanza" : `${cortas.length} zonas no alcanzan`} con el marco elegible: {cortas.filter((z) => z.falta === "titulares").length} para sus titulares y {cortas.filter((z) => z.falta === "reemplazos").length} sólo para sus reemplazos.
          </p>
          <ul className="hr-me-zonas">
            {cortas.slice(0, 6).map((z) => (
              <li key={`${z.ubigeo}-${z.zona}`}>{nombreDistrito(z.distrito)} · zona {z.zona}: {z.manzanas} de {z.necesita} manzanas</li>
            ))}
          </ul>
        </div>
      ) : null}
      {decisiones.length ? (
        <div className="hr-me-decision">
          <p className="hr-mapa-aviso">
            {decisiones.map((d) => nombreDistrito(d.distrito)).join(", ")} {decisiones.length === 1 ? "pierde" : "pierden"} el 10 % o más de su población: antes de sortear, el equipo decide si redefine la población objetivo o lo acepta con justificación.
          </p>
          {decidido ? (
            <p className="hr-mapa-nota">Registrado en la bitácora: {decidido}</p>
          ) : (
            <>
              <div className="hr-mapa-acciones">
                <PulsoButton variant={decision === "redefinir" ? "primary" : "secondary"} size="sm" onClick={() => setDecision("redefinir")}>Redefinir la población objetivo</PulsoButton>
                <PulsoButton variant={decision === "aceptar" ? "primary" : "secondary"} size="sm" onClick={() => setDecision("aceptar")}>Aceptar con justificación</PulsoButton>
              </div>
              {decision ? (
                <>
                  <input className="hr-mapa-buscar" aria-label="Justificación de la decisión" placeholder={decision === "redefinir" ? "Cómo se redefine (p. ej., hogares fuera de zonas de riesgo)" : "Por qué se acepta la pérdida de cobertura"} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />
                  <PulsoButton
                    variant="secondary"
                    size="sm"
                    disabled={!justificacion.trim()}
                    onClick={() => {
                      const resumen = `${decision === "redefinir" ? "Se redefine la población objetivo" : "Se acepta la pérdida de cobertura"} en ${decisiones.map((d) => nombreDistrito(d.distrito)).join(", ")}: ${justificacion.trim()}`;
                      apiHojasRutaBitacoraAnotar("decision_cobertura", resumen, {
                        decision,
                        distritos: decisiones.map((d) => ({ ubigeo: d.ubigeo, cobertura_poblacion: d.cobertura_poblacion })),
                        marco_elegible: { minimo_viviendas: me.minimo_viviendas, areas_excluidas: me.areas_excluidas.length },
                      })
                        .then(() => {
                          setErrorDecision("");
                          setDecidido(resumen);
                        })
                        .catch((e: unknown) => setErrorDecision(`No se pudo registrar la decisión: ${e instanceof Error ? e.message : "error"}. Vuelve a intentarlo.`));
                    }}
                  >
                    Registrar la decisión
                  </PulsoButton>
                  {errorDecision ? <p className="hr-mapa-aviso" role="alert">{errorDecision}</p> : null}
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
