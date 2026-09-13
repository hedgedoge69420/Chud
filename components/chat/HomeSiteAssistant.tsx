'use client';
import {FormEvent,useRef,useState} from 'react';
import {ConversationProvider,useConversation} from '@elevenlabs/react';
import {ArrowUp,Leaf,MessageCircle,Mic,MicOff,PanelRightClose,Sparkles} from 'lucide-react';

type Message={id:string;role:'user'|'assistant';content:string};
const prompts=['What does SiteSafe check?','How do I investigate a property?','What evidence will I see?'];
const agentId=process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

function AssistantPanel(){
  const pendingMessageRef=useRef<string|null>(null);
  const sendUserMessageRef=useRef<((message:string)=>void)|null>(null);
  const conversation=useConversation({
    onConnect:()=>{
      const pendingMessage=pendingMessageRef.current;
      pendingMessageRef.current=null;
      if(pendingMessage)sendUserMessageRef.current?.(pendingMessage);
    },
    onMessage:message=>{
      if(message.role==='agent')setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:message.message}]);
    },
    onError:message=>setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:message}]),
  });
  sendUserMessageRef.current=conversation.sendUserMessage;
  const [open,setOpen]=useState(false);
  const [input,setInput]=useState('');
  const [messages,setMessages]=useState<Message[]>([{id:'welcome',role:'assistant',content:'Hi, I’m the SiteSafe assistant. Ask me how the screening works, what evidence it uses, or where to begin.'}]);
  const connected=conversation.status==='connected';
  const loading=conversation.status==='connecting';

  async function send(text:string){
    const question=text.trim();
    if(!question||loading||!agentId)return;
    setMessages(current=>[...current,{id:crypto.randomUUID(),role:'user',content:question}]);
    setInput('');
    try{
      if(connected){
        conversation.sendUserMessage(question);
      }else{
        pendingMessageRef.current=question;
        await conversation.startSession({agentId});
      }
    }catch(error){
      setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:error instanceof Error?error.message:'Unable to connect to the ElevenLabs agent.'}]);
    }
  }

  function toggleVoice(){
    if(!agentId||loading)return;
    if(!connected){
      void conversation.startSession({agentId});
      return;
    }
    conversation.setMuted(!conversation.isMuted);
  }

  function openAssistant(){setOpen(true)}
  function closeAssistant(){setOpen(false);if(connected)void conversation.endSession()}
  function submit(event:FormEvent){event.preventDefault();void send(input)}

  return <>
    <button type="button" className="home-assistant-trigger" onClick={openAssistant} aria-label="Open SiteSafe assistant"><Sparkles size={17}/><span>Ask the site assistant</span><MessageCircle size={16}/></button>
    <aside className={`home-assistant-drawer ${open?'open':''}`} aria-hidden={!open} aria-label="SiteSafe home assistant">
      <header><span className="home-assistant-logo"><Leaf size={17}/></span><div><strong>SiteSafe assistant</strong><small>ElevenLabs conversational AI</small></div><button type="button" onClick={closeAssistant} aria-label="Close assistant"><PanelRightClose size={19}/></button></header>
      <div className="home-assistant-note">A quick guide to the evidence and workflow behind SiteSafe.</div>
      <div className="home-assistant-thread" aria-live="polite">{messages.map(message=><div className={`home-assistant-message ${message.role}`} key={message.id}><span>{message.role==='assistant'?<Leaf size={14}/>:<Sparkles size={14}/>}</span><p>{message.content}</p></div>)}</div>
      <div className="home-assistant-prompts">{prompts.map(prompt=><button type="button" key={prompt} onClick={()=>void send(prompt)} disabled={loading||!agentId}>{prompt}</button>)}</div>
      <form className="home-assistant-input" onSubmit={submit}><textarea value={input} onChange={event=>setInput(event.target.value)} placeholder={agentId?'Ask a question...':'Add NEXT_PUBLIC_ELEVENLABS_AGENT_ID to enable chat'} rows={2} disabled={!agentId||loading} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void send(input)}}}/><div className="home-assistant-input-actions"><button type="button" className={`home-assistant-mic ${connected&&!conversation.isMuted?'active':''}`} onClick={toggleVoice} disabled={!agentId||loading} aria-label={connected&&!conversation.isMuted?'Mute microphone':'Start voice conversation'} title={connected&&!conversation.isMuted?'Mute microphone':loading?'Connecting microphone':'Start voice conversation'}>{connected&&!conversation.isMuted?<Mic size={17}/>:<MicOff size={17}/>}</button><button type="submit" disabled={!input.trim()||loading||!agentId} aria-label="Send message"><ArrowUp size={17}/></button></div></form>
      <p className="home-assistant-voice-status">{loading?'Connecting microphone...':connected?(conversation.isSpeaking?'Agent is speaking':conversation.isMuted?'Microphone muted':'Listening for your voice'):'Use the microphone to talk to SiteSafe'}</p>
      <p className="home-assistant-disclaimer">General guidance only. Investigate a property for source-backed answers.</p>
    </aside>
    {open&&<button type="button" className="home-assistant-backdrop" onClick={closeAssistant} aria-label="Close assistant"/>}
  </>;
}

export function HomeSiteAssistant(){return <ConversationProvider><AssistantPanel/></ConversationProvider>}
