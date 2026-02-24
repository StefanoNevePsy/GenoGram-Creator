const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

// replace exact pairs
code = code.replace(/onMouseDown=\{onAddChildH\} onTouchStart=\{onAddChildH\}/g, "onPointerDown={onAddChildH}");
code = code.replace(/onMouseDown=\{\(e\)=>onH\(e,'spouse'\)\} onTouchStart=\{\(e\)=>onH\(e,'spouse'\)\}/g, "onPointerDown={(e)=>onH(e,'spouse')}");
code = code.replace(/onMouseDown=\{\(e\)=>onH\(e,'child'\)\} onTouchStart=\{\(e\)=>onH\(e,'child'\)\}/g, "onPointerDown={(e)=>onH(e,'child')}");
code = code.replace(/onMouseDown=\{\(e\)=>onH\(e,'parents'\)\} onTouchStart=\{\(e\)=>onH\(e,'parents'\)\}/g, "onPointerDown={(e)=>onH(e,'parents')}");
code = code.replace(/onMouseDown=\{\(e\)=>onH\(e,'link'\)\} onTouchStart=\{\(e\)=>onH\(e,'link'\)\}/g, "onPointerDown={(e)=>onH(e,'link')}");

// selection transformer multiline
code = code.replace(/onMouseDown=\{onMove\}\r?\n\s*onTouchStart=\{onMove\}/g, "onPointerDown={onMove}");
code = code.replace(/onMouseDown=\{\(e\) => onHandleDown\(e, 'rotate'\)\} onTouchStart=\{\(e\) => onHandleDown\(e, 'rotate'\)\}/g, "onPointerDown={(e) => onHandleDown(e, 'rotate')}");
code = code.replace(/onMouseDown=\{\(e\) => onHandleDown\(e, 'scale'\)\} onTouchStart=\{\(e\) => onHandleDown\(e, 'scale'\)\}/g, "onPointerDown={(e) => onHandleDown(e, 'scale')}");

// Also globally replace remaining standalone onMouseDown if any
code = code.replace(/onMouseDown=\{/g, "onPointerDown={");

// Strip standalone onTouchStart
code = code.replace(/onTouchStart=\{\(e\) => \{ if \(e\.touches\.length === 2\) handleTouchStart\(e as any\)\; \}\}/g, "");
// don't blindly strip all onTouchStart because some are valid
// Let's just remove the ones we know we don't need or leave them. Actually, just leaving them is mostly harmless if onPointerDown is there, but wait, onTouchStart can trigger before onPointerDown and cause double events if not carefully stopped.
// I'll just remove `onTouchStart={...}` for the specific cases where it was paired.

fs.writeFileSync('App.tsx', code);
console.log("Replaced successfully!");
