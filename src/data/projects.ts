export type Role = 'engineer'|'manager'|'director'|'customer'|'investor'|'admin'|'partner'|'property';
export type Project = {id:string;name:string;model:string;floors:number;budget:number;expense:number;forecast:number;delivery:string;progress:number;published:number};
export type Evidence = {id:string;projectId:string;image:string;point:string;note:string;completion:number;status:'pending'|'approved'|'rejected';createdAt:string;reviewedAt?:string;reviewNote?:string;published:boolean};
export const projects:Project[]=[
 {id:'lakeview',name:'Lakeview Residences',model:'lakeview_concept.glb',floors:12,budget:12000000,expense:6200000,forecast:12600000,delivery:'2027-09-15',progress:45,published:45},
 {id:'toptani',name:'Toptani Shopping Center',model:'toptani_concept.glb',floors:4,budget:4200000,expense:1400000,forecast:4100000,delivery:'2027-03-20',progress:30,published:30},
 {id:'aba',name:'ABA Business Center',model:'aba_concept.glb',floors:20,budget:8500000,expense:5100000,forecast:8700000,delivery:'2027-06-10',progress:60,published:60}
];
export const roles:Role[]=['engineer','manager','director','customer','investor','admin','partner','property'];
export const initialEvidence:Evidence[]=[{id:'initial',projectId:'lakeview',image:'/demo-photos/site.png',point:'Front',note:'Synthetic demonstration photograph. Structural work reviewed.',completion:45,status:'approved',createdAt:'2026-10-20T10:00:00Z',reviewedAt:'2026-10-21T10:00:00Z',published:true}];
