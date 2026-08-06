// Equivalencias entre públicos (ADR 0062).
//
// Declara qué pregunta de un público es la misma que la de otro. Sin esa tabla,
// comparar públicos depende de la memoria del analista frente a un selector que
// muestra la misma etiqueta —«Servicio de salud»— para tres preguntas distintas,
// y el error no da ninguna señal: en el PPT medido, un grupo comparaba «¿Conoce
// bienestar psicológico?» de docentes contra «¿Ha utilizado…?» de estudiantes,
// 90 % contra 31 %.
//
// La superficie tiene dos entradas deliberadas y en este orden: generar la
// plantilla poblada (la vía principal del ADR) y subir una ya escrita.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  GitCompare,
  Upload,
} from "../../vendor/lucide-react";
import {
  generarPlantillaEquivalencias,
  getEquivalencias,
  importarEquivalencias,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
} from "../../api/equivalencias";
import { apiUpload } from "../../api/estudio";
import { downloadUrl } from "../../api/core";
import "./EquivalenciasPanel.css";

export type EquivalenciasPanelProps = {
  /** Se dispara tras importar, para que la página refresque lo que dependa. */
  onImported?: () => void;
};

function resumenAplicacion(imp: EquivalenciasImportacion): {
  aplicadas: number;
  conservadas: number;
} {
  return Object.values(imp.aplicacion ?? {}).reduce(
    (acc, base) => ({
      aplicadas: acc.aplicadas + (base.aplicadas ?? 0),
      conservadas: acc.conservadas + (base.conservadas ?? 0),
    }),
    { aplicadas: 0, conservadas: 0 },
  );
}

