import psycopg2

try:
    conn = psycopg2.connect(
        host="localhost",
        port=5433,
        dbname="ec_action_tracker",      # change if needed
        user="ec_user",
        password="ec_password"
    )

    cur = conn.cursor()
    cur.execute("SELECT version();")

    print("✅ Connected successfully")
    print(cur.fetchone()[0])

    cur.close()
    conn.close()

except Exception as e:
    print("❌ Connection failed")
    print(e)