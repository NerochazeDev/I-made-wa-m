import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production (Render), serve the built frontend from the public/ directory
const publicDir = join(process.cwd(), "public");
if (process.env["NODE_ENV"] === "production" && existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback — all non-API routes return index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(publicDir, "index.html"));
  });
}

export default app;
