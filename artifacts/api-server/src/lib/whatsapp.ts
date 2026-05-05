import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Client as ClientType } from "whatsapp-web.js";
import QRCode from "qrcode";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger.js";

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wweb = _require("whatsapp-web.js") as any;
const Client = wweb.Client as typeof ClientType;
const LocalAuth = wweb.LocalAuth;

const CHROMIUM_PATH =
  process.env["CHROMIUM_PATH"] ??
  "/nix/store/m7qi78k6711fpwnrm4r2kn4p3ga3jal9-ungoogled-chromium-123.0.6312.105/bin/chromium";
const ACCOUNTS_FILE = ".wwebjs_accounts.json";

// Maximum reconnect backoff in ms (5 minutes)
const MAX_BACKOFF_MS = 5 * 60 * 1000;

type State =
  | "INITIALIZING"
  | "QR_READY"
  | "AUTHENTICATED"
  | "READY"
  | "DISCONNECTED";

interface AccountRecord {
  id: string;
  label: string;
  createdAt: string;
}

interface AccountState {
  state: State;
  qr: string | null;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  profilePicUrl: string | null;
  pairingCode: string | null;
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
  downloadMedia?: () => Promise<{ data: string; mimetype: string; filename?: string } | null>;
}

class WhatsAppAccount {
  readonly id: string;
  private client: InstanceType<typeof ClientType>;
  private state: AccountState;
  private manager: WhatsAppManager;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(id: string, manager: WhatsAppManager) {
    this.id = id;
    this.manager = manager;
    this.state = {
      state: "INITIALIZING",
      qr: null,
      qrDataUrl: null,
      phoneNumber: null,
      displayName: null,
      profilePicUrl: null,
      pairingCode: null,
    };
    this.client = this.createClient();
  }

