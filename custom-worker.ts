import { default as handler } from "./.open-next/worker.js";

import { LobbyStoreDO } from "./src/durable-objects/lobby-store-do";

export default {
  fetch: handler.fetch,
} satisfies ExportedHandler<CloudflareEnv>;

export { LobbyStoreDO };
