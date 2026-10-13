// Importar la matriz de correspondencias por bloques (contrato E4-E7, R3).
//
// La matriz que el equipo escribe para una serie de mediciones es un documento
// por BLOQUES con un año por columna. El diálogo la sube, ata cada año a una
// base del estudio, muestra qué entraría y qué advierte el motor, y sólo
// entonces aplica. Direccionable con `?panel=importar-bloques`.
//
// La lógica vive en `armonizacionModel`; aquí sólo hay render y eventos.

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, ArrowLeft, Check, FileSpreadsheet, Upload, X } from "../../vendor/lucide-react";
import { apiUpload } from "../../api/estudio";
import {
  detectarAniosBloques,
  importarBloquesEquivalencias,
  type ImportacionBloques,
} from "../../api/equivalencias";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import {
  PANEL_IMPORTAR_BLOQUES,
  agruparAdvertencias,
  mapaPeriodosInicial,
  mapaPeriodosParaEnviar,
  mapaPeriodosValido,
} from "./armonizacionModel";
import "./ImportarBloquesDialog.css";

type Paso =
  | { tipo: "archivo" }
  | { tipo: "mapear"; fileId: string; nombre: string; anios: string[]; mapa: Record<string, string> }
  | {
    tipo: "vista";
    fileId: string;
    nombre: string;
    anios: string[];
    mapa: Record<string, string>;
    resultado: ImportacionBloques;
  };

export type ImportarBloquesDialogProps = {
  bases: string[];
  onAplicado: (out: ImportacionBloques) => void;
};

/** Botón que abre el diálogo. Vive en la cabecera de Equivalencias. */
export function ImportarBloquesBoton({ disabled }: { disabled?: boolean }) {
  const panel = usePanelDireccionable(PANEL_IMPORTAR_BLOQUES);
  return (
    <button
      type="button"
      className="pulso-secondary pulso-equiv-btn"
      onClick={panel.abrir}
      disabled={disabled}
      aria-haspopup="dialog"
    >
      <FileSpreadsheet size={14} aria-hidden="true" />
      Importar por bloques
    </button>
  );
}

