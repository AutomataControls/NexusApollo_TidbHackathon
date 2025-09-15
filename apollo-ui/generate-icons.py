#!/usr/bin/env python3
"""
Generate all required icon sizes from the Automata Nexus logo
"""

from PIL import Image
import os

# Paths
input_logo = "public/automata-nexus-logo.png"
public_dir = "public"
app_dir = "src/app"

print("Generating icons from automata-nexus-logo.png...")

# Open the original logo
logo = Image.open(input_logo)

# Convert to RGBA if not already
if logo.mode != 'RGBA':
    logo = logo.convert('RGBA')

# Generate different sizes for web
sizes = [
    (16, "favicon-16x16.png"),
    (32, "favicon-32x32.png"),
    (192, "icon-192.png"),
    (512, "icon-512.png"),
    (180, "apple-icon.png"),
]

for size, filename in sizes:
    resized = logo.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(public_dir, filename), "PNG")
    print(f"Created {filename} ({size}x{size})")

# Create OG image (social media preview) with white background
og_width, og_height = 1200, 630
og_image = Image.new('RGBA', (og_width, og_height), (255, 255, 255, 255))

# Resize logo to fit nicely
logo_size = min(og_width, og_height) - 100  # Leave some padding
resized_logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

# Center the logo
x = (og_width - logo_size) // 2
y = (og_height - logo_size) // 2
og_image.paste(resized_logo, (x, y), resized_logo if resized_logo.mode == 'RGBA' else None)
og_image.save(os.path.join(public_dir, "og-image.png"), "PNG")
print("Created og-image.png (1200x630)")

# Create favicon.ico with multiple sizes
ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_images = []
for size in ico_sizes:
    resized = logo.resize(size, Image.Resampling.LANCZOS)
    ico_images.append(resized)

# Save as ICO
ico_images[0].save(
    os.path.join(public_dir, "favicon.ico"),
    format='ICO',
    sizes=ico_sizes,
    append_images=ico_images[1:]
)
print("Created favicon.ico (multi-size)")

# Copy favicon to app directory
import shutil
shutil.copy(
    os.path.join(public_dir, "favicon.ico"),
    os.path.join(app_dir, "favicon.ico")
)
print("Replaced src/app/favicon.ico")

print("\nIcons generated successfully!")
print("Files created:")
print("  - public/favicon-16x16.png")
print("  - public/favicon-32x32.png")
print("  - public/icon-192.png")
print("  - public/icon-512.png")
print("  - public/apple-icon.png")
print("  - public/og-image.png")
print("  - public/favicon.ico")
print("  - src/app/favicon.ico (replaced)")