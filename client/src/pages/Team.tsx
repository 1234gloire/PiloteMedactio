import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DirectionGate } from "@/components/crm/Analytics";
import { EmptyState, PageHeader, StatCard, formatDate, labelFor } from "@/components/crm/Common";
import { CollaboratorDialog, GoalDialog, LeaveDialog } from "@/components/crm/GovernanceForms";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Check, Loader2, Plus, Target, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const leaveTone: Record<string, string> = {
  Demande: "bg-amber-50 text-amber-800 border-amber-200",
  Valide: "bg-teal-50 text-teal-700 border-teal-200",
  Refuse: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Team() {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [goalDialog, setGoalDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [collaboratorOpen, setCollaboratorOpen] = useState(false);

  const utils = trpc.useUtils();
  const access = trpc.governance.access.useQuery();
  const isManager = access.data?.hrAdmin === true;
  // Ouvrir un accès relève de l\u2019administration seule.
  const isAdmin = access.data?.role === "admin";
  const team = trpc.governance.hr.team.useQuery(undefined, { enabled: isManager });
  const leaves = trpc.governance.hr.leaves.useQuery(undefined, { enabled: access.data !== undefined });
  const decide = trpc.governance.hr.decideLeave.useMutation();

  const pending = leaves.data?.filter(leave => leave.status === "Demande") ?? [];
  const validated = leaves.data?.filter(leave => leave.status === "Valide") ?? [];

  const act = async (id: number, status: "Valide" | "Refuse") => {
    try {
      await decide.mutateAsync({ id, status });
      await Promise.all([utils.governance.hr.leaves.invalidate(), utils.governance.hr.team.invalidate(), utils.governance.notifications.list.invalidate()]);
      toast.success(status === "Valide" ? "Congé validé." : "Demande refusée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
    }
  };

  return (
    <DirectionGate loading={access.isLoading} forbidden={false}>
      <PageHeader
        eyebrow="RH & Équipe interne"
        title="Équipe Medactio"
        description="Collaborateurs, congés et objectifs individuels de l’équipe interne."
        actionLabel="Demander un congé"
        onAction={() => setLeaveOpen(true)}
      />

      <Tabs defaultValue={isManager ? "equipe" : "conges"}>
        <TabsList className="mb-5">
          {isManager ? <TabsTrigger value="equipe">Collaborateurs</TabsTrigger> : null}
          <TabsTrigger value="conges">Congés{pending.length ? ` (${pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="calendrier">Calendrier d’absences</TabsTrigger>
        </TabsList>

        {isManager ? (
          <TabsContent value="equipe">
            {team.isLoading ? (
              <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : team.data?.length ? (
              <>
                {isAdmin ? (
                  <Button onClick={() => setCollaboratorOpen(true)} className="mb-5 bg-[#123653]">
                    <Plus className="mr-2 h-4 w-4" />Enregistrer un collaborateur
                  </Button>
                ) : null}
                <div className="mb-5 grid gap-4 sm:grid-cols-3">
                  <StatCard label="Collaborateurs" value={String(team.data.length)} icon={Users} accent="navy" />
                  <StatCard label="Congés à valider" value={String(pending.length)} icon={CalendarDays} accent={pending.length ? "amber" : "teal"} />
                  <StatCard label="Objectifs atteints" value={`${team.data.reduce((sum, m) => sum + m.goalsReached, 0)} / ${team.data.reduce((sum, m) => sum + m.goalsTotal, 0)}`} icon={Target} accent="violet" />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {team.data.map(member => (
                    <Card key={member.id} className="border-0 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#123653]/8 font-semibold text-[#123653]">
                              {member.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{member.fullName}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.jobTitle || labelFor(member.role)}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">{labelFor(member.role)}</Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                          <div><p className="text-muted-foreground">Congés pris</p><p className="mt-1 font-semibold text-slate-900">{member.leave.taken} j</p></div>
                          <div><p className="text-muted-foreground">Solde restant</p><p className="mt-1 font-semibold text-slate-900">{member.leave.remaining} j</p></div>
                          <div><p className="text-muted-foreground">Objectifs</p><p className="mt-1 font-semibold text-slate-900">{member.goalsReached}/{member.goalsTotal}</p></div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{member.pendingLeaveCount ? `${member.pendingLeaveCount} demande(s) en attente` : "Aucune demande en attente"}</span>
                          <Button size="sm" variant="outline" className="bg-white" onClick={() => setGoalDialog({ open: true, item: { userId: member.id } })}>
                            <Plus className="mr-2 h-3.5 w-3.5" />Objectif
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={Users} title="Aucun collaborateur" description="Les comptes internes apparaissent ici dès leur première connexion." />
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="conges">
          {leaves.isLoading ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : leaves.data?.length ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {leaves.data.map(leave => (
                    <div key={leave.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><CalendarDays className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{leave.userName || "Collaborateur"}</p>
                          <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${leaveTone[leave.status]}`}>{labelFor(leave.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {labelFor(leave.type)} · du {formatDate(leave.startDate)} au {formatDate(leave.endDate)} · {leave.businessDays} jour{leave.businessDays > 1 ? "s" : ""} ouvré{leave.businessDays > 1 ? "s" : ""}
                        </p>
                      </div>
                      {isManager && leave.status === "Demande" ? (
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => act(leave.id, "Valide")} disabled={decide.isPending}><Check className="mr-1.5 h-4 w-4" />Valider</Button>
                          <Button size="sm" variant="outline" className="bg-white text-rose-600" onClick={() => act(leave.id, "Refuse")} disabled={decide.isPending}><X className="mr-1.5 h-4 w-4" />Refuser</Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={CalendarDays} title="Aucune demande" description="Vos demandes de congés apparaîtront ici." actionLabel="Demander un congé" onAction={() => setLeaveOpen(true)} />
          )}
        </TabsContent>

        <TabsContent value="calendrier">
          {validated.length ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold text-slate-900">Absences validées</h2>
                <div className="space-y-2.5">
                  {validated
                    .slice()
                    .sort((a, b) => a.startDate.localeCompare(b.startDate))
                    .map(leave => (
                      <div key={leave.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-[#123653] shadow-sm">
                          {(leave.userName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{leave.userName}</p>
                          <p className="text-xs text-muted-foreground">{labelFor(leave.type)} · {leave.businessDays} j ouvré{leave.businessDays > 1 ? "s" : ""}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={UserRound} title="Aucune absence validée" description="Les congés validés composent le calendrier de l’équipe." />
          )}
        </TabsContent>
      </Tabs>

      <LeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
      <CollaboratorDialog open={collaboratorOpen} onOpenChange={setCollaboratorOpen} />
      {goalDialog.open ? (
        <GoalDialog key={goalDialog.item?.userId ?? "new"} open={goalDialog.open} onOpenChange={open => setGoalDialog({ open })} userId={goalDialog.item?.userId} />
      ) : null}
    </DirectionGate>
  );
}
