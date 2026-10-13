// Base .sav sin XLSForm (contrato E4-E7, R1).
//
// Una medición anterior puede existir sólo como .sav: sin formulario, pero con
// etiquetas de variable y de valor. El backend sintetiza un instrumento mínimo
// desde esas etiquetas y registra la base en el estudio igual que una carga
// manual, así la base entra a la matriz de equivalencias y a Analítica. Ninguna
// columna se pierde, incluida la de pesos (`factor_ponderacion`).

import { useRef, useState } from "react";
import { CheckCircle2, Database, Upload } from "../../vendor/lucide-react";
import {
  apiEstudioAddBaseSav,
  apiUpload,
  isSavLikeFileName,
  type BaseSavRegistrada,
} from "../../api/estudio";
import "./BaseSavPanel.css";
import { PulsoButton } from "../../components/PulsoButton";

export type BaseSavPanelProps = {
  /** Se llama tras registrar la base: Carga refresca el estudio. */
  onRegistrada?: (r: BaseSavRegistrada) => void;
  disabled?: boolean;
};

type Estado =
  | { tipo: "inicial" }
  | { tipo: "subiendo" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; resultado: BaseSavRegistrada };

/** Nombre de base propuesto desde el archivo: sin extensión, en minúsculas y sin espacios. */
export function nombreDesdeArchivo(nombre: string): string {
  return nombre
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function BaseSavPanel({ onRegistrada, disabled }: BaseSavPanelProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const archivoRef = useRef<HTMLInputElement>(null);
  const subiendo = estado.tipo === "subiendo";

  const registrar = async () => {
    if (!archivo || !nombre.trim()) return;
    setEstado({ tipo: "subiendo" });
    try {
      const subido = await apiUpload(archivo, "sav");
      const resultado = await apiEstudioAddBaseSav({ data_file_id: subido.file_id, nombre: nombre.trim() });
      setEstado({ tipo: "listo", resultado });
      setArchivo(null);
      setNombre("");
      onRegistrada?.(resultado);
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section
      className="pulso-base-sav"
      aria-labelledby="pulso-base-sav-titulo"
      data-qa-geometry-group="carga-base-sav"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="pulso-base-sav-head" data-qa-geometry-member>
        <Database size={16} aria-hidden="true" />
        <div>
          <h3 id="pulso-base-sav-titulo">Base .sav sin formulario</h3>
          <p>
            Para una medición que sólo existe como .sav. El instrumento se arma desde sus
            etiquetas y la base entra al estudio como cualquier otra.
          </p>
        </div>
      </header>

      <div className="pulso-base-sav-form" data-qa-geometry-member>
        <PulsoButton
          variant="secondary"
          className="pulso-base-sav-btn"
          onClick={() => archivoRef.current?.click()}
          disabled={disabled || subiendo}
        >
          <Upload size={14} aria-hidden="true" />
          {archivo ? archivo.name : "Elegir archivo .sav"}
        </PulsoButton>
        <input
          ref={archivoRef}
          className="pulso-base-sav-archivo"
          type="file"
          accept=".sav"
          tabIndex={-1}
          aria-label="Archivo .sav"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!file) return;
            if (!isSavLikeFileName(file.name)) {
              setEstado({ tipo: "error", mensaje: "El archivo debe ser .sav." });
              return;
            }
            setArchivo(file);
            if (!nombre.trim()) setNombre(nombreDesdeArchivo(file.name));
            setEstado({ tipo: "inicial" });
          }}
        />
        <label className="pulso-base-sav-nombre">
          <span>Nombre de la base</span>
          <input
            value={nombre}
            placeholder="Nombre de la base"
            disabled={disabled || subiendo}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <PulsoButton
          variant="primary"
          className="pulso-base-sav-btn"
          disabled={disabled || subiendo || !archivo || !nombre.trim()}
          onClick={() => void registrar()}
        >
          {subiendo ? "Registrando…" : "Registrar base"}
        </PulsoButton>
      </div>

      {estado.tipo === "error" && (
        <p className="pulso-base-sav-error" role="alert">{estado.mensaje}</p>
      )}
      {estado.tipo === "listo" && (
        <div className="pulso-base-sav-sintesis" role="status">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>
            <strong>{estado.resultado.base.nombre}</strong> registrada con{" "}
            {estado.resultado.sintesis.n_variables} variables, de las cuales{" "}
            {estado.resultado.sintesis.n_select_one} son de opción única con{" "}
            {estado.resultado.sintesis.n_listas} listas y {estado.resultado.sintesis.n_opciones} opciones.
            El estudio tiene ahora {estado.resultado.n_bases} de {estado.resultado.max_bases} bases.
          </span>
        </div>
      )}
    </section>
  );
}
