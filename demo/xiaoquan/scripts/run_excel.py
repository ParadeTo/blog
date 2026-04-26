import subprocess
result = subprocess.run(["python", "scripts/create_excel.py"], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)
