
/*

*/


//HACK probably a better method
function hex(integer, chars=2){
    var s = Number(integer).toString(16);
    let caps = {
        'a':'A',
        'b':'B',
        'c':'C',
        'd':'D',
        'e':'E',
        'f':'F'
    }
    while (s.length < chars){
        s = "0"+s;
    }
    return s.replace(/[abcdef]/g, m => caps[m]);
}
//binar(0x8fff,16)
function binar(integer,bit=8,sp=0){
    // assumes 8-bits
    // if space is specified, will add a narrow non-breaking space
    // every sp characters, and a space before and after the string.
    let str = "";
    let b1 = bit-1;
    let mask = 1 << b1;
    for (let i=0; i<bit; i++){
        str+= `${ (integer  & (mask >> i)) >> (b1-i)}`;
        if (sp) if ( (i+1)%sp==0) str+= "&#8239;";
        // if (sp) if ( (i+1)%sp==0) str+= " ";
    }
    return `${sp!=0?"&#8239;":""}${str}`;
    // return `${sp!=0?" ":""}${str}`;
}
// version specifically for html titles, and other non-html character sets (?)
function binart(integer,bit=8,sp=0){
    // assumes 8-bits
    // if space is specified, will add a narrow non-breaking space
    // every sp characters, and a space before and after the string.
    let str = "";
    let b1 = bit-1;
    let mask = 1 << b1;
    for (let i=0; i<bit; i++){
        str+= `${ (integer  & (mask >> i)) >> (b1-i)}`;
        // if (sp) if ( (i+1)%sp==0) str+= "&#8239;";
        if (sp) if ( (i+1)%sp==0) str+= " ";
    }
    // return `${sp!=0?"&#8239;":""}${str}`;
    return `${sp!=0?" ":""}${str}`;
}
// This generates a 2D array pre-filled with zeros. Much like np.zeros() in python.
// Probably pretty efficient...?
function zeros(m,n){
  return [...Array(m)].map( d => Array(n).fill(0));
}


// grayscale palette
// Array.from(Array(16).keys()).map(d=>[Math.round(255*d/16),Math.round(255*d/16),Math.round(255*d/16)])
const pal = [
    [ 0, 0, 0 ],       [ 16, 16, 16 ],
    [ 32, 32, 32 ],    [ 48, 48, 48 ],
    [ 64, 64, 64 ],    [ 80, 80, 80 ],
    [ 96, 96, 96 ],    [ 112, 112, 112 ],
    [ 128, 128, 128 ], [ 143, 143, 143 ],
    [ 159, 159, 159 ], [ 175, 175, 175 ],
    [ 191, 191, 191 ], [ 207, 207, 207 ],
    [ 223, 223, 223 ], [ 239, 239, 239 ]
  ];


function unbitplane(input){
    // Takes SNES 4 bit-per-pixel (4bpp) data and rearranges into image data.
    // Usage:
    // opim=unbitplane(op4);
    //NOTE: for the opposite process, probably want to use .flatmap()
    // returns

    var output = [];
    // 32 bytes in a tile
    for (var tileIndex = 0; tileIndex<(input.length); tileIndex+=32){
        // console.log("Tile index "+tileIndex);
        let tile = [];
        for (var rowIndex = 0; rowIndex < 8; rowIndex++){
            // console.log("Row index "+rowIndex);
            let row = [
                input[tileIndex + (rowIndex*2) ],
                input[tileIndex + (rowIndex*2) + 1],
                input[tileIndex + (rowIndex*2) + 16],
                input[tileIndex + (rowIndex*2) + 17]
            ];
            let rowOut = [];
            // This uses a lot of bit masking and stuff.
            // Essentially, we go through each column, masking the nth bit of each bitplane,
            // or'ing them together into the appropriate significant bits, then shift back.
            for (columnIndex = 0; columnIndex < 8; columnIndex++){
                let columnValue = 0;
                for (bitplaneIndex = 0; bitplaneIndex < 4; bitplaneIndex++){ // previously was < 8, error?
                    columnValue |= ( row[bitplaneIndex] & (0b10000000 >> columnIndex) ) << bitplaneIndex;
                }
                rowOut.push( columnValue >> ( 7 - columnIndex) );
            }
            tile.push(rowOut);
            // ------------debug
            // console.log();
            var str = [];
            rowOut.forEach( (x, i) => {
                // console.log(x);
                str.push(hex(x));
            });
            // console.log(str.join(" "));
            // -------------------------
        }
        output.push(tile);
    }
    return output;
}




