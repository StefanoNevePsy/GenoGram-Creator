import {ScegliPerPsyDiary,AvvisoPonte} from './ponte';
import {useEffect,useState,useRef} from 'react';
import type {GenogramMeta} from '../types';
import {readLocalIndex,readFullGenogram} from '../services/storage';
export function obsidianRequest(hash=location.hash){const m=/^#obsidian\?(.*)$/.exec(hash);if(!m)return null;const q=new URLSearchParams(m[1]);const port=Number(q.get('port')),token=q.get('token')||'',id=q.get('id')||'';if(!Number.isInteger(port)||port<1024||port>65535||! /^[a-f0-9]{48}$/.test(token)||id&&!/^[\w-]{1,128}$/.test(id))return null;return {port,token,id};}
/** Prefer the latest full document, retaining the existing app's offline storage. */
export function latestForObsidian(meta:GenogramMeta,local=readFullGenogram(meta)):GenogramMeta {
 return meta.data?.nodes && (!local.data?.nodes || meta.lastModified>local.lastModified) ? meta : local;
}
export function ObsidianBridge({genograms,current}:{genograms:GenogramMeta[],current:()=>GenogramMeta|null}){
 const [request,setRequest]=useState(()=>obsidianRequest());const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [success,setSuccess]=useState(false);const sent=useRef('');const latest=useRef(current);latest.current=current;
 useEffect(()=>{const change=()=>{setRequest(obsidianRequest());setStatus('');setSuccess(false);sent.current=''};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);
 const close=()=>{setRequest(null);history.replaceState(null,'',location.pathname+location.search)};
 const send=async(g:GenogramMeta)=>{if(!request||busy)return;setBusy(true);setStatus('Invio locale a Obsidian…');try{const body=JSON.stringify(g);if(new Blob([body]).size>4*1024*1024)throw Error('Genogramma oltre 4 MB: usa l’esportazione JSON.');if(request.id&&g.id!==request.id)throw Error('Il genogramma non corrisponde a quello collegato.');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(`http://127.0.0.1:${request.port}/genogram/${request.token}`,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal,credentials:'omit',redirect:'error'});if(!response.ok)throw Error('Obsidian non ha accettato il genogramma.')}finally{clearTimeout(timer)}setSuccess(true);setStatus('Genogramma inviato. Puoi tornare a Obsidian.')}catch(e){setStatus('Collegamento non riuscito. Consenti la connessione al dispositivo locale se richiesta, oppure usa il file JSON. '+(e as Error).message);sent.current=''}finally{setBusy(false)}};
 useEffect(()=>{if(!request?.id||sent.current===request.token)return;const live=latest.current();const meta=genograms.find(g=>g.id===request.id)||readLocalIndex().find(g=>g.id===request.id);const doc=live?.id===request.id?live:meta&&latestForObsidian(meta);if(!doc?.data?.nodes)return;sent.current=request.token;void send(doc)},[request,genograms]);
 if(!request)return null;
 if(success)return <AvvisoPonte testo={status} onChiudi={close}/>;
 const docs=[...new Map([...genograms,...readLocalIndex()].map(g=>[g.id,g])).values()].filter(g=>!request.id||g.id===request.id);
 return <ScegliPerPsyDiary destinazione="Obsidian" descrizione="Scambio locale con Obsidian su questo Mac. Scegli il genogramma da collegare." avviso={status||undefined} disabilitato={busy} genograms={docs} onAnnulla={close} onScegli={g=>void send(latest.current()?.id===g.id?latest.current()!:latestForObsidian(g))}/>;
}
