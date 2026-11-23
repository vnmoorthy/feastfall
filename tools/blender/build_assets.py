# Feastfall low-poly asset builder.
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python build_assets.py
# Blender is Z-up; the glTF exporter converts to Y-up. Asset "front" is Blender -Y (= glTF +Z).
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


MATS = {}


def principled(m):
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    p = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if p is None:
        p = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(p.outputs['BSDF'], out.inputs['Surface'])
    return p


def mat(name, hexcol, rough=0.85, metal=0.0, emit=None, emit_strength=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    p = principled(m)
    c = lin(hexcol) + (1.0,)
    p.inputs['Base Color'].default_value = c
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    m.diffuse_color = c
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
        self.mats = []
        self.rng = random.Random(seed)

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _merge(self, src, m):
        idx = self.mi(m)
        vmap = {v: self.bm.verts.new(v.co) for v in src.verts}
        for f in src.faces:
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
                nf.material_index = idx
            except ValueError:
                pass
        src.free()

    def part(self, kind, m, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), bevel=0.0, jitter=0.0, **kw):
        t = bmesh.new()
        if kind == 'box':
            bmesh.ops.create_cube(t, size=1.0)
        elif kind == 'cyl':
            bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=kw.get('segs', 8),
                                  radius1=kw.get('r1', 0.5), radius2=kw.get('r2', kw.get('r1', 0.5)), depth=kw.get('depth', 1.0))
        elif kind == 'ico':
            bmesh.ops.create_icosphere(t, subdivisions=kw.get('subdiv', 2), radius=kw.get('r', 1.0))
        elif kind == 'uv':
            bmesh.ops.create_uvsphere(t, u_segments=kw.get('u', 12), v_segments=kw.get('v', 8), radius=kw.get('r', 1.0))
        elif kind == 'prism':  # triangular prism: triangle in XZ (width w, height h), extruded along Y (depth d), base at z=0
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
            bmesh.ops.bevel(t, geom=list(t.verts) + list(t.edges), offset=bevel, segments=1, profile=0.5,
                            affect='EDGES', clamp_overlap=True)
        if isinstance(rot, Matrix):
            R = rot.to_4x4()
        else:
            R = Euler(rot, 'XYZ').to_matrix().to_4x4()
        M = Matrix.Translation(Vector(loc)) @ R @ sc
        bmesh.ops.transform(t, matrix=M, verts=t.verts)
        bmesh.ops.recalc_face_normals(t, faces=t.faces)
        self._merge(t, m)

    def beam(self, m, a, b, r=0.1, segs=6, bevel=0.0):
        """Cylinder from point a to point b."""
        a, b = Vector(a), Vector(b)
        d = b - a
        q = d.normalized().to_track_quat('Z', 'Y').to_matrix()
        self.part('cyl', m, loc=(a + b) / 2, rot=q, segs=segs, r1=r, r2=r * 0.9, depth=d.length, bevel=bevel)

    def obj(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for p in me.polygons:
            p.use_smooth = False
        for m in self.mats:
            me.materials.append(m)
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
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


# ---------------------------------------------------------------- materials
RED = mat('barn_red', '#a83a2a', 0.8)
RED2 = mat('barn_red_dark', '#93311f', 0.8)
TRIM = mat('trim_cream', '#f2e2c0', 0.7)
ROOF = mat('roof_brown', '#4a2c1d', 0.9)
ROOF2 = mat('roof_brown_dark', '#3a2216', 0.9)
HAY = mat('hay', '#e3b448', 0.95)
TWINE = mat('twine', '#9a7432', 0.95)
WOOD = mat('wood', '#8b5a2b', 0.85)
WOOD_L = mat('wood_light', '#b9875a', 0.85)
WOOD_D = mat('wood_dark', '#5e4026', 0.9)
DARK = mat('dark_interior', '#2b1a12', 1.0)
STONE = mat('stone', '#8a8f99', 0.95)
STONE2 = mat('stone_dark', '#757a84', 0.95)
TRUNK = mat('trunk', '#6b4423', 0.9)
LOG = mat('log', '#5b3a21', 0.9)
ASH = mat('ash', '#3b3330', 1.0)
BUSH = [mat('bush', '#3f8f3a', 0.9), mat('bush_dark', '#357a31', 0.9), mat('bush_light', '#4ea347', 0.9)]
WICKER = mat('wicker', '#b5804a', 0.9)
APPLE = mat('apple_red', '#c92a2a', 0.6)
PUMPKIN = mat('pumpkin', '#ff8c1a', 0.7)
STEM = mat('stem', '#5b6b2a', 0.9)
METAL = mat('metal_dark', '#2d2d30', 0.5, 0.6)
BUCKET = mat('bucket_metal', '#7f97a8', 0.45, 0.5)
WATER = mat('bucket_water', '#3b6e8f', 0.2)
LANTERN = mat('lantern_glow', '#ffd27a', 0.4, emit='#ffc457', emit_strength=4.0)
PLATE = mat('plate', '#f5f0e6', 0.5)
CRUST = mat('pie_crust', '#d9a05b', 0.8)
FILL = mat('pie_filling', '#c0582a', 0.6)
TURKEY = mat('turkey', '#b5652b', 0.55)
CORN = mat('corn', '#f5c542', 0.7)
PLANK = [mat('plank', '#9a6b3f', 0.85), mat('plank_dark', '#8a5d34', 0.85), mat('plank_light', '#a8784a', 0.85)]


# ---------------------------------------------------------------- granary
def build_granary():
    B = Builder(11)
    rng = B.rng
    B.part('box', STONE2, loc=(0, 0, 0.15), scale=(6.0, 5.0, 0.3), bevel=0.05)
    WX, WY, WZ0, WZ1 = 2.7, 2.2, 0.3, 4.2
    B.part('box', RED, loc=(0, 0, (WZ0 + WZ1) / 2), scale=(WX * 2, WY * 2, WZ1 - WZ0))
    h = WZ1 - WZ0
    # vertical plank panels, front/back
    n = 13; pw = WX * 2 / n
    for side in (-1, 1):
        for i in range(n):
            x = -WX + pw * (i + 0.5)
            m = RED if i % 2 == 0 else RED2
            B.part('box', m, loc=(x, side * (WY + 0.03 + rng.uniform(0, 0.015)), WZ0 + h / 2),
                   scale=(pw - 0.03, 0.07, h - 0.02), bevel=0.02)
    # sides
    n = 11; pw = WY * 2 / n
    for side in (-1, 1):
        for i in range(n):
            y = -WY + pw * (i + 0.5)
            m = RED if i % 2 == 0 else RED2
            B.part('box', m, loc=(side * (WX + 0.03 + rng.uniform(0, 0.015)), y, WZ0 + h / 2),
                   scale=(0.07, pw - 0.03, h - 0.02), bevel=0.02)
    # gable
    RIDGE = 6.35
    B.part('prism', RED, loc=(0, 0, WZ1), w=WX * 2, h=RIDGE - WZ1, d=WY * 2)
    # corner trim
    for sx in (-1, 1):
        for sy in (-1, 1):
            B.part('box', TRIM, loc=(sx * (WX + 0.04), sy * (WY + 0.04), WZ0 + h / 2), scale=(0.18, 0.18, h), bevel=0.02)
    # trim band at wall top (front/back)
    for sy in (-1, 1):
        B.part('box', TRIM, loc=(0, sy * (WY + 0.09), WZ1 - 0.05), scale=(WX * 2 + 0.2, 0.08, 0.16), bevel=0.02)
    # roof
    slope = (RIDGE - WZ1) / WX
    a = math.atan(slope)
    run = WX + 0.6
    L = run / math.cos(a) + 0.15
    for s in (-1, 1):
        mx = s * run / 2
        mz = RIDGE - slope * run / 2
        nx, nz = s * math.sin(a), math.cos(a)
        cx, cz = mx + nx * 0.12, mz + nz * 0.12
        B.part('box', ROOF, loc=(cx, 0, cz), rot=(0, s * a, 0), scale=(L, WY * 2 + 1.0, 0.2), bevel=0.03)
        # shingle rows
        for k in range(1, 4):
            f = k / 4.0
            px = s * run * f
            pz = RIDGE - slope * run * f
            B.part('box', ROOF2, loc=(px + nx * 0.25, 0, pz + nz * 0.25), rot=(0, s * a, 0),
                   scale=(0.16, WY * 2 + 1.0, 0.07), bevel=0.02)
    B.part('box', ROOF2, loc=(0, 0, RIDGE + 0.28), rot=(0, math.radians(45), 0), scale=(0.36, WY * 2 + 1.05, 0.36), bevel=0.03)
    # doors (front = -Y)
    fy = -(WY + 0.1)
    DW, DH = 1.2, 2.8
    for s in (-1, 1):
        cx = s * DW / 2
        B.part('box', RED2, loc=(cx, fy, WZ0 + DH / 2), scale=(DW - 0.02, 0.06, DH), bevel=0.015)
        # frame of each door
        ty = fy - 0.06
        B.part('box', TRIM, loc=(cx, ty, WZ0 + 0.08), scale=(DW, 0.07, 0.16), bevel=0.015)
        B.part('box', TRIM, loc=(cx, ty, WZ0 + DH - 0.08), scale=(DW, 0.07, 0.16), bevel=0.015)
        B.part('box', TRIM, loc=(cx, ty, WZ0 + DH / 2), scale=(DW, 0.07, 0.14), bevel=0.015)
        B.part('box', TRIM, loc=(cx - s * (DW / 2 - 0.08) * -1, ty, WZ0 + DH / 2), scale=(0.16, 0.07, DH), bevel=0.015)
        B.part('box', TRIM, loc=(cx + s * (DW / 2 - 0.08) * -1, ty, WZ0 + DH / 2), scale=(0.16, 0.07, DH), bevel=0.015)
        # X braces in upper and lower halves
        for (z0, z1) in ((WZ0 + 0.16, WZ0 + DH / 2 - 0.07), (WZ0 + DH / 2 + 0.07, WZ0 + DH - 0.16)):
            dw, dh = DW - 0.32, z1 - z0
            ang = math.atan2(dh, dw)
            ln = math.hypot(dw, dh)
            for sg in (-1, 1):
                B.part('box', TRIM, loc=(cx, ty - 0.01, (z0 + z1) / 2), rot=(0, sg * ang, 0), scale=(ln, 0.06, 0.12))
    # door header
    B.part('box', TRIM, loc=(0, fy - 0.07, WZ0 + DH + 0.08), scale=(DW * 2 + 0.3, 0.09, 0.16), bevel=0.02)
    # sign above door
    B.part('box', WOOD, loc=(0, fy - 0.08, 3.72), scale=(1.9, 0.08, 0.52), bevel=0.03)
    B.part('box', WOOD_L, loc=(0, fy - 0.13, 3.72), scale=(1.6, 0.03, 0.3))
    for i, x in enumerate((-0.55, -0.25, 0.05, 0.35, 0.6)):
        B.part('box', WOOD_D, loc=(x, fy - 0.15, 3.72 + (0.02 if i % 2 else -0.02)), scale=(0.16, 0.02, 0.14))
    # hay loft window
    gy = -(WY + 0.02)
    B.part('box', DARK, loc=(0, gy - 0.02, 5.05), scale=(0.95, 0.06, 0.85))
    for dx, dz, sx, sz in ((0, 0.47, 1.15, 0.12), (0, -0.47, 1.15, 0.12), (0.52, 0, 0.12, 1.0), (-0.52, 0, 0.12, 1.0)):
        B.part('box', TRIM, loc=(dx, gy - 0.08, 5.05 + dz), scale=(sx, 0.08, sz), bevel=0.015)
    B.part('box', TRIM, loc=(0, gy - 0.1, 5.05), rot=(0, math.radians(45), 0), scale=(1.1, 0.05, 0.08))
    B.part('box', HAY, loc=(0.0, gy - 0.12, 4.72), rot=(0, 0.1, 0), scale=(0.7, 0.3, 0.16), jitter=0.05)
    # hay bales (front right)
    def bale(x, y, z, rz=0.0):
        B.part('box', HAY, loc=(x, y, z + 0.28), rot=(0, 0, rz), scale=(1.0, 0.6, 0.56), bevel=0.06)
        for k in (-0.25, 0.25):
            c, s_ = math.cos(rz), math.sin(rz)
            B.part('box', TWINE, loc=(x + k * c, y + k * s_, z + 0.28), rot=(0, 0, rz), scale=(0.05, 0.62, 0.58))
    bale(2.25, -2.95, 0.0, 0.05)
    bale(2.0, -3.6, 0.0, -0.12)
    bale(2.15, -3.25, 0.56, 0.35)
    # baskets (front left)
    for bx, by in ((-2.3, -2.95), (-1.65, -3.35)):
        B.part('cyl', WICKER, loc=(bx, by, 0.2), segs=8, r1=0.26, r2=0.34, depth=0.4, bevel=0.02)
        B.part('cyl', WOOD_D, loc=(bx, by, 0.41), segs=8, r1=0.35, r2=0.35, depth=0.05)
        for k in range(4):
            an = k * 1.6 + bx
            B.part('ico', APPLE if k % 2 else PUMPKIN, loc=(bx + 0.13 * math.cos(an), by + 0.13 * math.sin(an), 0.48),
                   subdiv=1, r=0.12, jitter=0.08)
    return B.obj('granary')


# ---------------------------------------------------------------- trees
def blob(B, m, loc, r, sc=(1, 1, 1), jit=0.14):
    B.part('ico', m, loc=loc, scale=sc, subdiv=2, r=r, jitter=jit, rot=(B.rng.random() * 3, B.rng.random() * 3, B.rng.random() * 3))


def build_tree(name, cols, kind, seed):
    B = Builder(seed)
    rng = B.rng
    ms = [mat(name + '_leaf%d' % i, c, 0.85) for i, c in enumerate(cols)]
    th = {'a': 3.2, 'b': 2.8, 'c': 3.6}[kind]
    B.part('cyl', TRUNK, loc=(0, 0, th / 2), segs=7, r1=0.46, r2=0.26, depth=th, bevel=0.04)
    B.part('cyl', TRUNK, loc=(0, 0, 0.12), segs=7, r1=0.62, r2=0.46, depth=0.24, bevel=0.03)
    B.beam(TRUNK, (0, 0, th * 0.6), (0.9, 0.3, th + 0.5), r=0.13, segs=5)
    B.beam(TRUNK, (0, 0, th * 0.7), (-0.7, -0.5, th + 0.7), r=0.11, segs=5)
    if kind == 'a':  # round orange, ~7 tall
        blob(B, ms[0], (0, 0, 4.7), 2.15, (1.05, 1.0, 0.95))
        for i in range(4):
            an = i * math.pi / 2 + 0.4
            blob(B, ms[1 + i % 2], (1.35 * math.cos(an), 1.35 * math.sin(an), 4.0 + rng.uniform(-0.2, 0.6)), 1.35)
        blob(B, ms[2], (0.3, -0.2, 6.0), 1.0)
    elif kind == 'b':  # wide red, ~6 tall
        blob(B, ms[0], (0, 0, 4.2), 1.9, (1.25, 1.15, 0.85))
        for i in range(5):
            an = i * 2 * math.pi / 5
            blob(B, ms[1 + i % 2], (2.0 * math.cos(an), 2.0 * math.sin(an), 3.7 + rng.uniform(-0.2, 0.4)), 1.2, (1, 1, 0.85))
        blob(B, ms[2], (-0.3, 0.3, 5.2), 1.05)
    else:  # tall gold, ~8 tall
        blob(B, ms[0], (0, 0, 4.1), 1.9, (1, 1, 0.8))
        blob(B, ms[1], (0.15, -0.1, 5.5), 1.55, (1, 1, 0.85))
        blob(B, ms[2], (-0.1, 0.1, 6.7), 1.1)
        blob(B, ms[0], (0, 0, 7.55), 0.6)
        for i in range(3):
            an = i * 2 * math.pi / 3 + 0.5
            blob(B, ms[2 - i % 2], (1.4 * math.cos(an), 1.4 * math.sin(an), 3.7), 0.95)
    return B.obj(name)


# ---------------------------------------------------------------- bush
def build_bush():
    B = Builder(5)
    blob(B, BUSH[0], (0, 0, 0.98), 1.0, (1.15, 1.05, 1.0), 0.12)
    blob(B, BUSH[1], (0.62, 0.3, 0.65), 0.62, jit=0.12)
    blob(B, BUSH[2], (-0.6, -0.25, 0.68), 0.6, jit=0.12)
    blob(B, BUSH[1], (-0.1, 0.62, 0.62), 0.55, jit=0.12)
    blob(B, BUSH[2], (0.2, -0.6, 0.6), 0.55, jit=0.12)
    return B.obj('bush_berry')


# ---------------------------------------------------------------- campfire
def build_campfire():
    B = Builder(7)
    rng = B.rng
    for i in range(8):
        an = i * 2 * math.pi / 8 + rng.uniform(-0.08, 0.08)
        R = 6.2 + rng.uniform(-0.15, 0.15)
        r = rng.uniform(0.5, 0.75)
        B.part('ico', STONE if i % 2 else STONE2, loc=(R * math.cos(an), R * math.sin(an), r * 0.5),
               rot=(0, 0, rng.uniform(0, 6.28)), scale=(rng.uniform(1.1, 1.5), rng.uniform(0.9, 1.2), 0.8),
               subdiv=1, r=r, jitter=0.22)
    B.part('cyl', ASH, loc=(0, 0, 0.04), segs=10, r1=1.7, r2=1.55, depth=0.08)
    for i in range(7):  # small hearth stones
        an = i * 2 * math.pi / 7
        B.part('ico', STONE2, loc=(1.75 * math.cos(an), 1.75 * math.sin(an), 0.12), subdiv=1, r=0.25,
               scale=(1.2, 1, 0.7), jitter=0.2)
    for i in range(5):
        an = i * 2 * math.pi / 5 + 0.3
        b = (1.35 * math.cos(an), 1.35 * math.sin(an), 0.15)
        t = (0.12 * math.cos(an + 0.5), 0.12 * math.sin(an + 0.5), 2.3)
        B.beam(LOG, b, t, r=0.17, segs=6, bevel=0.02)
    return B.obj('campfire')


# ---------------------------------------------------------------- pier (extends toward Blender +Y = glTF -Z)
def build_pier():
    B = Builder(9)
    rng = B.rng
    for i in range(11):
        y = 0.225 + i * 0.45
        B.part('box', PLANK[i % 3], loc=(rng.uniform(-0.04, 0.04), y, 0.26 + rng.uniform(-0.01, 0.01)),
               rot=(0, 0, rng.uniform(-0.02, 0.02)), scale=(3.0, 0.38, 0.08), bevel=0.015)
    for x in (-1.1, 1.1):
        B.part('box', WOOD_D, loc=(x, 2.5, 0.13), scale=(0.16, 5.0, 0.18), bevel=0.02)
    for x in (-1.35, 1.35):
        for y in (0.25, 4.75):
            B.part('cyl', WOOD_D, loc=(x, y, -0.4), segs=8, r1=0.15, r2=0.14, depth=2.2, bevel=0.02)
    # bucket
    B.part('cyl', BUCKET, loc=(0.85, 4.1, 0.52), segs=10, r1=0.2, r2=0.26, depth=0.44, bevel=0.015)
    B.part('cyl', WATER, loc=(0.85, 4.1, 0.73), segs=10, r1=0.23, r2=0.23, depth=0.02)
    hb = [(0.85 + 0.26 * math.cos(t), 4.1, 0.74 + 0.22 * math.sin(t)) for t in [k * math.pi / 4 for k in range(5)]]
    for p, q in zip(hb, hb[1:]):
        B.beam(METAL, p, q, r=0.015, segs=4)
    # fishing rod leaning out over the end
    B.beam(WOOD_L, (-0.9, 3.9, 0.32), (-1.05, 7.2, 1.9), r=0.035, segs=5)
    B.beam(METAL, (-0.9, 3.9, 0.32), (-0.92, 4.4, 0.56), r=0.05, segs=6)
    B.part('cyl', METAL, loc=(-0.85, 4.55, 0.55), rot=(0, math.pi / 2, 0), segs=8, r1=0.09, r2=0.09, depth=0.08)
    B.part('box', WOOD, loc=(-0.55, 0.7, 0.4), scale=(0.6, 0.4, 0.22), bevel=0.02)  # tackle box
    return B.obj('pier')


# ---------------------------------------------------------------- island
def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def hill(x, y, r):
    n = 0.5 + 0.5 * (0.6 * math.sin(x * 0.21 + 1.3) * math.cos(y * 0.17 + 0.7) + 0.4 * math.sin(x * 0.09 - y * 0.13 + 2.0))
    return 0.6 * n * smooth(14, 20, r) * (1 - smooth(39, 44, r))


def build_island():
    rng = random.Random(3)
    SEG = 56
    rings = [(4, 'g'), (8, 'g'), (11, 'g'), (14, 'g'), (16.8, 'g'), (19.6, 'g'), (22.4, 'g'), (25.2, 'g'), (28, 'g'),
             (30.8, 'g'), (33.6, 'g'), (36.4, 'g'), (39.2, 'g'), (42, 'g'), (44, 'g'),
             (44.7, 'c'), (47, 's'), (49, 's'), (49.6, 'k')]
    verts = [(0, 0, 0)]
    ring_idx = []
    for ri, (r, kind) in enumerate(rings):
        ids = []
        for j in range(SEG):
            an = j * 2 * math.pi / SEG
            rr = r
            if r < 14:
                an += rng.uniform(-0.25, 0.25) * 2 * math.pi / SEG
                rr += rng.uniform(-0.5, 0.5)
            elif kind == 'g' and r < 44:
                an += rng.uniform(-0.3, 0.3) * 2 * math.pi / SEG
                rr += rng.uniform(-0.7, 0.7)
            else:
                rr += rng.uniform(-0.25, 0.25)
            x, y = rr * math.cos(an), rr * math.sin(an)
            if kind == 'g':
                z = 0.0 if r <= 14 else hill(x, y, rr)
                if r >= 44:
                    z = 0.05
            elif kind == 'c':
                z = -0.3 + rng.uniform(-0.04, 0.04)
            elif kind == 's':
                z = -0.4 if r < 48 else -0.55
                z += rng.uniform(-0.04, 0.04)
            else:
                z = -3.0
            ids.append(len(verts))
            verts.append((x, y, z))
        ring_idx.append(ids)
    faces, fkind = [], []
    for j in range(SEG):
        faces.append((0, ring_idx[0][j], ring_idx[0][(j + 1) % SEG])); fkind.append('g')
    for ri in range(len(rings) - 1):
        A, Bv = ring_idx[ri], ring_idx[ri + 1]
        k = rings[ri + 1][1]
        kk = {'g': 'g', 'c': 'c', 's': 's', 'k': 'k'}[k]
        for j in range(SEG):
            j2 = (j + 1) % SEG
            faces.append((A[j], Bv[j], Bv[j2], A[j2])); fkind.append(kk)
    faces.append(tuple(reversed(ring_idx[-1]))); fkind.append('k')
    me = bpy.data.meshes.new('island')
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = False
    attr = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='CORNER')
    G, G2, S, C = lin('#7fae4f'), lin('#93c45c'), lin('#e9cf94'), lin('#c9a66b')
    for p, k in zip(me.polygons, fkind):
        v = rng.uniform(0.9, 1.07)
        if k == 'g':
            zc = sum(me.vertices[i].co.z for i in p.vertices) / len(p.vertices)
            t = max(0.0, min(1.0, zc / 0.6))
            base = tuple(G[i] * (1 - t) + G2[i] * t for i in range(3))
        elif k == 's':
            base = S; v = rng.uniform(0.95, 1.04)
        else:
            base = C; v = rng.uniform(0.92, 1.05)
        col = tuple(min(1.0, c * v) for c in base) + (1.0,)
        for li in p.loop_indices:
            attr.data[li].color = col
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = 0
    except Exception:
        pass
    m = bpy.data.materials.new('island_ground')
    pb = principled(m)
    pb.inputs['Roughness'].default_value = 0.95
    vc = m.node_tree.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    m.node_tree.links.new(vc.outputs['Color'], pb.inputs['Base Color'])
    me.materials.append(m)
    o = bpy.data.objects.new('island', me)
    bpy.context.scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- props
