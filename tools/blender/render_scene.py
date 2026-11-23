# Beauty shot: imports the exported GLBs and renders docs/blender-render.png.
# Run: Blender -b --factory-startup --python render_scene.py [-- CYCLES]
# Positions below are Blender coords (Z-up). Three.js (x, y, z) == Blender (x, -z, y).
import bpy, math, os, sys, random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MODELS = os.path.join(ROOT, "public", "models")
OUTPNG = os.path.join(ROOT, "docs", "blender-render.png")
os.makedirs(os.path.dirname(OUTPNG), exist_ok=True)
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FORCE_CYCLES = "CYCLES" in argv

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scn = bpy.context.scene
col = scn.collection


def imp(fname):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, fname))
    return [o for o in bpy.data.objects if o not in before]


def place(src, loc, rz=0.0, s=1.0):
    o = src.copy()
    col.objects.link(o)
    o.parent = None
    o.location = loc
    o.rotation_mode = 'XYZ'
    o.rotation_euler = (0, 0, rz)
    o.scale = (s, s, s)
    return o


def single(fname):
    objs = imp(fname)
    root = next(o for o in objs if o.type == 'MESH')
    for o in objs:
        if o is not root:
            bpy.data.objects.remove(o, do_unlink=True)
    root.location = (0, 0, -1000)  # template parked out of view
    return root


rng = random.Random(4)
island = single('island.glb'); island.location = (0, 0, 0)
granary = single('granary.glb'); granary.location = (0, 0, 0)
camp = single('campfire.glb'); camp.location = (0, -10, 0)
pier = single('pier.glb'); place(pier, (-42.5, -15.5, -0.35), math.radians(110))
trees = [single('tree_autumn_%s.glb' % k) for k in 'abc']
bush = single('bush_berry.glb')
props = {o.name.split('.')[0]: o for o in imp('props.glb') if o.type == 'MESH'}
for o in props.values():
    o.location.z = -1000

for (x, y, k, s) in ((-11, 3, 0, 1.0), (13, -1, 1, 1.0), (-9, 12, 2, 1.1), (16, 10, 0, 1.15), (-19, -5, 2, 1.0),
                     (9, 15, 1, 1.0), (-24, 15, 0, 1.2), (25, -9, 2, 1.1), (-30, -14, 1, 1.0), (31, 4, 0, 1.0),
                     (2, 22, 2, 1.25), (-15, 24, 1, 1.1), (21, 22, 2, 1.0), (-34, 6, 2, 1.0)):
    place(trees[k], (x, y, 0), rng.uniform(0, 6.28), s)
for (x, y) in ((-6, -18.5), (6.5, -19.5), (-15, -13), (19, -18), (-7, 4), (7.5, 5), (-21, 2), (26, -2)):
    place(bush, (x, y, 0), rng.uniform(0, 6.28), rng.uniform(0.85, 1.1))
for (x, y) in ((-3.3, -4.2), (-2.6, -4.9), (-3.8, -5.2), (3.4, -3.9), (4.2, -4.6), (-9.5, -15), (8.7, -17.2),
               (12.2, -10.5), (-12.4, -8.8), (0.8, -19.5)):
    place(props['pumpkin'], (x, y, 0), rng.uniform(0, 6.28), rng.uniform(0.8, 1.3))
for (x, y) in ((-6.8, -3.4), (7.4, -3.4), (-6.5, -16.5), (6.8, -16.8)):
    place(props['lantern_post'], (x, y, 0), math.atan2(-y - 10, -x) if False else (0 if x < 0 else math.pi))
place(props['feast_table'], (12.5, -15.5, 0), math.radians(25))
place(props['haybale'], (-5.5, -1.5, 0), 0.3)
place(props['haybale'], (-6.4, -0.6, 0), -0.2)
place(props['haybale'], (5.8, -0.8, 0), 1.2)
for (x, y, k) in ((-16, -20, 'rock_a'), (22, -14, 'rock_b'), (-27, -3, 'rock_b'), (14, 3, 'rock_a'), (-3, 14, 'rock_a')):
    place(props[k], (x, y, 0), rng.uniform(0, 6.28), rng.uniform(0.9, 1.4))

