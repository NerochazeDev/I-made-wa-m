import { createRequire } from "node:module";
import type { Client as ClientType } from "whatsapp-web.js";
import QRCode from "qrcode";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger.js";

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wweb = _require("whatsapp-web.js") as any;
const Client = wweb.Client as typeof ClientType;
const LocalAuth = wweb.LocalAuth;

type State =
  | "INITIALIZING"
  | "QR_READY"
  | "AUTHENTICATED"
  | "READY"
  | "DISCONNECTED";

interface ServiceState {
  state: State;
  qr: string | null;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  profilePicUrl: string | null;
}

class WhatsAppService {
  private client: InstanceType<typeof ClientType>;
  private state: ServiceState;
  private wss: WebSocketServer | null = null;

  constructor() {
    this.state = {
      state: "INITIALIZING",
      qr: null,
      qrDataUrl: null,
      phoneNumber: null,
      displayName: null,
      profilePicUrl: null,
    };
    this.client = this.createClient();
  }

  private createClient(): InstanceType<typeof ClientType> {
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
      puppeteer: {
        headless: true,
        executablePath: "/nix/store/m7qi78k6711fpwnrm4r2kn4p3ga3jal9-ungoogled-chromium-123.0.6312.105/bin/chromium",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      },
    });

    client.on("qr", async (qr: string) => {
      this.state.state = "QR_READY";
      this.state.qr = qr;
      try {
        this.state.qrDataUrl = await QRCode.toDataURL(qr);
      } catch {
        this.state.qrDataUrl = null;
      }
      this.broadcast({
        type: "qr",
        qr,
        qrDataUrl: this.state.qrDataUrl,
      });
      logger.info("QR code generated");
    });

    client.on("authenticated", () => {
      this.state.state = "AUTHENTICATED";
      this.state.qr = null;
      this.state.qrDataUrl = null;
      this.broadcast({ type: "status", state: "AUTHENTICATED" });
      logger.info("WhatsApp authenticated");
    });

    client.on("ready", async () => {
      this.state.state = "READY";
      try {
        const info = client.info;
        this.state.phoneNumber = info.wid.user;
        this.state.displayName = info.pushname;
      } catch {
        // ignore info fetch errors
      }
      this.broadcast({
        type: "status",
        state: "READY",
        phoneNumber: this.state.phoneNumber,
        displayName: this.state.displayName,
      });
      logger.info({ phone: this.state.phoneNumber }, "WhatsApp ready");
    });

    client.on("disconnected", (reason: string) => {
      this.state.state = "DISCONNECTED";
      this.broadcast({ type: "status", state: "DISCONNECTED", reason });
      logger.info({ reason }, "WhatsApp disconnected");
    });

    client.on("message", (message: MessageLike) => {
      this.broadcast({ type: "message", message: this.formatMessage(message) });
    });

    client.on("message_create", (message: MessageLike) => {
      if (message.fromMe) {
        this.broadcast({
          type: "message",
          message: this.formatMessage(message),
        });
      }
    });

    return client;
  }

  async initialize() {
    try {
      await this.client.initialize();
    } catch (err) {
      logger.error({ err }, "Failed to initialize WhatsApp client");
    }
  }

  setWss(wss: WebSocketServer) {
    this.wss = wss;
  }

  private broadcast(data: unknown) {
    if (!this.wss) return;
    const msg = JSON.stringify(data);
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }

  getStatus() {
    return {
      state: this.state.state,
      phoneNumber: this.state.phoneNumber,
      displayName: this.state.displayName,
      profilePicUrl: this.state.profilePicUrl,
    };
  }

  getQr() {
    return {
      qr: this.state.qr,
      qrDataUrl: this.state.qrDataUrl,
    };
  }

  async logout() {
    try {
      await this.client.logout();
    } catch {
      // ignore logout errors
    }
    this.state = {
      state: "INITIALIZING",
      qr: null,
      qrDataUrl: null,
      phoneNumber: null,
      displayName: null,
      profilePicUrl: null,
    };
    this.client = this.createClient();
    await this.initialize();
  }

  async getChats() {
    if (this.state.state !== "READY") return [];
    const chats = await this.client.getChats();
    return chats.map((chat: ChatLike) => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      lastMessage: (chat.lastMessage as MessageLike | undefined)?.body ?? null,
      lastMessageTimestamp:
        (chat.lastMessage as MessageLike | undefined)?.timestamp ?? null,
      unreadCount: chat.unreadCount,
      profilePicUrl: null,
      isArchived: chat.archived,
      isMuted: chat.isMuted,
    }));
  }

  async getChatMessages(chatId: string, limit: number = 50) {
    if (this.state.state !== "READY") return [];
    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    return messages.map((m: MessageLike) => this.formatMessage(m));
  }

  async getStats() {
    if (this.state.state !== "READY") {
      return {
        totalChats: 0,
        totalGroups: 0,
        totalPrivateChats: 0,
        unreadChats: 0,
        totalUnreadMessages: 0,
      };
    }
    const chats = await this.client.getChats();
    const totalGroups = chats.filter((c: ChatLike) => c.isGroup).length;
    const unreadChats = chats.filter((c: ChatLike) => c.unreadCount > 0).length;
    const totalUnreadMessages = chats.reduce(
      (sum: number, c: ChatLike) => sum + c.unreadCount,
      0,
    );
    return {
      totalChats: chats.length,
      totalGroups,
      totalPrivateChats: chats.length - totalGroups,
      unreadChats,
      totalUnreadMessages,
    };
  }

  private formatMessage(message: MessageLike) {
    return {
      id: message.id._serialized,
      body: message.body,
      timestamp: message.timestamp,
      fromMe: message.fromMe,
      author: message.author ?? null,
      type: message.type,
      hasMedia: message.hasMedia,
      isForwarded: message.isForwarded,
      isStarred: message.isStarred,
    };
  }
}

interface ChatLike {
  id: { _serialized: string };
  name: string;
  isGroup: boolean;
  lastMessage?: unknown;
  unreadCount: number;
  archived: boolean;
  isMuted: boolean;
}

interface MessageLike {
  id: { _serialized: string };
  body: string;
  timestamp: number;
  fromMe: boolean;
  author?: string;
  type: string;
  hasMedia: boolean;
  isForwarded: boolean;
  isStarred: boolean;
}

export const whatsappService = new WhatsAppService();
