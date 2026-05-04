import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { whatsappService } from "./lib/whatsapp.js";

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
whatsappService.setWss(wss);

wss.on("connection", (ws) => {
  logger.info("WebSocket client connected");
  const status = whatsappService.getStatus();
  ws.send(JSON.stringify({ type: "status", ...status }));

  const qr = whatsappService.getQr();
  if (qr.qr) {
    ws.send(JSON.stringify({ type: "qr", qr: qr.qr, qrDataUrl: qr.qrDataUrl }));
  }

  ws.on("close", () => {
    logger.info("WebSocket client disconnected");
  });
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  whatsappService.initialize().catch((err) => {
    logger.error({ err }, "WhatsApp init error");
  });
});
