import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { whatsappManager } from "./lib/whatsapp.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Kill any stale Chromium processes left over from a previous server run.
// Without this, Chromium refuses to launch because the SingletonLock still
// points to the old PID which is still alive in the container.
try {
  execSync("pkill -f ungoogled-chromium || true", { stdio: "ignore" });
  // Give OS a moment to release file locks
  await new Promise((r) => setTimeout(r, 500));
  logger.info("Cleaned up stale Chromium processes");
} catch {
  // ignore
}

const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
whatsappManager.setWss(wss);

wss.on("connection", (ws) => {
  logger.info("WebSocket client connected");

  const allState = whatsappManager.getAllCurrentState();
  for (const { accountId, status, qr } of allState) {
    ws.send(JSON.stringify({ type: "status", accountId, ...status }));
    if (qr.qr) {
      ws.send(JSON.stringify({ type: "qr", accountId, qr: qr.qr, qrDataUrl: qr.qrDataUrl }));
    }
  }

  ws.on("close", () => {
    logger.info("WebSocket client disconnected");
  });
});

// Graceful shutdown: destroy all WhatsApp clients so Chromium exits cleanly
// and does not leave a stale SingletonLock behind.
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  await whatsappManager.destroyAll();
  process.exit(0);
}

process.on("SIGTERM", () => { shutdown("SIGTERM").catch(() => process.exit(1)); });
process.on("SIGINT",  () => { shutdown("SIGINT").catch(() => process.exit(1)); });

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  whatsappManager.initializeAll().catch((err) => {
    logger.error({ err }, "WhatsApp manager init error");
  });
});
