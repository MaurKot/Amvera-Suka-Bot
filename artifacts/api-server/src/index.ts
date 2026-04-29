import app from "./app";
import { logger } from "./lib/logger";
import { seedNpcsIfEmpty } from "./game/npcSeed";
import { seedWorldIfEmpty } from "./game/worldSeed";
import { runStartupMigrations } from "./lib/migrations";
import { startWorldDirectorScheduler } from "./game/worldDirector";

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

async function start(): Promise<void> {
  // Run idempotent schema migrations BEFORE seeders, since seeders rely on
  // the new columns/tables (personality, motives, location graph, etc).
  try {
    await runStartupMigrations(logger);
  } catch (err) {
    logger.error({ err }, "Startup migrations failed — continuing, but state may be inconsistent");
  }

  try {
    await seedWorldIfEmpty(logger);
  } catch (err) {
    logger.error({ err }, "Failed to seed world");
  }
  try {
    await seedNpcsIfEmpty(logger);
  } catch (err) {
    logger.error({ err }, "Failed to seed NPCs");
  }

  // P4 — Master AI cycle. Disabled if WORLD_CYCLE_ENABLED=false.
  if (process.env["WORLD_CYCLE_ENABLED"] !== "false") {
    try {
      startWorldDirectorScheduler(logger);
    } catch (err) {
      logger.error({ err }, "Failed to start world director scheduler");
    }
  } else {
    logger.info("World director scheduler disabled via WORLD_CYCLE_ENABLED=false");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

void start();
