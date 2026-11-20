import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectDirectory = resolve(process.argv[2] ?? ".");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read valid JSON from ${path}: ${error.message}`);
  }
}

try {
  const vercelConfig = readJson(join(projectDirectory, "vercel.json"));
  if (vercelConfig.outputDirectory !== null) {
    throw new Error("Vercel outputDirectory must be null so the Next.js build directory is detected automatically.");
  }

  const buildDirectory = join(projectDirectory, ".next");
  const manifestNames = [
    "routes-manifest.json",
    "prerender-manifest.json",
    "images-manifest.json",
    "required-server-files.json",
  ];
  const manifests = Object.fromEntries(
    manifestNames.map((name) => [name, readJson(join(buildDirectory, name))]),
  );

  const requiredFiles = manifests["required-server-files.json"];
  if (requiredFiles.config?.distDir !== ".next" || requiredFiles.config?.output !== "export") {
    throw new Error("Next.js must write its build manifests to .next while exporting the static site.");
  }

  console.log("Vercel build verified: automatic output directory and Next.js manifests in .next.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
