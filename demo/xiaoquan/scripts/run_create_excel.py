import os, subprocess

os.makedirs("output", exist_ok=True)
result = subprocess.run(["python", "scripts/create_excel.py"], capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
