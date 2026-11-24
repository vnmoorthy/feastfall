# Feastfall HD asset builder (higher realism; same filenames/origins/footprints as build_assets.py).
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python build_assets_hd.py
# Output: public/models/hd/*.glb. Blender Z-up -> glTF Y-up; asset front is Blender -Y (= glTF +Z).
# All colour lives in a per-vertex COLOR_0 attribute ("Col") multiplied by a white Principled base.
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Euler, noise

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public", "models", "hd"))
os.makedirs(OUT, exist_ok=True)


def lin(h):
    if not isinstance(h, str):
        return tuple(h[:3])
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mix(a, b, t):
    a, b = lin(a), lin(b)
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def mul(c, k):
    c = lin(c)
    return tuple(max(0.0, min(1.0, x * k)) for x in c)


def sstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def n01(p):
    return 0.5 + 0.5 * noise.noise(Vector(p))


MATS = {}


def vmat(name, rough=0.8, metal=0.0, emit=None, emit_strength=0.0):
    """White Principled base x vertex colour 'Col'."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (1, 1, 1, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], p.inputs['Base Color'])
    if emit:
        p.inputs['Emission Color'].default_value = lin(emit) + (1.0,)
        p.inputs['Emission Strength'].default_value = emit_strength
    MATS[name] = m
    return m


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


# ---------------------------------------------------------------- builder
class Builder:
    def __init__(self, seed=1):
        self.bm = bmesh.new()
        self.cl = self.bm.verts.layers.float_color.new('Col')
        self.mats = []
        self.rng = random.Random(seed)

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, t, mc, var=0.06, vn=0.025, col=None):
        m, c = mc
        if col is not None:
            c = col
        idx = self.mi(m)
        bright = 1.0 + self.rng.uniform(-var, var)
        t.normal_update()
        vmap = {}
        for v in t.verts:
            nv = self.bm.verts.new(v.co)
            cc = c(v.co, v.normal) if callable(c) else lin(c)
            k = bright * (1.0 + self.rng.uniform(-vn, vn))
            nv[self.cl] = (min(1.0, cc[0] * k), min(1.0, cc[1] * k), min(1.0, cc[2] * k), 1.0)
            vmap[v] = nv
        for f in t.faces:
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
                nf.material_index = idx
            except ValueError:
                pass
        t.free()

    def part(self, kind, mc, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), bevel=0.0, bseg=1, jitter=0.0,
             disp=None, var=0.06, vn=0.025, col=None, **kw):
        t = bmesh.new()
        if kind == 'box':
            bmesh.ops.create_cube(t, size=1.0)
        elif kind == 'cyl':
            bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=kw.get('segs', 12),
                                  radius1=kw.get('r1', 0.5), radius2=kw.get('r2', kw.get('r1', 0.5)), depth=kw.get('depth', 1.0))
        elif kind == 'ico':
            bmesh.ops.create_icosphere(t, subdivisions=kw.get('subdiv', 2), radius=kw.get('r', 1.0))
        elif kind == 'uv':
            bmesh.ops.create_uvsphere(t, u_segments=kw.get('u', 16), v_segments=kw.get('v', 10), radius=kw.get('r', 1.0))
        elif kind == 'prism':
            w, h, d = kw['w'], kw['h'], kw['d']
            pts = [(-w / 2, 0), (w / 2, 0), (0, h)]
            a = [t.verts.new((x, -d / 2, z)) for x, z in pts]
            b = [t.verts.new((x, d / 2, z)) for x, z in pts]
            t.faces.new(a[::-1]); t.faces.new(b)
            for i in range(3):
                j = (i + 1) % 3
                t.faces.new([a[i], a[j], b[j], b[i]])
        if 'deform' in kw:
            for v in t.verts:
                v.co = kw['deform'](v.co)
        if disp:
            amp, freq, off = disp
            for v in t.verts:
                d = v.co.normalized()
                v.co += d * amp * (noise.noise(v.co * freq + Vector(off)) + 0.5 * noise.noise(v.co * freq * 2.3 + Vector(off)))
        if jitter:
            for v in t.verts:
                v.co *= 1.0 + self.rng.uniform(-jitter, jitter)
        if kind == 'box':
            for v in t.verts:
                v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
            sc = Matrix.Identity(4)
        else:
            sc = Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        if bevel > 0 and kind in ('box', 'cyl'):
            bmesh.ops.bevel(t, geom=list(t.verts) + list(t.edges), offset=bevel, segments=bseg, profile=0.5,
                            affect='EDGES', clamp_overlap=True)
        R = rot.to_4x4() if isinstance(rot, Matrix) else Euler(rot, 'XYZ').to_matrix().to_4x4()
        M = Matrix.Translation(Vector(loc)) @ R @ sc
        bmesh.ops.transform(t, matrix=M, verts=t.verts)
        bmesh.ops.recalc_face_normals(t, faces=t.faces)
        self.add(t, mc, var=var, vn=vn, col=col)

    def tube(self, mc, pts, radii, segs=8, cap0=True, cap1=True, namp=0.0, col=None, var=0.05):
        t = bmesh.new()
        pts = [Vector(p) for p in pts]
        rings, pn = [], None
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            if pn is None:
                a = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
                n = d.cross(a).normalized()
            else:
                n = (pn - d * pn.dot(d)).normalized()
            b = d.cross(n)
            pn = n
            ring = []
            for j in range(segs):
                an = 2 * math.pi * j / segs
                dirv = n * math.cos(an) + b * math.sin(an)
                rr = radii[i] * (1.0 + namp * noise.noise(p * 1.7 + dirv * 1.3))
                ring.append(t.verts.new(p + dirv * rr))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for j in range(segs):
                j2 = (j + 1) % segs
                t.faces.new([rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]])
        if cap0:
            t.faces.new(list(reversed(rings[0])))
        if cap1:
            t.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(t, faces=t.faces)
        self.add(t, mc, var=var, col=col)

    def beam(self, mc, a, b, r=0.1, segs=8, bevel=0.0, r2=None, col=None):
        a, b = Vector(a), Vector(b)
        d = b - a
        q = d.normalized().to_track_quat('Z', 'Y').to_matrix()
        self.part('cyl', mc, loc=(a + b) / 2, rot=q, segs=segs, r1=r, r2=r * 0.9 if r2 is None else r2,
                  depth=d.length, bevel=bevel, col=col)

    def obj(self, name, sharp=50):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
        try:
            me.set_sharp_from_angle(angle=math.radians(sharp))
        except Exception as e:
            print('sharp fail', e)
        try:
            me.color_attributes.active_color = me.color_attributes['Col']
            me.color_attributes.render_color_index = 0
        except Exception:
            pass
        for m in self.mats:
            me.materials.append(m)
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        try:
            wn = o.modifiers.new('wnorm', 'WEIGHTED_NORMAL')
            wn.keep_sharp = True
        except Exception as e:
            print('wn fail', e)
        return o


def export(root, fname):
    bpy.ops.object.select_all(action='DESELECT')
    objs = [root] + list(root.children_recursive)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(OUT, fname)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True)
    print("EXPORTED", path, os.path.getsize(path))


# ---------------------------------------------------------------- materials (white base x vertex colour)
PAINT = vmat('hd_paint', 0.72)
WOODM = vmat('hd_wood', 0.82)
STONEM = vmat('hd_stone', 0.9)
LEAFM = vmat('hd_leaf', 0.7)
BARKM = vmat('hd_bark', 0.92)
HAYM = vmat('hd_hay', 0.95)
METALM = vmat('hd_metal', 0.42, 0.75)
CERAM = vmat('hd_ceramic', 0.32)
FOODM = vmat('hd_food', 0.45)
CLOTH = vmat('hd_cloth', 0.9)
WATERM = vmat('hd_water', 0.08)
GLASS = vmat('hd_glass_glow', 0.12, emit='#ffc457', emit_strength=6.0)
FLAME = vmat('hd_flame', 0.3, emit='#ffb347', emit_strength=8.0)
EMBER = vmat('hd_ember', 0.6, emit='#ff5a1a', emit_strength=3.0)

RED = (PAINT, '#a83a2a'); RED2 = (PAINT, '#8f2f1f'); SEAM = (PAINT, '#3a1712')
TRIM = (PAINT, '#efe0bf')
ROOF = (WOODM, '#3d2518'); SHING = (WOODM, '#4f3020')
HAY = (HAYM, '#e3b448'); TWINE = (HAYM, '#8f6a2c')
WOOD = (WOODM, '#8b5a2b'); WOOD_L = (WOODM, '#b9875a'); WOOD_D = (WOODM, '#5e4026')
DARK = (PAINT, '#1e120c')
STONE = (STONEM, '#8a8f99'); STONE2 = (STONEM, '#6f747d')
LOG = (BARKM, '#5b3a21'); ASH = (STONEM, '#3b3330')
WICKER = (HAYM, '#b5804a'); APPLE = (FOODM, '#b8201f'); PUMPK = (FOODM, '#f07c12')
STEM = (WOODM, '#5b5a2a'); METAL = (METALM, '#2d2d30'); BUCKET = (METALM, '#8a9aa6')
LANT = (GLASS, '#ffd27a'); PLATE = (CERAM, '#f5f0e6'); CRUST = (FOODM, '#d39a52'); FILL = (FOODM, '#a8441e')
TURKEY = (FOODM, '#a85a24'); CORN = (FOODM, '#f0c03a'); CLOTHC = (CLOTH, '#efe4cf'); RUNNER = (CLOTH, '#9c2f22')
WAX = (CERAM, '#f3ead2'); FLAMEC = (FLAME, '#ffd27a')
PLANKS = ['#9a6b3f', '#8a5d34', '#a8784a', '#7d5430']


def weathered(hexc, ground=0.3, top=1.6):
    base = lin(hexc)

    def f(co, no):
        g = 0.72 + 0.28 * sstep(ground, top, co.z)
        s = 0.9 + 0.2 * n01(co * Vector((6, 6, 0.8)))
        return mul(base, g * s)
    return f


def stone_col(hexc, moss='#5d7a3a'):
    base = lin(hexc)

    def f(co, no):
        s = 0.8 + 0.35 * n01(co * 2.5)
        c = mul(base, s)
        m = sstep(0.45, 0.85, no.z) * sstep(0.35, 0.65, n01(co * 1.3 + Vector((5, 1, 2))))
        return mix(c, mul(moss, 0.8 + 0.3 * n01(co * 4)), m * 0.85)
    return f


def bark_col(hexc='#6b4423'):
    base = lin(hexc)

    def f(co, no):
        s = 0.65 + 0.5 * n01(Vector((co.x * 5, co.y * 5, co.z * 0.7)))
        return mix(mul(base, s), '#3e5a2a', 0.25 * sstep(0.6, 0.9, n01(co * 0.8)) * (1 - sstep(0.0, 1.2, co.z)))
    return f


# ---------------------------------------------------------------- granary
def build_granary():
    B = Builder(11)
    rng = B.rng
    WX, WY, WZ0, WZ1 = 2.7, 2.2, 0.3, 4.2
    h = WZ1 - WZ0
    # stone foundation: dark slab + coursed stones around the perimeter
    B.part('box', STONE2, loc=(0, 0, 0.1), scale=(6.0, 5.0, 0.2), bevel=0.05, col=stone_col('#5f646c'))
    for course in range(2):
        z = 0.07 + course * 0.15
        for (x0, y0, x1, y1) in ((-3.0, -2.5, 3.0, -2.5), (3.0, -2.5, 3.0, 2.5), (3.0, 2.5, -3.0, 2.5), (-3.0, 2.5, -3.0, -2.5)):
            L = math.hypot(x1 - x0, y1 - y0)
            n = int(L / 0.5)
            off = 0.25 * course
            for i in range(n):
                t = (i + 0.5 + off) / n
                if t > 1: continue
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                ang = math.atan2(y1 - y0, x1 - x0)
                B.part('box', STONE, loc=(x, y, z + 0.07), rot=(0, 0, ang + rng.uniform(-0.05, 0.05)),
                       scale=(L / n - 0.04, 0.3, 0.14), bevel=0.035, jitter=0.06, col=stone_col('#8a8f99'), var=0.12)
    # wall core (dark: reads as plank seams between boards)
    B.part('box', SEAM, loc=(0, 0, (WZ0 + WZ1) / 2), scale=(WX * 2, WY * 2, h))
    n = 13; pw = WX * 2 / n
    for side in (-1, 1):
        for i in range(n):
            x = -WX + pw * (i + 0.5)
            c = RED if i % 2 == 0 else RED2
            B.part('box', c, loc=(x, side * (WY + 0.03 + rng.uniform(0, 0.015)), WZ0 + h / 2),
                   scale=(pw - 0.035, 0.07, h - 0.02), bevel=0.018, col=weathered(c[1]), var=0.08)
    n = 11; pw = WY * 2 / n
    for side in (-1, 1):
        for i in range(n):
            y = -WY + pw * (i + 0.5)
            c = RED if i % 2 == 0 else RED2
            B.part('box', c, loc=(side * (WX + 0.03 + rng.uniform(0, 0.015)), y, WZ0 + h / 2),
                   scale=(0.07, pw - 0.035, h - 0.02), bevel=0.018, col=weathered(c[1]), var=0.08)
    RIDGE = 6.35
    B.part('prism', RED, loc=(0, 0, WZ1), w=WX * 2, h=RIDGE - WZ1, d=WY * 2 + 0.12, col=weathered('#9a3526', 3, 5))
    # gable plank seams (thin dark vertical lines)
    for i in range(1, 9):
        x = -WX + i * WX * 2 / 9
        top = RIDGE - abs(x) * (RIDGE - WZ1) / WX
        for sy in (-1, 1):
            B.part('box', SEAM, loc=(x, sy * (WY + 0.065), (WZ1 + top) / 2), scale=(0.025, 0.012, max(0.05, top - WZ1 - 0.05)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            B.part('box', TRIM, loc=(sx * (WX + 0.04), sy * (WY + 0.04), WZ0 + h / 2), scale=(0.18, 0.18, h), bevel=0.03,
                   col=weathered(TRIM[1]))
    for sy in (-1, 1):
        B.part('box', TRIM, loc=(0, sy * (WY + 0.09), WZ1 - 0.05), scale=(WX * 2 + 0.2, 0.08, 0.16), bevel=0.025)
    # roof boards + shingles
    slope = (RIDGE - WZ1) / WX
    a = math.atan(slope)
    run = WX + 0.6
    L = run / math.cos(a) + 0.15
    DEPTH = WY * 2 + 1.0
    for s in (-1, 1):
        nx, nz = s * math.sin(a), math.cos(a)
        mx, mz = s * run / 2, RIDGE - slope * run / 2
        B.part('box', ROOF, loc=(mx + nx * 0.1, 0, mz + nz * 0.1), rot=(0, s * a, 0), scale=(L, DEPTH, 0.16), bevel=0.03)
        rows = 11
        for k in range(rows):
            f = (k + 0.5) / rows
            px, pz = s * run * f, RIDGE - slope * run * f
            segs = 7
            sw = DEPTH / segs
            stag = 0.5 * (k % 2)
            for j in range(segs + 1):
                y0 = -DEPTH / 2 + (j - stag) * sw
                y1 = min(DEPTH / 2, y0 + sw)
                y0 = max(-DEPTH / 2, y0)
                if y1 - y0 < 0.1: continue
                cval = mix('#4f3020', '#6b4a33', rng.random() * 0.6)
                B.part('box', (WOODM, cval), loc=(px + nx * 0.21, (y0 + y1) / 2, pz + nz * 0.21),
                       rot=(0, s * (a - 0.05), 0), scale=(L / rows + 0.12, y1 - y0 - 0.025, 0.05), bevel=0.012, var=0.1)
    B.part('box', SHING, loc=(0, 0, RIDGE + 0.3), rot=(0, math.radians(45), 0), scale=(0.38, DEPTH + 0.05, 0.38), bevel=0.04)
    # doors (front = -Y)
    fy = -(WY + 0.1)
    DW, DH = 1.2, 2.8
    for s in (-1, 1):
        cx = s * DW / 2
        for k in range(4):  # door boards
            bx = cx - DW / 2 + DW / 8 + k * DW / 4
            B.part('box', RED2, loc=(bx, fy, WZ0 + DH / 2), scale=(DW / 4 - 0.02, 0.06, DH), bevel=0.012,
                   col=weathered('#8a2d1e'), var=0.08)
        ty = fy - 0.06
        for (dx, dz, sx, sz) in ((0, 0.08, DW, 0.16), (0, DH - 0.08, DW, 0.16), (0, DH / 2, DW, 0.14),
                                 (-(DW / 2 - 0.08), DH / 2, 0.16, DH), ((DW / 2 - 0.08), DH / 2, 0.16, DH)):
            B.part('box', TRIM, loc=(cx + dx, ty, WZ0 + dz), scale=(sx, 0.07, sz), bevel=0.02, col=weathered(TRIM[1], 0.3, 1.2))
        for (z0, z1) in ((WZ0 + 0.16, WZ0 + DH / 2 - 0.07), (WZ0 + DH / 2 + 0.07, WZ0 + DH - 0.16)):
            dw, dh = DW - 0.32, z1 - z0
            ang = math.atan2(dh, dw)
            ln = math.hypot(dw, dh)
            for sg in (-1, 1):
                B.part('box', TRIM, loc=(cx, ty - 0.01, (z0 + z1) / 2), rot=(0, sg * ang, 0), scale=(ln, 0.06, 0.12), bevel=0.01)
        # iron hinges + handle
        for hz in (0.5, DH - 0.5):
            B.part('box', METAL, loc=(cx + s * (DW / 2 - 0.3), ty - 0.05, WZ0 + hz), scale=(0.5, 0.025, 0.07), bevel=0.008)
        B.part('cyl', METAL, loc=(cx - s * 0.12, ty - 0.08, WZ0 + 1.3), rot=(math.pi / 2, 0, 0), segs=10, r1=0.04, depth=0.06)
    B.part('box', TRIM, loc=(0, fy - 0.07, WZ0 + DH + 0.08), scale=(DW * 2 + 0.3, 0.09, 0.16), bevel=0.025)
    B.part('box', WOOD, loc=(0, fy - 0.08, 3.72), scale=(1.9, 0.08, 0.52), bevel=0.03)
    B.part('box', WOOD_L, loc=(0, fy - 0.13, 3.72), scale=(1.6, 0.03, 0.3), bevel=0.008)
    for i, x in enumerate((-0.55, -0.25, 0.05, 0.35, 0.6)):
        B.part('box', WOOD_D, loc=(x, fy - 0.15, 3.72 + (0.02 if i % 2 else -0.02)), scale=(0.16, 0.02, 0.14), bevel=0.006)
    gy = -(WY + 0.02)
    B.part('box', DARK, loc=(0, gy - 0.04, 5.05), scale=(0.95, 0.06, 0.85))
    for dx, dz, sx, sz in ((0, 0.47, 1.15, 0.12), (0, -0.47, 1.15, 0.12), (0.52, 0, 0.12, 1.0), (-0.52, 0, 0.12, 1.0)):
        B.part('box', TRIM, loc=(dx, gy - 0.1, 5.05 + dz), scale=(sx, 0.08, sz), bevel=0.02)
    B.part('box', TRIM, loc=(0, gy - 0.12, 5.05), rot=(0, math.radians(45), 0), scale=(1.1, 0.05, 0.08), bevel=0.01)
    for k in range(9):  # hay spilling from loft
        B.part('box', HAY, loc=(rng.uniform(-0.35, 0.35), gy - 0.15, 4.7 + rng.uniform(-0.05, 0.05)),
               rot=(rng.uniform(-0.3, 0.3), rng.uniform(-0.6, 0.6), rng.uniform(-0.5, 0.5)), scale=(0.35, 0.06, 0.04), var=0.15)

    def bale(x, y, z, rz=0.0):
        B.part('box', HAY, loc=(x, y, z + 0.28), rot=(0, 0, rz), scale=(1.0, 0.6, 0.56), bevel=0.1, bseg=2,
               col=lambda co, no: mul('#e3b448', 0.8 + 0.3 * n01(co * Vector((14, 14, 3))))) 
        for k in (-0.25, 0.25):
            c, s_ = math.cos(rz), math.sin(rz)
            B.part('box', TWINE, loc=(x + k * c, y + k * s_, z + 0.28), rot=(0, 0, rz), scale=(0.04, 0.615, 0.575), bevel=0.012)
    bale(2.25, -2.95, 0.0, 0.05)
    bale(2.0, -3.6, 0.0, -0.12)
    bale(2.15, -3.25, 0.56, 0.35)
    for bx, by in ((-2.3, -2.95), (-1.65, -3.35)):
        B.part('cyl', WICKER, loc=(bx, by, 0.2), segs=16, r1=0.26, r2=0.34, depth=0.4, bevel=0.02,
               col=lambda co, no: mul('#b5804a', 0.75 + 0.35 * (0.5 + 0.5 * math.sin(co.z * 90))))
        B.part('cyl', WOOD_D, loc=(bx, by, 0.41), segs=16, r1=0.35, r2=0.35, depth=0.05, bevel=0.015)
        for k in range(5):
            an = k * 1.3 + bx
            B.part('uv', APPLE if k % 2 else PUMPK, loc=(bx + 0.14 * math.cos(an), by + 0.14 * math.sin(an), 0.48),
                   u=10, v=6, r=0.11, scale=(1, 1, 0.9))
    return B.obj('granary', 50)


# ---------------------------------------------------------------- trees
GY = ['#a3b33a', '#c2c23f', '#8fa63a']
PALETTES = {
    'a': [('#e8590c', 5), ('#f08c00', 3), ('#c92a2a', 1.2), ('#d9a066', 1), (GY[0], 0.5), (GY[1], 0.4)],
    'b': [('#c92a2a', 5), ('#a51e1e', 2), ('#e8590c', 2), ('#d9a066', 0.6), (GY[2], 0.4), (GY[1], 0.3)],
    'c': [('#f08c00', 5), ('#d9a066', 2), ('#e8590c', 1.5), ('#f5b82e', 1.5), (GY[1], 0.7), (GY[0], 0.4)],
}
CANOPY = {
    'a': [((0, 0, 4.7), 2.15, (1.05, 1.0, 0.95))] + [((1.35 * math.cos(i * math.pi / 2 + 0.4), 1.35 * math.sin(i * math.pi / 2 + 0.4), 4.2), 1.35, (1, 1, 1)) for i in range(4)] + [((0.3, -0.2, 6.0), 1.0, (1, 1, 1))],
    'b': [((0, 0, 4.2), 1.9, (1.25, 1.15, 0.85))] + [((2.0 * math.cos(i * 2 * math.pi / 5), 2.0 * math.sin(i * 2 * math.pi / 5), 3.8), 1.2, (1, 1, 0.85)) for i in range(5)] + [((-0.3, 0.3, 5.2), 1.05, (1, 1, 1))],
    'c': [((0, 0, 4.1), 1.9, (1, 1, 0.8)), ((0.15, -0.1, 5.5), 1.55, (1, 1, 0.85)), ((-0.1, 0.1, 6.7), 1.1, (1, 1, 1)), ((0, 0, 7.55), 0.6, (1, 1, 1))] + [((1.4 * math.cos(i * 2 * math.pi / 3 + 0.5), 1.4 * math.sin(i * 2 * math.pi / 3 + 0.5), 3.7), 0.95, (1, 1, 1)) for i in range(3)],
}


def wpick(rng, pal):
    tot = sum(w for _, w in pal)
    r = rng.uniform(0, tot)
    for c, w in pal:
        r -= w
        if r <= 0:
            return c
    return pal[-1][0]


def build_tree(name, kind, seed, count):
    B = Builder(seed)
    rng = B.rng
    th = {'a': 3.2, 'b': 2.8, 'c': 3.6}[kind]
    top = th + 1.0
    N = 9
    pts, rad = [], []
    for i in range(N + 1):
        t = i / N
        z = top * t
        pts.append((0.22 * math.sin(t * 2.2 + seed) * t, 0.16 * math.sin(t * 3.1 + seed * 0.7) * t, z))
        rad.append(0.2 + 0.24 * (1 - t) ** 1.3 + 0.32 * math.exp(-z * 4.5))
    B.tube((BARKM, '#6b4423'), pts, rad, segs=12, cap0=True, cap1=True, namp=0.12, col=bark_col())
    # roots
    for k in range(5):
        an = k * 2 * math.pi / 5 + rng.uniform(-0.3, 0.3)
        d = Vector((math.cos(an), math.sin(an), 0))
        B.tube((BARKM, '#6b4423'), [d * 0.2 + Vector((0, 0, 0.35)), d * 0.55 + Vector((0, 0, 0.12)), d * 0.85 + Vector((0, 0, -0.02))],
               [0.16, 0.1, 0.04], segs=7, col=bark_col())
    # branches
    nb = 4 + (seed % 2)
    for k in range(nb):
        an = k * 2 * math.pi / nb + rng.uniform(-0.4, 0.4)
        hz = th * rng.uniform(0.55, 0.95)
        d = Vector((math.cos(an), math.sin(an), 0))
        L = rng.uniform(1.3, 2.0)
        p0 = Vector(pts[int(hz / top * N)])
        bp = [p0, p0 + d * L * 0.35 + Vector((0, 0, L * 0.25)), p0 + d * L * 0.7 + Vector((0, 0, L * 0.6)),
              p0 + d * L + Vector((0, 0, L * 1.0))]
        B.tube((BARKM, '#6b4423'), bp, [0.15, 0.11, 0.07, 0.035], segs=8, col=bark_col())
        # twig
        tp = bp[2]
        B.tube((BARKM, '#6b4423'), [tp, tp + d.cross(Vector((0, 0, 1))) * 0.5 + Vector((0, 0, 0.4))], [0.05, 0.02], segs=5,
               col=bark_col())
    # canopy: many small leaf clusters
    sph = CANOPY[kind]
    vols = [r ** 3 * s[0] * s[1] * s[2] for (_, r, s) in sph]
    pal = PALETTES[kind]
    zmin = min(c[2] - r * s[2] for c, r, s in sph)
    zmax = max(c[2] + r * s[2] for c, r, s in sph)
    for i in range(count):
        tv = rng.uniform(0, sum(vols))
        for si, v in enumerate(vols):
            tv -= v
            if tv <= 0:
                break
        c, r, s = sph[si]
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        f = rng.uniform(0.55, 1.0) ** 0.6
        p = Vector(c) + Vector((d.x * r * s[0], d.y * r * s[1], d.z * r * s[2])) * f
        hue = wpick(rng, pal)
        ao = 0.55 + 0.45 * f
        ao *= 0.7 + 0.3 * sstep(zmin, zmax, p.z)
        cc = mul(hue, ao * rng.uniform(0.85, 1.12))
        sz = rng.uniform(0.32, 0.58)
        B.part('ico', (LEAFM, cc), loc=p, subdiv=1, r=sz, jitter=0.22,
               scale=(rng.uniform(0.8, 1.25), rng.uniform(0.8, 1.25), rng.uniform(0.55, 0.85)),
               rot=(rng.random() * 3, rng.random() * 3, rng.random() * 3), var=0.04, vn=0.08)
    # a few fallen leaves on the ground
    for i in range(24):
        an = rng.uniform(0, 6.28); rr = rng.uniform(0.6, 2.4)
        B.part('box', (LEAFM, mul(wpick(rng, pal), 0.8)), loc=(rr * math.cos(an), rr * math.sin(an), 0.012),
               rot=(0, 0, rng.uniform(0, 6.28)), scale=(0.14, 0.09, 0.012))
    return B.obj(name, 89)


# ---------------------------------------------------------------- bush
def build_bush():
    B = Builder(5)
    rng = B.rng
    sph = [((0, 0, 0.98), 1.0, (1.15, 1.05, 1.0)), ((0.62, 0.3, 0.65), 0.62, (1, 1, 1)), ((-0.6, -0.25, 0.68), 0.6, (1, 1, 1)),
           ((-0.1, 0.62, 0.62), 0.55, (1, 1, 1)), ((0.2, -0.6, 0.6), 0.55, (1, 1, 1))]
    greens = [('#3f8f3a', 4), ('#357a31', 3), ('#4ea347', 3), ('#2f6b2c', 2), ('#6a9a3a', 1)]
    vols = [r ** 3 for (_, r, s) in sph]
    for i in range(190):
        tv = rng.uniform(0, sum(vols))
        for si, v in enumerate(vols):
            tv -= v
            if tv <= 0:
                break
        c, r, s = sph[si]
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), abs(rng.gauss(0, 1)) * 0.8 + rng.gauss(0, 0.4))).normalized()
        f = rng.uniform(0.5, 1.0) ** 0.6
        p = Vector(c) + Vector((d.x * r * s[0], d.y * r * s[1], d.z * r * s[2])) * f
        p.z = max(0.12, p.z)
        ao = (0.55 + 0.45 * f) * (0.7 + 0.3 * sstep(0.1, 1.9, p.z))
        B.part('ico', (LEAFM, mul(wpick(rng, greens), ao)), loc=p, subdiv=1, r=rng.uniform(0.2, 0.34), jitter=0.2,
               scale=(1, 1, rng.uniform(0.6, 0.9)), rot=(rng.random() * 3, rng.random() * 3, rng.random() * 3), vn=0.08)
    for i in range(34):  # berries
        c, r, s = sph[rng.randrange(len(sph))]
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), abs(rng.gauss(0, 1)))).normalized()
        p = Vector(c) + Vector((d.x * r * s[0], d.y * r * s[1], d.z * r * s[2])) * 1.02
        B.part('ico', (FOODM, rng.choice(['#b8201f', '#9e1b2a', '#c92a2a'])), loc=p, subdiv=1, r=0.055)
    return B.obj('bush_berry', 89)


# ---------------------------------------------------------------- rocks
def rock(B, loc, r, sc, seed, subdiv=3, amp=0.18, hexc='#8a8f99', rot=(0.2, 0.1, 0.5)):
    B.part('ico', (STONEM, hexc), loc=loc, scale=sc, subdiv=subdiv, r=r, disp=(r * amp, 1.6 / r, (seed, seed * 2, 3)),
           rot=rot, col=stone_col(hexc), var=0.05, vn=0.02)


def build_rock(name, seed, cluster):
    B = Builder(seed)
    rock(B, (0, 0, 0.42), 0.75, (1.25, 1.0, 0.7), seed)
    if cluster:
        rock(B, (0.85, 0.35, 0.25), 0.4, (1.1, 1.0, 0.75), seed + 3, 2, hexc='#757a84')
        rock(B, (-0.6, -0.5, 0.18), 0.28, (1, 1, 1), seed + 5, 2, hexc='#757a84')
    return B.obj(name, 70)


# ---------------------------------------------------------------- campfire
def build_campfire():
    B = Builder(7)
    rng = B.rng
    for i in range(8):
        an = i * 2 * math.pi / 8 + rng.uniform(-0.08, 0.08)
        R = 6.2 + rng.uniform(-0.15, 0.15)
        r = rng.uniform(0.5, 0.75)
        rock(B, (R * math.cos(an), R * math.sin(an), r * 0.45), r, (rng.uniform(1.1, 1.5), rng.uniform(0.9, 1.2), 0.8),
             i + 70, 2, 0.22, '#8a8f99' if i % 2 else '#757a84', rot=(0, 0, rng.uniform(0, 6.28)))
    B.part('cyl', ASH, loc=(0, 0, 0.03), segs=32, r1=1.7, r2=1.5, depth=0.06, bevel=0.02,
           col=lambda co, no: mix(mul('#3b3330', 0.7 + 0.5 * n01(co * 3)), '#1c1816', sstep(1.2, 0.2, co.length)))
    for i in range(12):
        an = i * 2 * math.pi / 12 + rng.uniform(-0.1, 0.1)
        rock(B, (1.75 * math.cos(an), 1.75 * math.sin(an), 0.1), 0.24, (1.25, 1, 0.7), 90 + i, 2, 0.25, '#6f747d',
             rot=(0, 0, an))
    for i in range(6):
        an = i * 2 * math.pi / 6 + 0.3
        b = Vector((1.35 * math.cos(an), 1.35 * math.sin(an), 0.15))
        t = Vector((0.12 * math.cos(an + 0.5), 0.12 * math.sin(an + 0.5), 2.2))
        pts = [b + (t - b) * k / 5 for k in range(6)]
        B.tube(LOG, pts, [0.17, 0.165, 0.16, 0.15, 0.13, 0.09], segs=10, namp=0.06,
               col=lambda co, no: mix(mul('#5b3a21', 0.7 + 0.45 * n01(co * Vector((6, 6, 1.5)))), '#120c09', sstep(1.0, 2.0, co.z) * 0.85))
    for i in range(30):  # embers
        an = rng.uniform(0, 6.28); rr = rng.uniform(0, 1.1)
        B.part('ico', (EMBER, rng.choice(['#ff6a1a', '#ff9a3a', '#c43a10'])), loc=(rr * math.cos(an), rr * math.sin(an), 0.07),
               subdiv=1, r=rng.uniform(0.05, 0.11), scale=(1, 1, 0.6), jitter=0.2)
    return B.obj('campfire', 60)


# ---------------------------------------------------------------- pier (+Y = glTF -Z)
def plank_col(hexc):
    base = lin(hexc)
    return lambda co, no: mul(base, 0.78 + 0.35 * n01(Vector((co.x * 0.9, co.y * 9, co.z * 9))))


def build_pier():
    B = Builder(9)
    rng = B.rng
    for i in range(11):
        y = 0.225 + i * 0.45
        hc = PLANKS[rng.randrange(4)]
        B.part('box', (WOODM, hc), loc=(rng.uniform(-0.04, 0.04), y, 0.26 + rng.uniform(-0.01, 0.01)),
               rot=(rng.uniform(-0.01, 0.01), 0, rng.uniform(-0.02, 0.02)), scale=(3.0, 0.4, 0.08), bevel=0.02, col=plank_col(hc))
        for x in (-1.1, 1.1):  # nails
            for dy in (-0.1, 0.1):
                B.part('cyl', METAL, loc=(x, y + dy, 0.302), segs=6, r1=0.015, depth=0.01)
    for x in (-1.1, 1.1):
        B.part('box', WOOD_D, loc=(x, 2.5, 0.13), scale=(0.16, 5.0, 0.18), bevel=0.025, col=plank_col('#5e4026'))
    for x in (-1.35, 1.35):
        for y in (0.25, 4.75):
            B.part('cyl', WOOD_D, loc=(x, y, -0.4), segs=14, r1=0.15, r2=0.14, depth=2.2, bevel=0.03,
                   col=lambda co, no: mix(mul('#5e4026', 0.7 + 0.4 * n01(co * Vector((5, 5, 1)))), '#2e3a2a', sstep(-0.3, -0.9, co.z)))
    B.part('cyl', BUCKET, loc=(0.85, 4.1, 0.52), segs=20, r1=0.2, r2=0.26, depth=0.44, bevel=0.015)
    for z in (0.38, 0.66):
        B.part('cyl', METAL, loc=(0.85, 4.1, z), segs=20, r1=0.225 + (z - 0.38) * 0.2, depth=0.03)
    B.part('cyl', (WATERM, '#2f5f7f'), loc=(0.85, 4.1, 0.72), segs=20, r1=0.235, depth=0.02)
    hb = [(0.85 + 0.26 * math.cos(t), 4.1, 0.74 + 0.22 * math.sin(t)) for t in [k * math.pi / 8 for k in range(9)]]
    B.tube(METAL, hb, [0.012] * len(hb), segs=6)
    B.tube((WOODM, '#c09060'), [(-0.9, 3.9, 0.32), (-0.97, 5.5, 1.1), (-1.05, 7.2, 1.9)], [0.04, 0.03, 0.015], segs=8)
    B.beam(METAL, (-0.9, 3.9, 0.32), (-0.92, 4.4, 0.56), r=0.05, segs=10)
    B.part('cyl', METAL, loc=(-0.85, 4.55, 0.55), rot=(0, math.pi / 2, 0), segs=14, r1=0.09, r2=0.09, depth=0.08, bevel=0.01)
    B.part('box', WOOD, loc=(-0.55, 0.7, 0.4), scale=(0.6, 0.4, 0.22), bevel=0.03, col=plank_col('#8b5a2b'))
    B.part('box', METAL, loc=(-0.55, 0.49, 0.42), scale=(0.08, 0.02, 0.06), bevel=0.005)
    # coiled rope
    pts = [(0.9 + (0.18 - 0.012 * k / 6) * math.cos(k * 0.5), 1.0 + (0.18 - 0.012 * k / 6) * math.sin(k * 0.5), 0.34 + 0.035 * (k // 13)) for k in range(39)]
    B.tube(TWINE, pts, [0.025] * len(pts), segs=6)
    return B.obj('pier', 50)


# ---------------------------------------------------------------- island
def hillz(x, y, r):
    n = n01((x * 0.06, y * 0.06, 0.3)) * 0.7 + n01((x * 0.15, y * 0.15, 4.1)) * 0.3
    n2 = 0.5 + 0.5 * (0.6 * math.sin(x * 0.21 + 1.3) * math.cos(y * 0.17 + 0.7) + 0.4 * math.sin(x * 0.09 - y * 0.13 + 2.0))
    return (0.75 * n + 0.35 * n2) * 0.85 * sstep(14, 21, r) * (1 - sstep(39, 44, r))


def build_island():
    rng = random.Random(3)
    SEG = 128
    rings = []
    r = 0.9
    while r < 14:
        rings.append((r, 'g')); r += 1.0
    while r <= 44.0:
        rings.append((r, 'g')); r += 0.6
    rings += [(44.4, 'c'), (44.8, 'c'), (45.2, 'c'), (45.7, 's'), (46.5, 's'), (47.3, 's'), (48.1, 's'), (49.0, 's'), (49.6, 'k')]
    verts = [(0, 0, 0)]
    cols = [None]
    ring_idx = []
    G1, G2, G3 = lin('#6f9e45'), lin('#8bbb55'), lin('#557f36')
    DRY, DIRT, SAND, WET, ROCK = lin('#c2b066'), lin('#8a6a45'), lin('#e6cf98'), lin('#b89b6a'), lin('#7c7468')

    def ground_col(x, y, z, rr, kind):
        if kind == 'g':
            g = mix(G1, G2, n01((x * 0.12, y * 0.12, 1.7)))
            g = mix(g, G3, 0.6 * sstep(0.55, 0.8, n01((x * 0.05, y * 0.05, 9.0))))
            g = mix(g, DRY, 0.75 * sstep(0.6, 0.75, n01((x * 0.09 + 3, y * 0.09, 2.2))))
            g = mul(g, 0.9 + 0.2 * n01((x * 0.8, y * 0.8, 5.5)))
            # dirt: yard around granary + path to the campfire and toward the pier
            d = max(0.0, 1 - sstep(4.5, 7.5, rr))
            path = (1 - sstep(1.0, 2.2, abs(x))) * sstep(-15.0, -13.0, y) * (1 - sstep(-3.0, -1.0, y))
            # path toward pier (direction -x,-y)
            px, py = -0.94, -0.34
            t = -(x * px + y * py) * -1
            perp = abs(x * py - y * px)
            path2 = (1 - sstep(1.0, 2.0, perp)) * sstep(6.0, 8.0, t) * (1 - sstep(40.0, 43.0, t))
            camp = 1 - sstep(1.6, 3.2, math.hypot(x, y + 10))
            dd = max(d * 0.85, path * 0.9, path2 * 0.75, camp * 0.9) * (0.75 + 0.35 * n01((x * 0.5, y * 0.5, 7)))
            g = mix(g, mul(DIRT, 0.85 + 0.3 * n01((x * 1.3, y * 1.3, 3))), min(1.0, dd))
            # sandy edge
            return mix(g, SAND, sstep(43.0, 44.2, rr) * 0.6)
        if kind == 'c':
            return mul(ROCK, 0.75 + 0.45 * n01((x * 0.7, y * 0.7, 2)))
        if kind == 's':
            return mix(mul(SAND, 0.93 + 0.12 * n01((x * 0.6, y * 0.6, 1))), WET, sstep(47.0, 49.0, rr))
        return mul(WET, 0.7)

    for ri, (r, kind) in enumerate(rings):
        ids = []
        for j in range(SEG):
            an = j * 2 * math.pi / SEG
            rr = r
            if kind == 'g':
                an += rng.uniform(-0.2, 0.2) * 2 * math.pi / SEG
                rr += rng.uniform(-0.15, 0.15)
            x, y = rr * math.cos(an), rr * math.sin(an)
            if kind == 'g':
                z = 0.0 if rr <= 14 else hillz(x, y, rr)
                z += 0.05 * sstep(42.5, 44, rr)
            elif kind == 'c':
                k = (r - 44.4) / 0.8
                z = 0.12 * (1 - k) - 0.32 * k + 0.12 * noise.noise((x * 0.8, y * 0.8, 1.0))
            elif kind == 's':
                z = -0.36 - 0.2 * sstep(45.7, 49.0, r) + 0.02 * noise.noise((x * 0.5, y * 0.5, 2.0))
            else:
                z = -3.0
            ids.append(len(verts))
            verts.append((x, y, z))
            cols.append(ground_col(x, y, z, rr, kind))
        ring_idx.append(ids)
    cols[0] = ground_col(0, 0, 0, 0, 'g')
    faces = []
    for j in range(SEG):
        faces.append((0, ring_idx[0][j], ring_idx[0][(j + 1) % SEG]))
    for ri in range(len(rings) - 1):
        A, Bv = ring_idx[ri], ring_idx[ri + 1]
        for j in range(SEG):
            j2 = (j + 1) % SEG
            faces.append((A[j], Bv[j], Bv[j2], A[j2]))
    faces.append(tuple(reversed(ring_idx[-1])))
    me = bpy.data.meshes.new('island')
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    try:
        me.set_sharp_from_angle(angle=math.radians(70))
    except Exception:
        pass
    attr = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for i, c in enumerate(cols):
        attr.data[i].color = (c[0], c[1], c[2], 1.0)
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = 0
    except Exception:
        pass
    me.materials.append(vmat('hd_ground', 0.95))
    o = bpy.data.objects.new('island', me)
    bpy.context.scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- props
def build_pumpkin():
    B = Builder(21)

    def rib(co):
        an = math.atan2(co.y, co.x)
        rxy = math.hypot(co.x, co.y)
        f = 1.0 + 0.07 * math.cos(10 * an) * (rxy / 0.5)
        z = co.z
        if rxy < 0.18:
            z -= 0.12 * (1 - rxy / 0.18) * (1 if z > 0 else -0.5)
        return Vector((co.x * f, co.y * f, z))

    def pcol(co, no):
        an = math.atan2(co.y, co.x)
        groove = 0.5 + 0.5 * math.cos(10 * an)
        c = mul('#f07c12', 0.72 + 0.32 * groove)
        return mix(c, '#c9a13a', 0.3 * sstep(0.55, 0.7, co.z) * (1 - groove))
    B.part('uv', PUMPK, loc=(0, 0, 0.34), scale=(1, 1, 0.68), u=40, v=18, r=0.5, deform=rib, col=pcol, var=0.03, vn=0.01)
    B.tube(STEM, [(0, 0, 0.6), (0.01, 0, 0.7), (0.04, 0.01, 0.78), (0.1, 0.02, 0.82)], [0.06, 0.05, 0.04, 0.032], segs=8,
           col=lambda co, no: mix('#5b5a2a', '#8a7a4a', n01(co * 30)))
    return B.obj('pumpkin', 70)


def build_haybale():
    B = Builder(22)
    hayc = lambda co, no: mul('#e3b448', 0.75 + 0.35 * n01(Vector((co.x * 30, co.y * 4, co.z * 4))))
    B.part('box', HAY, loc=(0, 0, 0.36), scale=(1.2, 0.75, 0.72), bevel=0.16, bseg=3, col=hayc)
    for k in (-0.3, 0.3):
        B.part('box', TWINE, loc=(k, 0, 0.36), scale=(0.045, 0.765, 0.735), bevel=0.04, bseg=2)
    rng = B.rng
    for i in range(14):
        B.part('box', HAY, loc=(rng.uniform(-0.55, 0.55), rng.uniform(-0.33, 0.33), 0.72 + rng.uniform(0, 0.02)),
               rot=(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 3)), scale=(0.22, 0.012, 0.012), var=0.15)
    return B.obj('haybale', 60)


def build_lantern_post():
    B = Builder(23)
    wc = lambda co, no: mul('#5b3a21', 0.75 + 0.4 * n01(Vector((co.x * 8, co.y * 8, co.z * 1.2))))
    B.part('box', WOOD_D, loc=(0, 0, 0.12), scale=(0.36, 0.36, 0.24), bevel=0.04, col=wc)
    B.part('box', LOG, loc=(0, 0, 1.25), scale=(0.18, 0.18, 2.5), bevel=0.03, col=wc)
    B.part('box', LOG, loc=(0.32, 0, 2.38), scale=(0.75, 0.12, 0.12), bevel=0.025, col=wc)
    B.beam(LOG, (0.0, 0, 2.0), (0.38, 0, 2.38), r=0.04, segs=8, col=wc)
    lx = 0.6
    B.part('cyl', METAL, loc=(lx, 0, 2.25), segs=8, r1=0.02, r2=0.02, depth=0.18)
    B.part('cyl', METAL, loc=(lx, 0, 2.1), rot=(0, 0, math.pi / 4), segs=4, r1=0.22, r2=0.04, depth=0.14, bevel=0.01)
    B.part('box', LANT, loc=(lx, 0, 1.86), scale=(0.23, 0.23, 0.33), bevel=0.01)
    B.part('ico', FLAMEC, loc=(lx, 0, 1.84), subdiv=2, r=0.05, scale=(1, 1, 1.8))
    for dx in (-0.13, 0.13):
        for dy in (-0.13, 0.13):
            B.part('box', METAL, loc=(lx + dx, dy, 1.86), scale=(0.035, 0.035, 0.36), bevel=0.008)
    B.part('box', METAL, loc=(lx, 0, 1.67), scale=(0.3, 0.3, 0.05), bevel=0.01)
    B.part('box', METAL, loc=(lx, 0, 2.04), scale=(0.3, 0.3, 0.03), bevel=0.008)
    B.tube(METAL, [(lx, 0, 2.3), (lx + 0.04, 0, 2.36), (lx, 0, 2.4)], [0.012] * 3, segs=6)
    return B.obj('lantern_post', 50)


def build_feast_table():
    B = Builder(24)
    rng = B.rng
    for k in range(5):  # tabletop boards
        hc = PLANKS[k % 4]
        B.part('box', (WOODM, hc), loc=(0, -0.64 + k * 0.32, 0.82), scale=(6.0, 0.31, 0.12), bevel=0.03, col=plank_col(hc))
    for x in (-2.7, 2.7):
        for y in (-0.6, 0.6):
            B.part('box', WOOD_D, loc=(x, y, 0.38), scale=(0.14, 0.14, 0.76), bevel=0.025, col=plank_col('#5e4026'))
        B.part('box', WOOD_D, loc=(x, 0, 0.2), scale=(0.1, 1.2, 0.1), bevel=0.015)
    B.part('box', WOOD_D, loc=(0, 0, 0.2), scale=(5.4, 0.1, 0.1), bevel=0.015)
    for y in (-1.25, 1.25):
        B.part('box', WOOD_L, loc=(0, y, 0.46), scale=(5.6, 0.42, 0.08), bevel=0.025, col=plank_col('#b9875a'))
        for x in (-2.4, 0, 2.4):
            B.part('box', WOOD_D, loc=(x, y, 0.21), scale=(0.1, 0.32, 0.42), bevel=0.015)
    # linen runner with red stripe
    B.part('box', CLOTHC, loc=(0, 0, 0.885), scale=(5.7, 0.8, 0.012), bevel=0.004)
    for y in (-0.33, 0.33):
        B.part('box', RUNNER, loc=(0, y, 0.893), scale=(5.7, 0.06, 0.004))
    for x in (-2.25, -0.85, 0.85, 2.25):
        for y in (-0.52, 0.52):
            B.part('cyl', PLATE, loc=(x, y, 0.9), segs=24, r1=0.2, r2=0.16, depth=0.025, bevel=0.008)
            B.part('cyl', (CERAM, '#d9cdb5'), loc=(x, y, 0.913), segs=24, r1=0.12, depth=0.004)
            B.part('cyl', (METALM, '#8a6a3a'), loc=(x + 0.3, y * 0.75, 0.96), segs=14, r1=0.05, r2=0.065, depth=0.16, bevel=0.008)
            B.part('box', (METALM, '#c0c0c0'), loc=(x - 0.27, y, 0.9), scale=(0.025, 0.2, 0.008), bevel=0.003)
    for x in (-1.6, 1.6):  # pies with lattice
        B.part('cyl', PLATE, loc=(x, 0, 0.905), segs=28, r1=0.34, r2=0.31, depth=0.025, bevel=0.008)
        B.part('cyl', CRUST, loc=(x, 0, 0.96), segs=28, r1=0.25, r2=0.3, depth=0.09, bevel=0.025, bseg=2)
        B.part('cyl', FILL, loc=(x, 0, 1.003), segs=28, r1=0.25, depth=0.012)
        for k in range(-2, 3):
            ln = 2 * math.sqrt(max(0.01, 0.25 ** 2 - (k * 0.09) ** 2))
            B.part('box', CRUST, loc=(x + k * 0.09, 0, 1.015), scale=(0.035, ln, 0.018), bevel=0.006)
            B.part('box', CRUST, loc=(x, k * 0.09, 1.025), scale=(ln, 0.035, 0.018), bevel=0.006)
    # roast turkey
    B.part('cyl', PLATE, loc=(0, 0, 0.905), segs=32, r1=0.52, r2=0.46, depth=0.025, bevel=0.01)
    tcol = lambda co, no: mix(mul('#b8692a', 0.85 + 0.25 * n01(co * 12)), '#5e2e12', 0.55 * sstep(0.2, -0.6, no.z) + 0.3 * sstep(0.5, 0.95, no.z) * 0)
    B.part('uv', TURKEY, loc=(0.02, 0, 1.08), scale=(0.42, 0.3, 0.22), u=24, v=14, r=1.0, col=tcol,
           deform=lambda co: Vector((co.x, co.y * (1 - 0.15 * co.x), co.z * (1 + 0.15 * co.x))))
    for s in (-1, 1):
        B.tube(TURKEY, [(-0.15, s * 0.18, 1.04), (-0.32, s * 0.22, 1.12), (-0.44, s * 0.24, 1.19)], [0.08, 0.06, 0.035], segs=10, col=tcol)
        B.part('uv', PLATE, loc=(-0.47, s * 0.245, 1.2), u=8, v=6, r=0.035)
        B.part('uv', TURKEY, loc=(0.1, s * 0.27, 1.07), scale=(0.18, 0.07, 0.09), u=12, v=8, r=1.0, col=tcol)
    for k in range(6):  # garnish
        an = k * 1.05
        B.part('uv', (FOODM, '#4f7a2a' if k % 2 else '#d13b1f'), loc=(0.44 * math.cos(an), 0.38 * math.sin(an), 0.93),
               u=8, v=5, r=0.04)
    for x, y in ((-0.72, 0.05), (0.75, -0.05)):
        B.part('cyl', CORN, loc=(x, y, 0.95), rot=(0, math.pi / 2, 0.3), segs=12, r1=0.06, r2=0.045, depth=0.32, bevel=0.015,
               col=lambda co, no: mul('#f0c03a', 0.8 + 0.25 * n01(co * 60)))
    for k in range(6):
        B.part('uv', APPLE, loc=(2.75 + rng.uniform(-0.12, 0.12), rng.uniform(-0.2, 0.2), 0.96), u=10, v=7, r=0.07,
               col=lambda co, no: mix('#b8201f', '#e0a030', 0.3 * sstep(0.0, 1.0, no.x)))
    # candles
    for x in (-1.15, 0.55, 1.15, -0.55):
        B.part('cyl', (METALM, '#b08a4a'), loc=(x, 0.2 * (1 if x > 0 else -1), 0.905), segs=14, r1=0.07, r2=0.05, depth=0.03, bevel=0.005)
        B.part('cyl', WAX, loc=(x, 0.2 * (1 if x > 0 else -1), 1.03), segs=14, r1=0.035, depth=0.22, bevel=0.006)
        B.part('ico', FLAMEC, loc=(x, 0.2 * (1 if x > 0 else -1), 1.18), subdiv=2, r=0.025, scale=(1, 1, 2.0))
    # bread loaf
    B.part('uv', CRUST, loc=(-2.75, 0, 0.98), scale=(0.22, 0.12, 0.09), u=16, v=10, r=1.0,
           col=lambda co, no: mix('#d39a52', '#7a4a1e', sstep(0.6, 1.0, no.z)))
    return B.obj('feast_table', 50)


def main():
    clear_scene()
    export(build_granary(), 'granary.glb'); clear_scene()
    for nm, kind, seed, cnt in (('tree_autumn_a', 'a', 31, 320), ('tree_autumn_b', 'b', 32, 330), ('tree_autumn_c', 'c', 33, 300)):
        export(build_tree(nm, kind, seed, cnt), nm + '.glb'); clear_scene()
    export(build_bush(), 'bush_berry.glb'); clear_scene()
    export(build_campfire(), 'campfire.glb'); clear_scene()
    export(build_pier(), 'pier.glb'); clear_scene()
    export(build_island(), 'island.glb'); clear_scene()
    root = bpy.data.objects.new('props', None)
    bpy.context.scene.collection.objects.link(root)
    for i, fn in enumerate((build_pumpkin, build_haybale, build_lantern_post, build_feast_table,
                            lambda: build_rock('rock_a', 41, False), lambda: build_rock('rock_b', 42, True))):
        o = fn()
        o.parent = root
        o.location.x = i * 4
    export(root, 'props.glb')


main()
