import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { checkDatabaseConnectivity } from "@divan/db";

async function main() {
  assert.equal(await checkDatabaseConnectivity(""), false);
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    // Deliberately accept TCP but never complete PostgreSQL's handshake.
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const started = performance.now();
    assert.equal(await checkDatabaseConnectivity(`postgresql://test:test@127.0.0.1:${address.port}/test`), false);
    assert.ok(performance.now() - started < 5000, "Readiness must be bounded even when TCP is accepted");
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("database-health.selfcheck: ok");
}
void main();
