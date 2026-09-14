import { describe, expect, it } from "vitest";
import { calculateMarketingMetrics } from "./marketing.logic";

describe("calculateMarketingMetrics", () => {
  it("calcule les performances campagne, canal, événement et contenu", () => {
    const result = calculateMarketingMetrics({
      now: new Date("2026-09-14T12:00:00Z"),
      campaigns: [{ id: 1, name: "Campagne test", channel: "Webinaire", budget: "1000", targetLeads: 4, attributedRevenue: "3000", status: "En Cours", startDate: "2026-09-01", endDate: "2026-10-01", ownerName: "Sophie" }],
      leads: [
        { id: 1, campaignId: 1, status: "Nouveau", createdAt: new Date("2026-09-01") },
        { id: 2, campaignId: 1, status: "Qualifie", createdAt: new Date("2026-09-02") },
        { id: 3, campaignId: 1, status: "Converti", createdAt: new Date("2026-09-03") },
      ],
      events: [{ id: 1, campaignId: 1, registrationCount: 10, attendeeCount: 5, meetingsBooked: 2, status: "Termine", scheduledAt: new Date("2026-09-10") }],
      content: [
        { id: 1, campaignId: 1, status: "Publie", publishDate: "2026-09-10" },
        { id: 2, campaignId: 1, status: "Planifie", publishDate: "2026-09-20" },
      ],
    });

    expect(result.summary).toMatchObject({ totalBudget: 1000, totalRevenue: 3000, totalLeads: 3, activeCampaigns: 1, cpl: 333, conversionRate: 33.3, roi: 200, publishedContent: 1, upcomingContent: 1, attendanceRate: 50, eventMeetingRate: 40 });
    expect(result.campaigns[0]).toMatchObject({ leadCount: 3, qualifiedLeads: 2, convertedLeads: 1, meetingsBooked: 3, cpl: 333, conversionRate: 33.3, roi: 200, targetProgress: 75 });
    expect(result.byChannel[0]).toMatchObject({ channel: "Webinaire", leads: 3, clients: 1, cpl: 333, conversionRate: 33.3, roi: 200 });
  });

  it("retourne des valeurs neutres quand le budget et les volumes sont nuls", () => {
    const result = calculateMarketingMetrics({ campaigns: [], leads: [], events: [], content: [] });
    expect(result.summary).toMatchObject({ totalBudget: 0, totalRevenue: 0, totalLeads: 0, cpl: null, roi: null, conversionRate: 0, attendanceRate: 0 });
    expect(result.campaigns).toEqual([]);
  });
});
