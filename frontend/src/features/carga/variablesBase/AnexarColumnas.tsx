// Variables de la base › anexar columnas desde otro archivo: variables de
// cruce u otras que vienen creadas aparte. Se unen por un identificador común
// y aparecen entre las columnas propias de la base para declararlas.

import { useId, useState } from "react";
import { apiUpload, uploadKindForDataFile } from "../../../api/client";
import { apiAnexarColumnas, apiAnexarVista, type AnexarVista } from "../../../api/estudio";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";

export function AnexarColumnas({ base, onAnexadas }: { base: string; onAnexadas: () => Promise<void> | void }) {
  const id = useId();
  const [archivoId, setArchivoId] = useState("");
  const [vista, setVista] = useState<AnexarVista | null>(null);
  const [clave, setClave] = useState("");
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const leer = async (f: File | null) => {
    if (!f) return;
    setOcupado(true);
    setMensaje(null);
    try {
      const up = await apiUpload(f, uploadKindForDataFile(f));
      const v = await apiAnexarVista(base, up.file_id);
      setArchivoId(up.file_id);
      setVista(v);
      setClave(v.claves[0]?.clave ?? "");
      setElegidas(v.columnas.filter((c) => !c.ya_en_la_base && c.n_con_dato > 0).map((c) => c.nombre));
    } catch (e) {
      setMensaje({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  };
  const anexar = async () => {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await apiAnexarColumnas(base, archivoId, clave, elegidas);
      setMensaje({ ok: true, texto: `${elegidas.length === 1 ? "Columna anexada" : `${elegidas.length} columnas anexadas`}: ${formatoConteo(r.n_con_dato)} de ${formatoConteoDe(r.n_base, "caso")} tienen dato. Ya aparecen arriba para declararlas.` });
      setVista(null);
      await onAnexadas();
    } catch (e) {
      setMensaje({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  };
  const k = vista?.claves.find((c) => c.clave === clave);

  return (
    <section className="pulso-armon-seccion" aria-labelledby={`${id}-t`} data-qa-geometry-member>
      <div className="pulso-armon-seccion-titulo">
        <h3 id={`${id}-t`}>Columnas desde otro archivo</h3>
        <p className="pulso-armon-ayuda">Variables que vienen creadas aparte (por ejemplo, de cruce). Se unen por un identificador común.</p>
      </div>
      {!vista ? (
        <label className="pulso-button pulso-button--secondary pulso-button--sm" aria-disabled={ocupado}>
          {ocupado ? "Leyendo…" : "Elegir archivo"}
          <input type="file" accept=".xlsx,.xls,.csv,.sav" className="pulso-sr-only" disabled={ocupado}
                 onChange={(e) => void leer(e.target.files?.[0] ?? null)} />
        </label>
      ) : !vista.claves.length ? (
        <p className="pulso-armon-error" role="alert">
          «{vista.archivo}» no comparte un identificador con la base (_uuid, respondent_id, código PULSO…).
          <PulsoButton variant="ghost" size="sm" onClick={() => setVista(null)}>Elegir otro</PulsoButton>
        </p>
      ) : (
        <div className="pulso-vb-anexar">
          <p>
            Unir por{" "}
            <select value={clave} aria-label="Identificador común" onChange={(e) => setClave(e.target.value)}>
              {vista.claves.map((c) => <option key={c.clave} value={c.clave}>{c.clave}</option>)}
            </select>
            {k ? ` · coinciden ${formatoConteo(k.n_coinciden)} de ${formatoConteoDe(k.n_base, "caso")} de la base` : ""}
            {k && k.repetidas_en_archivo ? ` · ${formatoConteoDe(k.repetidas_en_archivo, "identificador repetido", "identificadores repetidos")} en el archivo (se usa el primero)` : ""}
          </p>
          <ul className="pulso-vb-anexar-lista">
            {vista.columnas.map((c) => (
              <li key={c.nombre}>
                <label>
                  <input type="checkbox" disabled={c.ya_en_la_base} checked={elegidas.includes(c.nombre)}
                         onChange={() => setElegidas((x) => x.includes(c.nombre) ? x.filter((n) => n !== c.nombre) : [...x, c.nombre])} />
                  <code>{c.nombre}</code>
                  <small>{c.ya_en_la_base ? "la base ya la tiene" : `${formatoConteoDe(c.n_valores, "valor", "valores")} · ${formatoConteo(c.n_con_dato)} con dato`}</small>
                </label>
              </li>
            ))}
          </ul>
          <span className="pulso-vb-anexar-acciones">
            <PulsoButton variant="primary" size="sm" disabled={ocupado || !elegidas.length || !clave} onClick={() => void anexar()}>
              Anexar {elegidas.length ? formatoConteoDe(elegidas.length, "columna") : ""}
            </PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={() => setVista(null)}>Cancelar</PulsoButton>
          </span>
        </div>
      )}
      {mensaje ? <p className={mensaje.ok ? "pulso-armon-ayuda" : "pulso-armon-error"} role={mensaje.ok ? "status" : "alert"}>{mensaje.texto}</p> : null}
    </section>
  );
}
