import os
import math
from PIL import Image, ImageDraw, ImageFilter

target_dir = r"C:\Users\COM\Projects\today game\games\zombie-run\assets"
os.makedirs(target_dir, exist_ok=True)

def create_chick_hero():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Glow / Shadow
    draw.ellipse([128, 420, 384, 480], fill=(0, 0, 0, 80))
    
    # Feet (Orange boots)
    draw.ellipse([160, 390, 230, 440], fill="#FF6B00", outline="#D04A00", width=4)
    draw.ellipse([282, 390, 352, 440], fill="#FF6B00", outline="#D04A00", width=4)
    
    # Body (Cute round chick)
    # Base Yellow Body Gradient layers
    draw.ellipse([110, 160, 402, 420], fill="#FFB703", outline="#E09100", width=6)
    draw.ellipse([120, 170, 392, 410], fill="#FFD166")
    draw.ellipse([135, 180, 360, 380], fill="#FFE49E") # Highlight
    
    # Fluffy head crest feather
    draw.polygon([(256, 70), (230, 130), (282, 130)], fill="#FFB703", outline="#E09100")
    draw.polygon([(240, 60), (220, 125), (260, 125)], fill="#FFD166")
    
    # Big Shiny Cute Eyes
    # Left eye
    draw.ellipse([175, 200, 245, 280], fill="#111111")
    draw.ellipse([190, 210, 220, 240], fill="#FFFFFF") # Sparkle
    draw.ellipse([215, 245, 230, 260], fill="#FFFFFF") # Small sparkle
    
    # Right eye
    draw.ellipse([267, 200, 337, 280], fill="#111111")
    draw.ellipse([282, 210, 312, 240], fill="#FFFFFF") # Sparkle
    draw.ellipse([307, 245, 322, 260], fill="#FFFFFF") # Small sparkle
    
    # Cute Cheeks
    draw.ellipse([150, 260, 185, 290], fill=(255, 120, 150, 180))
    draw.ellipse([327, 260, 362, 290], fill=(255, 120, 150, 180))
    
    # Beak (Orange Chick Beak)
    draw.polygon([(230, 265), (282, 265), (256, 310)], fill="#FF5722", outline="#D83A07", width=4)
    draw.polygon([(238, 275), (274, 275), (256, 300)], fill="#FF7A50")
    
    # Tactical Combat Vest
    draw.rectangle([165, 320, 347, 390], fill="#2A2D34", outline="#4A4E58", width=4)
    draw.rectangle([180, 335, 240, 375], fill="#00F0FF") # Cyan Power Core
    draw.rectangle([272, 335, 332, 375], fill="#3A3F47")
    
    # Wings & Laser Rifle
    # Left wing
    draw.ellipse([90, 260, 160, 350], fill="#FFB703", outline="#E09100", width=4)
    
    # Right wing holding Futuristic Gun
    draw.ellipse([350, 260, 420, 350], fill="#FFB703", outline="#E09100", width=4)
    
    # Laser Gun
    draw.rectangle([280, 310, 460, 355], fill="#1A1C23", outline="#00F0FF", width=4)
    draw.rectangle([440, 300, 475, 365], fill="#00F0FF") # Glowing barrel
    draw.ellipse([460, 290, 490, 375], fill=(0, 240, 255, 160)) # Glow FX
    
    img.save(os.path.join(target_dir, "hero_chick.png"))
    print("Generated cute hero_chick.png")

def create_rabbit_hero():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Shadow
    draw.ellipse([128, 440, 384, 495], fill=(0, 0, 0, 80))
    
    # Bunny Ears
    draw.ellipse([150, 20, 220, 220], fill="#F8F9FA", outline="#E9ECEF", width=5)
    draw.ellipse([168, 40, 202, 190], fill="#FF85A1") # Inner Pink
    
    draw.ellipse([292, 20, 362, 220], fill="#F8F9FA", outline="#E9ECEF", width=5)
    draw.ellipse([310, 40, 344, 190], fill="#FF85A1") # Inner Pink
    
    # Feet
    draw.ellipse([150, 410, 225, 460], fill="#00F0FF", outline="#0088CC", width=4)
    draw.ellipse([287, 410, 362, 460], fill="#00F0FF", outline="#0088CC", width=4)
    
    # Body
    draw.ellipse([120, 180, 392, 430], fill="#F8F9FA", outline="#CED4DA", width=5)
    draw.ellipse([160, 250, 352, 410], fill="#FFF0F5")
    
    # Eyes
    draw.ellipse([175, 220, 245, 295], fill="#0088CC")
    draw.ellipse([190, 230, 220, 255], fill="#FFFFFF")
    
    draw.ellipse([267, 220, 337, 295], fill="#0088CC")
    draw.ellipse([282, 230, 312, 255], fill="#FFFFFF")
    
    # Nose & Mouth
    draw.polygon([(246, 290), (266, 290), (256, 305)], fill="#FF85A1")
    
    # Dual Blasters
    draw.rectangle([60, 300, 180, 345], fill="#212529", outline="#00F0FF", width=3)
    draw.rectangle([332, 300, 452, 345], fill="#212529", outline="#00F0FF", width=3)
    
    img.save(os.path.join(target_dir, "hero_rabbit.png"))
    print("Generated cute hero_rabbit.png")

