import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerFileRoutes } from "./fileRoutes";
import { appRouter } from "../routers";
import {
  runCustomerSuccessAlerts,
  runGovernanceWatch,
  runInvoiceRemindersRoute,
  runScheduledEmails,
  runSupportAlerts,
} from "../automations.scheduler";
import { applyLeadCaptureCors, captureMarketingLead } from "../marketing.capture";
import { openSupportTicket } from "../support.intake";
import { receiveBillingEvent } from "../billing.intake";
import { receiveCalendlyEvent } from "../calendly.intake";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  // Le corps brut est conservé : la signature des appels Calendly porte sur
  // les octets reçus, qu'un JSON ré-encodé ne reproduirait pas à l'identique.
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerFileRoutes(app);
  // Traitements quotidiens déclenchés par pg_cron (voir automations.db.ts).
  app.post("/api/scheduled/customer-success-alerts", runCustomerSuccessAlerts);
  app.post("/api/scheduled/support-alerts", runSupportAlerts);
  app.post("/api/scheduled/invoice-reminders", runInvoiceRemindersRoute);
  app.post("/api/scheduled/governance-watch", runGovernanceWatch);
  app.post("/api/scheduled/emails", runScheduledEmails);
  app.options("/api/public/marketing/leads", (req, res) => { applyLeadCaptureCors(req, res); res.sendStatus(204); });
  app.post("/api/public/marketing/leads", captureMarketingLead);
  // Ouverture de ticket depuis le produit Medactio (serveur à serveur).
  app.post("/api/public/support/tickets", openSupportTicket);
  // Abonnements et paiements relayés par le produit Medactio.
  app.post("/api/public/billing/events", receiveBillingEvent);
  // Réservations Calendly (signature vérifiée dans le gestionnaire).
  app.post("/api/public/calendly/events", receiveCalendlyEvent);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
