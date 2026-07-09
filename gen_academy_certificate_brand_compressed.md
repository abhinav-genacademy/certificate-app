---
name: brand-gen-academy-certificate
description: The Gen Academy certificate design system — dark, simple rectangular credential layout with Academy Yellow accents
metadata:
  tags: brand, gen-academy, certificate, dark-background, credential, qr
---

# The Gen Academy Certificate Design System

The certificate should feel modern, premium, AI-native, and credible.

Core direction:
- Dark black/navy background
- Simple rectangle only
- Thin Academy Yellow border accents
- Clean centered hierarchy
- No stamp, seal, badge, clipped corners, or ornate edges
- QR verification bottom right
- Issued date and credential ID along the bottom
- Optional signature block only if needed

---

## Palette

| Name | Hex | Usage |
|---|---|---|
| Academy Yellow | `#FEFB41` | Borders, course title, dividers, QR frame, small accents |
| Black | `#000000` | Base background |
| Deep Navy | `#07111F` | Background depth and gradient |
| Midnight Navy | `#0B1020` | Shadow/depth areas |
| White | `#FFFFFF` | Primary text and recipient name |
| Muted Grey | `#A8AFBD` | Secondary labels only |
| Grid Grey | `rgba(255,255,255,0.06)` | Subtle background grid |
| Yellow Glow | `rgba(254,251,65,0.35)` | Divider glow only |

---

## Background

Use a dark AI-native canvas with a subtle grid.

```css
.certificate {
  width: 1600px;
  height: 1000px;
  position: relative;
  overflow: hidden;
  color: #FFFFFF;
  font-family: Inter, Helvetica, Arial, sans-serif;
  background:
    linear-gradient(135deg, rgba(254,251,65,0.10), rgba(7,17,31,0.10) 28%, rgba(11,16,32,0.65)),
    radial-gradient(circle at 82% 80%, rgba(80,70,160,0.18), transparent 34%),
    linear-gradient(180deg, #05070D 0%, #07111F 100%);
}

.certificate-grid {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image:
    linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

---

## Shape and borders

Keep the certificate rectangular and minimal.

```css
.certificate-border {
  position: absolute;
  inset: 44px;
  border: 2px solid #FEFB41;
  opacity: 0.9;
}

.accent-line-top,
.accent-line-bottom {
  position: absolute;
  left: 0;
  width: 100%;
  height: 4px;
  background: #FEFB41;
}

.accent-line-top { top: 44px; }
.accent-line-bottom { bottom: 44px; }
```

Do not use:
- clipped corners
- angled edges
- beveled frames
- ornate borders
- circular seals or stamps

---

## Typography

```css
.brand-name {
  font-size: 28px;
  letter-spacing: 18px;
  font-weight: 700;
  text-transform: uppercase;
  color: #FFFFFF;
}

