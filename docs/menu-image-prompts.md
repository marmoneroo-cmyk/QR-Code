# Menu Image Prompts — ready for ChatGPT / DALL·E

**Who makes the images?** Not Claude (it only writes code & text). The current 9 hero
images were generated earlier by an AI image service (Pollinations) from each drink's
stored `heroPrompt`. Pollinations now charges per image, so the easy path today is:
**generate in ChatGPT (DALL·E), then upload in the editor** (manual upload already works).

## The 3-step workflow
1. In **ChatGPT** (a model with image generation), paste the **Style block** once, then
   paste an **item prompt** (or fill the template with your own item).
2. Download the PNG. Ask ChatGPT for *"pure black background, portrait, nothing cropped."*
3. In the admin editor (`/admin` → the item → image), **upload** the PNG. Done.

## Image spec (so uploads match the app)
- **Orientation:** portrait, ~1024×1280 (4:5). The whole glass/plate visible with margin.
- **Background:** pure solid **black** (the menu page is black, so it blends seamlessly).
- **No** text, no watermark, no logo. Photoreal studio product shot.
- Save as **PNG**.

---

## Reusable template (fill and paste)

**Drinks:**
> A beautifully lit **{DRINK NAME}**, made with **{INGREDIENTS}**, served in **{GLASS}**
> with elegant garnish, the complete glass centered and fully visible with generous empty
> margin so nothing is cropped, fresh condensation droplets, against a pure solid black
> background with no surface and no shadow below. Cinematic product photography, dramatic
> moody lighting from the upper-right, ultra-sharp focus, commercial advertising style,
> photorealistic, 8k. Portrait 4:5. No text, no watermark.

**Food (for real restaurant imports):**
> A beautifully lit **{DISH NAME}**, made of **{COMPONENTS}**, fine-dining plating on an
> elegant plate, centered and fully visible with generous margin so nothing is cropped,
> against a pure solid black background with no surface and no shadow. Cinematic food
> photography, dramatic moody lighting from the upper-right, ultra-sharp focus,
> photorealistic, 8k. Portrait 4:5. No text, no watermark.

---

## Style block (paste into ChatGPT ONCE, first)

> For every image I ask for next: photorealistic studio product shot, the subject centered
> and **fully visible** (never cropped) with generous margin, on a **pure solid black**
> background with no surface and no shadow, dramatic moody lighting from the upper-right,
> ultra-sharp focus, **portrait 4:5**, and absolutely **no text or watermark**. Reply only
> with the image.

---

## The current menu — 9 ready prompts

> Copy the prompt, paste after the Style block, generate, then upload as that item's image.

### 1. Citrus Lime Sour — `citrus-lime-sour`
*Gin · Pink grapefruit · Fresh lime · Crushed ice*
> A beautifully lit Citrus Lime Sour, made with gin, fresh lime and pink grapefruit over
> crushed ice, served in a tall Collins glass with a lime wheel and peel, the complete glass
> centered and fully visible with generous margin, pale citrus-gold liquid, fresh condensation,
> against a pure solid black background with no surface or shadow. Cinematic product
> photography, moody lighting from upper-right, ultra-sharp, photorealistic, 8k, portrait 4:5.
> No text, no watermark.

### 2. Smoked Old Fashioned — `smoked-old-fashioned`
*Bourbon · Demerara · Smoked oak · Orange peel*
> A beautifully lit Smoked Old Fashioned, bourbon with demerara and a hint of smoked oak over
> one large clear ice sphere, served in a short crystal rocks glass with a long orange peel
> twist, a faint wisp of smoke, deep amber liquid, centered and fully visible, against a pure
> solid black background with no surface or shadow. Cinematic product photography, moody
> lighting from upper-right, ultra-sharp, photorealistic, 8k, portrait 4:5. No text, no watermark.

