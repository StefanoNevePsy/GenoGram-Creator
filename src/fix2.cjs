const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

// The NodeShape handles
const spouseMatch = '<g transform={`translate(${w+20}, ${r})`} onPointerDown={(e)=>onH(e,\'spouse\')} className="cursor-crosshair hover:opacity-80">';
const childMatch = '<g transform={`translate(${r}, ${h+25})`} onPointerDown={(e)=>onH(e,\'child\')} className="cursor-crosshair hover:opacity-80">';
const parentsMatch = '<g transform={`translate(${r}, -25)`} onPointerDown={(e)=>onH(e,\'parents\')} className="cursor-crosshair hover:opacity-80">';
const linkMatch = '<g transform={`translate(-20, ${r})`} onPointerDown={(e)=>onH(e,\'link\')} className="cursor-alias hover:opacity-80">';

code = code.replace(spouseMatch, spouseMatch.replace('>', ' style={{ touchAction: \'none\' }}>'));
code = code.replace(childMatch, childMatch.replace('>', ' style={{ touchAction: \'none\' }}>'));
code = code.replace(parentsMatch, parentsMatch.replace('>', ' style={{ touchAction: \'none\' }}>'));
code = code.replace(linkMatch, linkMatch.replace('>', ' style={{ touchAction: \'none\' }}>'));

// The Transformer handles (multiple nodes selection)
const rotateMatch = '<g transform={`translate(${x + w/2}, ${y})`} className="cursor-grab active:cursor-grabbing" onPointerDown={(e) => onHandleDown(e, \'rotate\')}>';
code = code.replace(rotateMatch, rotateMatch.replace('>', ' style={{ touchAction: \'none\' }}>'));

const scaleMatch = '<g transform={`translate(${x + w}, ${y + h})`} className="cursor-nwse-resize" onPointerDown={(e) => onHandleDown(e, \'scale\')}>';
code = code.replace(scaleMatch, scaleMatch.replace('>', ' style={{ touchAction: \'none\' }}>'));

fs.writeFileSync('App.tsx', code);
console.log('Replaced touch actions successfully!');
