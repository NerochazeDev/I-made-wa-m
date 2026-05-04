import { createServer } from "node:http";
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

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  whatsappManager.initializeAll().catch((err) => {
    logger.error({ err }, "WhatsApp manager init error");
  });
});
