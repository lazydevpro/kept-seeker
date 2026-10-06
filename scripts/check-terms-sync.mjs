#!/usr/bin/env node
/**
 * The restricted-jurisdiction list lives twice: in the backend, which enforces it and sends it
 * to the app, and in the site, which prints it on /terms. They are separate builds with no path
 * between them, so this is what stops the terms saying one thing while the purchase sheet asks
 * the reader to confirm another. Run by CI.
 */

import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function list(source, name, file) {
  const block = source.match(
    new RegExp(`(?<![A-Z_])${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`),
  )?.[1];
  if (!block) throw new Error(`${file}: could not find ${name}`);
  return [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function parse(source, file) {
  const version = source.match(/TERMS_VERSION\s*=\s*(\d+)/)?.[1];
  if (!version) throw new Error(`${file}: could not find TERMS_VERSION`);
  return {
    version: Number(version),
    list: list(source, "RESTRICTED_JURISDICTIONS", file),
    crypto: list(source, "CRYPTO_RESTRICTED_JURISDICTIONS", file),
  };
}

const backend = parse(
  await read("backend/src/lib/terms.ts"),
  "backend/src/lib/terms.ts",
);
const web = parse(await read("web/lib/terms.ts"), "web/lib/terms.ts");

const sameList = (a, b) =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);
const same =
  backend.version === web.version &&
  sameList(backend.list, web.list) &&
  sameList(backend.crypto, web.crypto);

if (!same) {
  console.error(
    "Terms are out of sync between backend/src/lib/terms.ts and web/lib/terms.ts",
  );
  console.error("backend:", backend);
  console.error("web:    ", web);
  process.exit(1);
}
console.log(
  `Terms in sync: version ${backend.version}, ${backend.list.length} restricted jurisdictions, ${backend.crypto.length} for crypto.`,
);