### 3. Garden Spritz — `garden-spritz` *(mocktail)*
*Cucumber · Basil · Elderflower · Sparkling water*
> A beautifully lit non-alcoholic Garden Spritz, cucumber, fresh basil and elderflower with
> sparkling water over ice, served in a tall stemmed wine glass with a cucumber ribbon and
> basil leaf, pale green sparkling liquid with rising bubbles, centered and fully visible,
> against a pure solid black background with no surface or shadow. Cinematic product
> photography, moody lighting from upper-right, ultra-sharp, photorealistic, 8k, portrait 4:5.
> No text, no watermark.

### 4. Aperol Spritz — `diner-aperol-spritz`
*Aperol · Prosecco · Soda · Orange peel*
> A beautifully lit Aperol Spritz, bright orange Aperol with prosecco and a splash of soda
> over a large ice cube, served in a tall stemmed wine glass garnished with a fresh orange
> slice on the rim, vivid sunset-orange liquid, fresh condensation, centered and fully
> visible, against a pure solid black background with no surface or shadow. Cinematic product
> photography, moody lighting from upper-right, ultra-sharp, photorealistic, 8k, portrait 4:5.
> No text, no watermark.

### 5. Negroni — `diner-negroni`
*Gin · Campari · Sweet vermouth · Orange peel*
> A beautifully lit Negroni, equal parts gin, Campari and sweet vermouth over one large clear
> ice sphere, served in a short crystal rocks glass with a long orange peel twist, deep ruby-red
> liquid, centered and fully visible, against a pure solid black background with no surface or
> shadow. Cinematic product photography, moody lighting from upper-right, ultra-sharp,
> photorealistic, 8k, portrait 4:5. No text, no watermark.

### 6. Pinky — `diner-pinky`
*Pink gin · Raspberry · Lime · Tonic*
> A beautifully lit Pinky cocktail, pink gin with raspberry and lime topped with tonic over
> crushed ice, served in a tall stemmed balloon glass garnished with fresh raspberries and a
> lime wheel, vibrant pink liquid with gentle bubbles, centered and fully visible, against a
> pure solid black background with no surface or shadow. Cinematic product photography, moody
> lighting from upper-right, ultra-sharp, photorealistic, 8k, portrait 4:5. No text, no watermark.

### 7. Margarita — `diner-margarita`
*Tequila · Triple sec · Fresh lime · Salt rim*
> A beautifully lit Margarita, tequila, triple sec and fresh lime, served in a classic
> margarita coupe with a salt rim and a lime wheel, pale citrus-green liquid, centered and
> fully visible, against a pure solid black background with no surface or shadow. Cinematic
> product photography, moody lighting from upper-right, ultra-sharp, photorealistic, 8k,
> portrait 4:5. No text, no watermark.

### 8. Green Garden — `diner-green-garden` *(mocktail)*
*Cucumber · Basil · Elderflower · Lime*
> A beautifully lit non-alcoholic Green Garden, cucumber, fresh basil, elderflower and lime
> over ice, served in a tall highball glass with a cucumber ribbon and basil, fresh green
> liquid, centered and fully visible, against a pure solid black background with no surface
> or shadow. Cinematic product photography, moody lighting from upper-right, ultra-sharp,
> photorealistic, 8k, portrait 4:5. No text, no watermark.

### 9. Whiskey Sour — `diner-whiskey-sour`
*Bourbon · Fresh lemon · Sugar · Egg white*
> A beautifully lit Whiskey Sour, bourbon, fresh lemon and sugar shaken with egg white for a
> silky foam top, served in a rocks glass with a brandied cherry and lemon peel, warm amber
> liquid under a pale foam cap, centered and fully visible, against a pure solid black
> background with no surface or shadow. Cinematic product photography, moody lighting from
> upper-right, ultra-sharp, photorealistic, 8k, portrait 4:5. No text, no watermark.

---

*Note: the 9 drinks above already have images shipped — these prompts are the template/
examples. The real use is **imported menus**: paste the matching template, fill in the item's
name + ingredients, generate, upload. Ask Claude to wire a "Copy image prompt" button into the
import screen if you want this generated automatically for every imported item.*
