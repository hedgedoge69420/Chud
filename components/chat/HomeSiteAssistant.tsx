'use client';
import {FormEvent,useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ConversationProvider,useConversation} from '@elevenlabs/react';
import {ArrowUp,Leaf,MessageCircle,Mic,MicOff,PanelRightClose,Sparkles} from 'lucide-react';

type Message={id:string;role:'user'|'assistant';content:string};
const prompts=['What does SiteSafe check?','How do I investigate a property?','What evidence will I see?'];
const agentId=process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
const conversationContext=(messages:Message[])=>messages.filter(message=>message.id!=='welcome').map(message=>`${message.role==='user'?'User':'SiteSafe assistant'}: ${message.content}`).join('\n');

function VoiceMic({agentId,open,messages,setMessages,stopVoiceRef}:{agentId:string|undefined;open:boolean;messages:Message[];setMessages:Dispatch<SetStateAction<Message[]>>;stopVoiceRef:React.MutableRefObject<(() => void)|null>}){
  const messagesRef=useRef(messages);
  const sendContextualUpdateRef=useRef<((text:string)=>void)|null>(null);
  messagesRef.current=messages;
  const conversation=useConversation({
    onMessage:message=>{
      setMessages(current=>[...current,{id:crypto.randomUUID(),role:message.role==='agent'?'assistant':'user',content:message.message}]);
    },
    onConnect:()=>{
      const context=conversationContext(messagesRef.current);
      if(context)sendContextualUpdateRef.current?.(`Conversation so far:\n${context}`);
    },
    onError:message=>setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:message}]),
  });
  sendContextualUpdateRef.current=conversation.sendContextualUpdate;
  const connected=conversation.status==='connected';
  const loading=conversation.status==='connecting';

  stopVoiceRef.current=()=>{
    if(conversation.status!=='disconnected')void conversation.endSession();
  };

  useEffect(()=>{
    if(!open&&connected)void conversation.endSession();
  },[connected,conversation,open]);

  async function toggleVoice(){
    if(!agentId||loading)return;
    if(!connected){
      try{await conversation.startSession({agentId})}catch(error){
        setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:error instanceof Error?error.message:'Unable to connect to the ElevenLabs voice agent.'}]);
      }
      return;
    }
    await conversation.endSession();
  }

  return <><button type="button" className={`home-assistant-mic ${connected?'active':''}`} onClick={()=>void toggleVoice()} disabled={!agentId||loading} aria-label={connected?'Stop voice conversation':'Start voice conversation'} title={connected?'Stop voice conversation':loading?'Connecting microphone':'Start voice conversation'}>{connected?<Mic size={17}/>:<MicOff size={17}/>}</button><span className="home-assistant-voice-status">{loading?'Connecting microphone...':connected?(conversation.isSpeaking?'Agent is speaking':'Listening for your voice'):'Use the microphone to talk to SiteSafe'}</span></>;
}

function AssistantPanel(){
  const pendingMessageRef=useRef<string|null>(null);
  const sendUserMessageRef=useRef<((message:string)=>void)|null>(null);
  const sendContextualUpdateRef=useRef<((text:string)=>void)|null>(null);
  const stopVoiceRef=useRef<(() => void)|null>(null);
  const conversation=useConversation({
    textOnly:true,
    onConnect:()=>{
      const context=conversationContext(messages);
      if(context)sendContextualUpdateRef.current?.(`Conversation so far:\n${context}`);
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
  sendContextualUpdateRef.current=conversation.sendContextualUpdate;
  const [open,setOpen]=useState(false);
  const [input,setInput]=useState('');
  const [messages,setMessages]=useState<Message[]>([{id:'welcome',role:'assistant',content:'Hi, I’m the SiteSafe assistant. Ask me how the screening works, what evidence it uses, or where to begin.'}]);
  const connected=conversation.status==='connected';
  const loading=conversation.status==='connecting';

  async function send(text:string){
    const question=text.trim();
    if(!question||loading||!agentId)return;
    stopVoiceRef.current?.();
    setMessages(current=>[...current,{id:crypto.randomUUID(),role:'user',content:question}]);
    setInput('');
    try{
      if(connected){
        const context=conversationContext(messages);
        if(context)conversation.sendContextualUpdate(`Conversation so far:\n${context}`);
        conversation.sendUserMessage(question);
      }else{
        pendingMessageRef.current=question;
        await conversation.startSession({agentId});
      }
    }catch(error){
      setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:error instanceof Error?error.message:'Unable to connect to the ElevenLabs agent.'}]);
    }
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
      <form className="home-assistant-input" onSubmit={submit}><textarea value={input} onChange={event=>setInput(event.target.value)} placeholder={agentId?'Ask a question...':'Add NEXT_PUBLIC_ELEVENLABS_AGENT_ID to enable chat'} rows={2} disabled={!agentId||loading} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void send(input)}}}/><div className="home-assistant-input-actions"><ConversationProvider><VoiceMic agentId={agentId} open={open} messages={messages} setMessages={setMessages} stopVoiceRef={stopVoiceRef}/></ConversationProvider><button type="submit" disabled={!input.trim()||loading||!agentId} aria-label="Send message"><ArrowUp size={17}/></button></div></form>
      <p className="home-assistant-disclaimer">General guidance only. Investigate a property for source-backed answers.</p>
    </aside>
    {open&&<button type="button" className="home-assistant-backdrop" onClick={closeAssistant} aria-label="Close assistant"/>}
  </>;
}

export function HomeSiteAssistant(){return <ConversationProvider><AssistantPanel/></ConversationProvider>}
