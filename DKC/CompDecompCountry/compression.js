
// decompression for DKC1 graphics
function chrDecompress(inp, offset=0){
    // the decompression function.
    // After a block of data dedicates to a look up table,
    // the compressed data consists of spans of data, each starting with a
    // command / control byte. There are 4 types of commands modes.
    let input = inp.slice(offset);
    const modeNames = ["Copy", "RLE", "History", "LUT"];

    var index = 128; // index of byte within data;
    // start after the LUT of 64 16-bit words (64*2=128).
    var output = [];
    var highestDiff = 0, diff=0;
    while(index < input.length){
        var control = input[index]; // or "command"
        var mode = control >> 6; // same as extracting leftmost 2 bits
        var detail = control & 0b00111111; // extracts rightmost 6 bits
        // console.log(modeNames[mode]+": "+detail);
        switch(mode){
            // COPY
            case 0:
                // here, the detail refers to number of subsequent bytes to copy
                for (let i = 1; i <= detail; i++){
                    output.push(input[index + i]);
                }
                // output.push(input.slice(index + 1, index + 1 + detail));
                index += 1 + detail;
                break;
            // Run-length Encoding ("RLE")
            case 1:
                // here, the detail refers to number of times to copy the subsequent byte
                for (let i = detail; i > 0; i--){
                    output.push(input[index+1]);
                }
                index += 2;
                break;
            // HISTORY
            case 2:
                // Get the next 2 bytes, swap them, treat this as a word.
                // This word is the starting address within the existing OUTPUT data
                // from which to extract <detail> number of bytes
                let addr = input[index+1] | (input[index+2] << 8);
                output.push(...output.slice(addr, addr + detail));
                diff = output.length-addr;
                highestDiff = Math.max(highestDiff,diff);
                // console.log(`HISTORY: addr ${addr} to index ${output.length} (dec) = ${diff} / 0x${hex(diff,6)}`);
                index += 3;
                break;
            // Lookup Table ("LUT")
            case 3:
                // Take the detail and << 1. This value is our lookup table address.
                // take the 2 bytes of data starting at this address within the input.
                var lutAddress = detail << 1; // Multiplies by 2, ensures evenness
                output.push( input[lutAddress] );
                output.push( input[lutAddress+1] );
                index += 1;

                break;

        }
    }
    console.log(`Decompressed ${input.length} bytes to ${output.length} bytes.`);
    console.log(`Highest difference in offsets for History mode: ${highestDiff} / 0x${hex(highestDiff,6)}`);
    // return new Uint8Array(output);
    return output;
}




