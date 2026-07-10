import re

filepath = "/Applications/MAMP/htdocs/Production_Vigneair/vigenair/ui/src/ui/src/app/app.component.css"
with open(filepath, "r") as f:
    content = f.read()

# Make sure all h4 (section titles) are WPP Medium, 20px, font-weight 700 (or standard WPP weight)
if "h4 {" not in content:
    content += "\n\nh4 {\n  font-family: 'WPP Medium', sans-serif;\n  font-size: 20px;\n  font-weight: 700;\n  color: #1e293b;\n  margin: 0 0 16px 0;\n}\n"

# Ensure p tags use WPP Thin and size 15px/16px
if "p {" not in content:
    content += "\n\np {\n  font-family: 'WPP Thin', sans-serif;\n  font-size: 15px;\n  font-weight: 300;\n  color: #475569;\n  line-height: 1.6;\n}\n"
else:
    # replace existing p { rules if they exist and are basic
    pass # for now we just append overriding global rules at the end of the file

content += """
/* Typography Overrides */
h1, h2, h3, h4, h5, h6 {
  font-family: 'WPP Medium', sans-serif !important;
}

p, .ca-subtitle, .re-stat-info, .ca-scene-desc, .description, .context-text {
  font-family: 'WPP Thin', sans-serif !important;
  font-weight: 300 !important;
}
"""

with open(filepath, "w") as f:
    f.write(content)

