import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.info(`Aavya API listening on port ${env.PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close((error) => {
      if (error) {
        console.error("API shutdown failed:", error);
        process.exitCode = 1;
      }
    });
  });
}
