import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const dataDir = path.resolve(currentDir, "../data");

export const config = {
  port: Number(process.env.PORT ?? 8787),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5-mini",
  agentQlApiKey: process.env.AGENTQL_API_KEY ?? "",
  enableLiveScrape: process.env.ENABLE_LIVE_SCRAPE === "true",
  databasePath: path.join(dataDir, "tuition.db")
};

