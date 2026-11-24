"""Inject Morph transitions (fade fallback) and staggered entrance animations into a pptxgenjs deck.
Shapes named anim-<order>-<fade|up>-<id> get entrance effects; order N starts at N*STEP ms after slide start."""
import re, sys, zipfile, shutil

SRC, DST = sys.argv[1], sys.argv[2]
STEP, DUR = 280, 550

TRANS = ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
         '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
         '<p:transition spd="slow"><p159:morph option="byObject"/></p:transition></mc:Choice>'
         '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')

def effect(ids, spid, fx, delay):
    a, b, c, d = ids
    vis = (f'<p:set><p:cBhvr><p:cTn id="{b}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
           f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
           f'<p:to><p:strVal val="visible"/></p:to></p:set>')
    fade = (f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{c}" dur="{DUR}"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>')
    if fx == "up":  # Float In (preset 42): fade + rise
        rise = (f'<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="{d}" dur="{DUR}" fill="hold"/>'
                f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr>'
                f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="#ppt_y+.06"/></p:val></p:tav>'
                f'<p:tav tm="100000"><p:val><p:strVal val="#ppt_y"/></p:val></p:tav></p:tavLst></p:anim>')
        preset, body = 42, vis + fade + rise
    else:
        preset, body = 10, vis + fade
    return (f'<p:par><p:cTn id="{a}" presetID="{preset}" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="withEffect">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>')

def timing(xml):
    shapes = []
    for m in re.finditer(r'<p:(sp|pic|cxnSp)>\s*<p:nv\w+Pr>\s*<p:cNvPr id="(\d+)" name="(anim-(\d+)-(fade|up)-[^"]*)"', xml):
        shapes.append((int(m.group(4)), m.group(5), m.group(2), m.group(1)))
    if not shapes:
        return "", 0
    shapes.sort(key=lambda s: s[0])
    nid = 4
    effs, bld = [], []
    for order, fx, spid, kind in shapes:
        ids = (nid, nid + 1, nid + 2, nid + 3); nid += 4
        effs.append(effect(ids, spid, fx, order * STEP))
        if kind == "sp":
            bld.append(f'<p:bldP spid="{spid}" grpId="0" animBg="1"/>')
    t = ('<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
         '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
         '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
         '<p:par><p:cTn id="%d" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' % nid
         + "".join(effs) +
         '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>'
         '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
         '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
         '</p:childTnLst></p:cTn></p:par></p:tnLst>'
         + (f'<p:bldLst>{"".join(bld)}</p:bldLst>' if bld else "") + '</p:timing>')
    return t, len(shapes)

zin = zipfile.ZipFile(SRC)
zout = zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if re.match(r"ppt/slides/slide\d+\.xml$", item.filename):
        xml = data.decode("utf-8")
        assert "<p:timing" not in xml and "<p:transition" not in xml
        t, n = timing(xml)
        xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + TRANS + t, 1)
        assert TRANS in xml, item.filename
        print(item.filename, "animated shapes:", n)
        data = xml.encode("utf-8")
    zout.writestr(item, data)
zout.close()
