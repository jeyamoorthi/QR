import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

// Valid roles in the system
const VALID_ROLES = ["employee", "supervisor", "admin", "super_admin"];
const ROLE_LEVEL: Record<string, number> = {
  employee: 0,
  supervisor: 1,
  admin: 2,
  super_admin: 3,
};

/**
 * Set a user's role via Firebase custom claims.
 * Only callable by users with higher authority than the target role.
 */
export const setUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const callerRole = (request.auth.token.role as string) || "employee";
  const callerLevel = ROLE_LEVEL[callerRole] ?? 0;

  const { uid, role } = request.data;

  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      `role must be one of: ${VALID_ROLES.join(", ")}.`
    );
  }

  const targetLevel = ROLE_LEVEL[role] ?? 0;

  // Can only assign roles below your own level
  if (targetLevel >= callerLevel) {
    throw new HttpsError(
      "permission-denied",
      `You need higher authority to assign the '${role}' role.`
    );
  }

  // Prevent self-demotion
  if (uid === request.auth.uid && targetLevel < callerLevel) {
    throw new HttpsError("failed-precondition", "Cannot demote yourself.");
  }

  try {
    // Preserve existing companyId in claims
    const existingUser = await admin.auth().getUser(uid);
    const existingClaims = existingUser.customClaims || {};
    await admin.auth().setCustomUserClaims(uid, {
      ...existingClaims,
      role,
    });
    await db.doc(`users/${uid}`).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { message: `Role '${role}' set for user ${uid}` };
  } catch (error: any) {
    throw new HttpsError("internal", `Failed to set role: ${error.message}`);
  }
});

/**
 * Bootstrap the first super admin.
 * Can only be called once — when no admin/super_admin exists in the system.
 */
export const bootstrapAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const uid = request.auth.uid;

  // Check if any admin or super_admin already exists
  const existingAdmins = await db
    .collection("users")
    .where("role", "in", ["admin", "super_admin"])
    .limit(1)
    .get();

  if (!existingAdmins.empty) {
    throw new HttpsError(
      "already-exists",
      "An admin already exists. Use setUserRole to create more admins."
    );
  }

  // Make the caller a super_admin
  await admin.auth().setCustomUserClaims(uid, { role: "super_admin" });

  const userRef = db.doc(`users/${uid}`);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    await userRef.update({
      role: "super_admin",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.set({
      uid,
      email: request.auth.token.email || "",
      displayName: request.auth.token.name || "",
      role: "super_admin",
      status: "approved",
      companyId: null,
      phone: null,
      department: null,
      isActive: true,
      assignedLocations: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    message:
      "You are now a super_admin. Please sign out and sign back in for changes to take effect.",
  };
});

/**
 * Utility: Auto-create a Firestore user profile.
 * This is a fallback the mobile app can call on first login.
 * The primary registration flow is now via POST /users/register on the backend.
 */
export const onUserCreated = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const uid = request.auth.uid;
  const userRef = db.doc(`users/${uid}`);
  const existing = await userRef.get();

  if (existing.exists) {
    return { message: "User profile already exists.", uid };
  }

  // Extract optional role and companyId from request data (if provided by backend)
  const role = request.data?.role || "employee";
  const companyId = request.data?.companyId || null;
  const status = request.data?.status || "pending";

  await userRef.set({
    uid,
    email: request.auth.token.email || "",
    displayName: request.auth.token.name || "",
    role,
    status,
    companyId,
    phone: null,
    department: null,
    isActive: true,
    assignedLocations: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Set custom claims with role and companyId
  const claims: Record<string, any> = { role };
  if (companyId) claims.companyId = companyId;
  await admin.auth().setCustomUserClaims(uid, claims);

  return { message: "User profile created.", uid };
});