  private createClient(): InstanceType<typeof ClientType> {
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: this.id, dataPath: ".wwebjs_auth" }),
      puppeteer: {
        headless: true,
        executablePath: CHROMIUM_PATH,
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
      this.manager.broadcast({
        type: "qr",
        accountId: this.id,
        qr,
        qrDataUrl: this.state.qrDataUrl,
      });
      logger.info({ accountId: this.id }, "QR code generated");
    });

    client.on("authenticated", () => {
      this.reconnectAttempts = 0;
      this.state.state = "AUTHENTICATED";
      this.state.qr = null;
      this.state.qrDataUrl = null;
      this.state.pairingCode = null;
      this.manager.broadcast({ type: "status", accountId: this.id, state: "AUTHENTICATED" });
      logger.info({ accountId: this.id }, "WhatsApp authenticated");
    });

    client.on("ready", async () => {
      this.reconnectAttempts = 0;
      this.state.state = "READY";
      this.state.pairingCode = null;
      try {
        const info = client.info;
        this.state.phoneNumber = info.wid.user;
        this.state.displayName = info.pushname;
      } catch {
        // ignore info fetch errors
      }
      this.manager.broadcast({
        type: "status",
        accountId: this.id,
        state: "READY",
        phoneNumber: this.state.phoneNumber,
        displayName: this.state.displayName,
      });
      logger.info({ accountId: this.id, phone: this.state.phoneNumber }, "WhatsApp ready");

      // Keep-alive: ping the WA Web socket every 30 s so the session never
      // idles out on the server side.
      if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = setInterval(async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.client as any).pupPage?.evaluate(() => 1);
        } catch {
          // If the page is gone the disconnected event will fire; ignore here.
        }
      }, 30_000);
    });

    client.on("disconnected", (reason: string) => {
      if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
      this.state.state = "DISCONNECTED";
      this.manager.broadcast({ type: "status", accountId: this.id, state: "DISCONNECTED", reason });
      logger.info({ accountId: this.id, reason }, "WhatsApp disconnected");

      // Don't reconnect if this was an explicit logout or the account was destroyed
      if (this.destroyed || reason === "LOGOUT") return;

      this.scheduleReconnect();
    });

    client.on("message", (message: MessageLike) => {
      this.manager.broadcast({
        type: "message",
        accountId: this.id,
        message: this.formatMessage(message),
      });
    });

    client.on("message_create", (message: MessageLike) => {
      if (message.fromMe) {
        this.manager.broadcast({
          type: "message",
          accountId: this.id,
          message: this.formatMessage(message),
        });
      }
    });

    return client;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    // Exponential backoff: 5s, 10s, 20s, 40s … capped at 5 min
    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), MAX_BACKOFF_MS);
    this.reconnectAttempts += 1;
    logger.info(
      { accountId: this.id, attempt: this.reconnectAttempts, delayMs: delay },
      "Scheduling WhatsApp reconnect",
    );

    this.reconnectTimer = setTimeout(async () => {
      if (this.destroyed) return;
      logger.info({ accountId: this.id, attempt: this.reconnectAttempts }, "Attempting reconnect");
      this.state.state = "INITIALIZING";
      this.state.qr = null;
      this.state.qrDataUrl = null;
      this.manager.broadcast({ type: "status", accountId: this.id, state: "INITIALIZING" });

      try { await this.client.destroy(); } catch { /* ignore */ }
      this.manager.clearLocksForAccount(this.id);
      this.client = this.createClient();
      await this.initialize();
    }, delay);
  }

  private clearChromiumLocks() {
    const profileDir = join(".wwebjs_auth", `session-${this.id}`);
    if (!existsSync(profileDir)) return;
    const lockNames = new Set(["SingletonLock", "SingletonCookie", "SingletonSocket"]);
    const scanDir = (dir: string) => {
      let entries: string[] = [];
      try { entries = readdirSync(dir); } catch { return; }
      for (const entry of entries) {
        const full = join(dir, entry);
        if (lockNames.has(entry)) {
          try { rmSync(full, { force: true }); } catch { /* ignore */ }
        }
      }
    };
    scanDir(profileDir);
    scanDir(join(profileDir, "Default"));
  }

  async initialize() {
    this.clearChromiumLocks();
    try {
      await this.client.initialize();
    } catch (err) {
      logger.error({ err, accountId: this.id }, "Failed to initialize WhatsApp client");
      this.state.state = "DISCONNECTED";
      this.manager.broadcast({ type: "status", accountId: this.id, state: "DISCONNECTED", reason: "launch_failed" });
      if (!this.destroyed) this.scheduleReconnect();
    }
  }

  async destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    try {
      await this.client.destroy();
    } catch {
      // ignore errors
    }
  }

  getStatus() {
    return {
      state: this.state.state,
      phoneNumber: this.state.phoneNumber,
      displayName: this.state.displayName,
      profilePicUrl: this.state.profilePicUrl,
      pairingCode: this.state.pairingCode,
    };
  }

  getQr() {
    return {
      qr: this.state.qr,
      qrDataUrl: this.state.qrDataUrl,
    };
  }

  async logout() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.client.logout();
    } catch {
      // ignore
    }
    this.destroyed = false;
    this.reconnectAttempts = 0;
    this.state = {
      state: "INITIALIZING",
      qr: null,
      qrDataUrl: null,
      phoneNumber: null,
      displayName: null,
      profilePicUrl: null,
      pairingCode: null,
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
      lastMessageTimestamp: (chat.lastMessage as MessageLike | undefined)?.timestamp ?? null,
      unreadCount: chat.unreadCount,
      profilePicUrl: null,
      isArchived: chat.archived,
      isMuted: chat.isMuted,
    }));
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    // requestPairingCode must be called while the client is initialising
    // (i.e. QR_READY state — the page has loaded but no auth yet).
    if (this.state.state !== "QR_READY" && this.state.state !== "INITIALIZING") {
      throw new Error("Client must be in QR_READY or INITIALIZING state to request a pairing code");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = await (this.client as any).requestPairingCode(phoneNumber);
    this.state.pairingCode = code as string;
    this.manager.broadcast({ type: "pairing_code", accountId: this.id, code });
    logger.info({ accountId: this.id, phoneNumber }, "Pairing code generated");
    return code as string;
  }

  async sendMessage(chatId: string, body: string) {
    if (this.state.state !== "READY") {
      throw new Error("Client not ready");
    }
    const msg = await this.client.sendMessage(chatId, body);
    return this.formatMessage(msg as MessageLike);
  }

  async getChatMessages(chatId: string, limit = 50) {
    if (this.state.state !== "READY") return [];
    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    return messages.map((m: MessageLike) => this.formatMessage(m));
  }

  async getMessageMedia(messageId: string): Promise<{ data: string; mimetype: string; filename?: string } | null> {
    if (this.state.state !== "READY") return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = await (this.client as any).getMessageById(messageId) as MessageLike | null;
      if (!msg || !msg.hasMedia || !msg.downloadMedia) return null;
      const media = await msg.downloadMedia();
      return media;
    } catch (err) {
      logger.error({ err, messageId, accountId: this.id }, "Failed to download media");
      return null;
    }
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
      id: message.id?._serialized ?? "",
      body: message.body ?? "",
      timestamp: message.timestamp ?? 0,
      fromMe: message.fromMe ?? false,
      author: message.author ?? null,
      type: message.type ?? "chat",
      hasMedia: message.hasMedia ?? false,
      isForwarded: message.isForwarded ?? false,
      isStarred: message.isStarred ?? false,
    };
  }
}

