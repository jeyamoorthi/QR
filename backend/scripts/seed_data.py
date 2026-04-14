import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import firestore
import uuid
from datetime import datetime, timezone
import argparse
import sys
import os

LOCATIONS = [
    {
        "name": "Main Office - Front Desk",
        "description": "Reception and waiting area",
        "address": "100 Main St, Suite 100",
        "tasks": [
            {"title": "Sanitize Counter", "priority": "high", "frequency": "daily", "est_min": 10},
            {"title": "Empty Trash", "priority": "medium", "frequency": "daily", "est_min": 5},
            {"title": "Restock Brochures", "priority": "low", "frequency": "weekly", "est_min": 5},
        ]
    },
    {
        "name": "Warehouse A - Loading Dock",
        "description": "Shipping and receiving zone",
        "address": "150 Industrial Pkwy",
        "tasks": [
            {"title": "Sweep Dock Area", "priority": "high", "frequency": "daily", "est_min": 15},
            {"title": "Check Fire Extinguishers", "priority": "critical", "frequency": "monthly", "est_min": 10},
            {"title": "Inspect Bay Doors", "priority": "medium", "frequency": "weekly", "est_min": 20},
        ]
    },
    {
        "name": "Server Room 1",
        "description": "Primary datacenter",
        "address": "100 Main St, Basement",
        "tasks": [
            {"title": "Log Temperature", "priority": "critical", "frequency": "daily", "est_min": 5},
            {"title": "Check UPS Status", "priority": "high", "frequency": "daily", "est_min": 10},
        ]
    }
]

def seed_database(credentials_path: str):
    print(f"Initializing Firebase with credentials from {credentials_path}")
    if os.path.exists(credentials_path):
        cred = credentials.Certificate(credentials_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        db = firestore.Client(credentials=cred.get_credential())
    else:
        print("Credentials file not found, trying Application Default Credentials...")
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        db = firestore.Client()
    now = datetime.now(timezone.utc)
    
    print("Seeding locations and tasks...")
    
    locations_count = 0
    tasks_count = 0
    
    for loc in LOCATIONS:
        # Create Location
        loc_id = str(uuid.uuid4())
        qr_val = str(uuid.uuid4())
        
        db.collection('locations').document(loc_id).set({
            "name": loc["name"],
            "description": loc["description"],
            "qrCodeValue": qr_val,
            "address": loc["address"],
            "isActive": True,
            "createdBy": "system_seed",
            "createdAt": now,
            "updatedAt": now,
        })
        locations_count += 1
        
        # Create Tasks for Location
        for i, task in enumerate(loc["tasks"]):
            db.collection('tasks').document().set({
                "title": task["title"],
                "description": f"Standard procedure for {task['title']}",
                "locationId": loc_id,
                "priority": task["priority"],
                "frequencyType": task["frequency"],
                "isActive": True,
                "order": i,
                "estimatedMinutes": task["est_min"],
                "createdBy": "system_seed",
                "createdAt": now,
                "updatedAt": now,
            })
            tasks_count += 1
            
    print(f"✅ Successfully created {locations_count} locations.")
    print(f"✅ Successfully created {tasks_count} tasks.")
    print("Database seeded successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the database with sample locations and tasks.")
    parser.add_argument("--cred", default="../credentials/service-account.json", help="Path to Firebase service account JSON")
    args = parser.parse_args()

    seed_database(args.cred)