// compression for DKC1 graphics
function chrCompress(input){
    console.log(`Compressing ${input.length} bytes...`);
  
    var output = []; // new Uint8Array(); // UInt8Array might be nice but it lacks convenience methods?
  
    //    Lookup Table (LUT)
    //
    // This will be a table of 64 2-byte values, to be used in mode 3.
    // initialize the LUT as all possible 2-byte values, 0 to 65,535.
    var lut = Array(0x10000).fill(0).map((d,i)=>{return {value:i,count:0}});
        
    // iterate through the input array in 2-byte increments, counting occurrences of the values
    //NOTE: starting at 32 to skip over the first 32-byte tile, assumed to be all 00s...
    // alternatives would be to start at 0, 1, or 33 (odds might be less efficient?)
    for (let i=32; i<(input.length-2); i+=2) {
        // console.log(`${i}: ${(input[i+1]<<8) | input[i]}`);
        lut[(input[i+1]<<8) | input[i]].count++;
    }
  
    // sort by descending occurrence, and take only the first 64
    lut = lut.sort((a,b)=> b.count-a.count ).slice(0,64);
  
    // sort by descending swapped-bytes-value (unnecessary, but used in some implementations?)
    // lut.sort((a,b)=> b.value - a.value );
    
    // apply the LUT values to the output
    for (let i=0; i<64; i++) output.push( ...[lut[i].value & 0xff, lut[i].value >> 8]);
    // console.log("LUT"+output.map((d,i)=>(i%16?(i%2?'':'  '):'\n')+hex(d,2)).join(" ")); // print LUT
  
    // create a reverse lookup table. tul[<value>] = <LUT index>, whereas lut[<LUT index>] = <value>
    var tul = {}; for (let i=0; i<64; i++) tul[lut[i].value] = i;
  
    //    STEPS
    //
    // Each byte will get a step object. 
    // We will link some of these to each other in a chain of compression spans or blocks.
    // define the Step class
    class Step {
      constructor(link=null, used=0xffff, mode=0, count=0, address=0, index=null){
        this.link = link; // the previous span in the sequence
        this.used = used; // basically, how much data is used (we want to minimize this)
        this.mode = mode; // 
        this.count = count;
        this.address = address; // used in some modes
        this.next = null; // will be the next span in the sequence
        this.index = index;
      }
      // during our iterations testing the different modes, 
      // if we find a more efficient mode, we overwrite.
      overwrite(link, used, mode, count, address=this.address){
        this.link = link;
        this.used = used;
        this.mode = mode;
        this.count = count;
        this.address = address;
      }
      // Once we've tested all modes and have everything linking to a previous step,
      // we work backwards and save a reference to the next step, using this chain()
      chain(){
        if (this.link) {
          this.link.next = this;
          this.link.chain();
        }
      }
    }
  
    // create all the steps
    var steps = Array(input.length+1).fill().map( (d,i)=> new Step(null,0xffff,0,0,0,i) );
    steps[0].used = 0; // initialize the first step
  
    //  TEST THE MODES
    //
    // define what to do for each mode's check/test
    // Mode 0. Basically lack of compression, just copies over a span of byte literals.
    function mode0(i){
      for (let j=1; j<Math.min(64,input.length+1-i); j++) 
        if ( (steps[i].used+1+j) < steps[i+j].used )
          steps[i+j].overwrite(steps[i], steps[i].used+1+j, 0, j);
    }
    // Mode 1. Run-length encoding. Duplicate a byte n times.
    function mode1(i){
      var limit = Math.min(64,input.length-i);
      var j = 1;
      while (j < limit) if (input[i+j++] != input[i]) break;
      while (j--) 
        if ( (steps[i].used+2) < steps[i+j].used ) 
          steps[i+j].overwrite(steps[i], steps[i].used+2, 1, j);
    }
    // Mode 2. An LZ-like compression scheme, we duplicate previous data.
    function mode2(i){
      // in k loop, instead of k<(input.length-i), should be k<(i-j)?
      // yes, this caused bugs and was corrected
      // var limit = Math.min(64,input.length-i);
      maxCount = 0, maxAddress = 0;
  
      // start from beginning of file and increment
      for (let j=0; j<i; j++) {
        // find matches
        for (k=0; k<(i-j); k++) if (input[j+k] != input[i+k]) break;
        if (k>maxCount) {
          maxCount = k;
          maxAddress = j;
        }
        if (maxCount==63) break;
      }
  
      for (let j=2; j<=maxCount; j++) 
        if ( (steps[i].used+3) < steps[i+j].used )
          steps[i+j].overwrite(steps[i], steps[i].used+3, 2, j, maxAddress);
    }
    // Mode 3. Check lookup table to see if the next two bytes are in it.
    function mode3(i){
      let match = tul[(input[i+1]<<8) | input[i]];
      if (match!=undefined)
        if ( (steps[i].used+1) < steps[i+2].used )
          steps[i+2].overwrite(steps[i], steps[i].used+1, 3, tul[(input[i+1]<<8) | input[i]]);
    }
  
    // loop through all bytes and test each mode
    //
    // essentially, we will look at each byte, 
    // see how many bytes we could compress it down to as part of a span of bytes
    // (basically, .used) for each of the 4 modes,
    // then assign the span starting with this byte to that mode.
    // parts of the span could be overwritten: for example mode 0 is run first,
    // but it is very inefficient so will often be overwritten.
    var i, k=0, maxCount=0, maxAddress=0; // setup
    for (i=0; i<(input.length-1); i++){
      mode0(i); // mode 0  Copy
      mode1(i); // mode 1  RLE
      mode2(i); // mode 2  History ("LZ-like")
      mode3(i); // mode 3  LUT
    }
    mode0(i); // Do mode 0 for the last byte (by now, i = (input.length-1), so j would only run for j=1)
  
    // chain the "next" references, from end to start
    steps[input.length].chain();
    
    // OUTPUT THE DATA
    //
    // jump through each step in the chain, writing its data to the output
    // setup
    var step = steps[0];
    var index = 0; // input index
    // loop through all the steps, which are each linked to their "next" step
    while (step != steps[input.length] ){ 
      let next = step.next;
      // push cmd byte: [mmcc cccc] where m is mode bits, c is count (or operand) bits
      output.push( (next.mode<<6) | next.count ); 
      // push subsequent bytes. Which bytes, and how many, will depend on the mode.
      switch (next.mode){
        case 0:
          output.push( ...input.slice(index, index + next.count) );
          index += next.count;
          break;
        case 1:
          output.push( input[index] );
          index += next.count;
          break;
        case 2:
          output.push( ...[ next.address & 0xff, next.address >> 8 ] );
          index += next.count; //
          break;
        case 3:
          // no subsequent bytes
          index += 2;
          break;
      }
      step = next;
    }
    
    return output;
  }