export function EquivalenciasPanel({ onImported }: EquivalenciasPanelProps) {
  const [estado, setEstado] = useState<EquivalenciasEstado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<"" | "plantilla" | "importar">("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      setEstado(await getEquivalencias());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const onGenerar = useCallback(async () => {
    setOcupado("plantilla");
    setError("");
    try {
      const out = await generarPlantillaEquivalencias();
      // Mismo camino que el resto de artefactos de la sesión: `downloadUrl`
      // resuelve el prefijo de la API, que en dev no es el origen de la página.
      const url = downloadUrl(out.file_id);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setAviso(`Plantilla generada: ${out.filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado("");
    }
  }, []);

  const onSubir = useCallback(
    async (file: File) => {
      setOcupado("importar");
      setError("");
      try {
        const subido = await apiUpload(file, "equivalencias");
        const imp = await importarEquivalencias(subido.file_id);
        setEstado(imp.estado);
        const { aplicadas, conservadas } = resumenAplicacion(imp);
        setAviso(
          conservadas > 0
            ? `${aplicadas} etiquetas aplicadas. ${conservadas} se conservaron porque ya estaban editadas a mano.`
            : `${aplicadas} etiquetas aplicadas en ${imp.estado.bases.length} públicos.`,
        );
        onImported?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setOcupado("");
      }
    },
    [onImported],
  );

  if (cargando && !estado) {
    return (
      <section className="pulso-equiv" aria-label="Equivalencias entre públicos">
        <p className="pulso-equiv-cargando">Revisando la declaración del estudio…</p>
      </section>
    );
  }

  const declarada = Boolean(estado?.declarada);
  const bases = estado?.bases ?? [];
  const desfasadas = estado?.desfasadas ?? [];

  // C1: seccion independiente, no una coleccion de pares. Su alto es intrinseco
  // a proposito — medido, el contenedor de Carga usa filas `auto` con
  // `align-content: start`, asi que estirar esta superficie fabricaria vacio
  // interior en vez de mostrar mas datos. El espacio de abajo pertenece al area
  // de scroll, igual que en sus hermanas.
  return (
    <section
      className="pulso-equiv"
      aria-label="Equivalencias entre públicos"
      data-qa-geometry-group="carga-equivalencias"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="pulso-equiv-head">
        <div className="pulso-equiv-title">
          <GitCompare size={18} aria-hidden="true" />
          <div>
            <strong>La misma pregunta en cada público</strong>
            <small>
              Cada público nombra sus variables distinto. Declarar la equivalencia es lo
              que permite compararlos sin emparejar a mano.
            </small>
          </div>
        </div>
        <div className="pulso-equiv-actions">
          <button
            type="button"
            className="pulso-secondary pulso-equiv-btn"
            onClick={() => void onGenerar()}
            disabled={ocupado !== ""}
          >
            <Download size={14} aria-hidden="true" />
            {declarada ? "Descargar plantilla actual" : "Generar plantilla"}
          </button>
          <label className="pulso-secondary pulso-equiv-btn pulso-equiv-btn-file">
            <Upload size={14} aria-hidden="true" />
            Subir matriz
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={ocupado !== ""}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onSubir(file);
              }}
            />
          </label>
        </div>
      </header>

      {error && (
        <p className="pulso-equiv-error" role="alert">
          {error}
        </p>
      )}
      {aviso && !error && <p className="pulso-equiv-aviso">{aviso}</p>}

      {/* C3: el vacío vive dentro de este contenedor, que es el dueño de la
          capacidad. No se deja aire suelto en el panel. */}
      <div
        className="pulso-equiv-cuerpo"
        data-qa-geometry-capacity="owned"
        data-surface-contract="carga-equivalencias"
      >
        {!declarada ? (
          // C5 categoría 1: vacío legítimo — el estudio todavía no la declaró.
          // El estado dice qué falta y cómo se llena, dentro de su propia caja.
          <div className="pulso-equiv-vacio">
            <p>
              <strong>Este estudio todavía no declara equivalencias.</strong>
            </p>
            <p>
              Genera la plantilla: sale con las variables y etiquetas de cada público ya
              puestas. Empareja las filas que son la misma pregunta, escribe su etiqueta
              estándar y súbela.
            </p>
            <p className="pulso-equiv-vacio-nota">
              Sin esto, comparar dos públicos exige recordar qué variable corresponde a
              cuál en cada uno.
            </p>
          </div>
        ) : (
          <>
            <ul className="pulso-equiv-resumen" aria-label="Cobertura por público">
              {bases.map((base) => {
                const cob = estado?.cobertura?.[base];
                const huerfanas = cob?.huerfanas ?? [];
                const desfasada = desfasadas.includes(base);
                return (
                  <li
                    key={base}
                    data-qa-geometry-group="carga-equivalencias-base"
                    data-qa-geometry-contract="equal"
                    className={desfasada || huerfanas.length > 0 ? "is-attention" : "is-ready"}
                  >
                    <span className="pulso-equiv-resumen-estado" aria-hidden="true">
                      {desfasada || huerfanas.length > 0 ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </span>
                    <span className="pulso-equiv-resumen-copy">
                      <strong>{base}</strong>
                      <small>
                        {cob ? `${cob.n_calzan} de ${cob.n_declaradas} variables declaradas` : "—"}
                      </small>
                      {desfasada && (
                        <small className="pulso-equiv-alerta">
                          El formulario cambió desde que se importó: revisa esta columna.
                        </small>
                      )}
                      {huerfanas.length > 0 && (
                        <small className="pulso-equiv-alerta">
                          {huerfanas.length === 1
                            ? `${huerfanas[0]} ya no existe en el formulario.`
                            : `${huerfanas.length} variables ya no existen en el formulario.`}
                        </small>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="pulso-equiv-pie">
              {estado?.n_filas} preguntas declaradas
              {typeof estado?.n_sin_etiqueta === "number" && estado.n_sin_etiqueta > 0
                ? ` · ${estado.n_sin_etiqueta} todavía sin etiqueta estándar`
                : ""}
              {estado?.importada_en ? ` · importada el ${estado.importada_en.slice(0, 10)}` : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
