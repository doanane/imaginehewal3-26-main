import logging
from app.seed import seed_db

# Configure logging to see the output
logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    print("Starting database seeding...")
    seed_db()
    print("Database seeding completed.")
