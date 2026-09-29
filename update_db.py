import re
with open('backend/core/database.py', 'r') as f:
    content = f.read()

if 'import certifi' not in content:
    content = content.replace('from pymongo.errors import ConnectionFailure, OperationFailure', 'from pymongo.errors import ConnectionFailure, OperationFailure\nimport certifi')
    content = content.replace('socketTimeoutMS=30_000,', 'socketTimeoutMS=30_000,\n            tlsCAFile=certifi.where(),')
    with open('backend/core/database.py', 'w') as f:
        f.write(content)
