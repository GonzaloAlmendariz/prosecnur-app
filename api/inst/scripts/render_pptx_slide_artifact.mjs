#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

async function importArtifactTool(specifier) {
  if (!specifier) {
    return import("@oai/artifact-tool/dist/artifact_tool.mjs");
  }
  if (specifier.startsWith("file:")) return import(specifier);
  if (path.isAbsolute(specifier)) return import(pathToFileURL(specifier).href);
  return import(specifier);
}

const args = parseArgs(process.argv.slice(2));
const pptxPath = path.resolve(String(args.pptx || ""));
const outputPath = path.resolve(String(args.output || ""));
const slideIndex = Number.parseInt(String(args["slide-index"] || "1"), 10);
const scale = Number.parseFloat(String(args.scale || "2"));

if (!pptxPath || !outputPath || !Number.isFinite(slideIndex) || slideIndex < 1) {
  throw new Error("Usage: render_pptx_slide_artifact.mjs --pptx <file.pptx> --output <slide.png> [--slide-index 1] [--scale 2] [--module <artifact_tool.mjs>]");
}

const artifact = await importArtifactTool(args.module || process.env.PROSECNUR_ARTIFACT_TOOL_MODULE || "");
const { FileBlob, PresentationFile } = artifact;
if (!FileBlob?.load || !PresentationFile?.importPptx) {
  throw new Error("artifact-tool runtime does not expose FileBlob.load and PresentationFile.importPptx");
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
const count = presentation.slides?.count ?? 0;
if (slideIndex > count) {
  throw new Error(`Slide index ${slideIndex} is out of range; presentation has ${count} slide(s).`);
}

const slide = presentation.slides.getItem(slideIndex - 1);
const png = await presentation.export({ slide, format: "png", scale });
const bytes = Buffer.from(await png.arrayBuffer());
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, bytes);

console.log(JSON.stringify({
  ok: true,
  renderer: "artifact-tool",
  slide_index: slideIndex,
  slides: count,
  output: outputPath,
  size: bytes.length,
}));
