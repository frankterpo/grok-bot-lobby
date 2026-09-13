import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const absolute = `${pathToFileURL(join(srcRoot, specifier.slice(2))).href}.ts`;
    return nextResolve(absolute, context);
  }
  return nextResolve(specifier, context);
}
