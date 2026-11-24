import AppKit

let size = 512.0
let out = CommandLine.arguments[1]
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: 512, height: 512, bitsPerComponent: 8, bytesPerRow: 0,
                    space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

func rr(_ x: Double, _ y: Double, _ w: Double, _ h: Double, _ r: Double) -> CGPath {
  // y measured from top for readability
  CGPath(roundedRect: CGRect(x: x, y: size - y - h, width: w, height: h), cornerWidth: r, cornerHeight: r, transform: nil)
}
func rgba(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> CGColor { CGColor(red: r/255, green: g/255, blue: b/255, alpha: a) }

// Background: rounded square with diagonal gradient
let bg = rr(16, 16, 480, 480, 108)
ctx.saveGState()
ctx.addPath(bg); ctx.clip()
let grad = CGGradient(colorsSpace: cs, colors: [rgba(76, 110, 245), rgba(132, 74, 230)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: size), end: CGPoint(x: size, y: 0), options: [])
// soft top highlight
let hl = CGGradient(colorsSpace: cs, colors: [rgba(255,255,255,0.18), rgba(255,255,255,0)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(hl, start: CGPoint(x: 0, y: size), end: CGPoint(x: 0, y: size * 0.45), options: [])
ctx.restoreGState()

func fill(_ p: CGPath, _ c: CGColor, shadow: Bool = false) {
  ctx.saveGState()
  if shadow { ctx.setShadow(offset: CGSize(width: 0, height: -6), blur: 18, color: rgba(20, 10, 60, 0.35)) }
  ctx.addPath(p); ctx.setFillColor(c); ctx.fillPath()
  ctx.restoreGState()
}

// Stage Manager strip: three stacked thumbnails, fading down
let thumbs: [(Double, Double)] = [(118, 0.85), (214, 0.6), (310, 0.38)]
for (y, a) in thumbs { fill(rr(84, y, 70, 82, 16), rgba(255, 255, 255, a), shadow: a > 0.8) }

// Two half panes
fill(rr(178, 110, 122, 292, 24), rgba(255, 255, 255, 1), shadow: true)
fill(rr(314, 110, 122, 292, 24), rgba(255, 255, 255, 0.72), shadow: true)

// Title-bar dots on the active pane
for (i, c) in [rgba(255, 95, 87), rgba(254, 188, 46), rgba(40, 200, 64)].enumerated() {
  ctx.addEllipse(in: CGRect(x: 198 + Double(i) * 22, y: size - 140, width: 12, height: 12))
  ctx.setFillColor(c); ctx.fillPath()
}

let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
