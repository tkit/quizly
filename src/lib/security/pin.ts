import { createHash } from 'crypto';

export function hashPin(pin: string) {
  return createHash('sha256').update(pin).digest('hex');
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}
