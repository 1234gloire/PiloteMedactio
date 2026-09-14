import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

/**
 * Connexion par lien magique.
 *
 * Aucun mot de passe n'est géré par l'application : Supabase envoie un lien à
 * usage unique à l'adresse saisie. Seules les adresses déjà enregistrées dans
 * le projet Supabase peuvent aboutir.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError(
        "L’authentification n’est pas configurée. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY."
      );
      return;
    }

    setStatus("sending");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      setStatus("idle");
      setError("L’envoi a échoué. Vérifiez l’adresse saisie, puis réessayez.");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f8f8] p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,111,105,.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(18,54,83,.10),transparent_42%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(18,54,83,.12)] backdrop-blur">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#123653] text-lg font-bold text-white">M</div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-[#123653]">MEDACTIO</p>
            <p className="text-xs font-medium uppercase tracking-[.18em] text-teal-700">Pilotage</p>
          </div>
        </div>

        {status === "sent" ? (
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> Lien envoyé
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Consultez votre messagerie.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Un lien de connexion vient d’être envoyé à <span className="font-medium text-slate-800">{email}</span>. Il est valable une seule fois et expire rapidement.
            </p>
            <Button
              variant="outline"
              className="mt-6 h-11 w-full"
              onClick={() => {
                setStatus("idle");
                setEmail("");
              }}
            >
              Utiliser une autre adresse
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Espace interne sécurisé
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Bienvenue dans votre cockpit de pilotage.</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Saisissez votre adresse professionnelle : vous recevrez un lien de connexion, sans mot de passe à retenir.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="prenom.nom@medactio.fr"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="h-12 bg-white"
                aria-label="Adresse email professionnelle"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                size="lg"
                disabled={status === "sending"}
                className="h-12 w-full bg-[#123653] text-white hover:bg-[#0b2941]"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi en cours…
                  </>
                ) : (
                  "Recevoir mon lien de connexion"
                )}
              </Button>
            </form>
          </>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground">Accès réservé à l’équipe Medactio</p>
      </div>
    </div>
  );
}
