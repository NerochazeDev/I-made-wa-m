import { Router, type IRouter } from "express";
import { whatsappManager } from "../lib/whatsapp.js";
import {
  ListAccountsResponse,
  ListAccountsResponseItem,
  CreateAccountBody,
  DeleteAccountParams,
  DeleteAccountResponse,
  GetAccountStatusParams,
  GetAccountStatusResponse,
  GetAccountQrParams,
  GetAccountQrResponse,
  LogoutAccountParams,
  LogoutAccountResponse,
  GetAccountChatsParams,
  GetAccountChatsResponse,
  GetAccountChatMessagesParams,
  GetAccountChatMessagesQueryParams,
  GetAccountChatMessagesResponse,
  GetAccountStatsParams,
  GetAccountStatsResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/whatsapp/accounts", (_req, res) => {
  res.json(ListAccountsResponse.parse(whatsappManager.listRecords()));
});

router.post("/whatsapp/accounts", async (req, res) => {
  const { label } = CreateAccountBody.parse(req.body);
  const account = await whatsappManager.createAccount(label);
  res.status(201).json(ListAccountsResponseItem.parse(account));
});

router.delete("/whatsapp/accounts/:accountId", async (req, res) => {
  const { accountId } = DeleteAccountParams.parse(req.params);
  const removed = await whatsappManager.removeAccount(accountId);
  if (!removed) {
    res.status(404).json({ success: false, message: "Account not found" });
    return;
  }
  res.json(DeleteAccountResponse.parse({ success: true, message: "Account removed" }));
});

router.get("/whatsapp/accounts/:accountId/status", (req, res) => {
  const { accountId } = GetAccountStatusParams.parse(req.params);
  const account = whatsappManager.getAccount(accountId);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json(GetAccountStatusResponse.parse(account.getStatus()));
});

router.get("/whatsapp/accounts/:accountId/qr", (req, res) => {
  const { accountId } = GetAccountQrParams.parse(req.params);
  const account = whatsappManager.getAccount(accountId);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  const qrData = account.getQr();
  if (!qrData.qr) {
    res.status(404).json({ error: "No QR code available yet" });
    return;
  }
  res.json(GetAccountQrResponse.parse(qrData));
});

router.post("/whatsapp/accounts/:accountId/logout", async (req, res) => {
  const { accountId } = LogoutAccountParams.parse(req.params);
  const account = whatsappManager.getAccount(accountId);
  if (!account) {
    res.status(404).json({ success: false, message: "Account not found" });
    return;
  }
  try {
    await account.logout();
    res.json(LogoutAccountResponse.parse({ success: true, message: "Logged out successfully" }));
  } catch {
    res.status(500).json({ success: false, message: "Failed to logout" });
  }
});

router.get("/whatsapp/accounts/:accountId/chats", async (req, res) => {
  const { accountId } = GetAccountChatsParams.parse(req.params);
  const account = whatsappManager.getAccount(accountId);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  try {
    const chats = await account.getChats();
    res.json(GetAccountChatsResponse.parse(chats));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch chats");
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

router.get("/whatsapp/accounts/:accountId/chats/:chatId/messages", async (req, res) => {
  const { accountId, chatId } = GetAccountChatMessagesParams.parse(req.params);
  const { limit } = GetAccountChatMessagesQueryParams.parse(req.query);
  const account = whatsappManager.getAccount(accountId);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  try {
    const messages = await account.getChatMessages(chatId, limit);
    res.json(GetAccountChatMessagesResponse.parse(messages));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/whatsapp/accounts/:accountId/chats/:chatId/messages", async (req, res) => {
  const { accountId, chatId } = SendMessageParams.parse(req.params);
  const { body } = SendMessageBody.parse(req.body);
  const account = whatsappManager.getAccount(accountId);
  if (!account) {
    res.status(404).json({ success: false, message: "Account not found" });
    return;
  }
  try {
    await account.sendMessage(chatId, body);
    res.json(SendMessageResponse.parse({ success: true, message: "Message sent" }));
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

router.get("/whatsapp/accounts/:accountId/messages/:messageId/media", async (req, res) => {
  const { accountId, messageId } = req.params as { accountId: string; messageId: string };
  const account = whatsappManager.getAccount(accountId);
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  try {
    const media = await account.getMessageMedia(decodeURIComponent(messageId));
    if (!media) { res.status(404).json({ error: "Media not available" }); return; }
    const buf = Buffer.from(media.data, "base64");
    res.setHeader("Content-Type", media.mimetype);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (media.filename) res.setHeader("Content-Disposition", `inline; filename="${media.filename}"`);
    res.send(buf);
  } catch (err) {
    req.log.error({ err }, "Failed to serve media");
    res.status(500).json({ error: "Failed to fetch media" });
  }
});

router.get("/whatsapp/accounts/:accountId/stats", async (req, res) => {
  const { accountId } = GetAccountStatsParams.parse(req.params);
  const account = whatsappManager.getAccount(accountId);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  try {
    const stats = await account.getStats();
    res.json(GetAccountStatsResponse.parse(stats));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
