import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { getListingCount, seedListingsIfEmpty } from "./db/database.js";
import { listingsRouter } from "./routes/listings.js";

seedListingsIfEmpty();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    listings: getListingCount()
  });
});

app.use("/api", listingsRouter);

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

