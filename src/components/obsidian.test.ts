import {describe,it,expect} from 'vitest';
import {obsidianRequest,latestForObsidian} from './obsidian';
describe('Obsidian local bridge request',()=>{it('only accepts bounded loopback port and unpredictable token',()=>{const token='a'.repeat(48);expect(obsidianRequest(`#obsidian?port=41234&token=${token}&id=demo-1`)).toEqual({port:41234,token,id:'demo-1'});for(const hash of ['#else','#obsidian?port=80&token='+token,'#obsidian?port=70000&token='+token,'#obsidian?port=41234&token=bad','#obsidian?port=41234&token='+token+'&id=../x'])expect(obsidianRequest(hash)).toBeNull()})});

it('prefers the latest full cloud/local version without losing offline data',()=>{
 const older={id:'demo',title:'Earlier',category:'family',lastModified:10,data:{nodes:[],edges:[],groups:[]}};
 const newer={...older,title:'Latest',lastModified:20};
 expect(latestForObsidian(newer,older).title).toBe('Latest');
 expect(latestForObsidian(older,newer).title).toBe('Latest');
});
