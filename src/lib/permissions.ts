import type {Role} from '@/data/projects';
export const canReview=(role:Role)=>role==='manager'||role==='admin';
export const external=(role:Role)=>role==='customer'||role==='investor';
export const visibleProjects=(role:Role)=>['director','admin','manager'].includes(role)?['lakeview','toptani','aba']:role==='property'?['toptani']:['lakeview'];
