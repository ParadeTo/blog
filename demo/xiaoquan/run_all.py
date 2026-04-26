import subprocess
import sys

# Step 1: Create Excel
result = subprocess.run([sys.executable, "create_excel.py"], capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("Return code:", result.returncode)
