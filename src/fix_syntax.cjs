const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Fix syntax errors introduced by previous script
code = code.replace(/onPointerDown=\{\(e\)=>onH\(e,'spouse'\)\} className="cursor-crosshair hover:opacity-80" style=\{\{ touchAction: 'none' \}\}>/g, 'onPointerDown={(e)=>onH(e,\'spouse\')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\)=>onH\(e,'child'\)\} className="cursor-crosshair hover:opacity-80" style=\{\{ touchAction: 'none' \}\}>/g, 'onPointerDown={(e)=>onH(e,\'child\')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\)=>onH\(e,'parents'\)\} className="cursor-crosshair hover:opacity-80" style=\{\{ touchAction: 'none' \}\}>/g, 'onPointerDown={(e)=>onH(e,\'parents\')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\)=>onH\(e,'link'\)\} className="cursor-alias hover:opacity-80" style=\{\{ touchAction: 'none' \}\}>/g, 'onPointerDown={(e)=>onH(e,\'link\')} className="cursor-alias hover:opacity-80" style={{ touchAction: \'none\' }}>');

code = code.replace(/onPointerDown=\{\(e\) = style=\{\{ touchAction: 'none' \}\}> onHandleDown\(e, 'rotate'\)\}>/g, 'onPointerDown={(e) => onHandleDown(e, \'rotate\')} style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\) = style=\{\{ touchAction: 'none' \}\}> onHandleDown\(e, 'scale'\)\}>/g, 'onPointerDown={(e) => onHandleDown(e, \'scale\')} style={{ touchAction: \'none\' }}>');

// One more check: wait, the previous script replaced '>' with ' style={{ touchAction: \'none\' }}>' inside the FULL matching string wrapper.
// So: `const childMatch = '<g transform={...} ... >'` -> was replaced with `<g transform={...} ... style={{ touchAction: 'none' }}>`
// BUT my rotateMatch was:
// const rotateMatch = '<g transform={`translate(${x + w/2}, ${y})`} className="cursor-grab active:cursor-grabbing" onPointerDown={(e) => onHandleDown(e, \'rotate\')}>';
// IF there was NO '>' at the end of the regex or if the regex matched multiple '>' ??
// Wait, `rotateMatch` HAS a `>`! But `App.tsx` had `onPointerDown={(e) = style={{ touchAction: 'none' }}> onHandleDown(e, 'scale')}>`
// This means the match replaced the FIRST `>` in `(e) =>` !!!!!!
// Because `=>` has a `>` !!

// Let's fix it properly.
// Read original from Update(4).tsx which has the uncorrupted file probably?
// No, I'll just fix it manually using regex on `App.tsx`:

code = code.replace(/onPointerDown=\{\(e\) = style=\{\{ touchAction: 'none' \}\}> onHandleDown\(e, 'rotate'\)\}>/g, 'onPointerDown={(e) => onHandleDown(e, \'rotate\')} style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\) = style=\{\{ touchAction: 'none' \}\}> onHandleDown\(e, 'scale'\)\}>/g, 'onPointerDown={(e) => onHandleDown(e, \'scale\')} style={{ touchAction: \'none\' }}>');

code = code.replace(/onPointerDown=\{\(e\)=style=\{\{ touchAction: 'none' \}\}>onH\(e,'spouse'\)\} className="cursor-crosshair hover:opacity-80">/g, 'onPointerDown={(e)=>onH(e,\'spouse\')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\)=style=\{\{ touchAction: 'none' \}\}>onH\(e,'child'\)\} className="cursor-crosshair hover:opacity-80">/g, 'onPointerDown={(e)=>onH(e,\'child\')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\)=style=\{\{ touchAction: 'none' \}\}>onH\(e,'parents'\)\} className="cursor-crosshair hover:opacity-80">/g, 'onPointerDown={(e)=>onH(e,\'parents\')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: \'none\' }}>');
code = code.replace(/onPointerDown=\{\(e\)=style=\{\{ touchAction: 'none' \}\}>onH\(e,'link'\)\} className="cursor-alias hover:opacity-80">/g, 'onPointerDown={(e)=>onH(e,\'link\')} className="cursor-alias hover:opacity-80" style={{ touchAction: \'none\' }}>');

// Let's just restore from Nuovo_2.tsx basically OR just regex fix it directly.

fs.writeFileSync('App.tsx', code);