function clearAllChromiumLocks(authRoot: string) {
  const lockNames = new Set(["SingletonLock", "SingletonCookie", "SingletonSocket"]);
  const walk = (dir: string) => {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (lockNames.has(entry)) {
        try { rmSync(full, { force: true }); logger.info({ file: full }, "Removed stale Chromium lock"); } catch { /* ignore */ }
      } else {
        walk(full);
      }
    }
  };
  if (existsSync(authRoot)) walk(authRoot);
}

class WhatsAppManager {
  private accounts = new Map<string, WhatsAppAccount>();
  private records: AccountRecord[] = [];
  private wss: WebSocketServer | null = null;
  private readonly authRoot = ".wwebjs_auth";

  constructor() {
    clearAllChromiumLocks(this.authRoot);
    this.loadRecords();
  }

  private loadRecords() {
    try {
      if (existsSync(ACCOUNTS_FILE)) {
        const raw = readFileSync(ACCOUNTS_FILE, "utf-8");
        this.records = JSON.parse(raw) as AccountRecord[];
      }
    } catch {
      this.records = [];
    }
  }

  private saveRecords() {
    writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.records, null, 2), "utf-8");
  }

  setWss(wss: WebSocketServer) {
    this.wss = wss;
  }

  broadcast(data: unknown) {
    if (!this.wss) return;
    const msg = JSON.stringify(data);
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }

  /** Called by WhatsAppAccount during reconnect to clear its own locks */
  clearLocksForAccount(accountId: string) {
    const profileDir = join(this.authRoot, `session-${accountId}`);
    const lockNames = new Set(["SingletonLock", "SingletonCookie", "SingletonSocket"]);
    const scanDir = (dir: string) => {
      let entries: string[] = [];
      try { entries = readdirSync(dir); } catch { return; }
      for (const entry of entries) {
        if (lockNames.has(entry)) {
          try { rmSync(join(dir, entry), { force: true }); } catch { /* ignore */ }
        }
      }
    };
    scanDir(profileDir);
    scanDir(join(profileDir, "Default"));
  }

  listRecords(): AccountRecord[] {
    return this.records;
  }

  async initializeAll() {
    for (const record of this.records) {
      const account = new WhatsAppAccount(record.id, this);
      this.accounts.set(record.id, account);
      account.initialize().catch((err) => {
        logger.error({ err, accountId: record.id }, "Account init error");
      });
    }
  }

  async destroyAll() {
    const destroys = Array.from(this.accounts.values()).map((a) => a.destroy());
    await Promise.allSettled(destroys);
    this.accounts.clear();
  }

  async createAccount(label: string): Promise<AccountRecord> {
    const record: AccountRecord = {
      id: randomUUID(),
      label,
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    this.saveRecords();
    const account = new WhatsAppAccount(record.id, this);
    this.accounts.set(record.id, account);
    account.initialize().catch((err) => {
      logger.error({ err, accountId: record.id }, "Account init error");
    });
    return record;
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) return false;
    await account.destroy();
    this.accounts.delete(accountId);
    this.records = this.records.filter((r) => r.id !== accountId);
    this.saveRecords();
    try {
      rmSync(`.wwebjs_auth/session-${accountId}`, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return true;
  }

  getAccount(accountId: string): WhatsAppAccount | undefined {
    return this.accounts.get(accountId);
  }

  getAllCurrentState() {
    const out: { accountId: string; status: ReturnType<WhatsAppAccount["getStatus"]>; qr: ReturnType<WhatsAppAccount["getQr"]> }[] = [];
    for (const [id, account] of this.accounts) {
      out.push({ accountId: id, status: account.getStatus(), qr: account.getQr() });
    }
    return out;
  }
}

export const whatsappManager = new WhatsAppManager();
