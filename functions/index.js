/**
 * MiracardiacHealth Cloud Functions
 * Deploy with: firebase deploy --only functions
 *
 * IMPORTANT: Set environment config:
 * firebase functions:config:set paystack.secret="sk_live_xxxx"
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ---------- Paystack Webhook / Verification ----------
exports.verifyPaystackPayment = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const secret = functions.config().paystack?.secret;
    if (!secret) {
      console.error("Paystack secret not configured");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    // Option A: Verify by reference (called from client after popup)
    const { reference, userId, purpose, metadata } = req.body || {};
    if (!reference) {
      return res.status(400).json({ error: "Missing reference" });
    }

    try {
      const https = require("https");
      const verifyData = await new Promise((resolve, reject) => {
        const options = {
          hostname: "api.paystack.co",
          port: 443,
          path: `/transaction/verify/${encodeURIComponent(reference)}`,
          method: "GET",
          headers: {
            Authorization: `Bearer ${secret}`
          }
        };
        const r = https.request(options, (resp) => {
          let data = "";
          resp.on("data", (chunk) => (data += chunk));
          resp.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        r.on("error", reject);
        r.end();
      });

      if (!verifyData.status || verifyData.data.status !== "success") {
        // Log failed verification
        await db.collection("payments").add({
          reference,
          userId: userId || null,
          purpose: purpose || "unknown",
          status: "failed",
          raw: verifyData,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.status(400).json({ success: false, message: "Payment not successful" });
      }

      const amount = verifyData.data.amount / 100; // kobo → naira
      const paidAt = verifyData.data.paid_at;

      // Idempotent: check if already recorded
      const existing = await db.collection("payments")
        .where("reference", "==", reference)
        .limit(1)
        .get();

      if (existing.empty) {
        await db.collection("payments").add({
          reference,
          userId: userId || verifyData.data.metadata?.userId || null,
          amount,
          purpose: purpose || verifyData.data.metadata?.purpose || "unknown",
          status: "success",
          channel: verifyData.data.channel,
          paidAt,
          metadata: metadata || verifyData.data.metadata || {},
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // If consultation payment, ensure consultation is marked paid_pending
      // (Client already creates it; this is a safety net / update)

      return res.json({
        success: true,
        amount,
        reference,
        status: "success"
      });
    } catch (err) {
      console.error("Verify error:", err);
      return res.status(500).json({ error: "Verification failed" });
    }
  });
});

// ---------- Paystack Webhook endpoint (recommended for production) ----------
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  const secret = functions.config().paystack?.secret;
  const hash = require("crypto")
    .createHmac("sha512", secret || "")
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.body;
  if (event.event === "charge.success") {
    const data = event.data;
    const reference = data.reference;
    const amount = data.amount / 100;

    const existing = await db.collection("payments")
      .where("reference", "==", reference)
      .limit(1)
      .get();

    if (existing.empty) {
      await db.collection("payments").add({
        reference,
        userId: data.metadata?.userId || null,
        amount,
        purpose: data.metadata?.purpose || "unknown",
        status: "success",
        channel: data.channel,
        paidAt: data.paid_at,
        metadata: data.metadata || {},
        source: "webhook",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  res.sendStatus(200);
});

// ---------- Optional: Auto-expire consultations ----------
exports.expireConsultations = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collection("consultations")
      .where("status", "==", "active")
      .where("expiresAt", "<=", now)
      .get();

    const batch = db.batch();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        status: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    console.log(`Expired ${snap.size} consultations`);
    return null;
  });


// ---------- Admin: Create staff user (Auth + Firestore) ----------
// Callable from Admin dashboard. Requires the caller to be an admin.
exports.createStaffUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required");
  }
  const callerUid = context.auth.uid;
  const callerEmail = (context.auth.token.email || "").toLowerCase();
  const adminEmails = [
    "onyekamiracle08@gmail.com",
    "onyekaudechukwum@gmail.com",
    "onyekamiracle08@yahoo.com",
    "onyekaudechukwum@yahoo.com",
    "admin@miracardiachealth.com"
  ];
  const callerDoc = await db.collection("users").doc(callerUid).get();
  const isAdmin =
    adminEmails.includes(callerEmail) ||
    (callerDoc.exists && callerDoc.data().role === "admin");
  if (!isAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const {
    email, password, displayName, phone, role, department, employeeId,
    specialty, experience, consultationFee, licenseNumber, bio, photoURL,
    pharmacyName, pharmacyLicense, pharmacyLocation
  } = data || {};

  if (!email || !password || !displayName || !role) {
    throw new functions.https.HttpsError("invalid-argument", "email, password, displayName, role required");
  }

  const userRecord = await admin.auth().createUser({
    email,
    password,
    displayName,
    emailVerified: false
  });
  const uid = userRecord.uid;

  await db.collection("users").doc(uid).set({
    uid,
    email,
    displayName,
    phone: phone || "",
    role,
    department: department || "",
    employeeId: employeeId || "",
    status: "active",
    provider: "password",
    createdByAdmin: callerUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (role === "doctor" || role === "surgeon") {
    await db.collection("doctors").doc(uid).set({
      name: displayName,
      specialty: specialty || "General Practice",
      experience: experience || 0,
      consultationFee: consultationFee || 0,
      licenseNumber: licenseNumber || "",
      phone: phone || "",
      bio: bio || "",
      photoURL: photoURL || "",
      department: department || "",
      status: "approved",
      available: true,
      rating: 0,
      reviewCount: 0,
      ownerId: uid,
      createdByAdmin: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  if (role === "pharmacist") {
    await db.collection("pharmacies").doc(uid).set({
      name: pharmacyName || displayName,
      ownerName: displayName,
      ownerId: uid,
      licenseNumber: pharmacyLicense || "",
      location: pharmacyLocation || "",
      phone: phone || "",
      email,
      status: "approved",
      createdByAdmin: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return { success: true, uid, email };
});
