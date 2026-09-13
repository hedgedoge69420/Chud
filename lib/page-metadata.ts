import type {Metadata} from 'next';
const description='Traceable Victorian bushfire and extreme-heat evidence, transparent scenarios, and practical climate due-diligence actions.';
export function pageMetadata(title:string,pageDescription=description):Metadata{return {title:{absolute:title},description:pageDescription,openGraph:{title,description:pageDescription,type:'website',siteName:'SiteSafe',locale:'en_AU'},twitter:{card:'summary',title,description:pageDescription},icons:{icon:'/icon.svg'}}}