.brand-name .highlight { color: #FEFB41; }

.certificate-title {
  margin: 76px 0 12px;
  font-size: 64px;
  letter-spacing: 18px;
  font-weight: 700;
  text-transform: uppercase;
  color: #FFFFFF;
}

.certificate-subtitle {
  font-size: 30px;
  letter-spacing: 14px;
  font-weight: 500;
  text-transform: uppercase;
  color: #FEFB41;
}

.certifies-label,
.completion-label {
  font-size: 22px;
  letter-spacing: 9px;
  font-weight: 500;
  text-transform: uppercase;
  color: #FFFFFF;
}

.recipient-name {
  margin-top: 36px;
  font-size: 82px;
  line-height: 1.1;
  font-weight: 800;
  color: #FFFFFF;
  text-align: center;
  text-shadow: 0 8px 30px rgba(0,0,0,0.45);
}

.course-name {
  margin-top: 18px;
  font-size: 42px;
  line-height: 1.15;
  font-weight: 800;
  color: #FEFB41;
}
```

---

## Dividers

```css
.small-divider {
  width: 300px;
  height: 1px;
  margin: 60px auto 44px;
  background: linear-gradient(90deg, transparent, #FEFB41, transparent);
}

.name-divider {
  width: 1180px;
  height: 1px;
  margin: 36px auto;
  background: linear-gradient(90deg, transparent, rgba(254,251,65,0.35), #FEFB41, rgba(254,251,65,0.35), transparent);
  box-shadow: 0 0 18px rgba(254,251,65,0.55);
}
```

---

## Bottom row

Use issued date, credential ID, optional signature, and QR verification.

```css
.bottom-row {
  position: absolute;
  z-index: 2;
  left: 96px;
  right: 96px;
  bottom: 92px;
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr 160px;
  align-items: end;
  column-gap: 56px;
}

.metadata-label {
  font-size: 15px;
  letter-spacing: 6px;
  text-transform: uppercase;
  color: #FFFFFF;
  opacity: 0.85;
}

.metadata-value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  color: #FFFFFF;
}
```

If no signature is used:

```css
.bottom-row {
  grid-template-columns: 1fr 1fr auto;
}
```

---

## QR verification

```css
.qr-block { text-align: center; }

.qr-frame {
  width: 150px;
  height: 150px;
  padding: 10px;
  border: 2px solid #FEFB41;
  background: #FFFFFF;
}

.qr-frame img {
  width: 100%;
  height: 100%;
  display: block;
}

.qr-label {
  margin-top: 12px;
  font-size: 13px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #FFFFFF;
}
```

---

## Optional signature

Use a signature only if required. Do not replace this with a seal or stamp.

```css
.signature-block { text-align: center; }

.signature {
  font-family: 'Cursive', sans-serif;
  font-size: 42px;
  color: #FFFFFF;
}

.signature-line {
  width: 300px;
  height: 1px;
  margin: 8px auto 12px;
  background: #FEFB41;
}

.signature-name {
  font-size: 16px;
  letter-spacing: 5px;
  text-transform: uppercase;
  color: #FFFFFF;
}

.signature-title {
  margin-top: 8px;
  font-size: 13px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #FEFB41;
  font-weight: 700;
}
```

---

## HTML structure

```html
<section class="certificate">
  <div class="certificate-grid"></div>
  <div class="accent-line-top"></div>
  <div class="accent-line-bottom"></div>
  <div class="certificate-border"></div>

  <div class="certificate-content">
    <div class="brand-name">THE <span class="highlight">GEN</span> ACADEMY</div>

    <h1 class="certificate-title">CERTIFICATE</h1>
    <div class="certificate-subtitle">OF COMPLETION</div>

    <div class="small-divider"></div>

    <div class="certifies-label">THIS CERTIFIES THAT</div>
    <div class="recipient-name">Aishwarya Srinivasan</div>

    <div class="name-divider"></div>

    <div class="completion-label">HAS SUCCESSFULLY COMPLETED</div>
    <div class="course-name">Mastering Agentic AI</div>
  </div>

  <div class="bottom-row">
    <div class="metadata-block">
      <div class="metadata-label">ISSUED</div>
      <div class="metadata-value">June 27, 2026</div>
    </div>

    <div class="metadata-block">
      <div class="metadata-label">CREDENTIAL ID</div>
      <div class="metadata-value">P2BU4RMK7T</div>
    </div>

    <div class="signature-block">
      <div class="signature">Aishwarya S.</div>
      <div class="signature-line"></div>
      <div class="signature-name">Aishwarya Srinivasan</div>
      <div class="signature-title">Founder, The Gen Academy</div>
    </div>

    <div class="qr-block">
      <div class="qr-frame">
        <img src="qr-code.png" alt="Verify certificate QR code" />
      </div>
      <div class="qr-label">VERIFY CERTIFICATE</div>
    </div>
  </div>
</section>
```

---

## Anti-patterns

| Don't | Do instead |
|---|---|
| Circular stamp or seal | Remove it entirely |
| Angled or clipped edges | Use a simple rectangle |
| Ornate diploma styling | Use modern AI-native minimalism |
| Heavy decorative symbols | Keep accents sparse |
| Yellow body text everywhere | Use yellow for accents and course title |
| Overcrowded metadata row | Keep bottom row spacious |
| Thick glows everywhere | Use glow only on dividers |
| Low-contrast grey text | Use muted grey only for secondary labels |

---

## Design principles

1. Premium, not decorative.
2. Simple rectangle only.
3. No stamp, seal, badge, or ornamental frame.
4. Recipient name is the visual anchor.
5. Academy Yellow is a controlled accent.
6. QR must remain clean and scannable.
7. Match The Gen Academy dark grid, yellow accent, and clean typography.
