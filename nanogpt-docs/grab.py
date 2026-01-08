import os
import requests
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

SITEMAP_URL = "https://docs.nano-gpt.com/sitemap.xml"
BASE_URL = "https://docs.nano-gpt.com"

# Fetch sitemap
response = requests.get(SITEMAP_URL)
response.raise_for_status()
root = ET.fromstring(response.content)

# Extract URLs (filter to docs pages if needed)
urls = [loc.text for loc in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc") 
        if loc.text.startswith(BASE_URL)]

# Download each as .md
for url in urls:
    md_url = url + ".md" if not url.endswith("/") else url.rstrip("/") + ".md"
    md_response = requests.get(md_url)
    if md_response.status_code == 200:
        # Create local path mirroring URL structure
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if path:
            file_path = path + ".md"
        else:
            file_path = "index.md"
        
        os.makedirs(os.path.dirname(file_path) or ".", exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(md_response.text)
        
        print(f"Saved: {file_path}")
    else:
        print(f"Failed ({md_response.status_code}): {md_url}")

print("Done! All docs saved as Markdown files.")
