#!/bin/bash

# Source DB (your main Atlas)
OLD_URI="=mongodb+srv://kriyonainfotech:kriyonainfotech@cluster0.ntvag.mongodb.net/ks-adminpanel"

# Target DB (another MongoDB account)
NEW_URI="mongodb+srv://kriyonastudio_db:kriyonastudio_db@cluster0.ebnasrj.mongodb.net/ks-backup"

echo "Starting backup at $(date)"

# Direct transfer (no temp files)
mongodump --uri="$OLD_URI" --archive | mongorestore --uri="$NEW_URI" --archive --drop

echo "Backup completed at $(date)"