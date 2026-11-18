import re
with open('backend/app/core/seed.py', 'r', encoding='utf-8') as f:
    s = f.read()
s = s.replace('detetime', 'datetime')
s = s.replace('jull_name', 'full_name')
s = s.replace("User_data['mail']", "user_data['mail'].replace('mail', 'email')")
s = s.replace("User_data['vole']", "user_data['vole'].replace('vole', 'role')")
s = s.replace("data['mail']", "data['email']")
s = s.replace("data['vole']", "data['vole'].replace('vole', 'role')")
s = s.replace("data['vole']", "data['role']")
with open('backend/app/core/seed.py', 'w', encoding='utf-8') as f:
    f.write(s)
print('Seed fixed')
