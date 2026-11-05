// ============================================================
// MiracardiacHealth - Shared Firebase Config + Helpers
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  getDocFromCache,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction,
  getDocs,
  arrayUnion,
  arrayRemove,
  increment
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQZ3vYlm-VpWao55RAkqL-owwk61fhHKM",
  authDomain: "miracardiachealth.firebaseapp.com",
  projectId: "miracardiachealth",
  storageBucket: "miracardiachealth.firebasestorage.app",
  messagingSenderId: "407534576563",
  appId: "1:407534576563:web:04508ae3f55f18f780e1c6"
};


// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Local cache: repeat visits show saved data instantly, then refresh from the server
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  db = getFirestore(app);
}
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ---------- Paystack Public Key (NEVER put secret key here) ----------
// >>> PASTE YOUR PAYSTACK PUBLIC KEY HERE <<<
// Get it from: https://dashboard.paystack.com/#/settings/developers
// Use pk_test_... for testing, pk_live_... for production.
const PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

// ---------- Cloudinary (image / file storage – same credentials used on past projects) ----------
// Create a free account at https://cloudinary.com → Dashboard → copy Cloud name.
// Settings → Upload → Upload presets → Add unsigned preset (e.g. name "miracardiac_unsigned").
// >>> PASTE YOUR VALUES HERE <<<
const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";       // e.g. "dxyz123abc"
const CLOUDINARY_UPLOAD_PRESET = "YOUR_UNSIGNED_PRESET"; // e.g. "miracardiac_unsigned"

/**
 * Upload a File/Blob to Cloudinary (unsigned preset). Returns secure_url.
 * folder: optional path prefix e.g. "logos", "profiles", "drugs", "chat"
 */
async function uploadToCloudinary(file, folder = "miracardiac") {
  if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    throw new Error("Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in js/config.js");
  }
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) form.append("folder", folder);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Cloudinary upload failed");
  }
  const data = await res.json();
  return data.secure_url || data.url;
}

// Default logo (local). Overridden by Admin → Settings → Logo when set.
const DEFAULT_LOGO = "icons/icon.svg";

/**
 * Load platform settings (logo etc.) once and apply to every .site-logo img on the page.
 * Call this early on every page that shows the brand.
 */
async function applyPlatformBranding() {
  try {
    const snap = await getDoc(doc(db, "settings", "platform"));
    const logo = (snap.exists() && snap.data().logoURL) ? snap.data().logoURL : DEFAULT_LOGO;
    document.querySelectorAll("img.site-logo, img[data-brand-logo]").forEach((img) => {
      if (img.src !== logo) img.src = logo;
    });
    // Also set favicon if present
    const fav = document.querySelector('link[rel="icon"], link[rel="apple-touch-icon"]');
    if (fav && logo !== DEFAULT_LOGO) fav.href = logo;
    return logo;
  } catch (e) {
    console.warn("Branding load:", e);
    return DEFAULT_LOGO;
  }
}

// ---------- Helpers ----------
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0
  }).format(amount || 0);
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function timeAgo(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

async function ensureUserProfileBase(user) {
  if (!user) return null;
  const ref = doc(db, "users", user.uid);
  try {
    // Saved copy first (instant), then refresh it quietly in the background
    let snap = null;
    try { snap = await getDocFromCache(ref); } catch (_) { snap = null; }
    if (snap && snap.exists()) {
      getDoc(ref).catch(() => {});
    } else {
      snap = await getDoc(ref);
    }
    if (snap.exists()) {
      return { uid: user.uid, email: user.email || "", ...snap.data() };
    }
  } catch (e) {
    console.warn("getUserProfile read:", e);
  }
  // Missing profile (e.g. first Google login or create failed earlier) — create a patient profile
  const base = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    phone: user.phoneNumber || "",
    role: "patient",
    status: "active",
    provider: (user.providerData && user.providerData[0] && user.providerData[0].providerId) || "password",
    consent: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    await setDoc(ref, base);
    return { ...base, uid: user.uid, email: user.email || "" };
  } catch (e1) {
    // Rules may only allow "pending" on older deploys — fallback
    try {
      const pending = { ...base, status: "pending" };
      await setDoc(ref, pending);
      return { ...pending, uid: user.uid, email: user.email || "" };
    } catch (e2) {
      console.error("ensureUserProfile failed:", e2);
      return null;
    }
  }
}