def build_pumpkin():
    B = Builder(21)
    def rib(co):
        an = math.atan2(co.y, co.x)
        f = 1.0 + 0.09 * math.cos(8 * an)
        return Vector((co.x * f, co.y * f, co.z))
    B.part('uv', PUMPKIN, loc=(0, 0, 0.34), scale=(1, 1, 0.68), u=16, v=9, r=0.5, deform=rib)
    B.part('cyl', STEM, loc=(0.02, 0, 0.74), rot=(0.25, 0.1, 0), segs=6, r1=0.06, r2=0.04, depth=0.22)
    return B.obj('pumpkin')


def build_haybale():
    B = Builder(22)
    B.part('box', HAY, loc=(0, 0, 0.36), scale=(1.2, 0.75, 0.72), bevel=0.07)
    for k in (-0.3, 0.3):
        B.part('box', TWINE, loc=(k, 0, 0.36), scale=(0.06, 0.77, 0.74))
    B.part('box', HAY, loc=(0.1, 0, 0.74), rot=(0, 0, 0.3), scale=(0.5, 0.2, 0.05), jitter=0.1)
    return B.obj('haybale')


def build_lantern_post():
    B = Builder(23)
    B.part('box', WOOD_D, loc=(0, 0, 0.12), scale=(0.36, 0.36, 0.24), bevel=0.03)
    B.part('box', LOG, loc=(0, 0, 1.25), scale=(0.18, 0.18, 2.5), bevel=0.025)
    B.part('box', LOG, loc=(0.32, 0, 2.38), scale=(0.75, 0.12, 0.12), bevel=0.02)
    B.beam(LOG, (0.0, 0, 2.0), (0.38, 0, 2.38), r=0.04, segs=4)
    lx = 0.6
    B.part('cyl', METAL, loc=(lx, 0, 2.25), segs=4, r1=0.02, r2=0.02, depth=0.18)
    B.part('cyl', METAL, loc=(lx, 0, 2.1), rot=(0, 0, math.pi / 4), segs=4, r1=0.22, r2=0.04, depth=0.14)
    B.part('box', LANTERN, loc=(lx, 0, 1.86), scale=(0.24, 0.24, 0.34))
    for dx in (-0.13, 0.13):
        for dy in (-0.13, 0.13):
            B.part('box', METAL, loc=(lx + dx, dy, 1.86), scale=(0.035, 0.035, 0.36))
    B.part('box', METAL, loc=(lx, 0, 1.67), scale=(0.3, 0.3, 0.05))
    return B.obj('lantern_post')


