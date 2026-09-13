import {describe,expect,it} from 'vitest';
import {POST} from '@/app/api/chat/route';
import {demoReports} from '@/lib/demo-data';

describe('SiteSafe copilot fallback',()=>{
  it('streams an exact financial widget when no API key is configured',async()=>{
    const previous=process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try{
      const response=await POST(new Request('http://localhost/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:[{role:'user',content:'What if cost per day is $1,200 and interruption extends to 14 days?'}],report:demoReports[0]}),
      }));
      expect(response.status).toBe(200);
      const events=(await response.text()).trim().split('\n').map(row=>JSON.parse(row));
      const tool=events.find(event=>event.type==='tool');
      expect(tool).toMatchObject({name:'calculateExposure',output:{interruptionCost:16800,totalLow:49300,totalHigh:146800}});
      expect(events.at(-1)).toEqual({type:'done',mode:'demo'});
    }finally{
      if(previous)process.env.OPENAI_API_KEY=previous;
    }
  });
});