export function ImportarBloquesDialog({ bases, onAplicado }: ImportarBloquesDialogProps) {
  const panel = usePanelDireccionable(PANEL_IMPORTAR_BLOQUES);
  const [paso, setPaso] = useState<Paso>({ tipo: "archivo" });
  const [hoja, setHoja] = useState("");
  const [ocupado, setOcupado] = useState<"" | "subir" | "previsualizar" | "aplicar">("");
  const [error, setError] = useState("");
  const archivoRef = useRef<HTMLInputElement>(null);

  const reiniciar = () => {
    setPaso({ tipo: "archivo" });
    setError("");
    setOcupado("");
  };

  const cerrar = () => {
    panel.cerrar();
    reiniciar();
  };

  const subir = async (file: File) => {
    setOcupado("subir");
    setError("");
    try {
      const subido = await apiUpload(file, "equivalencias");
      const anios = bases.length ? await detectarAniosBloques(subido.file_id, bases[0], hoja || undefined) : [];
      if (anios.length === 0) {
        setError("La hoja no trae columnas de año. Revisa que sea la matriz de correspondencias por bloques.");
        return;
      }
      setPaso({
        tipo: "mapear",
        fileId: subido.file_id,
        nombre: file.name,
        anios,
        mapa: mapaPeriodosInicial(anios, bases),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado("");
    }
  };

  const correr = async (modo: "previsualizar" | "aplicar") => {
    if (paso.tipo === "archivo") return;
    setOcupado(modo);
    setError("");
    try {
      const resultado = await importarBloquesEquivalencias({
        fileId: paso.fileId,
        mapaPeriodos: mapaPeriodosParaEnviar(paso.mapa),
        modo,
        hoja: hoja || undefined,
      });
      if (modo === "aplicar") {
        onAplicado(resultado);
        cerrar();
        return;
      }
      setPaso({ ...paso, tipo: "vista", resultado });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado("");
    }
  };

  const validez = paso.tipo === "archivo" ? null : mapaPeriodosValido(paso.mapa);

  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-bloques-velo" />
        <Dialog.Content
          className="pulso-bloques"
          {...panel.props}
          // Siempre medible: `ocupado` es una acción que el usuario disparó, no
          // la carga de la vista, y cada paso se pinta entero mientras corre.
          data-audit-ready="true"
          aria-describedby="pulso-bloques-descripcion"
        >
          <header className="pulso-bloques-cabecera">
            <div className="pulso-bloques-titular">
              <Dialog.Title className="pulso-bloques-titulo">Importar matriz por bloques</Dialog.Title>
              <Dialog.Close className="pulso-bloques-cerrar" aria-label="Cerrar">
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <Dialog.Description id="pulso-bloques-descripcion" className="pulso-bloques-regla">
              La matriz del proyecto lleva un bloque por pregunta y un año por columna. Cada año se
              ata a una base del estudio, y los códigos se validan contra el instrumento de esa base.
            </Dialog.Description>
            <ol className="pulso-bloques-pasos" aria-label="Pasos">
              {(["archivo", "mapear", "vista"] as const).map((p, i) => (
                <li key={p} aria-current={paso.tipo === p ? "step" : undefined}>
                  {i + 1}. {p === "archivo" ? "Archivo" : p === "mapear" ? "Años y bases" : "Revisión"}
                </li>
              ))}
            </ol>
          </header>

          {/* C4: un único dueño de scroll; cabecera y pie fijos. */}
          <div
            className="pulso-bloques-cuerpo"
            data-qa-geometry-group="carga-importar-bloques"
            data-qa-geometry-contract="intrinsic"
          >
            {error && (
              <p className="pulso-bloques-error" role="alert">{error}</p>
            )}

            {paso.tipo === "archivo" && (
              <section className="pulso-bloques-seccion" data-qa-geometry-member>
                <label className="pulso-bloques-campo">
                  <span>Hoja</span>
                  <input
                    value={hoja}
                    placeholder="Matriz de correspondencias"
                    onChange={(e) => setHoja(e.target.value)}
                  />
                </label>
                <p className="pulso-bloques-nota">
                  Déjala vacía si la hoja se llama «Matriz de correspondencias».
                </p>
                <button
                  type="button"
                  className="pulso-primary pulso-equiv-btn"
                  disabled={ocupado !== ""}
                  onClick={() => archivoRef.current?.click()}
                >
                  <Upload size={14} aria-hidden="true" />
                  {ocupado === "subir" ? "Leyendo la matriz…" : "Elegir archivo .xlsx"}
                </button>
                <input
                  ref={archivoRef}
                  className="pulso-equiv-archivo"
                  type="file"
                  accept=".xlsx,.xls"
                  tabIndex={-1}
                  aria-label="Matriz por bloques (.xlsx)"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void subir(file);
                  }}
                />
              </section>
            )}

            {paso.tipo !== "archivo" && (
              <section className="pulso-bloques-seccion" data-qa-geometry-member>
                <h3>Años de {paso.nombre}</h3>
                <table className="pulso-bloques-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Año en la matriz</th>
                      <th scope="col">Base del estudio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paso.anios.map((anio) => (
                      <tr key={anio}>
                        <td>{anio}</td>
                        <td>
                          <select
                            value={paso.mapa[anio] ?? ""}
                            disabled={paso.tipo === "vista" || ocupado !== ""}
                            aria-label={`Base para ${anio}`}
                            onChange={(e) =>
                              setPaso({ ...paso, mapa: { ...paso.mapa, [anio]: e.target.value } })
                            }
                          >
                            <option value="">No importar este año</option>
                            {bases.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validez && !validez.ok && <p className="pulso-bloques-nota is-aviso">{validez.motivo}</p>}
              </section>
            )}

            {paso.tipo === "vista" && <VistaPrevia resultado={paso.resultado} />}
          </div>

          <footer className="pulso-bloques-pie">
            {paso.tipo === "mapear" && (
              <>
                <button type="button" className="pulso-secondary pulso-equiv-btn" onClick={reiniciar} disabled={ocupado !== ""}>
                  <ArrowLeft size={14} aria-hidden="true" />
                  Otro archivo
                </button>
                <button
                  type="button"
                  className="pulso-primary pulso-equiv-btn"
                  disabled={ocupado !== "" || !validez?.ok}
                  onClick={() => void correr("previsualizar")}
                >
                  {ocupado === "previsualizar" ? "Revisando…" : "Previsualizar"}
                </button>
              </>
            )}
            {paso.tipo === "vista" && (
              <>
                <button
                  type="button"
                  className="pulso-secondary pulso-equiv-btn"
                  disabled={ocupado !== ""}
                  onClick={() => setPaso({ tipo: "mapear", fileId: paso.fileId, nombre: paso.nombre, anios: paso.anios, mapa: paso.mapa })}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Cambiar años
                </button>
                <button
                  type="button"
                  className="pulso-primary pulso-equiv-btn"
                  disabled={ocupado !== "" || paso.resultado.filas_importadas.length === 0}
                  onClick={() => void correr("aplicar")}
                >
                  <Check size={14} aria-hidden="true" />
                  {ocupado === "aplicar" ? "Aplicando…" : `Aplicar ${paso.resultado.resumen.n_filas} filas`}
                </button>
              </>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function VistaPrevia({ resultado }: { resultado: ImportacionBloques }) {
  const r = resultado.resumen;
  const grupos = agruparAdvertencias(resultado.advertencias);
  const cifras: [string, number][] = [
    ["Bloques", r.n_bloques],
    ["Filas", r.n_filas],
    ["Con armonización", r.n_con_armonizacion],
    ["Nuevas", r.nuevas],
    ["Actualizadas", r.actualizadas],
    ["Sin variables", r.n_sin_variables],
  ];
  const bases = Object.entries(r.por_base);
  return (
    <>
      <section className="pulso-bloques-seccion" data-qa-geometry-member aria-label="Resumen">
        <h3>Qué entraría{r.hoja ? ` desde «${r.hoja}»` : ""}</h3>
        <dl className="pulso-bloques-cifras">
          {cifras.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {bases.length > 0 && (
          <table className="pulso-bloques-tabla">
            <thead>
              <tr>
                <th scope="col">Base</th>
                <th scope="col">Año</th>
                <th scope="col" className="is-num">Variables</th>
                <th scope="col" className="is-num">Pendientes</th>
                <th scope="col" className="is-num">Códigos que la lista no tiene</th>
              </tr>
            </thead>
            <tbody>
              {bases.map(([base, b]) => (
                <tr key={base}>
                  <td>{base}</td>
                  <td>{b.anio}</td>
                  <td className="is-num">{b.n_variables}</td>
                  <td className={`is-num${b.n_pendientes ? " is-aviso" : ""}`}>{b.n_pendientes}</td>
                  <td className={`is-num${b.n_codigos_inexistentes ? " is-aviso" : ""}`}>{b.n_codigos_inexistentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {r.bloques_sin_variables.length > 0 && (
          <p className="pulso-bloques-nota is-aviso">
            Sin variable en ninguna base: {r.bloques_sin_variables.join(", ")}. Esos bloques no entran.
          </p>
        )}
      </section>

      <section className="pulso-bloques-seccion" data-qa-geometry-member aria-label="Advertencias">
        <h3>
          {r.n_advertencias === 0
            ? "Sin advertencias"
            : r.n_advertencias === 1
              ? "1 advertencia"
              : `${r.n_advertencias} advertencias`}
        </h3>
        {grupos.length === 0 ? (
          // C3: el vacío es de esta sección.
          <p className="pulso-bloques-nota">El motor no encontró nada que revisar.</p>
        ) : (
          <div className="pulso-bloques-grupos">
            {grupos.map((g) => (
              <details key={g.tipo} className="pulso-bloques-grupo">
                <summary>
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>{g.etiqueta}</span>
                  <span className="pulso-bloques-grupo-n">{g.n}</span>
                </summary>
                <ul>
                  {g.items.map((a, i) => (
                    <li key={`${a.id}-${a.base}-${i}`}>
                      <strong>{a.id || "Sin id"}</strong>
                      {a.base && <span className="pulso-bloques-base">{a.base}</span>}
                      <span>{a.mensaje}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
