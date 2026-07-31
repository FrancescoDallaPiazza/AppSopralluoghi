const fs=require('fs');
const dec=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&amp;/g,'&');
function leggi(dir){
  const strs=[];
  if(fs.existsSync(dir+'/xl/sharedStrings.xml')){
    const ss=fs.readFileSync(dir+'/xl/sharedStrings.xml','utf8');
    for(const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g))
      strs.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>dec(x[1])).join(''));
  }
  const sh=fs.readFileSync(dir+'/xl/worksheets/sheet1.xml','utf8');
  const rows=[];
  for(const r of sh.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
    const cells={};
    for(const c of r[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)){
      const col=c[1],attrs=c[3];
      const vm=c[4].match(/<v>([\s\S]*?)<\/v>/);
      let val=vm?vm[1]:'';
      if(/t="s"/.test(attrs)) val=strs[+val]??'';
      else if(/t="inlineStr"/.test(attrs)){const im=c[4].match(/<t[^>]*>([\s\S]*?)<\/t>/);val=im?dec(im[1]):'';}
      cells[col]=val;
    }
    rows.push({r:+r[1],cells});
  }
  return rows;
}
module.exports={leggi};
