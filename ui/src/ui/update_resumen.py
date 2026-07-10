import re

filepath = "/Applications/MAMP/htdocs/Production_Vigneair/vigenair/ui/src/ui/src/app/app.component.css"
with open(filepath, "r") as f:
    content = f.read()

# Increase banner height by 20%
content = content.replace("padding: 48px;\n  display: flex;\n  gap: 32px;\n  align-items: center;", "padding: 64px 48px;\n  display: flex;\n  gap: 40px;\n  align-items: center;")
content = content.replace("width: 320px;\n  height: 180px;\n  border-radius: 8px;", "width: 384px;\n  height: 216px;\n  border-radius: 8px;")

# Espaciado de metricas (Insights, Oportunidades, Fortalezas, Áreas de mejora)
content = content.replace(".re-stats-row {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  margin-top: 38px;", ".re-stats-row {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  margin-top: 54px;")

with open(filepath, "w") as f:
    f.write(content)

