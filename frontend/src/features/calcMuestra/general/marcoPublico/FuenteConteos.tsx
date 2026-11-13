/**
 * Marco › Archivo › Tabla de conteos: para un público sin base por persona (cuántos hay por categoría o por cruce).
 * Se elige la hoja, se nombra la variable de las columnas si son un cruce (por ejemplo "Sexo"), se revisa la tabla
 * y se guarda como marco: la población es el total y cada fila es un segmento. Total, % y Meta se reconocen solos.
 */
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { apiMarcoPublicoConteos, apiMarcoPublicoDeclararConteos, type HojaDelMarco, type TablaDeConteos } from "../../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../../components/Alert";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { useCalcMuestraStore } from "../../store";
import { reconciliarEstudio } from "../modelo";
import { useMuestraGeneralStore } from "../store";
import { guardarEstudioPendiente } from "../useMuestraGeneral";
import { cifra, errorLegible, Pastilla } from "./piezas";

type FilaConteo = { categoria: string; i: number };

const clave = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** La hoja que se llama como el actor ("Estudiantes de pregrado") gana a la más grande del libro. */
export function hojaDelActor(hojas: readonly HojaDelMarco[], actor: string, sugerida: string): string {
  const datos = hojas.filter((h) => h.tipo === "datos");
  const a = clave(actor);
  const exacta = datos.find((h) => clave(h.nombre) === a);
  if (exacta) return exacta.nombre;
  const contiene = datos.find((h) => a && (clave(h.nombre).includes(a) || a.includes(clave(h.nombre))));
  return contiene?.nombre ?? (sugerida || datos[0]?.nombre || "");
}

