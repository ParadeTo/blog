import subprocess, json

result = subprocess.run(
    ["python", "./scripts/search.py", "--query", "Node.js 24 新特性", "--top_k", "10", "--recency", "month"],
    capture_output=True, text=True
)
print(result.stdout)
print(result.stderr)
