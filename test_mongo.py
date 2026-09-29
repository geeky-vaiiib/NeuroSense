import os
import certifi
from pymongo import MongoClient
uri = "mongodb+srv://geekypeter2805_db_user:oCQuhVSuBkiXhWjL@neurosense.c42pokr.mongodb.net/?appName=NeuroSense"
print("Connecting...")
client = MongoClient(uri, tlsCAFile=certifi.where())
print(client.admin.command('ping'))
