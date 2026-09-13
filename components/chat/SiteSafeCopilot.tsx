'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {ArrowUp,Command,Leaf,MessageCircle,Minus,Sparkles} from 'lucide-react';
import type {SiteReport} from '@/lib/schemas';
import type {ScenarioAssumptions} from '../ImpactScenarioCalculator';
import {ChatMessage,type CopilotMessage,type ToolWidget} from './ChatMessage';

const modes={Assist:'Analyse the most decision-relevant risks and next actions.','What should I say?':'Draft a concise evidence-based briefing for a buyer, lender, or assessor.','Follow-up questions':'List the exact questions to ask the council, insurer, and qualified assessors, and explain what each answer changes.',Recap:'Recap this conversation as findings, uncertainties, scenarios, and prioritized actions.'} as const;
type Mode=keyof typeof modes;
const prompts=['Stress-test financial exposure','Required parcel assessments','Graph heat trends vs projections','Compare adaptation ROI'];

export function SiteSafeCopilot({report,assumptions}:{report:SiteReport;assumptions:ScenarioAssumptions}){
  const [open,setOpen]=useState(false),[activeMode,setActiveMode]=useState<Mode>('Assist');
  const [messages,setMessages]=useState<CopilotMessage[]>([{id:'welcome',role:'assistant',content:`## Decision intelligence\nI am ready to analyse **${report.location.address}** across financial exposure, Victorian planning obligations, and adaptation return on investment. Every figure will be identified as reported evidence, a user assumption, or a calculated scenario.`}]);
  const [input,setInput]=useState(''),[loading,setLoading]=useState(false),[engineMode,setEngineMode]=useState<'live'|'demo'|null>(null);
  const abortRef=useRef<AbortController|null>(null),inputRef=useRef<HTMLTextAreaElement|null>(null);
  useEffect(()=>{const toggle=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(current=>!current)}if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',toggle);return()=>window.removeEventListener('keydown',toggle)},[]);
  useEffect(()=>{if(open)requestAnimationFrame(()=>inputRef.current?.focus())},[open]);
  async function send(text:string){
    const question=text.trim();if(!question||loading)return;
    const user:CopilotMessage={id:crypto.randomUUID(),role:'user',content:question},assistantId=crypto.randomUUID(),next=[...messages,user];
    setMessages([...next,{id:assistantId,role:'assistant',content:''}]);setInput('');setLoading(true);
    const controller=new AbortController();abortRef.current=controller;
    try{
      const suffix=`\n\n[HUD mode: ${activeMode}. Objective: ${modes[activeMode]} Current assumptions: low damage ${assumptions.low}%, high damage ${assumptions.high}%, interruption ${assumptions.days} days, cost per day AUD ${assumptions.daily}.]`;
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next.map((message,index)=>({role:message.role,content:index===next.length-1?message.content+suffix:message.content})),report}),signal:controller.signal});
      if(!response.ok||!response.body)throw new Error('Copilot is unavailable.');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value??new Uint8Array(),{stream:!done});const rows=buffer.split('\n');buffer=rows.pop()??'';for(const row of rows){if(!row.trim())continue;const event=JSON.parse(row) as {type:string;text?:string;name?:ToolWidget['name'];output?:unknown;message?:string;mode?:'live'|'demo'};if(event.type==='delta'&&event.text)setMessages(current=>current.map(message=>message.id===assistantId?{...message,content:message.content+event.text}:message));if(event.type==='tool'&&event.name)setMessages(current=>current.map(message=>message.id===assistantId?{...message,tool:{name:event.name as ToolWidget['name'],output:event.output}}:message));if(event.type==='done'&&event.mode)setEngineMode(event.mode);if(event.type==='error')throw new Error(event.message??'Copilot request failed.')}if(done)break}
    }catch(error){if(!controller.signal.aborted)setMessages(current=>current.map(message=>message.id===assistantId?{...message,content:error instanceof Error?error.message:'Copilot request failed.'}:message))}finally{setLoading(false);abortRef.current=null}
  }
  function submit(event:FormEvent){event.preventDefault();void send(input)}
  function selectMode(mode:Mode){setActiveMode(mode);if(mode!=='Assist')void send(modes[mode])}
  return <><button className="copilot-trigger" onClick={()=>setOpen(true)} aria-label="Open SiteSafe AI Copilot"><Sparkles size={17}/><span>Ask SiteSafe AI</span><kbd><Command size={11}/>K</kbd></button>{open&&<div className="copilot-overlay" role="presentation"><button className="copilot-backdrop" onClick={()=>setOpen(false)} aria-label="Close copilot overlay"/><section className="copilot-hud" role="dialog" aria-modal="true" aria-label="SiteSafe AI Copilot"><header className="hud-header"><div className="hud-brand"><span className="copilot-logo"><Leaf size={16}/></span><span><strong>SiteSafe AI</strong><small>{engineMode==='live'?'Live analysis':engineMode==='demo'?'Evidence-safe local engine':'Climate decision copilot'}</small></span></div><nav aria-label="Copilot modes">{(Object.keys(modes) as Mode[]).map(mode=><button className={activeMode===mode?'active':''} key={mode} onClick={()=>selectMode(mode)} disabled={loading}>{mode}</button>)}</nav><button className="hud-close" onClick={()=>setOpen(false)} aria-label="Collapse copilot"><Minus size={18}/></button></header><div className="pipeline-strip"><span>Scattered public data</span><b>→</b><span>SiteSafe analysis</span><b>→</b><span>Exposure + assessments + adaptation</span><b>→</b><span>Land decision</span></div><div className="chat-thread" aria-live="polite">{messages.map((message,index)=><ChatMessage key={message.id} message={message} streaming={loading&&index===messages.length-1}/>)}</div><div className="quick-prompts">{prompts.map(prompt=><button key={prompt} onClick={()=>void send(prompt)} disabled={loading}>{prompt}</button>)}</div><form className="chat-input" onSubmit={submit}><textarea ref={inputRef} maxLength={1000} value={input} onChange={event=>setInput(event.target.value)} placeholder="Ask for a deeper analysis of this property..." rows={2} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void send(input)}}}/><button disabled={!input.trim()||loading} aria-label="Send message"><ArrowUp size={17}/></button></form><p className="copilot-disclaimer"><MessageCircle size={10}/> Evidence, assumptions, and calculated scenarios stay explicitly separated.</p></section></div>}</>;
}
