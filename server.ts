import express from "express";
import path from "path";
import fs from "fs";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import { getApp, getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

// Lazy initialize Stripe to prevent module load errors and catch updated env vars
function getStripe(): Stripe | null {
  if (process.env.STRIPE_SECRET_KEY) {
    return new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(cors());

  // Store the last few received webhooks in-memory for testing/debugging
  const recentWebhooks: any[] = [];

  // === STRIPE WEBHOOK ===
  // Must be processed before express.json() because Stripe needs the raw body buffer
  app.post("/api/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !webhookSecret || !sig) {
      console.warn("Missing stripe, webhook secret, or signature.");
      return res.status(400).send("Webhook configuration missing.");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`⚠️  Webhook signature verification failed:`, err.message);
      recentWebhooks.unshift({ time: new Date().toISOString(), type: 'error', message: err.message, body: 'Verification Failed' });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handled event successfully
    recentWebhooks.unshift({ time: new Date().toISOString(), type: event.type, id: event.id });
    if (recentWebhooks.length > 20) recentWebhooks.pop(); // keep last 20

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Payment successful for session: ${session.id}`);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Debugging endpoint so user can see if events arrived
  app.get("/api/debug/webhooks", (req, res) => {
    res.json(recentWebhooks);
  });

  // === API ROUTES: Payment and Fulfillment ===
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running." });
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
         return res.status(500).json({ error: "Stripe configuration is missing. Add STRIPE_SECRET_KEY to your environment." });
      }

      const { itemType } = req.body;
      const domainUrl = req.headers.origin || `http://localhost:${PORT}`;

      // Only Ebook is supported for checkout now
      if (itemType !== 'ebook') {
         return res.status(400).json({ error: "Only digital ebook checkouts are supported via this API." });
      }

      const product = { name: 'The Awakening of the Spark (Digital Ebook)', price: 1500 };

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: product.name },
              unit_amount: product.price,
            },
            quantity: 1,
          },
        ],
        metadata: {
          itemType: itemType,
        },
        success_url: `${domainUrl}/api/download-ebook?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domainUrl}?canceled=true`,
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      if (session.url) {
        if (req.headers.accept?.includes("application/json")) {
           res.json({ url: session.url });
        } else {
           res.redirect(303, session.url);
        }
      } else {
        res.status(500).json({ error: "Failed to create Stripe session URL." });
      }
    } catch (e: any) {
      console.error("Stripe Checkout Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // === SECURE EBOOK DELIVERY ENDPOINT ===
  app.get("/api/download-ebook", async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) return res.status(500).send("Stripe not configured.");

      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).send("Missing session_id");

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === "paid") {
        let ebookUrl = process.env.LULU_EBOOK_URL || "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0361710872.firebasestorage.app/o/Awakening%20Master%20%20Working%20Project%20With%20TOC%20%26%20ISBN%20WITH%20COVER.pdf?alt=media&token=7207f6c6-86dd-4e51-a9ee-4fea64d8bfc6";
        
        // Try to get dynamic URL from Firestore if Admin updated it
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          if (getApps().length === 0) {
             try {
               const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
               initializeApp({ credential: cert(serviceAccount) });
             } catch (e) {}
          }
          try {
            const dbId = process.env.FIREBASE_DATABASE_ID || "ai-studio-e7bdba52-2ec3-4633-bb68-0a9d3ef94f20";
            const db = getFirestore(dbId);
            const doc = await db.collection("site_config").doc("book_fulfillment").get();
            if (doc.exists && doc.data()?.ebook) {
               ebookUrl = doc.data()?.ebook;
            }
          } catch(e) {}
        }
        
        // Redirect directly to the PDF/Dropbox link
        res.redirect(302, ebookUrl);
      } else {
        res.status(403).send("Payment not completed.");
      }
    } catch (e: any) {
      res.status(500).send(`Error verifying session: ${e.message}`);
    }
  });

  // === VITE MIDDLEWARE (Development / Production SPA) ===
  
  // Force production mode if we are in the deployed environment
  const isProduction = process.env.NODE_ENV === "production" || process.env.DATABASE_URL !== undefined;
  
  if (!isProduction) {
    console.log("Starting in DEVELOPMENT mode...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode...");
    const distPath = path.resolve(process.cwd(), 'dist');
    console.log(`Serving static assets from: ${distPath}`);
    
    // Heartbeat for diagnostics
    app.get("/api/status", (req, res) => {
      res.json({ 
        status: "alive", 
        mode: "production",
        cwd: process.cwd(),
        distExists: fs.existsSync(distPath)
      });
    });

    // Explicitly serve common image types to prevent SPA redirect issues
    app.get(/\.(png|jpg|jpeg|gif|svg|webp|ico|pdf)$/, (req, res, next) => {
      const filePath = path.join(distPath, req.path);
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        next();
      }
    });

    // Default static serving
    app.use(express.static(distPath, {
      maxAge: '1h',
      index: 'index.html'
    }));
    
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // === STRIPE BACKGROUND POLLER (Ebook Logging Only) ===
  // Polls Stripe to securely log Ebook sales to Firebase in the background
  const processedSessions = new Set<string>();
  setInterval(async () => {
    const stripe = getStripe();
    if (!stripe) return;
    try {
      const recentEvents = await stripe.events.list({
        type: 'checkout.session.completed',
        limit: 10,
        created: { gte: Math.floor(Date.now() / 1000) - 120 } // trailing 2 minutes
      });
      for (const event of recentEvents.data) {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!processedSessions.has(session.id)) {
          processedSessions.add(session.id);
          recentWebhooks.unshift({ time: new Date().toISOString(), type: 'poll_checkout.session.completed', eventId: event.id, sessionId: session.id });
          if (recentWebhooks.length > 20) recentWebhooks.length = 20;
          
          await logOrderToFirebase(session);
        }
      }
    } catch(e) {
      // ignore verbose polling errors
    }
  }, 5000);

  async function logOrderToFirebase(session: Stripe.Checkout.Session) {
    const itemType = session.metadata?.itemType || "unknown";
    
    // Try to log to Firebase (Requires FIREBASE_SERVICE_ACCOUNT_JSON in env)
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        if (getApps().length === 0) {
          try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            initializeApp({ credential: cert(serviceAccount) });
          } catch (jsonErr) {
            return;
          }
        }
        const dbId = process.env.FIREBASE_DATABASE_ID || "ai-studio-e7bdba52-2ec3-4633-bb68-0a9d3ef94f20";
        const db = getFirestore(dbId);
        await db.collection("orders").doc(session.id).set({
          sessionId: session.id,
          customerEmail: session.customer_details?.email,
          customerName: session.customer_details?.name,
          amountTotal: session.amount_total,
          itemType: itemType,
          status: "paid",
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Ebook Order ${session.id} securely saved to Firebase Database.`);
      }
    } catch(err: any) {
      console.error("Firebase save error:", err.message);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
