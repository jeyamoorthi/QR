import firebase_admin
from firebase_admin import credentials, auth
import argparse
import sys
import os

def bootstrap_super_admin(email: str, credentials_path: str):
    """Elevate a specific user via email to be a super_admin bypassing standard UI."""
    print(f"Initializing Firebase with credentials from {credentials_path}")
    if os.path.exists(credentials_path):
        cred = credentials.Certificate(credentials_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
    else:
        print("Credentials file not found, trying Application Default Credentials...")
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
    
    try:
        user = auth.get_user_by_email(email)
        print(f"Found user: {user.uid} ({user.email})")
        
        auth.set_custom_user_claims(user.uid, {"role": "super_admin"})
        print(f"✅ Successfully set custom claims '{{\"role\": \"super_admin\"}}' for {email}")

        # Also update firestore profile if it exists
        from google.cloud import firestore
        if os.path.exists(credentials_path):
            db = firestore.Client(credentials=cred.get_credential())
        else:
            db = firestore.Client()
        user_ref = db.collection('users').document(user.uid)
        
        if user_ref.get().exists:
            user_ref.update({"role": "super_admin"})
            print("✅ Updated Firestore user profile to 'super_admin'")
        else:
            print("⚠️ User profile not found in Firestore. Make sure they have logged in once.")

        print("\nComplete. The user must sign out and sign back in for the new claims to take effect.")

    except auth.UserNotFoundError:
        print(f"❌ Error: No user found with email '{email}'", file=sys.stderr)
        print("Make sure to sign up through the mobile app or dashboard first before running this script.")
    except Exception as e:
        print(f"❌ Error: {str(e)}", file=sys.stderr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bootstrap the first Super Admin user.")
    parser.add_argument("--email", required=True, help="Email of the user to make Super Admin")
    parser.add_argument("--cred", default="../credentials/service-account.json", help="Path to Firebase service account JSON")
    args = parser.parse_args()

    bootstrap_super_admin(args.email, args.cred)
