import express from "express";
import path from "path";
import fs from "fs";
import https from "https";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import { getApp, getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

// Lazy initialize Stripe to prevent module load errors and catch updated env vars
function getStripe(): Stripe | null {
  // Use the Live key if it exists, otherwise fallback to the generic secret key
  const key = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (key) {
    return new Stripe(key);
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

      const itemType = req.body?.itemType || 'ebook';
      const domainUrl = req.headers.origin || req.headers.host ? `https://${req.headers.host}` : `http://localhost:${PORT}`;

      // Only Ebook is supported for checkout now
      if (itemType !== 'ebook') {
         return res.status(400).json({ error: "Only digital ebook checkouts are supported via this API." });
      }

      const product = { name: 'The Awakening of the Spark (Digital Ebook)', price: 999 };

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'cad',
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
  // Verifies payment then serves a confirmation page that auto-triggers the download
  app.get("/api/download-ebook", async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) return res.status(500).send("Stripe not configured.");

      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).send("Missing session_id");

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        const downloadUrl = `/api/stream-ebook?session_id=${sessionId}`;
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>The Awakening of the Spark — Download</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #d4c5b0; font-family: Georgia, serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; }
    .container { max-width: 560px; }
    h1 { font-size: 1.4rem; letter-spacing: 0.2em; text-transform: uppercase; color: #FFBF00; margin-bottom: 1.5rem; }
    p { line-height: 1.8; margin-bottom: 1rem; color: #a39481; font-size: 1rem; }
    em { color: #d4c5b0; font-style: italic; }
    .btn { display: inline-block; margin-top: 1.5rem; border: 1px solid #FFBF00; color: #FFBF00; padding: 0.8rem 2rem; text-decoration: none; letter-spacing: 0.15em; text-transform: uppercase; font-size: 0.8rem; font-family: monospace; }
    .btn:hover { background: rgba(255,191,0,0.1); }
    .support { margin-top: 2.5rem; font-size: 0.78rem; font-family: monospace; color: #6b5f52; border-top: 1px solid #1f1a14; padding-top: 1.5rem; line-height: 1.8; }
    .support a { color: #FFBF00; opacity: 0.6; text-decoration: none; }
  </style>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.location.href = '${downloadUrl}'; }, 1500);
    });
  </script>
</head>
<body>
  <div class="container">
    <h1>Thank You</h1>
    <p>Your purchase is confirmed.<br><em>The Awakening of the Spark</em> is downloading to your device now.</p>
    <p>If your download does not begin automatically:</p>
    <a class="btn" href="${downloadUrl}">Download Now</a>
    <div class="support">
      If you ever lose your copy, email<br>
      <a href="mailto:contact@theawakeningofthespark.com">contact@theawakeningofthespark.com</a><br>
      with your Stripe receipt and we will send you a new link.
    </div>
  </div>
</body>
</html>`);
      } else {
        res.status(403).send("Payment not completed.");
      }
    } catch (e: any) {
      res.status(500).send(`Error verifying session: ${e.message}`);
    }
  });

  // === SECURE EBOOK STREAM ENDPOINT ===
  // Streams the PDF directly to the browser with Content-Disposition: attachment
  // so it saves to the customer's Downloads folder instead of opening in the browser
  app.get("/api/stream-ebook", async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) return res.status(500).send("Stripe not configured.");

      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).send("Missing session_id");

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        let ebookUrl = process.env.LULU_EBOOK_URL || "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0361710872.firebasestorage.app/o/Awakening%20Master%20%20Working%20Project%20With%20TOC%20%26%20ISBN%20WITH%20COVER.pdf?alt=media&token=7207f6c6-86dd-4e51-a9ee-4fea64d8bfc6";

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
          } catch (e) {}
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="The-Awakening-of-the-Spark.pdf"');
        https.get(ebookUrl, (fileStream) => fileStream.pipe(res));
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
