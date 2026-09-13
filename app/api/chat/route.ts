import OpenAI from 'openai';
import {z} from 'zod';
import {calculateScenario} from '@/lib/financial-scenarios';
import {recommendations} from '@/lib/recommendations';
import {Report} from '@/lib/schemas';

export const runtime='edge';

const ChatRequest=z.object({
  messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(1500)})).min(1).max(12),
  report:Report,
});
const FinancialArgs=z.object({
  damageRatioLow:z.number().min(0).max(1),
  damageRatioHigh:z.number().min(0).max(1),
  interruptionDays:z.number().int().min(0).max(3650),
  costPerDay:z.number().min(0).max(1_000_000),
});
const ChartArgs=z.object({
  chartType:z.enum(['historical_vs_projection','adaptation_costs']),
  title:z.string().max(100),
});

type SiteReport=z.infer<typeof Report>;
const encoder=new TextEncoder();
const line=(value:unknown)=>encoder.encode(`${JSON.stringify(value)}\n`);

function compact(report:SiteReport){
  return {
    address:report.location.address,
    intendedUse:report.context.use,
    assetValue:report.context.assetValue,
    holdingYears:report.context.holdingYears,
    bushfireIntersection:report.bushfire,
    historical:report.history?{period:report.history.provenance.period,medians:report.history.medians,annual:report.history.annual}:null,
    projections:report.projections,
    findings:report.findings.map(({id,title,finding,interpretation,limitation})=>({id,title,finding,interpretation,limitation})),
    sources:report.sources.map(({id,name,status})=>({id,name,status})),
    approvedActions:recommendations(report).map(({id,name,low,high,reason,limitation})=>({id,name,low,high,reason,limitation})),
  };
}

function financialWidget(report:SiteReport,args:z.infer<typeof FinancialArgs>){
  return calculateScenario({
    assetValue:report.context.assetValue,
    lowDamageRatio:Math.min(args.damageRatioLow,args.damageRatioHigh),
    highDamageRatio:Math.max(args.damageRatioLow,args.damageRatioHigh),
    interruptionDays:args.interruptionDays,
    interruptionCostPerDay:args.costPerDay,
  });
}

function chartWidget(report:SiteReport,args:z.infer<typeof ChartArgs>){
  if(args.chartType==='adaptation_costs'){
    return {...args,data:recommendations(report).map(({name,low,high})=>({name,low,high})),unit:'AUD'};
  }
  return {
    ...args,
    historical:report.history?.annual??[],
    projections:report.projections.map(({indicator,minimumChange,medianChange,maximumChange})=>({indicator,minimum:minimumChange,median:medianChange,maximum:maximumChange})),
    unit:'days/year',
  };
}

function fallback(message:string,report:SiteReport){
  const lower=message.toLowerCase();
  if(lower.includes('graph')||lower.includes('chart')){
    const costs=lower.includes('cost');
    return {
      text:'I have prepared an interactive view from the validated report data. Historical values are ERA5-Land reanalysis; future values are same-model CMIP6 changes against 1981-2010.',
      tool:{name:'renderChart' as const,output:chartWidget(report,{chartType:costs?'adaptation_costs':'historical_vs_projection',title:costs?'Adaptation option cost ranges':'Historical heat and projected change'})},
    };
  }
  const day=lower.match(/(?:cost per day|per day)[^\d$]*\$?([\d,]+)/);
  const duration=lower.match(/(\d+)\s*days?/);
  if(lower.includes('cost')||lower.includes('financial')||lower.includes('exposure')){
    const args={damageRatioLow:.05,damageRatioHigh:.2,interruptionDays:duration?Number(duration[1]):7,costPerDay:day?Number(day[1].replaceAll(',','')):500};
    return {
      text:'Here is the exact illustrative impact range using the current exposed asset value and visible scenario assumptions. No event probability is applied, so this is not expected loss.',
      tool:{name:'calculateExposure' as const,output:financialWidget(report,args)},
    };
  }
  const actions=recommendations(report);
  const bushfire=report.bushfire===true
    ?'The Vicmap Bushfire Prone Area intersection means a site-specific BAL assessment should be prioritised.'
    :'No Vicmap intersection was returned; that does not establish low bushfire risk.';
  return {text:`For ${report.location.address}, SiteSafe first resolves public evidence, then separates mapped exposure from climate-model change. ${bushfire} Flood evidence remains not assessed. Current approved next steps include ${actions.map(a=>a.name).join('; ')}. These are due-diligence prompts, not engineering, insurance or legal conclusions.`};
}

export async function POST(request:Request){
  const parsed=ChatRequest.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:'Invalid copilot request.'},{status:400});
  const {messages,report}=parsed.data;
  const last=messages.at(-1)?.content??'';
  const stream=new ReadableStream({
    async start(controller){
      const send=(value:unknown)=>controller.enqueue(line(value));
      try{
        if(!process.env.OPENAI_API_KEY){
          const result=fallback(last,report);
          for(const token of result.text.split(/(\s+)/)){
            send({type:'delta',text:token});
            await new Promise(resolve=>setTimeout(resolve,12));
          }
          if(result.tool)send({type:'tool',...result.tool});
          send({type:'done',mode:'demo'});
          controller.close();
          return;
        }
        const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
        const response=await client.responses.create({
          model:process.env.OPENAI_MODEL||'gpt-5',
          store:false,
          stream:true,
          instructions:'You are SiteSafe AI Copilot, a concise climate due-diligence analyst. Use only supplied report facts and approved actions. Structure explanations through public data, financial exposure, required assessments, adaptation options, and decision implications. Never invent numbers, probabilities, risk ratings, insurance outcomes, legal conclusions, or new actions. State that missing evidence is not assessed. Use a function tool whenever a chart or calculation is requested.',
          input:`Validated property context:\n${JSON.stringify(compact(report))}\n\nConversation:\n${messages.map(message=>`${message.role}: ${message.content}`).join('\n')}`,
          tools:[
            {type:'function',name:'calculateExposure',description:'Calculate an illustrative impact scenario using the report asset value and explicit user assumptions.',strict:true,parameters:{type:'object',properties:{damageRatioLow:{type:'number',minimum:0,maximum:1},damageRatioHigh:{type:'number',minimum:0,maximum:1},interruptionDays:{type:'integer',minimum:0,maximum:3650},costPerDay:{type:'number',minimum:0,maximum:1000000}},required:['damageRatioLow','damageRatioHigh','interruptionDays','costPerDay'],additionalProperties:false}},
            {type:'function',name:'renderChart',description:'Render an approved interactive chart using only validated report or catalogue data.',strict:true,parameters:{type:'object',properties:{chartType:{type:'string',enum:['historical_vs_projection','adaptation_costs']},title:{type:'string'}},required:['chartType','title'],additionalProperties:false}},
          ],
        });
        for await(const event of response){
          if(event.type==='response.output_text.delta')send({type:'delta',text:event.delta});
          if(event.type==='response.output_item.done'&&event.item.type==='function_call'){
            if(event.item.name==='calculateExposure'){
              const args=FinancialArgs.parse(JSON.parse(event.item.arguments));
              send({type:'tool',name:event.item.name,output:financialWidget(report,args)});
            }
            if(event.item.name==='renderChart'){
              const args=ChartArgs.parse(JSON.parse(event.item.arguments));
              send({type:'tool',name:event.item.name,output:chartWidget(report,args)});
            }
          }
        }
        send({type:'done',mode:'live'});
        controller.close();
      }catch(error){
        send({type:'error',message:error instanceof Error?error.message:'Copilot request failed.'});
        controller.close();
      }
    },
  });
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff'}});
}
