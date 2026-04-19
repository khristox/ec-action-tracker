set +e

conda deactivate
echo "conda exit code: $?"


deactivate
echo "deconda exit code: $?"

source venv/bin/activate
echo "venv activation exit code: $?"

