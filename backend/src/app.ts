import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";
import { AppError } from "./utils/errors.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new AppError(403, "This origin is not allowed by the API CORS policy."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));
app.use(express.json({ limit: env.MAX_REQUEST_BYTES }));
app.use(express.urlencoded({ extended: false, limit: env.MAX_REQUEST_BYTES }));
app.use(morgan((tokens, req, res) => [
  tokens.method(req, res),
  req.path,
  tokens.status(req, res),
  `${tokens['response-time'](req, res)} ms`,
].join(" ")));
app.use(rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later.", errors: [] },
}));
app.use(env.API_BASE_PATH, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
