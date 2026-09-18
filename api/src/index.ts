import { readConfig } from "./config";
import { createRuntime } from "./runtime";

const config = readConfig();
const { app } = await createRuntime(config);

export default {
  port: config.port,
  idleTimeout: config.idleTimeoutSeconds,
  fetch: app.fetch,
};