function snes2rgb(color){
  // converts the SNES two-byte RGB (5bits per color channel, plus extra bit)
  // into typical RGB.
  // SNES two-byte format is 0bbb bbgg gggr rrrr
  // so, for each color channel, we shift the number to the right by the appropriate
  // amount to get that channel aligned on the right (red is already aligned),
  // then AND it with 0b11111 to get only those 5 bits, then shift that back by 3 (*2 *2 *2 = *8).
  // then we add the floor division of this by 32.
  //NOTE: this multiplies by 8; actual SNES uses a slightly more advanced conversion...?

  // ( uses ~~(a/b), not Math.floor() floor division, for efficiency:
  // behaves differently for negative numbers; not of concern here)
  return [
    (color & 0b11111) << 3,
    ( (color >> 5) & 0b11111) << 3,
    ( (color >> 10) & 0b11111) << 3
  ].map(d => d + ~~(d/32));

}

function rgb2snes(rgb){
  // return ((rgb[0]>>3) & 0xFF) + (((rgb[1]>>3) & 0xFF) << 5) + (((rgb[2]>>3) & 0xFF) << 10)
  return rgb.reduce(
    (sum,val,i) => sum + (( (val>>3) & 0xFF) << (i*5)) ,0
  );
}
//(val,i) => (( (val>>3) & 0xFF) << (i*5))

function palette2rgb(inp, offset=0){
  let input = inp.slice(offset);

  var output = [];
  for (let i=0; i<input.length; i+=2){
    output.push( snes2rgb(
      // (input[i] << 8) + input[i+1] /* not swapped */
      (input[i+1] << 8) + input[i]  /* swapped */

    ) );
    // console.log(`Color ${snes2rgb( (input[i] << 8) + input[i+1] ) }` );
  }
  return output;
}


