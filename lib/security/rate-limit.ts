import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  url: process.env.NUVERDIS_UPSTASH_KV_REST_API_URL!,
  token: process.env.NUVERDIS_UPSTASH_KV_REST_API_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "nuverdis:rl",
});

/**
 * Deduplicación (SET NX EX 60) + rate limit sliding window (10/min por usuario).
 * Fail-safe: si Upstash falla retorna true — Redis nunca bloquea el flujo principal.
 */
export async function checkRateLimitAndDedupe(
  userId: string,
  actionId: string
): Promise<boolean> {
  try {
    const dedupeKey = `nuverdis:dedup:${actionId}`;
    const isNew = await redis.set(dedupeKey, "1", { nx: true, ex: 60 });
    if (isNew === null) return false;

    const { success } = await ratelimit.limit(userId);
    return success;
  } catch (err) {
    console.warn("[rate-limit] Redis no disponible, fail-safe activo:", err);
    return true;
  }
}