def create_bear_hero():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Shadow
    draw.ellipse([110, 430, 402, 490], fill=(0, 0, 0, 80))
    
    # Bear Ears
    draw.ellipse([110, 80, 210, 180], fill="#8B4513", outline="#5C2E0B", width=5)
    draw.ellipse([135, 105, 185, 155], fill="#D2B48C")
    
    draw.ellipse([302, 80, 402, 180], fill="#8B4513", outline="#5C2E0B", width=5)
    draw.ellipse([327, 105, 377, 155], fill="#D2B48C")
    
    # Body
    draw.ellipse([100, 140, 412, 440], fill="#8B4513", outline="#5C2E0B", width=6)
    
    # Snout
    draw.ellipse([196, 240, 316, 330], fill="#F5DEB3")
    draw.ellipse([236, 250, 276, 280], fill="#2B1B17") # Nose
    
    # Eyes
    draw.ellipse([160, 200, 220, 260], fill="#111111")
    draw.ellipse([175, 210, 195, 230], fill="#FFFFFF")
    
    draw.ellipse([292, 200, 352, 260], fill="#111111")
    draw.ellipse([307, 210, 327, 230], fill="#FFFFFF")
    
    # Armor & Cannon
    draw.rectangle([140, 330, 372, 420], fill="#DAA520", outline="#8B6508", width=5)
    draw.rectangle([340, 310, 470, 370], fill="#333333", outline="#FF9E00", width=4)
    
    img.save(os.path.join(target_dir, "hero_bear.png"))
    print("Generated cute hero_bear.png")

def create_bird_hero():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Shadow
    draw.ellipse([128, 430, 384, 485], fill=(0, 0, 0, 80))
    
    # Body & Head (Emerald/Cyan)
    draw.ellipse([110, 130, 402, 420], fill="#00CEC9", outline="#00B894", width=6)
    draw.ellipse([140, 210, 372, 400], fill="#55EFC4")
    
    # Crest feathers
    draw.polygon([(256, 40), (220, 110), (292, 110)], fill="#00CEC9")
    
    # Eyes & Goggles
    draw.rectangle([140, 175, 372, 235], fill="#2D3436", outline="#FF7675", width=4)
    draw.ellipse([170, 180, 230, 230], fill="#00B894")
    draw.ellipse([185, 190, 205, 210], fill="#FFFFFF")
    
    draw.ellipse([282, 180, 342, 230], fill="#00B894")
    draw.ellipse([297, 190, 317, 210], fill="#FFFFFF")
    
    # Beak
    draw.polygon([(226, 235), (286, 235), (256, 285)], fill="#FAB1A0", outline="#E17055", width=4)
    
    # Plasma Gun
    draw.rectangle([300, 300, 460, 350], fill="#0984E3", outline="#74B9FF", width=4)
    
    img.save(os.path.join(target_dir, "hero_bird.png"))
    print("Generated cute hero_bird.png")

def create_zombie():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Shadow
    draw.ellipse([140, 440, 372, 495], fill=(0, 0, 0, 90))
    
    # Zombie Legs (Pants)
    draw.rectangle([180, 340, 235, 450], fill="#2C3E50", outline="#1A252F", width=4)
    draw.rectangle([277, 340, 332, 450], fill="#2C3E50", outline="#1A252F", width=4)
    
    # Zombie Body (Shirt)
    draw.rectangle([150, 200, 362, 350], fill="#8E44AD", outline="#6C3483", width=5)
    
    # Zombie Head
    draw.ellipse([160, 60, 352, 220], fill="#2ECC71", outline="#27AE60", width=6)
    
    # Glowing Red Eyes
    draw.ellipse([190, 110, 235, 155], fill="#E74C3C")
    draw.ellipse([205, 120, 220, 135], fill="#FFFFFF")
    
    draw.ellipse([277, 110, 322, 155], fill="#E74C3C")
    draw.ellipse([292, 120, 307, 135], fill="#FFFFFF")
    
    # Zombie Mouth & Teeth
    draw.rectangle([210, 170, 302, 195], fill="#111111")
    draw.rectangle([220, 170, 235, 182], fill="#FFFFFF")
    draw.rectangle([250, 170, 265, 182], fill="#FFFFFF")
    draw.rectangle([280, 170, 295, 182], fill="#FFFFFF")
    
    # Outstretched Arms
    draw.rectangle([70, 220, 160, 260], fill="#2ECC71", outline="#27AE60", width=4)
    draw.rectangle([352, 220, 442, 260], fill="#2ECC71", outline="#27AE60", width=4)
    
    img.save(os.path.join(target_dir, "zombie.png"))
    print("Generated standing zombie.png")

def create_boss():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Shadow
    draw.ellipse([100, 430, 412, 495], fill=(0, 0, 0, 110))
    
    # Crown
    draw.polygon([(170, 70), (210, 20), (256, 60), (302, 20), (342, 70)], fill="#F1C40F", outline="#F39C12", width=4)
    
    # Boss Head
    draw.ellipse([140, 60, 372, 240], fill="#16A085", outline="#117864", width=7)
    
    # Glowing Eyes
    draw.ellipse([180, 110, 235, 165], fill="#C0392B")
    draw.ellipse([277, 110, 332, 165], fill="#C0392B")
    
    # Giant Teeth
    draw.rectangle([190, 180, 322, 220], fill="#111111")
    draw.polygon([(200, 180), (220, 180), (210, 205)], fill="#FFFFFF")
    draw.polygon([(245, 180), (265, 180), (255, 205)], fill="#FFFFFF")
    draw.polygon([(290, 180), (310, 180), (300, 205)], fill="#FFFFFF")
    
    # Giant Body
    draw.rectangle([110, 230, 402, 420], fill="#27AE60", outline="#1E8449", width=6)
    
    img.save(os.path.join(target_dir, "boss.png"))
    print("Generated standing boss.png")

create_chick_hero()
create_rabbit_hero()
create_bear_hero()
create_bird_hero()
create_zombie()
create_boss()
