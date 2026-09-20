#!/usr/bin/env node

function fail(err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${message}`);
  process.exit(1);
}

process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

try {
  await import("../index.js");
} catch (err) {
  fail(err);
}