# water
bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, -0.62))
wm = bpy.data.materials.new('water')
try:
    wm.use_nodes = True
except Exception:
    pass
p = next(n for n in wm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value = (0.03, 0.18, 0.25, 1)
p.inputs['Roughness'].default_value = 0.12
bpy.context.active_object.data.materials.append(wm)

# lighting: low warm sun from front-left
to_light = Vector((-0.75, -0.55, 0.26)).normalized()
sun_d = bpy.data.lights.new('sun', 'SUN')
sun_d.energy = 7.0
sun_d.color = (1.0, 0.58, 0.32)
sun_d.angle = math.radians(2.5)
sun = bpy.data.objects.new('sun', sun_d)
col.objects.link(sun)
sun.rotation_mode = 'QUATERNION'
sun.rotation_quaternion = to_light.to_track_quat('Z', 'Y')
fill_d = bpy.data.lights.new('fill', 'SUN'); fill_d.energy = 0.6; fill_d.color = (0.55, 0.65, 1.0)
fill = bpy.data.objects.new('fill', fill_d); col.objects.link(fill)
fill.rotation_mode = 'QUATERNION'
fill.rotation_quaternion = Vector((0.6, 0.7, 0.6)).normalized().to_track_quat('Z', 'Y')
# campfire glow
fire_d = bpy.data.lights.new('fire', 'POINT'); fire_d.energy = 1500; fire_d.color = (1.0, 0.55, 0.2)
fire = bpy.data.objects.new('fire', fire_d); col.objects.link(fire); fire.location = (0, -10, 1.4)

world = bpy.data.worlds.new('sky'); scn.world = world
try:
    world.use_nodes = True
except Exception:
    pass
wn = world.node_tree
bg = next(n for n in wn.nodes if n.type == 'BACKGROUND')
sky_ok = False
try:
    sky = wn.nodes.new('ShaderNodeTexSky')
    for t in ('NISHITA', 'MULTIPLE_SCATTERING', 'SINGLE_SCATTERING'):
        try:
            sky.sky_type = t
            break
        except Exception:
            continue
    try:
        sky.sun_elevation = math.radians(4)
        sky.sun_rotation = math.atan2(to_light.x, to_light.y) * -1 + math.pi / 2
        sky.sun_disc = False
    except Exception:
        pass
    wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.14
    sky_ok = True
except Exception as e:
    print("SKY FAIL", e)
if not sky_ok:
    bg.inputs['Color'].default_value = (0.95, 0.55, 0.32, 1)
    bg.inputs['Strength'].default_value = 0.8

# camera
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 30
cam = bpy.data.objects.new('cam', cam_d); col.objects.link(cam)
cam.location = (17, -36, 11.5)
cam.rotation_mode = 'QUATERNION'
cam.rotation_quaternion = (Vector((0, -5, 2.0)) - cam.location).to_track_quat('-Z', 'Y')
scn.camera = cam

scn.render.resolution_x, scn.render.resolution_y, scn.render.resolution_percentage = 1600, 900, 100
scn.render.image_settings.file_format = 'PNG'
scn.render.filepath = OUTPNG
try:
    scn.view_settings.view_transform = 'AgX'
    scn.view_settings.look = 'AgX - Punchy'
except Exception:
    pass

engine = None
if not FORCE_CYCLES:
    for e in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scn.render.engine = e
            engine = e
            break
        except Exception:
            pass
if engine is None:
    scn.render.engine = 'CYCLES'
    engine = 'CYCLES'
    scn.cycles.samples = 32
    try:
        scn.cycles.device = 'GPU'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
    except Exception:
        pass
    try:
        scn.cycles.use_denoising = True
    except Exception:
        pass
else:
    try:
        scn.eevee.taa_render_samples = 32
    except Exception:
        pass
print("ENGINE", engine)
bpy.ops.render.render(write_still=True)
print("RENDERED", OUTPNG)
