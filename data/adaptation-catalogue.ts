import {z} from 'zod';
import {money} from '../lib/schemas';
export const Action=z.object({id:z.string(),name:z.string(),category:z.enum(['bushfire','heat','flood']),low:money,high:money,effort:z.enum(['low','medium','high']),professional:z.boolean(),investigation:z.boolean(),assumptionDate:z.string(),sourceNote:z.string(),limitation:z.string()});
const base={assumptionDate:'2026-09-12',sourceNote:'SiteSafe prototype budgeting assumption; not a contractor quote. Edit these amounts to reflect your own research.',limitation:'Scope and cost depend on the site. Obtain local advice; no risk reduction is quantified.'};
export const catalogue=z.array(Action).parse([
 {...base,id:'bal',name:'Obtain a site-specific BAL assessment',category:'bushfire',low:600,high:1800,effort:'low',professional:true,investigation:true},
 {...base,id:'vegetation',name:'Review vegetation and defendable-space requirements',category:'bushfire',low:500,high:2000,effort:'medium',professional:true,investigation:true},
 {...base,id:'home-heat',name:'Investigate shading, insulation and reflective roofing',category:'heat',low:2000,high:15000,effort:'medium',professional:true,investigation:false},
 {...base,id:'warehouse-heat',name:'Review cool roofing, ventilation and worker heat management',category:'heat',low:5000,high:40000,effort:'high',professional:true,investigation:false},
 {...base,id:'farm-heat',name:'Review water storage, shade and livestock or crop heat management',category:'heat',low:3000,high:30000,effort:'high',professional:true,investigation:false},
 {...base,id:'flood-advice',name:'Obtain council or qualified flood advice',category:'flood',low:0,high:1500,effort:'low',professional:true,investigation:true}
]);
