import { randomInt } from "node:crypto";

// Unambiguous alphabet: no 0/O, 1/I/L — the admin reads this aloud or the
// owner retypes it from a message, so every character must be unmistakable.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generate a one-time password for concierge-provisioned owner accounts,
 * e.g. "K7MF-2QWX-9HTC": three dash-separated groups of four characters.
 *
 * Entropy is ~19.8 bits per group (31^4), ~59 bits total — plenty for a
 * short-lived, admin-delivered secret. It is single-use by construction:
 * the account is created with mustChangePassword=true, so the first login
 * forces the owner to replace it with a password of their own.
 */
export function generateOneTimePassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
      ""
    );
  return `${group()}-${group()}-${group()}`;
}
