export type CampaignMetricInput = {
  id: number;
  name: string;
  channel: string;
  objective?: string | null;
  budget: string | number;
  targetLeads: number;
  attributedRevenue: string | number;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  leadsGenerated?: number;
  createdAt?: Date;
};

export type MarketingLeadMetricInput = {
  id: number;
  campaignId?: number | null;
  status: string;
  createdAt: Date;
};

export type MarketingEventMetricInput = {
  id: number;
  campaignId?: number | null;
  registrationCount: number;
  attendeeCount: number;
  meetingsBooked: number;
  status: string;
  scheduledAt: Date;
};

export type ContentMetricInput = {
  id: number;
  campaignId?: number | null;
  status: string;
  publishDate?: string | null;
};

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const percent = (numerator: number, denominator: number) => denominator > 0 ? round(numerator / denominator * 100) : 0;

export function calculateMarketingMetrics(input: {
  campaigns: CampaignMetricInput[];
  leads: MarketingLeadMetricInput[];
  events: MarketingEventMetricInput[];
  content: ContentMetricInput[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const campaignMetrics = input.campaigns.map(campaign => {
    const leads = input.leads.filter(lead => lead.campaignId === campaign.id);
    const events = input.events.filter(event => event.campaignId === campaign.id);
    const leadCount = leads.length;
    const qualifiedLeads = leads.filter(lead => ["Qualifie", "RDV Planifie", "Converti"].includes(lead.status)).length;
    const meetingsBooked = leads.filter(lead => ["RDV Planifie", "Converti"].includes(lead.status)).length
      + events.reduce((sum, event) => sum + event.meetingsBooked, 0);
    const convertedLeads = leads.filter(lead => lead.status === "Converti").length;
    const budget = Number(campaign.budget || 0);
    const revenue = Number(campaign.attributedRevenue || 0);
    return {
      ...campaign,
      budget,
      attributedRevenue: revenue,
      leadCount,
      qualifiedLeads,
      meetingsBooked,
      convertedLeads,
      cpl: leadCount ? round(budget / leadCount, 0) : null,
      qualificationRate: percent(qualifiedLeads, leadCount),
      conversionRate: percent(convertedLeads, leadCount),
      roi: budget > 0 ? round((revenue - budget) / budget * 100) : null,
      targetProgress: campaign.targetLeads > 0 ? percent(leadCount, campaign.targetLeads) : 0,
    };
  });

  const byChannel = Array.from(new Set(input.campaigns.map(campaign => campaign.channel))).map(channel => {
    const campaigns = campaignMetrics.filter(campaign => campaign.channel === channel);
    const budget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);
    const leads = campaigns.reduce((sum, campaign) => sum + campaign.leadCount, 0);
    const clients = campaigns.reduce((sum, campaign) => sum + campaign.convertedLeads, 0);
    const revenue = campaigns.reduce((sum, campaign) => sum + campaign.attributedRevenue, 0);
    return {
      channel,
      campaigns: campaigns.length,
      budget,
      leads,
      clients,
      cpl: leads ? round(budget / leads, 0) : null,
      conversionRate: percent(clients, leads),
      roi: budget > 0 ? round((revenue - budget) / budget * 100) : null,
    };
  }).sort((a, b) => b.leads - a.leads);

  const registrations = input.events.reduce((sum, event) => sum + event.registrationCount, 0);
  const attendees = input.events.reduce((sum, event) => sum + event.attendeeCount, 0);
  const eventMeetings = input.events.reduce((sum, event) => sum + event.meetingsBooked, 0);
  const totalBudget = campaignMetrics.reduce((sum, campaign) => sum + campaign.budget, 0);
  const totalRevenue = campaignMetrics.reduce((sum, campaign) => sum + campaign.attributedRevenue, 0);
  const totalLeads = input.leads.length;
  const convertedLeads = input.leads.filter(lead => lead.status === "Converti").length;
  const published = input.content.filter(item => item.status === "Publie").length;
  const upcomingContent = input.content.filter(item => item.publishDate && new Date(`${item.publishDate}T23:59:59Z`) >= now && item.status !== "Publie").length;

  return {
    summary: {
      totalBudget,
      totalRevenue,
      totalLeads,
      activeCampaigns: input.campaigns.filter(campaign => campaign.status === "En Cours").length,
      cpl: totalLeads ? round(totalBudget / totalLeads, 0) : null,
      conversionRate: percent(convertedLeads, totalLeads),
      roi: totalBudget > 0 ? round((totalRevenue - totalBudget) / totalBudget * 100) : null,
      publishedContent: published,
      upcomingContent,
      attendanceRate: percent(attendees, registrations),
      eventMeetingRate: percent(eventMeetings, attendees),
    },
    campaigns: campaignMetrics.sort((a, b) => b.leadCount - a.leadCount),
    byChannel,
  };
}
