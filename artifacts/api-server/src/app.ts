import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./middlewares/session";

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
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.use("/api", router);

// Serve built frontend in production (single-container deploy on Amvera).
// Static files are copied to ./public next to the bundled server.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidatePaths = [
  path.resolve(__dirname, "public"),
  path.resolve(__dirname, "../public"),
  path.resolve(process.cwd(), "public"),
];
const staticDir = candidatePaths.find((p) => fs.existsSync(path.join(p, "index.html")));

if (staticDir) {
  logger.info({ staticDir }, "Serving static frontend");
  app.use(
    express.static(staticDir, {
      index: false,
      maxAge: "1h",
      setHeaders: (res, p) => {
        if (/\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|ico)$/i.test(p)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // SPA fallback: any non-/api route returns index.html.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else if (process.env["NODE_ENV"] === "production") {
  logger.warn("No static frontend directory found; serving API only");
}

export default app;