// sort of a wrapper
function transpose(a){
    return a.map((_,i) => a.map(r=>r[i]));
  }
  function wrapColumns(a,columns){
    b = [];
    while(a.length) b.push(a.splice(0,columns));
    return b;
  }
  function wrapRows(a,rows){
    // kind of a lazy wrapper
    return transpose( wrapColumns(a, rows) );
  }
  function block(a){
    // converts an M x N x m x n array to M*n x N*n
    // assumes all sub-arrays are same size 
    // (though M,N,m, and n can all be different from each other)
    // let i = a.length*a[0][0].length, j = a[0].length*a[0][0][0].length;
    let Mm = a.reduce((s,d,i)=>s+=d[0].length, 0);
    let Nn = a[0].reduce((s,d,i)=>s+=d[0].length, 0)
    b = Array.from(Array(Mm).keys()).map(_=>[]);
    let i = 0;
    a.forEach((R,I)=>{
      R.forEach( (subm,J) => subm.forEach((r,ii) => b[i+ii].push(...r) ) );
      i+=R[0].length;
    });
    return b;
  }
   
  function prepMetatile(mt,pal){
    mt = {...mt}; // hopefully breaks reference because we'll be reversing and stuff
    // first, create the merged 32x32 px 2d array.
    // we will flip the sub tiles while here.
    var px = [  [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], 
                [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], ];
  
    //NOTE: subtile.vflip and hflip were already done by this point.
    // if we needed to do them again for some reason:
    // if (st.vflip) st.colorIndices.slice().reverse(); // already flipped in metatile object
    // row = st.hflip ? row.slice().reverse() : row.slice(); // already flipped in metatile object
  
    mt.metatile.forEach( (st,sti)=>{
      let p = (st.paletteIndex<<4); // *16
      let stro = (sti>>2)<<3; // 0, 8, 16, or 24
      st.colorIndices.forEach( (row,ri) => px[stro+ri].push( ...row.map(co=>pal[p+co]) ) );
    });
    if (mt.vflip) px.reverse();
    if (mt.hflip) px.forEach((d,i)=>px[i]=d.slice().reverse());
    return px;
  }
  // prepMetatile(mts[0],pall);
  
  //
  function metatile(tiles, tilemap32){
  
    console.log(`Indexing metatiles...`);
    var tl = 8; // good placeholder for future...?
  
    var word = 0;
    var vflip = 0;
    var hflip = 0;
    var strow, stcof, rof, cof;
    var metatiles = [];  //TODO: modify so we initialize as one X x m x n array of zeros?
    var metatilesObj = [];
    var metatile;
    var overflows = [];
    let mtstr = [ ["","","",""],["","","",""],["","","",""],["","","",""]]; //HACK: not very clean
    let mtidx = 0;
    let metatileObj = [];
    let stobj = {paletteIndex: 0, colorIndices: zeros(8,8)};
    let stobjs = [];
  
    for ( let idx = 0; idx < tilemap32.length; idx+=2 ){
  
      mtidx = idx>>5; // same as floor dividing by 32
      // if starting the next metatile:
      if ( (((idx/2)) % 16 == 0) )  {
        // console.log(`Metatile ${idx/32}`);
        metatile = zeros(32, 32); // initially filled with zeros
        stobjs = [];
      }
  
      // Get the next 2 bytes, treat this as a word.
      // This word is the starting address within the existing OUTPUT data
      // from which to extract <detail> number of bytes
      // word = tilemap32[idx+1] | (tilemap32[idx] << 8); // not swapped
      word = tilemap32[idx] | (tilemap32[idx+1] << 8); // swapped
      // vh?t tttt tttt tttt // nope
      // vhPp pptt tttt tttt // yep
      vflip = (0x8000 & word) >> 15; // leftmost bit of the word (bit 0)
      hflip = (0x4000 & word) >> 14; // second leftmost bit (bit 1)
      prior = (0x2000 & word) >> 13; // bit 2
      palet = (0x1c00 & word) >> 10; // bit 3-5
      tilex = (0x03ff & word); // 10 rightmost bits (bits 6-15)
  
  
      // Get the row offset and column offset associated with
      // this submatrix/block within the metatile.
      // divide by 2 because each tile is represented by 2 bytes
      // floor divide by 4 (aka >> 2) and mod 4
  
      // get the 8x8 "subtile" indices
      strof = (( ((idx/2)%16)>>2 ));
      stcof = ((idx/2) %4);
      strof = Math.floor( ((idx/2)%16)/4 );
      mtstr[strof][stcof] = `${vflip},${hflip},${palet}`;
  
      // stcof = ((idx/2) %4)
      // now multiply that by the number of pixels in a subtile (usually 8)
      rof = tl*strof;
      cof = tl*stcof;
  
      // [["1","2"],["3","4"]].reduce((sum,d) => sum+="\n"+d.join(" "),"")
      // [["1","2"],["3","4"]].map((d) => d.join(" ")).join("\n")
  
      // console.log(`\nidx ${idx} (${strof},${stcof}): ${hex(word,4)} / ${binar(word,16)}\t  ${tileIndex}\t  /2=${tileIndex/2}`);
      // console.log(`(tile index ${(tiles[tileIndex])})`);
  
      // for ( let row = vflip ? 7 : 0; vflip ?( row > -1) : (row < 8); vflip ? row-- : row++){
      var tilestr = ``;
      var rowstr;
  
      stobjs.push( {
        paletteIndex: palet,
        colorIndices: zeros(8,8),
        tileIndex: tilex,
        vflip: vflip,
        hflip: hflip
      } );
  
      for ( let row = 0; row < tl;  row++){
        rowstr = ``;
        for ( let col = 0; col < tl;  col++){
          0;
          // rowstr += `${hex(tileIndex,4).slice(1)} `;
          // rowstr += ( `${rof + row},${cof + col}|${vflip?7-row:row},${hflip?7-col:col}  `);
  
          // index backwards from the end, if vflip and/or hflip:
          // console.log([hex(word,4), binar(word,16), binar(tileIndex,16), vflip?7-row:row, hflip?7-col:col]);
          if (tiles[tilex]){
            // console.log(`Tile inde xis ok. rof + row: ${rof + row}; cof + col ${cof + col}`);
  
            metatile[rof + row][cof + col] = tiles[tilex][vflip?7-row:row][hflip?7-col:col];
            stobjs[stobjs.length-1].colorIndices[row][col] = tiles[tilex][vflip?7-row:row][hflip?7-col:col];
  
          }
  
          else{
            0;
            overflows.push(tilex)
            // console.log(`Tile index too big!! rof + row: ${rof + row}; cof + col ${cof + col}`);
          };
        }
        tilestr+=`${rowstr}\n`;
      }
  
      // console.log(tilestr);
      // console.log(metatile);
  
      // push this if we're on the last of the 16 tiles.
      if ( (((idx/2)+1) % 16 == 0) )  {
        // metatiles.push( metatile ); old method, didn't include palette indices
        metatilesObj.push(stobjs);
        // console.log(mtstr);
        // console.log(`Metatile ${mtidx}:\n${mtstr.map((d) => d.join(" ")).join("\n")}`);
      }
  
    }
  
    // console.log(`Metatile: overflows from available tiles (${overflows.length} total).`);
    // console.log(overflows);
  
    // return metatiles;
    return metatilesObj;
  
  
  }
  
  
  function levelMap(metatiles, levelmetatiles){
  
    console.log(`Indexing level map...`);
    var tl = 8; // good placeholder for future...?
  
    var word = 0;
    var vflip = 0;
    var hflip = 0;
  
    let overflows = [];
    let levelobjs = [];
  
  
    for ( let idx = 0; idx < levelmetatiles.length; idx+=2 ){
  
      // Get the next 2 bytes, treat this as a word.
      // word = levelmetatiles[idx+1] | (levelmetatiles[idx] << 8); // not swapped
      word = levelmetatiles[idx] | (levelmetatiles[idx+1] << 8); // swapped
      // vh?t tttt tttt tttt // nope
      // vhPp pptt tttt tttt // yep
      vflip = (0x8000 & word) >> 15; // leftmost bit of the word (bit 0)
      hflip = (0x4000 & word) >> 14; // second leftmost bit (bit 1)
      prior = (0x2000 & word) >> 13; // bit 2 ...?
      tilex = (0x1fff & word); // 13 rightmost bits (bits 4-15)
  
      if (metatiles[tilex]){
        //TODO: would this cause an issue because we're sort of passing by reference...?
        levelobjs.push( { metatile: metatiles[tilex], vflip: vflip, hflip: hflip} );
      }
      else{
        overflows.push(tilex);
      }
  
    }
  
    // console.log(`Level Metatiles: overflows from available tiles (${overflows.length} total):`);
    // console.log(overflows);
  
    // return metatiles;
    return levelobjs;
  
  }

