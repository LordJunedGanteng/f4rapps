from PIL import Image, ImageDraw

def create_app_icon():
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    images = []
    
    for w, h in sizes:
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Rounded background
        r = int(w * 0.22)
        pad = int(w * 0.04)
        
        # Background dark rounded rect
        draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=r, fill=(15, 12, 28, 255), outline=(139, 92, 246, 255), width=max(1, int(w*0.04)))
        
        # Inner waveform bars (Electric Purple / Violet & Cyan)
        # Draw 5 bars
        bar_count = 5
        bar_width = max(2, int(w * 0.08))
        gap = max(1, int(w * 0.05))
        total_width = bar_count * bar_width + (bar_count - 1) * gap
        start_x = (w - total_width) // 2
        
        height_factors = [0.4, 0.75, 1.0, 0.65, 0.35]
        max_bar_h = int(h * 0.45)
        center_y = h // 2
        
        for i, factor in enumerate(height_factors):
            bx = start_x + i * (bar_width + gap)
            bh = int(max_bar_h * factor)
            by1 = center_y - bh // 2
            by2 = center_y + bh // 2
            
            # Color gradient feel (center is bright cyan/white, sides are electric purple)
            if i == 2:
                bar_color = (192, 132, 252, 255) # Light electric violet
            elif i in (1, 3):
                bar_color = (168, 85, 247, 255) # Medium violet
            else:
                bar_color = (124, 58, 237, 255) # Deep violet
                
            draw.rounded_rectangle([bx, by1, bx + bar_width, by2], radius=max(1, bar_width//2), fill=bar_color)
            
        images.append(img)
        
    images[0].save("app_icon.ico", format="ICO", sizes=[(s[0], s[1]) for s in sizes])
    images[0].save("app_icon.png", format="PNG")
    print("Icon generated: app_icon.ico & app_icon.png")

if __name__ == "__main__":
    create_app_icon()
