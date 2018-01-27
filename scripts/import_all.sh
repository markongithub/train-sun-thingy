GTFS_PATH=$1
MONGO_URL=$2
for FILENAME in $GTFS_PATH/*.zip; do
  AGENCY=$(echo $FILENAME | sed 's/.*\///; s/.zip$//')
  node scripts/easy_import.gtfs $AGENCY $FILENAME $MONGO_URL
done
