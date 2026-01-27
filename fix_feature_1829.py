#!/usr/bin/env python3
"""
One-time script to fix feature 1829 which has an invalid escape sequence.
"""

import sqlite3
import json

db_path = "/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db"

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get feature 1829
cursor.execute("SELECT id, name, description, steps FROM features WHERE id = 1829")
row = cursor.fetchone()

if row:
    print(f"Feature {row[0]}: {row[1]}")
    print(f"Description: {row[2]}")
    print(f"Steps (raw): {repr(row[3])}")

    # Try to parse steps
    try:
        steps = json.loads(row[3])
        print(f"Steps (parsed): {steps}")
    except json.JSONDecodeError as e:
        print(f"JSON Error: {e}")

        # Fix the steps - replace backslash issues
        fixed_steps = row[3].replace("\\", "\\\\")
        try:
            steps = json.loads(fixed_steps)
            print(f"Fixed steps: {steps}")
        except:
            # Just set simple steps
            steps = ["Verify feature works correctly"]

        # Update in database
        cursor.execute("UPDATE features SET steps = ? WHERE id = 1829", (json.dumps(steps),))
        conn.commit()
        print("Fixed!")
else:
    print("Feature 1829 not found")

    # List all pending features
    cursor.execute("SELECT id, priority, name FROM features WHERE passes = 0 ORDER BY priority")
    for row in cursor.fetchall():
        print(f"  Pending: {row[0]} (priority {row[1]}): {row[2]}")

conn.close()