// Asks Firestore to make this account an admin. The Firestore rules decide
// (only the admin emails listed in the rules are allowed). No emails live in this file.
// Uses setDoc({merge:true}) so it works even when the user document is still missing.
async function claimAdmin(user, waitMs = 12000) {
  claimAdmin.lastError = null;
  if (!user || !user.uid) {
    claimAdmin.lastError = new Error("no-user");
    return false;
  }
  try {
    const userRef = doc(db, "users", user.uid);
    await Promise.race([
      setDoc(userRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        role: "admin",
        status: "active",
        provider: (user.providerData && user.providerData[0] && user.providerData[0].providerId) || "password",
        consent: true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout (slow network)")), waitMs))
    ]);
    return true;
  } catch (e) {
    claimAdmin.lastError = e;
    console.warn("claimAdmin failed:", e.code || e.message, e);
    return false;
  }
}

async function ensureUserProfile(user) {
  const profile = await ensureUserProfileBase(user);
  if (!profile || profile.role === "admin") return profile;
  // Always attempt claim for known admin emails (no long throttle while debugging)
  if (await claimAdmin(user, 8000)) return { ...profile, role: "admin", status: "active" };
  return profile;
}

async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  return ensureUserProfile(user);
}

async function requireAuth(redirect = "Login.html") {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        const next = encodeURIComponent(
          (location.pathname.split("/").pop() || "Dashboard.html") + (location.search || "")
        );
        const target = redirect.includes("?")
          ? redirect
          : redirect + (redirect.includes("Login") ? "?next=" + next : "");
        window.location.href = target;
        resolve(null);
        return;
      }
      const profile = await ensureUserProfile(user);
      if (!profile) {
        // Auth ok but profile could not be written — send back to login with message
        try { await signOut(auth); } catch (_) {}
        window.location.href = "Login.html?error=profile";
        resolve(null);
        return;
      }
      resolve(profile);
    });
  });
}

async function requireRole(allowedRoles = [], redirect = "Dashboard.html") {
  const profile = await requireAuth();
  if (!profile) return null;
  if (!allowedRoles.includes(profile.role) && allowedRoles.includes("admin") && auth.currentUser && await claimAdmin(auth.currentUser)) {
    profile.role = "admin";
    profile.status = "active";
  }
  if (!allowedRoles.includes(profile.role)) {
    const u = auth.currentUser;
    const err = claimAdmin.lastError;
    let msg = "Access denied for your role.";
    if (allowedRoles.includes("admin") && u) {
      msg += "\n\nSigned in as: " + (u.email || "no email") +
             "\nEmail verified: " + (u.emailVerified ? "yes" : "NO (sign in with Google instead)") +
             "\nAdmin check: " + (err ? (err.code || err.message) : "not run") +
             "\n\nFIX: Publish the new firestore.rules in Firebase Console → Firestore → Rules → Publish. Then hard-refresh this page (Ctrl+Shift+R).";
    }
    alert(msg);
    window.location.href = redirect;
    return null;
  }
  return profile;
}

function showToast(message, type = "info") {
  const existing = document.getElementById("ah-toast");
  if (existing) existing.remove();
  const colors = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    info: "bg-blue-600",
    warning: "bg-amber-500"
  };
  const el = document.createElement("div");
  el.id = "ah-toast";
  el.className = `fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${colors[type] || colors.info} max-w-[90vw]`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showLoading(container, message = "Loading...") {
  if (typeof container === "string") container = document.querySelector(container);
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-slate-500">
      <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
      <p class="text-sm">${escapeHtml(message)}</p>
    </div>`;
}

function showEmpty(container, message = "Nothing here yet", icon = "📭") {
  if (typeof container === "string") container = document.querySelector(container);
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-slate-400">
      <div class="text-4xl mb-3">${icon}</div>
      <p class="text-sm text-center max-w-xs">${escapeHtml(message)}</p>
    </div>`;
}

function showError(container, message = "Something went wrong") {
  if (typeof container === "string") container = document.querySelector(container);
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-red-500">
      <div class="text-4xl mb-3">⚠️</div>
      <p class="text-sm text-center max-w-xs">${escapeHtml(message)}</p>
    </div>`;
}

// Haversine distance in km
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Paystack helper (client-side only – verification must be server-side)
function payWithPaystack({ email, amount, reference, metadata = {}, onSuccess, onCancel }) {
  if (typeof PaystackPop === "undefined") {
    showToast("Payment library not loaded", "error");
    return;
  }
  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: Math.round(amount * 100), // kobo
    ref: reference,
    metadata,
    callback: function (response) {
      if (typeof onSuccess === "function") onSuccess(response);
    },
    onClose: function () {
      if (typeof onCancel === "function") onCancel();
    }
  });
  handler.openIframe();
}

// Generate unique reference
function generateRef(prefix = "MH") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Export everything needed by other modules
export {
  app,
  auth,
  db,
  storage,
  googleProvider,
  PAYSTACK_PUBLIC_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  uploadToCloudinary,
  DEFAULT_LOGO,
  applyPlatformBranding,
  // Auth
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  // Firestore
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction,
  getDocs,
  arrayUnion,
  arrayRemove,
  increment,
  // Storage
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  // Helpers
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  timeAgo,
  getCurrentUserProfile,
  requireAuth,
  requireRole,
  showToast,
  showLoading,
  showEmpty,
  showError,
  distanceKm,
  payWithPaystack,
  generateRef
};