// canvas display functions.
// could be moved to another file...?
function displayRaw(dat, parent, sc=1){
  
    // console.log(dat);
    var canvas = document.createElement("canvas");
    // canvas.id = "canvas";
    canvas = parent.appendChild(canvas);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    var w = dat.length;
    var h = dat[0].length;
  
    canvas.width = sc * w;
    canvas.height = sc * h;
  
    var ctx = canvas.getContext("2d");
  
    for (let rowIndex = 0; rowIndex < dat.length; rowIndex++){
    
      for (let columnIndex = 0; columnIndex < dat[rowIndex].length; columnIndex++){
  
        // let fill = "#"+pal[ dat[tileIndex][rowIndex][columnIndex] ].map(d => hex(d)).join("")+"ff";
  
        ctx.fillStyle = `rgb(${dat[rowIndex][columnIndex].join()})`;
        ctx.fillRect(columnIndex*sc, rowIndex*sc, sc, sc);
  
        // rowstr+="R_"+rowIndex+";C_"+columnIndex+":_"+fill;
        // console.log([rowIndex*sc, tileIndex*8*sc + rowIndex*sc, sc, sc]);
      }
    }
  
    return canvas;
}
  
function display(dat, parent, palette, sc=1, title=null, classes=null){
    // use canvas to display image. Maybe try integrer scaling, and pixel-rendering CSS stuff for better look.
    // console.log(dat);
    // sc is pexel scale
    // const sc = 4; // integer scale for canvas

    var canvas = document.createElement("canvas");
    // canvas.id = "canvas";
    canvas = parent.appendChild(canvas);
    var w = dat[0].length;
    var h = dat[0][0].length;
    canvas.className = "tile_item";
    canvas.width = sc * w;
    canvas.height = dat.length*sc * h;
    if (title) canvas.title = title;
    if (classes) classes.forEach(d=>canvas.classList.add(d));
    var ctx = canvas.getContext("2d");
    // var pixels = new Uint8ClampedArray(8*8*4);
    for (var tileIndex = 0; tileIndex<(dat.length); tileIndex++){
    //TODO: can remove this outermost loop through tiles; this func is only ever called for 1, wrpped in an array???
        // let rowstr = "";
        for (let rowIndex = 0; rowIndex < dat[tileIndex].length; rowIndex++){

            for (let columnIndex = 0; columnIndex < dat[tileIndex][rowIndex].length; columnIndex++){

                let px = palette[ dat[tileIndex][rowIndex][columnIndex] ];
                // console.log(dat[tileIndex][rowIndex][columnIndex]);
                // console.log(px);
                // let fill = "#"+pal[ dat[tileIndex][rowIndex][columnIndex] ].map(d => hex(d)).join("")+"ff";
                let fill = `rgba(${px[0]}, ${px[1]}, ${px[2]}, 255)`;
                ctx.fillStyle = fill;
                ctx.fillRect(columnIndex*sc, (tileIndex*h*sc) + (rowIndex*sc), sc, sc);

                // rowstr+="R_"+rowIndex+";C_"+columnIndex+":_"+fill;
                // console.log([rowIndex*sc, tileIndex*8*sc + rowIndex*sc, sc, sc]);
            }
        }
        // console.log(rowstr);
    }

    // .putImageData(value, x, y);

    // let df = dat.flat();
    // let cvim = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // console.log(cvim);
    // for (i=0; i<cvim.length/4;i++){
    //     let px = pal[df[i]];
    //     let ii = 4*i;
    //     cvim[ii] = px[0];
    //     cvim[ii+1] = px[1];
    //     cvim[ii+2] = px[2];
    //     cvim[ii+3] = 255;
    // }
    // console.log(cvim);
    // ctx.putImageData(cvim,0,0);
    return canvas;

}