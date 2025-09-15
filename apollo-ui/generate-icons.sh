#!/bin/bash

# Generate icons from the Automata Nexus logo
echo "Generating icons from automata-nexus-logo.png..."

# Create different sizes for web
convert public/automata-nexus-logo.png -resize 16x16 public/favicon-16x16.png
convert public/automata-nexus-logo.png -resize 32x32 public/favicon-32x32.png
convert public/automata-nexus-logo.png -resize 192x192 public/icon-192.png
convert public/automata-nexus-logo.png -resize 512x512 public/icon-512.png

# Create Apple touch icon
convert public/automata-nexus-logo.png -resize 180x180 public/apple-icon.png

# Create OG image (social media preview) - add padding for better display
convert public/automata-nexus-logo.png -resize 800x800 -gravity center -background white -extent 1200x630 public/og-image.png

# Create favicon.ico with multiple sizes
convert public/automata-nexus-logo.png -resize 16x16 public/icon-16.png
convert public/automata-nexus-logo.png -resize 32x32 public/icon-32.png
convert public/automata-nexus-logo.png -resize 48x48 public/icon-48.png
convert public/icon-16.png public/icon-32.png public/icon-48.png public/favicon.ico

# Replace the Next.js favicon in src/app
cp public/favicon.ico src/app/favicon.ico

# Clean up temporary files
rm -f public/icon-16.png public/icon-32.png public/icon-48.png

echo "Icons generated successfully!"
echo "Files created:"
echo "  - public/favicon-16x16.png"
echo "  - public/favicon-32x32.png"
echo "  - public/icon-192.png"
echo "  - public/icon-512.png"
echo "  - public/apple-icon.png"
echo "  - public/og-image.png"
echo "  - public/favicon.ico"
echo "  - src/app/favicon.ico (replaced)"