export function FuenteConteos({ componenteId, actor, fileId, nombreArchivo, hojas, sugerida, onGuardado }: {
  componenteId: string;
  actor: string;
  fileId: string;
  nombreArchivo: string;
  hojas: readonly HojaDelMarco[];
  sugerida: string;
  onGuardado: () => void;
}) {
  const datos = hojas.filter((h) => h.tipo === "datos");
  const [hoja, setHoja] = useState(() => hojaDelActor(hojas, actor, sugerida));
  const [variable, setVariable] = useState("");
  const [variableLeida, setVariableLeida] = useState("");
  const [tabla, setTabla] = useState<{ clave: string; datos: TablaDeConteos | null; error: string | null }>({ clave: "", datos: null, error: null });
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  // El nombre de la variable se lee al salir del campo: no se relee la tabla con cada tecla.
  const claveLectura = JSON.stringify([fileId, hoja, variableLeida]);
  useEffect(() => {
    let vivo = true;
    apiMarcoPublicoConteos({ fileId, hoja, columnaVariable: variableLeida })
      .then((d) => { if (vivo) setTabla({ clave: claveLectura, datos: d, error: null }); })
      .catch((e: unknown) => { if (vivo) setTabla({ clave: claveLectura, datos: null, error: errorLegible(e) }); });
    return () => { vivo = false; };
    // La clave resume las dependencias que cambian la lectura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveLectura]);
  const actual = tabla.clave === claveLectura ? tabla.datos : null;
  const cruce = actual?.cruce ?? null;

  async function guardar() {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await guardarEstudioPendiente();
      const enviado = useCalcMuestraStore.getState().estudio;
      const res = await apiMarcoPublicoDeclararConteos({ componenteId, fileId, hoja, columnaVariable: variableLeida });
      const store = useCalcMuestraStore.getState();
      const r = reconciliarEstudio({ componenteId, actual: store.estudio, enviado, estudioRespuesta: res.estudio, componenteRespuesta: res.componente });
      if (r?.limpio) store.hydrate(r.estudio);
      else if (r) store.replaceEstudio(r.estudio);
      await useMuestraGeneralStore.getState().cargar({ forzar: true });
      onGuardado();
    } catch (e) {
      setErrorGuardar(errorLegible(e));
    } finally {
      setGuardando(false);
    }
  }

  const columnas: PulsoTableColumna<FilaConteo>[] = cruce ? [
    { id: "cat", encabezado: actual?.categoria || "Categoría", ancho: 260, celda: (f) => <strong>{f.categoria}</strong> },
    ...cruce.columnas.map((c, j): PulsoTableColumna<FilaConteo> => ({
      id: `c-${j}`, encabezado: cruce.columnaVariable ? c : "Personas", ancho: 110, tipo: "cifra", celda: (f) => cifra(cruce.conteos[f.i]?.[j] ?? 0),
    })),
    ...(cruce.columnas.length > 1 ? [{
      id: "total", encabezado: "Total", ancho: 110, tipo: "cifra" as const, celda: (f: FilaConteo) => cifra(cruce.conteos[f.i]?.reduce((s, x) => s + x, 0) ?? 0),
    }] : []),
  ] : [];

  return (
    <section className="cmmp-conteos" aria-label="Tabla de conteos">
      <div className="cmmp-formula">
        <div className="cmmp-ctl">
          <small>Archivo</small>
          <Pastilla>{nombreArchivo}</Pastilla>
        </div>
        {datos.length > 1 ? (
          <label className="cmmp-ctl">
            <small>Hoja</small>
            <PulsoSelect size="sm" value={hoja} ariaLabel="Hoja de la tabla de conteos" options={datos.map((h) => ({ value: h.nombre, label: h.nombre }))} onValueChange={(h) => { setHoja(h); setVariable(""); setVariableLeida(""); }} />
          </label>
        ) : null}
        {actual && actual.conteoColumnas.length > 1 ? (
          <label className="cmmp-ctl cmmp-ctl--ancho">
            <small>Variable de las columnas</small>
            <PulsoInput
              size="sm"
              value={variable}
              placeholder={actual.conteoColumnas.join(", ")}
              aria-label="Nombre de la variable de las columnas"
              onChange={(e) => setVariable(e.currentTarget.value)}
              onBlur={() => setVariableLeida(variable.trim())}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
          </label>
        ) : null}
      </div>
      {tabla.clave === claveLectura && tabla.error ? <div className="cmmp-pad"><Alert kind="error">{tabla.error}</Alert></div> : null}
      {actual ? (
        <>
          <div className="cmmp-cifras">
            <div><strong>{cifra(cruce?.total ?? 0)}</strong><small>personas en la tabla</small></div>
            <div><strong>{cifra(cruce?.filas.length ?? 0)}</strong><small>segmentos ({actual.categoria})</small></div>
          </div>
          {actual.calculadas.length ? (
            <div className="cmmp-leido cmmp-leido--sec">
              {actual.calculadas.map((c) => <Pastilla key={c.columna}>{c.columna}: no se usa</Pastilla>)}
            </div>
          ) : null}
          {actual.avisos.map((a) => <div key={a} className="cmmp-pad"><Alert kind="warn">{a}</Alert></div>)}
          <PulsoTable
            columnas={columnas}
            filas={(cruce?.filas ?? []).map((categoria, i) => ({ categoria, i }))}
            idDeFila={(f) => f.categoria}
            ariaLabel="Tabla de conteos leída"
            densidad="compacta"
            altoMaximo={2000}
          />
          {errorGuardar ? <div className="cmmp-pad"><Alert kind="error">{errorGuardar}</Alert></div> : null}
          <div className="cmmp-pie">
            <span className="cmmp-vacio-chico">Alcanza para la propuesta y las cuotas. El listado de envío necesita la base por persona.</span>
            <PulsoButton variant="primary" size="sm" onClick={() => void guardar()} disabled={guardando || !(cruce && cruce.total > 0)}>
              <Check size={14} aria-hidden="true" /> Guardar el marco
            </PulsoButton>
          </div>
        </>
      ) : null}
    </section>
  );
}
