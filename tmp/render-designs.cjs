const fs = require('fs');
const path = require('path');
const sharp = require('./design-review/node_modules/sharp');
const root = path.resolve(__dirname, '..');
(async () => {
 const dir=path.join(root,'frontend/design/figma-exports');
 const files=fs.readdirSync(dir).filter(x=>x.endsWith('.svg'));
 for(let start=0;start<files.length;start+=6){
  const tiles=[];
  for(let i=start;i<Math.min(start+6,files.length);i++){
   const file=files[i];const x=((i-start)%3)*300;const y=Math.floor((i-start)/3)*700;
   const label=Buffer.from(`<svg width="300" height="28"><rect width="300" height="28" fill="white"/><text x="8" y="20" font-size="15">${file}</text></svg>`);
   const buf=await sharp(path.join(dir,file)).resize({width:290,height:665,fit:'inside'}).png().toBuffer();
   tiles.push({input:label,left:x,top:y},{input:buf,left:x+5,top:y+30});
  }
  await sharp({create:{width:900,height:1400,channels:4,background:'#ddd'}}).composite(tiles).png().toFile(path.join(root,`tmp/design-review/references-${start/6+1}.png`));
 }
 const assets=JSON.parse(fs.readFileSync(path.join(root,'tmp/design-review/assets.json')));
 for(let start=0;start<assets.length;start+=20){
  const tiles=[];
  for(let i=start;i<Math.min(start+20,assets.length);i++){
   const a=assets[i],x=((i-start)%5)*190,y=Math.floor((i-start)/5)*190;
   const buf=await sharp(path.join(root,'frontend/assets/design',a.file)).resize({width:180,height:150,fit:'inside'}).png().toBuffer();
   tiles.push({input:buf,left:x+5,top:y});
   tiles.push({input:Buffer.from(`<svg width="190" height="32"><rect width="190" height="32" fill="white"/><text x="3" y="19" font-size="11">${a.file}</text></svg>`),left:x,top:y+153});
  }
  await sharp({create:{width:950,height:760,channels:4,background:'#eee'}}).composite(tiles).png().toFile(path.join(root,`tmp/design-review/assets-${start/20+1}.png`));
 }
 console.log('Reference and original-asset inspection sheets rendered.');
})();
