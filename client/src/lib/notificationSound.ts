/**
 * Signal sonore des notifications.
 *
 * Le son est un confort, jamais le mécanisme d'alerte principal : il suppose
 * que l'onglet soit ouvert, et les navigateurs refusent toute lecture audio
 * tant que l'utilisateur n'a pas interagi avec la page. Le canal fiable reste
 * l'email.
 *
 * Le son est synthétisé plutôt que chargé depuis un fichier : deux notes
 * brèves suffisent, sans requête réseau ni dépendance.
 */

const STORAGE_KEY = "medactio-notification-sound";

export function isSoundEnabled(): boolean {
  try {
    // Activé par défaut : l'utilisateur coupe s'il le souhaite.
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Stockage indisponible (navigation privée) : le réglage ne survit pas
    // à la session, ce qui reste acceptable pour un confort.
  }
}

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  return context;
}

/**
 * Autorise la lecture audio à la première interaction de l'utilisateur.
 * Sans cela, le navigateur bloque silencieusement le premier signal.
 */
export function primeSound(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Deux notes brèves et discrètes, volontairement peu intrusives. */
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return;

  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    // L'utilisateur n'a pas encore interagi : le navigateur refuserait.
    void ctx.resume();
    return;
  }

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);

  [880, 1174.66].forEach((frequency, index) => {
    const start = now + index * 0.14;
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(gain);
    // Attaque douce puis extinction : évite le claquement d'un signal brut.
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  });
}
