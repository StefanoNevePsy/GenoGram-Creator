import {describe,it,expect} from 'vitest';
import {obsidianRequest,latestForObsidian} from './obsidian';
describe('Obsidian local bridge request',()=>{it('only accepts bounded loopback port and unpredictable token',()=>{const token='a'.repeat(48);expect(obsidianRequest(`#obsidian?port=41234&token=${token}&id=demo-1`)).toEqual({port:41234,token,id:'demo-1'});for(const hash of ['#else','#obsidian?port=80&token='+token,'#obsidian?port=70000&token='+token,'#obsidian?port=41234&token=bad','#obsidian?port=41234&token='+token+'&id=../x'])expect(obsidianRequest(hash)).toBeNull()})});

it('prefers the latest full cloud/local version without losing offline data',()=>{
 const older={id:'demo',title:'Earlier',category:'family',lastModified:10,data:{nodes:[],edges:[],groups:[]}};
 const newer={...older,title:'Latest',lastModified:20};
 expect(latestForObsidian(newer,older).title).toBe('Latest');
 expect(latestForObsidian(older,newer).title).toBe('Latest');
});

it('Obsidian picker uses the shared themed panel and busy state',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {ScegliPerPsyDiary}=await import('./ponte');
 const html=renderToStaticMarkup(createElement(ScegliPerPsyDiary,{destinazione:'Obsidian',descrizione:'Scambio locale',disabilitato:true,genograms:[{id:'demo',title:'Esempio',category:'family',lastModified:1,data:{nodes:[],edges:[],groups:[]}}],onScegli:()=>{},onAnnulla:()=>{}}));
 expect(html).toContain('theme-panel');expect(html).toContain('theme-border');expect(html).toContain('theme-text-muted');expect(html).toContain('Obsidian');expect(html).toContain('disabled');expect(html).not.toContain('#f6f0e6');expect(html).not.toContain('#1a2131');
});
