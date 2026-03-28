import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { getSchoolCount, initDb } from "./data/schoolStore.js";
import { listingsRouter } from "./routes/listings.js";

initDb();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    listings: getSchoolCount()
  });
});

app.use("/api", listingsRouter);

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
