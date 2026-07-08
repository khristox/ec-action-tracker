deactivate 
conda deacitvate
source ./venv/bin/activate


docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"


python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
