export async function simulateReconstruction(images:number,onProgress:(progress:number)=>void){
 if(images<3)throw Error('Select at least three overlapping views for this demonstration. This threshold does not establish photogrammetry suitability.');
 for(const progress of [10,30,55,80,100]){await new Promise(resolve=>setTimeout(resolve,450));onProgress(progress);}
 return {model:'/models/lakeview_concept.glb',simulated:true,label:'Simulated preview — prebuilt architectural concept. No model was reconstructed from your photographs.'};
}
