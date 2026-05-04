import { Router, type IRouter } from "express";
import { whatsappService } from "../lib/whatsapp.js";
import {
  GetWhatsappStatusResponse,
  GetWhatsappQrResponse,
  LogoutWhatsappResponse,
  GetChatsResponse,
  GetChatMessagesParams,
  GetChatMessagesQueryParams,
  GetChatMessagesResponse,
  GetWhatsappStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/whatsapp/status", (_req, res) => {
  const status = whatsappService.getStatus();
  res.json(GetWhatsappStatusResponse.parse(status));
});

router.get("/whatsapp/qr", (_req, res) => {
  const qrData = whatsappService.getQr();
  if (!qrData.qr) {
    res.status(404).json({ error: "No QR code available yet" });
    return;
  }
  res.json(GetWhatsappQrResponse.parse(qrData));
});

router.post("/whatsapp/logout", async (_req, res) => {
  try {
    await whatsappService.logout();
    res.json(
      LogoutWhatsappResponse.parse({
        success: true,
        message: "Logged out successfully",
      }),
    );
  } catch {
    res.status(500).json({ success: false, message: "Failed to logout" });
  }
});

router.get("/whatsapp/chats", async (req, res) => {
  try {
    const chats = await whatsappService.getChats();
    res.json(GetChatsResponse.parse(chats));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch chats");
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

router.get("/whatsapp/chats/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = GetChatMessagesParams.parse(req.params);
    const { limit } = GetChatMessagesQueryParams.parse(req.query);
    const messages = await whatsappService.getChatMessages(chatId, limit);
    res.json(GetChatMessagesResponse.parse(messages));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/whatsapp/stats", async (req, res) => {
  try {
    const stats = await whatsappService.getStats();
    res.json(GetWhatsappStatsResponse.parse(stats));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
