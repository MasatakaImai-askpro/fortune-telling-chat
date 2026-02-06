import express from "express";
import session from "express-session";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

const PgStore = connectPgSimple(session);
const sessionMiddleware = session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "fortune-telling-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).substring(0, 80)}`;
      }
      log(logLine);
    }
  });

  next();
});

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

registerRoutes(app);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

interface ChatClient {
  ws: WebSocket;
  userId: number;
  roomId: string | null;
  fortunetellerId: number | null;
}

const clients = new Set<ChatClient>();

function broadcastToRoom(roomId: string, data: any) {
  const msg = JSON.stringify(data);
  Array.from(clients).forEach((client) => {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  });
}

wss.on("connection", async (ws, req) => {
  const sessionParser = new Promise<any>((resolve) => {
    const fakeRes = { end: () => {} } as any;
    sessionMiddleware(req as any, fakeRes, () => {
      resolve((req as any).session);
    });
  });

  const sess = await sessionParser;
  const userId = sess?.userId;

  if (!userId) {
    ws.close(1008, "Not authenticated");
    return;
  }

  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const params = url.searchParams;
  const roomIdParam = params.get("room_id");
  const fortunetellerIdParam = params.get("fortuneteller_id");

  const client: ChatClient = {
    ws,
    userId,
    roomId: roomIdParam,
    fortunetellerId: fortunetellerIdParam ? parseInt(fortunetellerIdParam) : null,
  };

  clients.add(client);

  if (roomIdParam) {
    try {
      const msgs = await storage.getMessagesByRoom(roomIdParam);
      ws.send(JSON.stringify({
        type: "history",
        room_id: roomIdParam,
        messages: msgs.map((m) => ({
          id: String(m.id),
          sender: m.sender,
          text: m.text,
          created_at: m.createdAt.toISOString(),
          attachments: [],
          free: false,
        })),
      }));
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }

  ws.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type !== "chat_message") return;

      const { sender, text, category, point } = data;
      let roomId = client.roomId;

      if (!roomId && client.fortunetellerId) {
        const room = await storage.getOrCreateRoom(client.fortunetellerId, userId);
        roomId = room.id;
        client.roomId = roomId;
        ws.send(JSON.stringify({ type: "room_init", room_id: roomId }));
      }

      if (!roomId) return;

      let costPt: number | null = null;
      let isLocked = false;

      if (sender === "fortuneteller") {
        if (category === "length_paying") {
          costPt = text.length * 2;
          isLocked = true;
        } else if (category === "healing" && point) {
          costPt = Number(point);
          isLocked = true;
        }
      }

      const msg = await storage.createMessage({
        roomId,
        sender,
        text,
        costPt,
        isLocked,
      });

      broadcastToRoom(roomId, {
        type: "new_message",
        message: {
          id: String(msg.id),
          sender: msg.sender,
          text: msg.text,
          created_at: msg.createdAt.toISOString(),
          attachments: [],
          free: false,
        },
      });
    } catch (e) {
      console.error("WS message error:", e);
    }
  });

  ws.on("close", () => {
    clients.delete(client);
  });
});

(async () => {
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
