/**
 * Evolution API v2 — WhatsApp message sender.
 *
 * Requires env vars:
 *   EVOLUTION_API_URL        — base URL of your Evolution API instance
 *   EVOLUTION_API_KEY        — global or instance API key
 *   EVOLUTION_INSTANCE_NAME  — the WhatsApp instance name
 */

import axios from "axios";
import { logger } from "./logger";

const baseUrl      = () => process.env.EVOLUTION_API_URL ?? "";
const apiKey       = () => process.env.EVOLUTION_API_KEY ?? "";
const instanceName = () => process.env.EVOLUTION_INSTANCE ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";

/** Normalise a phone string to a plain numeric format with country code. */
function normalisePhone(raw: string): string {
  // Strip everything except digits
  let digits = raw.replace(/\D/g, "");
  // If starts with 0, assume Indian local → replace with 91
  if (digits.startsWith("0")) digits = "91" + digits.slice(1);
  // If no country code (10 digits), prepend 91
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const url = baseUrl();
  const key = apiKey();
  const instance = instanceName();

  if (!url || !key || !instance) {
    logger.create("Evolution").warn("Missing config — skipping WhatsApp message");
    return false;
  }

  const number = normalisePhone(phone);
  if (number.length < 10) {
    logger.create("Evolution").warn(`Invalid phone number: ${phone}`);
    return false;
  }

  try {
    await axios.post(
      `${url}/message/sendText/${instance}`,
      {
        number,
        text: message,
      },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: key,
        },
        timeout: 15_000,
      }
    );
    logger.create("Evolution").info(`Message sent to ${number}`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.create("Evolution").error(`Failed to send to ${number}: ${msg}`);
    return false;
  }
}
