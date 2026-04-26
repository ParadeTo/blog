#!/bin/bash
cd /workspace/sessions/s-90eaebc45f11
python create_excel.py
echo "Exit code: $?"
ls -la 人员信息.xlsx 2>/dev/null && echo "File created successfully"