def build_feast_table():
    B = Builder(24)
    rng = B.rng
    B.part('box', WOOD, loc=(0, 0, 0.82), scale=(6.0, 1.6, 0.12), bevel=0.03)
    for x in (-2.7, 2.7):
        for y in (-0.6, 0.6):
            B.part('box', WOOD_D, loc=(x, y, 0.38), scale=(0.14, 0.14, 0.76), bevel=0.02)
        B.part('box', WOOD_D, loc=(x, 0, 0.2), scale=(0.1, 1.2, 0.1))
    B.part('box', WOOD_D, loc=(0, 0, 0.2), scale=(5.4, 0.1, 0.1))
    for y in (-1.25, 1.25):  # benches
        B.part('box', WOOD_L, loc=(0, y, 0.46), scale=(5.6, 0.42, 0.08), bevel=0.02)
        for x in (-2.4, 0, 2.4):
            B.part('box', WOOD_D, loc=(x, y, 0.21), scale=(0.1, 0.32, 0.42))
    B.part('box', TRIM, loc=(0, 0, 0.885), scale=(5.7, 0.7, 0.015))
    for x in (-2.25, -0.85, 0.85, 2.25):
        for y in (-0.52, 0.52):
            B.part('cyl', PLATE, loc=(x, y, 0.9), segs=10, r1=0.2, r2=0.17, depth=0.03)
            B.part('cyl', WOOD_L, loc=(x + 0.3, y * 0.75, 0.96), segs=6, r1=0.06, r2=0.07, depth=0.16)  # cups
    for x in (-1.6, 1.6):  # pies
        B.part('cyl', PLATE, loc=(x, 0, 0.905), segs=12, r1=0.34, r2=0.32, depth=0.025)
        B.part('cyl', CRUST, loc=(x, 0, 0.96), segs=12, r1=0.25, r2=0.3, depth=0.09, bevel=0.015)
        B.part('cyl', FILL, loc=(x, 0, 1.0), segs=12, r1=0.25, r2=0.25, depth=0.015)
    # turkey on a platter
    B.part('cyl', PLATE, loc=(0, 0, 0.905), segs=12, r1=0.5, r2=0.46, depth=0.025)
    B.part('ico', TURKEY, loc=(0, 0, 1.08), scale=(0.42, 0.3, 0.22), subdiv=2, r=1.0, jitter=0.04)
    for s in (-1, 1):
        B.beam(TURKEY, (-0.18, s * 0.2, 1.05), (-0.42, s * 0.24, 1.2), r=0.06, segs=6)
        B.part('ico', PLATE, loc=(-0.46, s * 0.24, 1.22), subdiv=1, r=0.05)
    # corn and apples
    for x, y in ((-0.7, 0.05), (0.75, -0.05)):
        B.part('cyl', CORN, loc=(x, y, 0.95), rot=(0, math.pi / 2, 0.3), segs=6, r1=0.06, r2=0.05, depth=0.32)
    for k in range(5):
        B.part('ico', APPLE, loc=(2.75 + rng.uniform(-0.12, 0.12), rng.uniform(-0.2, 0.2), 0.96), subdiv=1, r=0.07)
    return B.obj('feast_table')


def build_rock(name, seed, cluster):
    B = Builder(seed)
    B.part('ico', STONE, loc=(0, 0, 0.42), scale=(1.25, 1.0, 0.7), subdiv=1, r=0.75, jitter=0.25, rot=(0.2, 0.1, 0.5))
    if cluster:
        B.part('ico', STONE2, loc=(0.85, 0.35, 0.25), scale=(1.1, 1.0, 0.75), subdiv=1, r=0.4, jitter=0.25)
        B.part('ico', STONE2, loc=(-0.6, -0.5, 0.18), subdiv=1, r=0.28, jitter=0.25)
    return B.obj(name)


def main():
    clear_scene()
    export(build_granary(), 'granary.glb'); clear_scene()
    for nm, cols, kind, seed in (('tree_autumn_a', ('#e8590c', '#c8470a', '#f07a2e'), 'a', 31),
                                 ('tree_autumn_b', ('#c92a2a', '#a51e1e', '#e03e3e'), 'b', 32),
                                 ('tree_autumn_c', ('#f08c00', '#d97706', '#f5a524'), 'c', 33)):
        export(build_tree(nm, cols, kind, seed), nm + '.glb'); clear_scene()
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
