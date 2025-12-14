import { redis } from "./../integration/redis";

export async function getInfo() {
  const keys = await redis.keys("hipermidia:server:*:*");

  const servers: Record<string, { metrics?: string, logs?: string[] }> = {};

  await Promise.all(
    keys.map(async (key) => {
      const [, , serverId, type] = key.split(":");
      if (type !== "metrics" && type !== "logs") return;

      let value;
      if (type === "metrics") {
        value = await redis.get(key); // string
      } else if (type === "logs") {
        value = await redis.lrange(key, 0, -1); // array de strings
      }

      if (!servers[serverId as string]) servers[serverId as string] = {};
      servers[serverId as string][type] = value;
    })
  );

  return servers;
}