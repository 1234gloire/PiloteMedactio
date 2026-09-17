import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Connexion par adresse professionnelle et mot de passe.
 *
 * Les comptes ne sont pas ouverts à l'inscription : un administrateur
 * enregistre le collaborateur, qui reçoit alors l'accès. Une adresse
 * authentifiée mais non enregistrée est refusée par l'API.
 */
type Mode = "connexion" | "oubli" | "envoye" | "renouvellement";

const shell = "relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f8f8] p-6";
const card = "relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(18,54,83,.12)] backdrop-blur";
const fieldClass = "h-12 bg-white";

function Marque() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#123653] text-lg font-bold text-white">M</div>
      <div>
        <p className="text-lg font-semibold tracking-tight text-[#123653]">MEDACTIO</p>
        <p className="text-xs font-medium uppercase tracking-[.18em] text-teal-700">Pilotage</p>
      </div>
    </div>
  );
}

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un lien de réinitialisation ouvre l'application en mode récupération :
  // l'utilisateur doit alors choisir un nouveau mot de passe.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setMode("renouvellement");
    });
    if (window.location.hash.includes("type=recovery")) setMode("renouvellement");
    return () => data.subscription.unsubscribe();
  }, []);

  const indisponible = () => {
    setError("L’authentification n’est pas configurée. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
    return true;
  };

  async function connexion(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!supabase) return void indisponible();

    setPending(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setPending(false);

    if (authError) {
      // Le message reste volontairement identique quelle que soit la cause :
      // distinguer « adresse inconnue » de « mot de passe erroné » révélerait
      // quelles adresses possèdent un compte.
      setError("Adresse ou mot de passe incorrect.");
    }
  }

  async function demanderReinitialisation(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!supabase) return void indisponible();

    setPending(true);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    setPending(false);
    // On confirme sans condition : indiquer qu'une adresse est inconnue
    // permettrait d'énumérer les comptes existants.
    setMode("envoye");
  }

  async function definirMotDePasse(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!supabase) return void indisponible();

    if (password.length < 10) {
      setError("Le mot de passe doit comporter au moins dix caractères.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (authError) {
      setError("Le mot de passe n’a pas pu être enregistré. Le lien a peut-être expiré.");
      return;
    }
    window.location.replace(window.location.origin);
  }

  return (
    <div className={shell}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,111,105,.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(18,54,83,.10),transparent_42%)]" />
      <div className={card}>
        <Marque />

        {mode === "connexion" ? (
          <>
            <div className="mb-7">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Espace interne sécurisé
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Connexion</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Accédez au pilotage de l’activité commerciale, clients, support et financière de Medactio.
              </p>
            </div>

            <form onSubmit={connexion} className="space-y-4">
              <div>
                <Label htmlFor="email" className="mb-2 block text-xs font-semibold text-slate-600">Adresse professionnelle</Label>
                <Input id="email" type="email" required autoComplete="email" placeholder="prenom.nom@medactio.fr"
                  value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} />
              </div>

              <div>
                <Label htmlFor="password" className="mb-2 block text-xs font-semibold text-slate-600">Mot de passe</Label>
                <div className="relative">
                  <Input id="password" type={visible ? "text" : "password"} required autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)} className={`${fieldClass} pr-11`} />
                  <button type="button" onClick={() => setVisible(v => !v)}
                    aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700">
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" size="lg" disabled={pending} className="h-12 w-full bg-[#123653] text-white hover:bg-[#0b2941]">
                {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connexion…</> : "Se connecter"}
              </Button>
            </form>

            <button onClick={() => { setMode("oubli"); setError(null); }}
              className="mt-4 w-full text-center text-sm font-medium text-teal-700 transition-colors hover:text-teal-900">
              Mot de passe oublié ?
            </button>
          </>
        ) : null}

        {mode === "oubli" ? (
          <>
            <button onClick={() => { setMode("connexion"); setError(null); }}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Retour
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Mot de passe oublié</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Indiquez votre adresse professionnelle : vous recevrez un lien pour en choisir un nouveau.
            </p>

            <form onSubmit={demanderReinitialisation} className="mt-6 space-y-4">
              <Input type="email" required autoComplete="email" placeholder="prenom.nom@medactio.fr"
                value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} aria-label="Adresse professionnelle" />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" size="lg" disabled={pending} className="h-12 w-full bg-[#123653] text-white hover:bg-[#0b2941]">
                {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi…</> : "Recevoir le lien"}
              </Button>
            </form>
          </>
        ) : null}

        {mode === "envoye" ? (
          <>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> Demande enregistrée
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Consultez votre messagerie</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Si un compte existe pour <span className="font-medium text-slate-800">{email}</span>, un lien de
              réinitialisation vient d’être envoyé. Il expire rapidement.
            </p>
            <Button variant="outline" className="mt-6 h-11 w-full" onClick={() => { setMode("connexion"); setPassword(""); }}>
              Revenir à la connexion
            </Button>
          </>
        ) : null}

        {mode === "renouvellement" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Choisissez un mot de passe</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Dix caractères au minimum. Évitez un mot de passe déjà utilisé ailleurs.
            </p>

            <form onSubmit={definirMotDePasse} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="new" className="mb-2 block text-xs font-semibold text-slate-600">Nouveau mot de passe</Label>
                <Input id="new" type={visible ? "text" : "password"} required minLength={10} autoComplete="new-password"
                  value={password} onChange={e => setPassword(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <Label htmlFor="confirm" className="mb-2 block text-xs font-semibold text-slate-600">Confirmation</Label>
                <Input id="confirm" type={visible ? "text" : "password"} required minLength={10} autoComplete="new-password"
                  value={confirmation} onChange={e => setConfirmation(e.target.value)} className={fieldClass} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} className="h-4 w-4 accent-teal-600" />
                Afficher les mots de passe
              </label>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" size="lg" disabled={pending} className="h-12 w-full bg-[#123653] text-white hover:bg-[#0b2941]">
                {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</> : "Enregistrer et se connecter"}
              </Button>
            </form>
          </>
        ) : null}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Accès réservé à l’équipe Medactio. Les comptes sont créés par un administrateur.
        </p>
      </div>
    </div>
  );
}
