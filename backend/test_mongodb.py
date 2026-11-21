import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

load_dotenv()

uri = os.getenv("MONGODB_URI")

if not uri:
    raise ValueError("MONGODB_URI not found in .env")

client = None

try:
    client = MongoClient(
        uri,
        serverSelectionTimeoutMS=15000
    )

    client.admin.command("ping")

    print("MongoDB Atlas connection successful!")

except (PyMongoError, OSError, ValueError) as e:
    print("MongoDB connection failed:")
    print(type(e).__name__, str(e))

finally:
    if client:
        client.close()
