
class Animation {
    //
    constructor(){

    }
    elements = [];
    // format for each element of stack:
    // [
    //   {
    //     'keyframeName':'keyframeName1',
    //     'element':node1,
    //     'steps': [
    //       {'percent': 0,
    //        'props':{'prop': 'prop1','value':value1},
    //       }
    //       {'percent': 5,
    //        'props':{'prop': 'prop1','value':value1},
    //       }
    //     ],
    //     baseDuration: 1,
    //     duration: 1, /* this'll be the current duration */
    //     easingFunction: 'linear',
    //     progress: 0
    //   },
    //   ...
    // ]
    complete = false;
    paused = false;
    skipping = false;
    durationScale = 1;
    userDurationScale = 1;
    skippingDurationScale = 0.01;

    initElement(e){
      // initialize and build keyframes,
      // but do not actually assign the animation to the HTML node yet

      if (e.initialized) return 0;


      // parse some properties, especially ones likely to not be filled out.
      if (e.direction==undefined) e.direction = 'forwards';
      if (e.baseDuration==undefined) e.baseDuration = 1;
      if (e.duration==undefined) e.duration = e.baseDuration;
      if (e.easingFunction==undefined) e.easingFunction = "linear";
      if (e.progress==undefined) e.progress = 0;
      if (e.kind==undefined) e.kind = "keyframes"; // otherwise could be scroll
      if (e.name==undefined) e.name = "__ animation"; // 

      this.elements.push( e );

      // create the keyframe CSS (assuming we have the spes already)
      // and add it to stylesheets
      var kf = this.buildKeyframe( e );

      document.styleSheets[0].insertRule( kf );
      // this.debug.keyframes += kf+'\n\n';

      e.initialized = true;

    }
    startElement(e){
      e.startTime = Date.now();
      // depends on animation type
      switch (e.kind){
        default:
        case "keyframes":

          // actually assign it
          e.element.style.animation = `${e.keyframeName} ${e.duration}s ${e.easingFunction} ${e.direction}`;
          this.debug.times[e.keyframeName] = {
            start: Date.now(),
            projectedEnd: Date.now() + (e.duration*1000)
          };

          // what to do when this finishes animating
          // (the logistics stuff.. we may do more element-specific stuff with additional event listeners, elsewhere)
          e.element.addEventListener("animationend", ()=>{
            let nm = e.keyframeName+"";
            this.debug.times[nm].end = Date.now();
            if (e.keyframeName.substr(0,5)=="mover") console.log(`Mover end at `+(Date.now()-this.spanStartTime));
            if (e.keyframeName.substr(0,5)=="shado") console.log(`shadow end at `+(Date.now()-this.spanStartTime));

            // assign the current animated properties
            var computedStyles = window.getComputedStyle(e.element);
            var styleStr = ``;
            for (let [key, value] of Object.entries(e.allProps)){
              // e.element.style.setAttribute(
              //     key, computedStyles.getPropertyValue(key)
              //   );
              // or:
              // styleStr+=`${key}: ${value}; `;
              styleStr+=`${key}: ${computedStyles.getPropertyValue(key)}; `;
            }



            
            e.element.setAttribute('style', styleStr); //(?)
            // console.log(`Assigning the following to ${e.name}:\n${styleStr}`);
            // console.log(e.element);

            
            // remove animation (?)
            e.element.style.animation = ``;

            // find and delete this keyframe to clean up the stylesheet
            for (let i=0; i<document.styleSheets[0].cssRules.length; i++) {
              if ( document.styleSheets[0].cssRules[i].name === e.keyframeName ){
                document.styleSheets[0].deleteRule(i);
                break;
              }
            }

            // delete this element from this.elements
            // delete e;

            // delete html dom node
            if (e.deleteNodeWhenDone) setTimeout( e.element.remove(), 2);

          });

          break;

        case "scroll":


          // .progress
          e.startTime = Date.now(); // in msec

          const animEl = e;
          const nodeEl = e.element;
          

          function scrollStep(){


            // see which steps we're between
            let progress = animEl.progress + (Date.now() - animEl.startTime ) / (1000*animEl.duration); // 1-0
            let beforePerc, afterPerc, beforePos, afterPos; //positions
            // iterate until we find where we are.
            // if we're before any percentages, Percs should remain undefined, and we won't do anything
            for (let i=0; i<animEl.steps.length; i++){
              if (progress*100 >= animEl.steps[i].percent){
                beforePos = animEl.steps[i].props.position;
                beforePerc = animEl.steps[i].percent;
                if ((i+1)<animEl.steps.length){
                  afterPos = animEl.steps[i+1].props.position;
                  afterPerc = animEl.steps[i+1].percent;
                } else {
                  afterPos = beforePos;
                }
                break;
              }
            }

            // if before and after are the same, don't bother scrolling.
            var newPos;
            var scrolled = false;
            if (beforePos == afterPos){
              0;
            } else{ // if not, interpolate: 
              const scrollProg = Math.min( 1, (progress - (beforePerc*0.01) ) / ((afterPerc*0.01)-(beforePerc*0.01)));
              // if (scrollProg > 0.98) { /* might prevent losing the final position? */
                // nodeEl.scrollTo({top: afterPos, behavior: 'instant'});
                // } else {
                const newPosProg = 0.5+(-0.5*Math.cos( scrollProg*Math.PI) );
                newPos = ((afterPos-beforePos)*newPosProg) + beforePos;
                // console.log(newPos);
                // then actually scroll
                nodeEl.scrollTo({top: newPos, behavior: 'instant'});// instant...
                scrolled = true;
              // }
            }

            // now call the next frame (keep going if we somehow didn't quite get to the last position)
            if ( (progress <= 1) || (scrolled && (newPos != afterPos)) ){
              requestAnimationFrame(scrollStep);
            }


          }
          
          requestAnimationFrame( scrollStep );

        break;
      }

    }
    buildKeyframe(e){
      // we'll track the running props so that, if there's no change, we will use the last one
      // but if we say so, we won't assign the runningProp,
      // and css will take over and smoothly animate between.
      var runningProps = {};
      e.allProps = {}; // will be used later

      var keyframes = `@keyframes ${e.keyframeName} {\n`;

      // add percent and props for each step
      var totalSteps = e.steps.length;

      // first check if we actually go up to 100%,
      // if not, duplicate the last but with a percent of 100.
      var foundPercent =  e.steps[totalSteps-1]['percent'];
      var tol = 0.01; //tolerance
      if ( (foundPercent > 100+tol) || (foundPercent < 100-tol)){
        e.steps.push({...e.steps[totalSteps-1], 'percent':100});
        totalSteps++;
      } else {
        e.steps[totalSteps-1]['percent'] = 100; // basically round it if it's close
      }
      // repeat for 0%?



      var stepsCSS = [];
      var lastPerc;

      for (let i=0; i<totalSteps; i++){

        var stepCSS = ``;
        let d = e.steps[i];
        // initialize w percent
        let perc, percStr;
        switch (typeof(d.percent)){
          case 'object':
            perc = Math.round(d.percent[0]*100)/100;
            percStr = d.percent.map(f=>""+(Math.round(f*100)/100)+"%").join(', ');
            break;
          
          case 'number':
          default:
            perc = Math.round(d.percent*100)/100;
            // if it's just one percentage and equal to the last, add a little fudge factor
            perc = (perc==lastPerc) ? perc+ 0.01 : perc;
            lastPerc = perc*1;
            percStr = ""+perc+"%";
            break;


        }
        stepCSS += `\n  /* Step ${i+1} of ${totalSteps} `;
        stepCSS += `     ${e.duration*0.01*perc}s of ${e.duration}s */`;
        stepCSS += `\n  ${percStr} {`;

        // get properties. overwrite the running if not null.
        var fillProps = {...runningProps};
        for (let [key, value] of Object.entries(d.props)){
          if (value==null) {
            delete fillProps[key];
            delete runningProps[key];
          } else {
            fillProps[key] = value;
          }
        }

        // now update the running props
        runningProps = {...runningProps, ...fillProps};
        // now that we have it up to date, go through and apply all props
        for (let [key, value] of Object.entries(runningProps)){
          stepCSS += `\n    ${key}: ${value}; `;
          e.allProps[key] = true; //save this
        }
        // save back to steps for future reference:
        e.steps[i] = {...e.steps[i], ...runningProps};

        // close this step
        stepCSS += `\n  }`;
        // console.log(stepCSS);

        keyframes += stepCSS;
        stepsCSS.push(stepCSS);

        // save running props for use later:
        e.runningProps = {...runningProps};
      }

      // close entire thing
      keyframes += `\n}`;

      e.keyframes = keyframes;
      e.keyframeStepsCSS = stepsCSS;
      // console.log(keyframes);
      return keyframes;

    }
    pause(){
      this.elements.forEach( d => {
        this.pauseElement( d );
      });
    }
    resume(){
      this.elements.forEach( d => {
        this.resumeElement( d );
      });
    }
    assignAnimation(e){
      // TODO: scale e.duration: ( this.skipping ? this.skipDurationScale : this.userDurationScale ) * e.duration
      let delay = -e.progress * e.duration;
      e.animation = `${e.duration}s ${e.easingFunction} ${delay}s ${e.keyframeName}`;
    }
    pauseElement(e){
      // TODO: scale e.duration: ( this.skipping ? this.skipDurationScale : this.userDurationScale ) * e.duration
      let remainingTime = e.duration * ( 1 - e.progress );
      e.progress = e.progress + ( (Date.now() - e.startTime) / remainingTime );
      e.element.style.animationPlayState = "paused";
    }
    resumeElement(e){
      e.startTime = Date.now();
      e.element.style.animationPlayState = "running";
    }
    changeDurations(){
      this.elements.forEach( d=>{
        // update each element's durations in their objects:
        d.duration = d.baseDuration * ( this.skipping ? this.skipDurationScale : this.userDurationScale );
        // now update in DOM too:
        this.assignAnimation(d);

      })


    }
    toggleSkip(){
      if (!this.paused) this.pause();
      this.skipping = !this.skipping;
      // here we would update global duration, except we already use skip duration if skpping
      this.changeDurations();
      this.resume();

    }
    changeState(input){
      switch (input){
        case "space":
          if (!this.skipping) {
            this.paused ? this.resume() : this.pause();
            this.paused = !this.paused;
          } else {
            this.toggleSkip();
            this.paused = false;
          }
          break;
        case ">":
          if (!this.skipping) {
            this.toggleSkip();
            this.skipping = true;
          } else {
            if (this.paused) {
              this.resume();
              this.paused = false;
            }
          }
          break;
        case "duration":
          //TODO: update this.userDurationScale here
          if ( (!this.paused) && (!this.skipping) ){
            this.pause();
            this.changeDurations();
            this.resume();
          } else{
            this.changeDurations(); // should update in the object and in DOM...
            // while skipping, the DOM part should have no effect,
            // because there won't be a change in elements' durations
            // ( all will just set to skip duration )
          }
          break
      }
    }
    animationEndWrapper(){
      // other stuff goes here
      // maybe start the next keyframes...?

      // this checks if we are in a skipping state and running
      if ( this.skipping && !this.paused ){
        this.pause();
        this.paused = true;
      }

    }

    initDecomp(comp, decomp){
      // comp and decomp arguments are the compressed and decompressed panels
      // we create compContent and decompContent from their hex_content
      this.decomp = decomp;
      this.comp = comp;
      this.decompContent = decomp.panelContent.querySelector(".hex_content");
      this.compContent = comp.panelContent.querySelector(".hex_content");
      // console.log("initDecomp()");
      // console.log(this.compContent);

      // lock the comp and decomp panels from drag, resize, or maximize

      this.compIndex = 128; // first byte after LUT
      this.decompIndex = 0;
      this.decompSpanCount = 0;

      this.colors = [
        [255,0,0],
        [255,255,0],
        [255,0,255],
        [0,0,255]
      ];
      this.bgColors = [
        [0,0,0],
        [85,85,85],
        [170,170,170],
        [255,255,255]
      ];
      // this.bgColors = [
      //   [255,0,0],
      //   [255,255,0],
      //   [200,50,100],
      //   [0,0,255]
      // ];
      this.fgColors = [
        [255,255,255],
        [255,255,255],
        [0,0,0],
        [0,0,0]
      ];
      // this.fgColors = [
      //   [0,0,0],
      //   [0,0,0],
      //   [0,0,0],
      //   [0,0,0]
      // ];
      this.modeNames = [
        "Copy",
        "RLE",
        "HISTORY",
        "LUT"
      ];
      this.operandNames = [
        "№ bytes",
        "№ times",
        "№ bytes",
        "LUT index"
      ];

      this.hexToDec = {
        '0':0, '1':1, '2':2,  '3':3,  '4':4,  '5':5,  '6':6,  '7':7,
        '8':8, '9':9, 'A':10, 'B':11, 'C':12, 'D':13, 'E':14, 'F':15
      };
      this.corner = '2ch';
      this.cornerUnits = 'ch'; // might help smooth animating of borderRadius, in future...


      var rnd = this.corner;
      var shp = "0"+this.cornerUnits;
      this.bblBoth = `${rnd} ${rnd} ${rnd} ${rnd}`,
      this.bblLeft = `${rnd} ${shp} ${shp} ${rnd}`,
      this.bblRight= `${shp} ${rnd} ${rnd} ${shp}`,
      this.bblNone = `${shp} ${shp} ${shp} ${shp}`;

      this.parallelize = true;; // move all divs in parallel (faster)
      this.riseTime = 0.025;//0.15;
      this.staggerTime = 0.05;//0.2;
      this.moveTime = 0.1;//0.3;
      this.detailsTime = 5.5;
      this.scrollTime = 0.2;//1; // time to give to scroll during details div

      this.riseTime = 0.15;
      this.staggerTime = 0.2;
      this.moveTime = 0.3;
      this.detailsTime = 5.5;
      this.scrollTime = 1; // time to give to scroll during details div


      this.bblTime = Math.min(this.riseTime, this.staggerTime)/2;
      // this.detailsTime = 2.5;
      
      this.debug = {
        keyframes: '',
        log: '',
        header: '',
        times: {}
      };

      // set all loaded decomp to invisible
      Array.from(this.decompContent.querySelectorAll(".byte_group > .byte_container > .byte")).forEach(d=>d.style.color = "var(--textColorTransparent)");
      // set all previously-generated-butnot-loaded decomp to invisible
      this.decomp.source.groupNodes.forEach(
        groupNode=>groupNode.querySelectorAll(".byte_container > .byte").forEach(
          d=>d.style.color = "var(--textColorTransparent)"
        )
      );

      
      // save the invisibilty here so future-generated bytes are also invisible
      this.decomp.byteColor = "var(--textColorTransparent)"; 

      // circle the words of the LUT.
      //NOTE: somewhat complicated to check if existing/generated
      var targetGroupNode;
      for (let i=0; i<128; i++){
        let groupIndex = Math.floor(i/this.comp.groupSize);
        
          if (this.comp.source.groupNodes[groupIndex]){
            targetGroupNode = this.comp.source.groupNodes[groupIndex];
          } else {
            targetGroupNode = this.compContent.querySelector(`group_${this.source.offsetsHexStrings[i]}`);
            // if we didn't find anything (shouldn't happen except with very small group sizes...?)
            if (!targetGroupNode) {
              targetGroupNode = this.comp.generateHexHTML(this.comp.source.data, groupIndex*this.comp.groupSize);
            }
          }
        let lutEntry = targetGroupNode.querySelector(`#byte_${hex( i, 6 )} > .byte`);
        console.log(`.byte_group > #byte_${hex( i, 6 )} > .byte`);
        lutEntry.style.border = '1px solid';
        if (i%2) { // right side
          lutEntry.style.borderRadius = `0 ${this.corner} ${this.corner} 0`;
          lutEntry.style.borderLeft = "none";
        } else{    // left side of bubble
          lutEntry.style.borderRadius = `${this.corner} 0 0 ${this.corner}`;
          lutEntry.style.borderRight = "none";
        }
      }

      // scroll both panels to the start if needed
      //NOTE: this is copied almost verbatim from end of cloneAndMove, could be made its own function?
      // see if we need to return the hex_content positions before the next span:
      // bc we possibly got messed up by a previous LUT mode scroll
      var cmdOffsetPos = this.comp.checkOffsetPosition( this.compIndex, 2, 2 );
      if (!cmdOffsetPos.inView) this.scrollContent(
        this.compContent, 
        this.compContent.scrollTop, cmdOffsetPos.position-cmdOffsetPos.topMargin, 
        this.scrollTime ); 

      // Do the same for decomp... although we still have the problem with decomp where it might not look clear if
      // history mode bytes are higher up than the current decompIndex
      var outOffsetPos = this.decomp.checkOffsetPosition( this.decompIndex, 2, 2 );
      if (!outOffsetPos.inView) this.scrollContent(
        this.decompContent, 
        this.decompContent.scrollTop, outOffsetPos.position-outOffsetPos.topMargin, 
        this.scrollTime ); 

      setTimeout( ()=>{
        this.decompSpan();
      }, (!cmdOffsetPos.inView || !outOffsetPos.inView) ? this.scrollTime*1000 : 0 )

      // begin iterations
      // this.decompSpan();

    }

    scrollContent(content, startPos, endPos, duration, delay=0, steps=null, hold=false){
      // wrapper to scroll compContent or decompContent
      let scrollAnim = new Animation();
      scrollAnim.name = "scroll animation "+Date.now();
      scrollAnim.element = content;
      scrollAnim.baseDuration = duration;
      scrollAnim.kind = "scroll";
      scrollAnim.keyframeName = `contentScroll`; //?
      scrollAnim.steps = [
        { 'percent': 0, 'props': { position: startPos} },
        { 'percent': 100, 'props': { position: endPos} },
      ];
      // override if we pass in specific steps
      if (steps) scrollAnim.steps = steps;

      this.initElement(scrollAnim );
      // start it unless we don't want to yet
      if (!hold) setTimeout( this.startElement(scrollAnim ), delay*1000);
      
      return scrollAnim;
    }
    

    cloneAndMove(){
      // console.log(`Starting cloneAndMove with ${this.moveBuffer.length} remaining bytes in moveBuffer`);

      // some setup
      // bubble/rounded corners shorthands
      // left means rounded on left side, right means rounded on right side
      // later we say "expand" left or right, that means going "sharp" in those directions
      var bblBoth = this.bblBoth;
      var bblLeft = this.bblLeft;
      var bblRight = this.bblRight;
      var bblNone = this.bblNone;

      var lift = "20px";
      var riseTime = this.riseTime;
      var staggerTime = this.staggerTime;
      var stagger = 0;
      var move1920 = 2;
      var moveTime = this.moveTime;
      var bblTime = this.bblTime; // should always be <= riseTime and <= staggerTime
      var scrollTime = ( (this.mode==2) && this.willScrollDecomp) ? this.scrollTime : 0;
      
      

      // get the source divs
      // It will act on this.moveBuffer, popping off each batch
      // if not a parralelized span, each batch will only conntain 1 div
      var fromDivs = this.moveBuffer.pop();

      //
      //  A  lifting all from divs
      //
      var totalFromDivs = fromDivs.length;
      this.batchSize = fromDivs.length;
      var totalStagger = ((totalFromDivs-1)*staggerTime);
      var totalTime = totalStagger + riseTime; // before move time, which we have to calculate.
      totalTime += scrollTime; // scroll time
      totalTime += totalStagger +  moveTime + riseTime + staggerTime + bblTime; // moving and dropping and bubbling
      // totalStagger + riseTime + scrollTime + stagger + moveTime + riseTime + staggerTime + bblTime
      // totalStagger + riseTime + scrollTime + totalStagger + moveTime + riseTime

      var maxMoveTime = 0;

      var positionWillScrollTo = 0;


      //
      var checkToDiv = this.decomp.checkOffsetPosition( this.decompIndex, 2, 2 );
      positionWillScrollTo = checkToDiv.position - checkToDiv.topMargin;
      ///
      var fromDiv;
      var anims = [];

      // set scroll
      if ( (this.mode==2) && this.willScrollDecomp){
        
        // setTimeout( ()=>{
        //     console.log(`Mode 2 HISTORY: scrolling from ${this.decompContent.scrollTop} to ${positionWillScrollTo}.`);
        //     this.decompContent.scrollTo({top: positionWillScrollTo, behavior: 'smooth'});
        //   },
        //   (totalStagger +  riseTime )*1000
        // );

        anims.push(
            this.scrollContent(this.decompContent, 0, 0, totalTime, 0, 
              [
                {percent: 100*(totalStagger +  riseTime )/totalTime, props: {position:1*this.decompContent.scrollTop}},
                {percent: 100*((totalStagger +  riseTime )+this.scrollTime)/totalTime, props: {position:positionWillScrollTo}},                  
              ], true)
          );

      }


      for (let i=0; i<fromDivs.length; i++){ // loop A //////////////////////////////////////////////////////////////

        fromDiv = fromDivs[i];
        
        // style the from div, if necessary
        // if it's mode 0 or the first byte of mode 1
        if ( (this.mode==0) || ( (this.mode==1) && (this.axbi == this.axb) ) ){

          let fromDivAnim = new Animation();
          fromDivAnim.name = "fromDiv animation";
          fromDivAnim.element = fromDiv;
          fromDivAnim.baseDuration = totalTime;
          fromDivAnim.easingFunction = "ease";
          fromDivAnim.keyframeName = `fromDivStyle_${i}_${Date.now()}`;
          fromDivAnim.steps = [];
          
          
          let fromDivStyle = window.getComputedStyle(fromDiv);
          let origs = {
            'color':fromDivStyle.getPropertyValue('color'),
            'background-color':fromDivStyle.getPropertyValue('background-color'),
            'border':fromDivStyle.getPropertyValue('border'),
            
          }

          // instant jump to cell style
          fromDivAnim.steps = [
            { 'percent': [0, 100*stagger/totalTime], 'props': { ...origs }  },
            // when the mover div appears, coming out of this, instantly* make it the same color: *actually 0.01%
            { 'percent': (100*stagger/totalTime)+0.01, 'props': { 
              'background-color': `rgba(${this.bgColors[this.mode]},1)`,
              'color': `rgba(${this.fgColors[this.mode]},1)`,
              'border-radius': bblBoth} },
            // quickly morph to fit previous, stopping <bblTime> after the stagger
            { 'percent': [100*(stagger+bblTime)/totalTime, 100*(stagger+staggerTime)/totalTime], 'props': {
              'border-radius': bblRight
            } },

          ];

          // if mode 0, we expand for the next cell next
          if (this.mode==0) fromDivAnim.steps.push(
            // quickly morph to fit next
            { 'percent': 100*(stagger+staggerTime+bblTime)/totalTime, 'props': {
              'border-radius': ( this.axbi==1 ) ? bblRight : bblNone
            } }
          );

          fromDivAnim.steps.push(
            { 'percent': 100, 'props': {} }
          );
          
          this.initElement( fromDivAnim );
          anims.push(fromDivAnim);
          // console.log(fromDivAnim.keyframes);
       }



        // decrement the visible n:
        // HACK: this isn't really synced with animation so can't be paused
        if (this.mode!=3){
          setTimeout( ()=>{
          try {
            let ndiv = this.details.querySelector("div > .n");
            // console.log(ndiv);
            this.ni-=1;
            let nattempt = ndiv.innerHTML.replace(/[0-9A-F]{2}/i,hex(this.ni,2));;

            ndiv.innerHTML = nattempt; // replaces hex
            } catch(err){
              console.log("error:" +err);
            }
            // one liner
            // this.details.querySelector("div > .n").innerHTML = this.details.querySelector("div > .n").innerHTML.replace(/[0-9A-F]{2}/i,hex(this.ni--,2));
          }, stagger*1000);
        }


        // Mover and its Shadow
        //
        // create elements
        let fromDivBbox = fromDiv.getBoundingClientRect();

        // cloning it at the same position
        let mover = fromDiv.cloneNode();
        let shadow = fromDiv.cloneNode();
        // let mover = document.createElement("div");
        // let shadow = document.createElement("div");
        mover.style.border = 'none';
        shadow.style.border = 'none';
        
        mover.style.opacity = "0";
        mover.innerHTML = fromDiv.innerHTML+"";
        shadow.style.opacity = "0";

        mover = document.getElementById("animationTop").appendChild( mover ); // actually add it to page
        shadow = document.getElementById("animationTop").appendChild( shadow ); // actually add it to page
        //


        // track this animation, for pausing, etc
        let moverAnim = new Animation();
        moverAnim.element = mover;
        moverAnim.baseDuration = totalTime;
        moverAnim.duration = totalTime;
        moverAnim.easingFunction = "ease";
        moverAnim.deleteNodeWhenDone = true;
        moverAnim.keyframeName = `moverMove_${i}_${Date.now()}`;

        var moverOrig = {
          'width': fromDivBbox.width+"px", 'height': fromDivBbox.height+"px", 'border-radius': bblBoth,
            'position': 'absolute', 'opacity': "0", 'z-index': "102",
            'transform': `translate3D(${fromDivBbox.x}px, ${fromDivBbox.y }px, 0px)`,
            'background-color': `rgba(${this.bgColors[this.mode]},1)`, 'color': `rgba(${this.fgColors[this.mode]},1)`
        }

        // moverAnim.steps = [
        //   { 'percent':0, 'props': {
        //     ...moverOrig}
        //   }
        // ];

        let shadowAnim = new Animation();
        shadowAnim.element = shadow;
        shadowAnim.baseDuration = totalTime;
        shadowAnim.easingFunction = "ease";
        shadowAnim.deleteNodeWhenDone = true;
        shadowAnim.keyframeName = `shadowMove_${i}_${Date.now()}`;
        // more modular but not working?
        // shadowAnim.steps = [ { ...moverAnim.steps[0], 'z-index': "101",  'background-color': `rgba(0,0,0,0.8)` } ];
        var shadowOrig = { ...moverOrig, 'z-index': "101",  'background-color': `rgba(0,0,0,0.8)` };

        // shadowAnim.steps = [
        //   { 'percent':0, 'props': {
        //     'width': fromDivBbox.width+"px", 'height': fromDivBbox.height+"px", 'border-radius': bblBoth,
        //     'position': 'absolute', 'opacity': "0", 'z-index': "101",
        //     'transform': `translate3D(${fromDivBbox.x}px, ${fromDivBbox.y }px, 0px)`,
        //     'background-color': `rgba(0,0,0,0.8)`}
        //   }
        // ];



        // getting the location of destination div
        // note that it's not in the right position when we build these,
        // if we are going to scroll, so we have to check
        // where it will be once we scroll.

        let toDiv = this.decompContent.querySelector(`.byte_group > #byte_${hex( (this.decompIndex+i), 6 )} > .byte`);
        let toDivBbox = toDiv.getBoundingClientRect();
        //
        let hcTop = this.decompContent.getBoundingClientRect().y;
        let toDivY;
        if (this.willScrollDecomp){
          checkToDiv = this.decomp.checkOffsetPosition( this.decompIndex+i, 2, 2 ); //assuming this is up to date
          toDivY = hcTop + ( checkToDiv.position - positionWillScrollTo );
        } else {
          toDivY = toDivBbox.y;
        }

        // toDivYs.push(toDivY);

        // hc.y + topMargin;
        // for each: hcTop.y + ( thisToDiv_.position_from_checkOffsetPosition - positionWillScrollTo );

        // and moving the clone to location of destinationDiv

        // first determine the distance it's moving and make a reasonable travel speed:
        // let travelDist = (((fromDivBbox.x-toDivBbox.x)**2)+((fromDivBbox.y-toDivY)**2))**0.5;
        // // based on 2sec for travel across width of a 1080/1920 screen,
        // // but clamp the time... esp if we're picking up and scrolling for mode 2
        // // let travelRatio = Math.min( travelDist/1920, 1);
        // let travelRatio = 1;
        // let travelTime = move1920*travelRatio; // +1sec; 0.5 each for raising and lowering div into place
        
        // moveTimes.push(travelTime);
        // maxMoveTime = Math.max( travelTime, maxMoveTime ); // track the highest (not necessarily the 1920 time)

        let scrollEndTime = totalStagger+riseTime+scrollTime+stagger; // includes stagger

        // new:
        // only thing differing s the lift height:
        [ [moverAnim, lift, moverOrig], [shadowAnim, "0px", shadowOrig] ].forEach(d=>{

          d[0].steps = [
            // rise //////
            // wait for stagger
            { 'percent': [0, 100*stagger/totalTime], 'props': {...d[2]} },
            // rise
            { 'percent': 0.01+(100*(stagger)/totalTime), 'props': {
              'opacity': '1',
              }
            },
            // rise up and remain until scroll break ////
            { 'percent': [100*(stagger+riseTime)/totalTime, 100*(scrollEndTime)/totalTime], 'props': {
              'transform': `translate3D(${fromDivBbox.x}px, ${fromDivBbox.y }px, ${d[1]})`}
            },
            // move, drop, bubble //////
            // begin move
            { 'percent': 100*(scrollEndTime+moveTime)/totalTime, 'props': {
              'transform': `translate3D(${toDivBbox.x}px, ${toDivY }px, ${d[1]})`,
              'width': `${toDivBbox.width}px`, 'height': `${toDivBbox.height}px` } },
            // end move/begin drop
            { 'percent': 100*(scrollEndTime+moveTime+riseTime)/totalTime, 'props': {
              'transform': `translate3D(${toDivBbox.x}px, ${toDivY }px, 0px)`, 'opacity': "1"} },
            // make invisible
            { 'percent': 0.01+(100*(scrollEndTime+moveTime+riseTime)/totalTime), 'props': {
              'opacity': "0"} },
            // end drop/begin bubble
            { 'percent': 100, 'props': { } },

          ];
        });

        
        // console.log(`Mode ${this.mode} mover, last at ${0.01+(100*(scrollEndTime+moveTime+riseTime)/totalTime)}%.`);


        // style the toDiv

        let toDivAnim = new Animation();
        toDivAnim.name = "toDiv animation";
        toDivAnim.element = toDiv;
        toDivAnim.baseDuration = totalTime;
        toDivAnim.easingFunction = "ease";
        toDivAnim.keyframeName = `toDivStyle_${i}_${Date.now()}`;
        toDivAnim.steps = [];

        let toDivStyle = window.getComputedStyle(toDiv);
        let torigs = {
          'color':toDivStyle.getPropertyValue('color'),
          'background-color':toDivStyle.getPropertyValue('background-color'),
          'border':toDivStyle.getPropertyValue('border'),
          'opacity':'0'
        }

        let finalBbl = bblNone;
        if (( this.axbi==1 ) && ( this.axbi==this.axb )){
          finalBbl = bblBoth;
        } else {
          if ( this.axbi==1 ) finalBbl = bblRight;        // last
          if ( this.axbi==this.axb ) finalBbl = bblLeft;  // first
        }

        // instant jump to cell style
        toDivAnim.steps.push(...[
          { 'percent': [0, 100*(scrollEndTime+moveTime+riseTime)/totalTime], 'props': { 
            ...torigs} },
          // begin bubble
          // instantly change color and add full bubble
          { 'percent': 0.01+(100*(scrollEndTime+moveTime+riseTime)/totalTime), 'props': {
            'opacity':"1",
            'background-color': `rgba(${this.bgColors[this.mode]},1)`,
            'color': `rgba(${this.fgColors[this.mode]},1)`,
            'border-radius': bblBoth },
          },
          

          // quickly morph to fit previous
          { 'percent': [
              100*(scrollEndTime+moveTime+riseTime+bblTime)/totalTime,
              100*(scrollEndTime+moveTime+riseTime+staggerTime)/totalTime
            ],  'props': {
            'border-radius': ( this.axbi==this.axb ) ? bblBoth : bblRight
          } },

          // morph to fit next
          { 'percent': 100*(scrollEndTime+moveTime+riseTime+staggerTime+bblTime)/totalTime, 'props': {
            'border-radius': finalBbl
          } },

          { 'percent': 100, 'props': {} }
          
        ]);
        //TODO: if we have an output byte coming after, bubble it up to match that one:
        // (currently all just bubble up at very end)
        
        this.axbi--; // countdown
        stagger += staggerTime;
        
        // now that we have all the anims' steps
        this.initElement( moverAnim );
        this.initElement( shadowAnim );
        this.initElement( toDivAnim );
        // console.log("toDiv:");
        // console.log(toDivAnim);
        // console.log(toDivAnim.keyFrames);

        anims.push(...[ moverAnim, shadowAnim, toDivAnim]);


        // toDivs.push(toDiv);
        // movers.push(mover);
        // shadows.push(shadow);



      }; // fromDivs for  A end

      // anims.forEach( (d,i) => {
      //     console.log(d.keyframes);
      //   }
      // );

      anims.forEach( (d,i) => {
        this.startElement( d );
      });


      anims[anims.length-1].element.addEventListener("animationend", ()=>{

        // then increment this.decompIndex++;
        // this.decompIndex += forDivs.length;
        // this.decompIndex += this.axb; // number of bytes (a) x number of times (b)
        this.decompIndex += this.batchSize;
        // Replace styles of hex_bytes in hex_content with those of the clones
        // (just background and font being visible? maybe borders?)
        // toDiv.style.color = 'var(--textColor)';
        // toDiv.style.background = `rgba(${this.modeColor.map(d=>d*0.25)},1)`;

        // toDiv.style.backgroundColor = `rgba(${this.bgColors[this.mode]},1)`;
        // toDiv.style.color = `rgba(${this.fgColors[this.mode]},1)`;
        // var blefts=['0','0'], brights=' 0 0 ';
        // if (this.firstIncomplete){
        //   blefts = [crnr,crnr];
        //   this.firstIncomplete = false;
        // }
        // if (this.moveBuffer.length == 0) brights = ` ${crnr} ${crnr} `;
        // toDiv.style.borderRadius = blefts.join(brights);
        // console.log(`\n\n\n\ntodiv borderRadius:${blefts.join(brights)}\n\n\n\n`);


        // fade out/remove clone elements
        // mover.remove();
        // shadow.remove();

        // if (this.mode!=3) ndiv.style.animation = ``; // remove the bulge animation

        // if this is the end of this decomp span
        if (this.moveBuffer.length > 0){
          // console.log("this.moveBuffer.length > 0, calling this.cloneAndMove()");
          // console.log("continue this.cloneAndMove() for next byte of this span");
          // continue moving the next byte within this same span
          this.cloneAndMove();

        } else {

          // style the cmd byte if we haven't already (shouldn't have):
          // let cmd = this.compContent.querySelector(`div > #g0x${hex( 32*(this.compIndex>>5), 6 )} div #byte_${hex( this.compIndex, 6 )}`); // actual div node
          // if (cmd.style.backgroundColor != `rgba(${this.bgColors[this.mode]},1)`){
          //   cmd.style.backgroundColor = `rgba(${this.bgColors[this.mode]},1)`;
          //   cmd.style.color = `rgba(${this.fgColors[this.mode]},1)`;

          //   var cmdbleft=[crnr, crnr], cmdbright=' 0 0 ';
          //   if (this.mode == 3) cmdbright = ` ${crnr} ${crnr} `; // mode 3 has no following bytes in its span
          //   console.log(`\n\n\n\ncmd borderRadius:${cmdbleft.join(cmdbright)}\n\n\n\n`);
          //   cmd.style.borderRadius = cmdbleft.join(cmdbright);
          // }
          // console.log("length of buffer is: "+this.moveBuffer.length+"; move on to next decompSpan()");

          // increment the comp index
          // (note that we already incremented by 1 from the command byte)
          switch(this.mode){
            case 0:
              this.compIndex += this.n+1;
              // this.decompIndex += n;
              break;
            case 1:
              this.compIndex += 1+1;
              // this.decompIndex += n;
              break;
            case 2:
              this.compIndex += 2+1;
              // this.decompIndex += n;scrollCont
              break;
            case 3:
              this.compIndex += 0+1;
              // this.decompIndex += 2;
              break;
          }

          // remove all previous animations:
          Array.from(document.body.querySelectorAll(".decomp_animation_details")).forEach(d=>d.remove());
          // document.getElementById('animationTop').innerHTML = '';


          // see if we need to return the hex_content positions before the next span:
          // bc we possibly got messed up by a previous LUT mode scroll
          var cmdOffsetPos = this.comp.checkOffsetPosition( this.compIndex, 2, 2 );
          if (!cmdOffsetPos.inView) this.scrollContent(
            this.compContent, 
            this.compContent.scrollTop, cmdOffsetPos.position-cmdOffsetPos.topMargin, 
            this.scrollTime ); 

          // Do the same for decomp... although we still have the problem with decomp where it might not look clear if
          // history mode bytes are higher up than the current decompIndex
          var outOffsetPos = this.decomp.checkOffsetPosition( this.decompIndex, 2, 2 );
          if (!outOffsetPos.inView) this.scrollContent(
            this.decompContent, 
            this.decompContent.scrollTop, outOffsetPos.position-outOffsetPos.topMargin, 
            this.scrollTime ); 

          // debug
          // this.debug.times['decomp span '+this.decompSpanCount].end = Date.now();
          // var times = '////////////////////////\ndecomp span '+this.decompSpanCount+" [mode "+this.mode+"]\n";

          // for (let [key, value] of Object.entries(this.debug.times)){
          //   let name = key+'                            ';
          //   name = name.substr(0,20);
          //   times+=`\n${name}:\t ${value.start-this.spanStartTime} ->\t${value.end-this.spanStartTime}\t(${value.projectedEnd?(value.projectedEnd-this.spanStartTime):''})\t[${value.end-value.start}]`;
          // }
          // console.log(times);
          // var scrtm = (!cmdOffsetPos.inView || !outOffsetPos.inView) ? this.scrollTime*1000 : 0;
          // console.log("scroll time: "+ scrtm);

          this.decompSpanCount++;

          //HACK: a somewhat arbitrary time to wait for panel(s) to scroll
          setTimeout( ()=>{
            // console.log(`/*\n${this.debug.header}*/\n${this.debug.keyframes}`);
            // let b78 = Array.from(Array(78).keys()).map(d=>"-").join("");
            // this.debug.log += `/*${b78}\n${this.debug.header}\n${b78}*/\n${this.debug.keyframes}`;
            if (this.compIndex < this.comp.source.data.length) this.decompSpan();
          }, (!cmdOffsetPos.inView || !outOffsetPos.inView) ? this.scrollTime*1000 : 0 )

          // // begin the next span
          // if (this.compIndex < this.comp.source.data.length) this.decompSpan();

        }

       
      }); // end of A end animation end

    }


    decompSpan(){

      var nm = 'decomp span '+this.decompSpanCount; 
      this.debug.times = { };
      this.debug.times[nm] = {start:Date.now()};
      this.spanStartTime = Date.now();

      // let decompScrollAnim = new Animation();
      // decompScrollAnim.name = "comp scroll animation";
      // decompScrollAnim.element = this.compContent;
      // decompScrollAnim.baseDuration = 2;
      // decompScrollAnim.kind = "scroll";
      // // decompScrollAnim.easingFunction = "ease";
      // decompScrollAnim.keyframeName = `decompScroll`;
      // decompScrollAnim.steps = [
      //   { 'percent': 0, 'props': { position: this.compContent.scrollTop} },
      //   { 'percent': 100, 'props': { position: this.compContent.scrollTop+300} },
      // ];
      // this.initElement(decompScrollAnim );
      // this.startElement(decompScrollAnim );
      // return 0;


      // mode-specific
      switch(this.mode){
        case 0: // copy
          // highlight the following n bytes of input,
          // decrementing the visible n as we go
          // (maybe this is also copying the nodes... maybe mask a highlight appearing left-to-right?)

          // move them across the screen to decomp

          // replace decomp's equivalent bytes' style with that of these ones
          // fade these mover nodes out

          // ------------------------------------------
          // var mover = node.cloneNode(true);
          // mover.style.position = "absolute";
          // var nodeBbox = node.getBoundingClientRect();
          // // mover.style.perspective = `100px`;
          // // mover.style.perspectiveOrigin = `100px`;
          // mover.style.width = nodeBbox.width+"px";
          // mover.style.height = nodeBbox.height+"px";
          // mover.style.transform = `translate3D(${nodeBbox.x }px, ${nodeBbox.y }px, 0px)`;
          // mover.style.zIndex = "100";
          // mover = page.appendChild(mover);
          // return mover;

          break;

        case 1: // RLE
          // highlight the follwing single byte

          // make a stack of n copies of that byte?
          // move each copy into decomp
          // decrementing the visible n as we go

          // replace decomp's equivalent bytes' style with that of these ones
          // fade these mover nodes out

          break;

        case 2: // history
          // highlight the following 2 bytes

          // swap them

          // move this address mover div to just left of the <decomp> offsets, at the top (or just middle?)
          // scroll the <decomp> hex content to the position of this address/offset
          // move to the right, touching the left side of this address's byte

          // highlight along the next n bytes
          // decrementing the visible n as we go

          // pick these up as a group
          // scroll to current position of decomp

          // place them in order

          // replace decomp's equivalent bytes' style with that of these ones
          // fade these mover nodes out

          break;

        case 3: // LUT
          // keep n as binary
          // bit shift left by adding a zero and sliding it in
          // show a "x2" as well?

          // move this address mover div to just left of the <comp> offsets, at the top (or just middle?)
          // scroll the <comp> hex content to the position of this address/offset
          // move to the right, touching the left side of this address's byte

          // highlight along the next 2 bytes

          // pick these up as a group
          // scroll to current position of decomp

          // place them in order

          // replace decomp's equivalent bytes' style with that of these ones
          // fade these mover nodes out

          break;

      }

      // ---------------------------------------------------------------
      //
      // LEVEL 1
      // Intitialize and show mode details



      var anims = [];

      // set more details based on the current command byte
      //
      this.cmdVal = this.comp.source.data[this.compIndex]; // get actual data value
      this.cmdHex = hex( this.cmdVal, 2 ); // convert value to hex
      this.cmdBin = binar( this.cmdVal, 8 ); // convert to binary
      this.mode = (this.cmdVal & 0b11000000) >> 6; // 2 MSBs are command mode
      this.n = this.cmdVal & 0b00111111; // 6 LSBs are detail
      this.ni = this.n*1; // to be used for visual decrementing later
      // get address; only used for modes 2 or 3
      if (this.mode==2) this.address = this.comp.source.data[this.compIndex+1] | (this.comp.source.data[this.compIndex+2] << 8);
      if (this.mode==3) this.address = this.n << 1;
      this.numberAddedToDecomp = (this.mode==3) ? 2 : this.n; // number of bytes that will be added to decomp data (not needed?)
      this.modeColor = this.bgColors[this.mode]; // color of this mode

      
      // determine which bytes we will need to interact with during this span, 
      // load them and keep them loaded for now.
      var compBytes = [], decompBytes = [];
      switch(this.mode){
        case 0:
          // copy: 
          // comp: cmd, following n bytes
          // decomp: next n bytes
          compBytes = [this.compIndex];
          for (let i = 0; i<this.n; i++) compBytes.push(this.compIndex+1+i);
          for (let i = 0; i<this.n; i++) decompBytes.push(this.decompIndex+i);
          break;
        case 1:
          // RLE:
          // comp: cmd, following 1 byte
          // decomp: next n bytes
          compBytes = [this.compIndex, this.compIndex+1];
          for (let i = 0; i<this.n; i++) decompBytes.push(this.decompIndex+i);
          break;
        case 2:
          // history
          // comp: cmd, following 2 bytes
          // decomp: n bytes starting at address, n bytes starting at decompIndex
          compBytes = [this.compIndex, this.compIndex+1, this.compIndex+2];
          for (let i = 0; i<this.n; i++) decompBytes.push(this.address+i);
          for (let i = 0; i<this.n; i++) decompBytes.push(this.decompIndex+i);

          break;
        case 3:
          // LUT
          // comp: cmd, 2 bytes at LUT address
          // decomp: following 2 bytes
          compBytes = [this.compIndex, this.address, this.address+1];
          decompBytes = [this.decompIndex, this.decompIndex+1];
          break;
      }
      var compGroups = {}, decompGroups = {};
      // comp
      // reduce to only the unique groups (avoid duplicates)
      for (let offset of compBytes) 
        compGroups[`#group_${hex(this.comp.groupSize*Math.floor(offset/this.comp.groupSize),6)}`] = this.comp.groupSize*Math.floor(offset/this.comp.groupSize);
      // now add if needed; either way, mark as "keep_loaded" class
      for (let groupName in compGroups) {
        let group = compGroups[groupName];
        if (!this.compContent.querySelector(groupName)) {
          this.comp.generateHexHTML(this.comp.source.data, group*1);
          console.log('added '+groupName);
        }
        this.compContent.querySelector(groupName).classList.add("keep_loaded");
      }
      // decomp
      // reduce to only the unique groups (avoid duplicates)
      for (let offset of decompBytes) 
        decompGroups[`#group_${hex(this.decomp.groupSize*Math.floor(offset/this.decomp.groupSize),6)}`] = this.decomp.groupSize*Math.floor(offset/this.decomp.groupSize);

      // now add groups if needed; either way, mark as "keep_loaded" class
      for (let groupName in decompGroups) {

        let group = decompGroups[groupName];

        if (!this.decompContent.querySelector(groupName)) {
          let groupIndex = group/this.decomp.groupSize;
          if (this.decomp.source.groupNodes[groupIndex]){
            this.decomp.source.groupNodes[groupIndex] = this.decompContent.appendChild( this.decomp.source.groupNodes[groupIndex]);
          } else {
            this.decomp.generateHexHTML(this.decomp.source.data, group*1);
          }
          
          // set all new decomp to invisible
          Array.from(this.decompContent.querySelectorAll(groupName+" > .byte_container > .byte")).forEach(d=>d.style.color = "var(--textColorTransparent)");
          console.log('added '+groupName);
        }
        console.log(groupName);
        this.decompContent.querySelector(groupName).classList.add("keep_loaded");
      }


      this.debug.header = `------------\n Decomp span ${this.decompSpanCount}\n mode ${this.mode}\n n ${this.n}\ncomp index ${this.compIndex}\ndecomp index ${this.decompIndex}\n------------\n`;
      // console.log(this.debug.header);


      // console.log(this);

      // Create the Details div, a grid that will animate to show the breakdown of the command byte
      //
      // get the command byte html div so we can find its properties and line up our details html div to it
      // console.log(compGroups);
      // console.log(this.compContent.childNodes);
      // console.log(decompGroups);
      // console.log(this.decompContent.childNodes);
      // console.log(`.byte_group > #byte_${hex( this.compIndex, 6 )} > .byte`);
      let cmd = this.compContent.querySelector(`.byte_group > #byte_${hex( this.compIndex, 6 )} > .byte`); // actual div node

      let cmdBbox = cmd.getBoundingClientRect();
      // set up dimensions
      // y will be the new "scrolled" y position if we determined we will scroll
      // (it takes a bit to scroll so the bounding box won't immediately be up-to-date)
      let w = cmdBbox.width, h = cmdBbox.height, x = cmdBbox.x, y = cmdBbox.y;
      let ww = w*1.5;
      let wl = 5*w; // width for "labels"
      let wll = wl;

      // string versions, easier to change units and stuff:
      var wh = w/2+"px";
      // wh = "1fr";
      var wlls = wll+"px";
      wlls = "1fr";
      var ww2s = ww*2 + "px";
      ww2s = "1fr";

      // let xl = x+w-(wl+(2*ww)); // x when fully expanded left
      let xl = cmdBbox.x+w;
      // create a new div that will walk through the process for this command mode
      var details = document.createElement("div");
      // details.style.gridTemplateColumns = `0px ${wh} ${wh} 0px 0px 0px 0px`;
      // details.style.gridTemplateRows = `0px ${h}px 0px 0px 0px 0px 0px 0px 0px`;

      var runningColumns = `0px 0px 0px 0px 0px 0px 0px 0px`; // this shouldn't be necssary...
      var runningTransform = `translate3D(${ Math.round(xl) }px, ${ Math.round(y) }px, 0px)`;
      details.style.transform = runningTransform;
      details.style.height = cmdBbox.height+"px";
      // details.style.border = `2px solid rgb(${this.fgColors[this.mode]})`;
      details.style.backgroundColor = `rgba(${this.bgColors[this.mode]},1)`;
      details.style.color = `rgba(${this.fgColors[this.mode]},1)`;

      details.classList.add("decomp_animation_details");
      this.details = document.getElementById("animationTop").appendChild(details);
      // this.details = details;

      //
      var cmd1 = this.compContent.querySelector(`.byte_group > #byte_${hex( (1+this.compIndex), 6 )} > .byte`);
      var cmd2 = this.compContent.querySelector(`.byte_group > #byte_${hex( (2+this.compIndex), 6 )} > .byte`);

      // now fill out the details div with contents.
      // let bgc = `background-color: rgba(${this.modeColor.map(d=>d*0.25)},1); `;
      let bgc = `background-color: rgba(${this.bgColors[this.mode]},1); color: rgba(${this.fgColors[this.mode]},1); `;
      let clsnm = "decomp_animation_details_item";
      let bbl = 'div class="bubbleCell">';

      // Animation of details div
      // see how many steps the animation will go through:
      var total; // total steps
      switch(this.mode){
        case 2:
          total = 9;
          break;
        case 3:
          total = 7;
          break;
        default:
          total = 4;

      }
      // timing:
      var detailsKeyframesDuration = this.detailsTime*total/4; // 7
      var count = 1;

      // new method; rolling columns (all in one row)
      // custom object to allow the "keyframe builder" to be more modular.
      //HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
      // a⮀❮⇋↹⇄━─═▶--►▸⇒⇨➠➔➜➩➧➤⭆⮞🡆🠞🡢🡪🡪🡲🡺🢥⟹⇒🡒
      this.detailsObjects = [
        // First, basically a copy of cmd cell
        {
          text: [this.cmdHex],
          width: cmdBbox.width,
          widthUnits: "px",
          class: ['bubbleCellOne'],
          transform: runningTransform+""
        },
        // binary
        {
          text: [` -to-binary-> `,` ${this.cmdBin} `],
          class: ['notBubble','bubbleCell']
        },
        // binary mode/operand
        {
          text: [` -split-bits-> `,` Mode: ${this.cmdBin.slice(0,2)} `,` Operand: ${this.cmdBin.slice(2)} `],
          class: ['notBubble','bubbleCell','bubbleCell']
        },
        // hex mode/operand
        {
          text: [` -hex-> `,` Mode: ${this.mode} (${this.modeNames[this.mode]}) `,` Operand: ${hex(this.n,2)} (${this.operandNames[this.mode]}) `],
          class: ['notBubble','bubbleCell','bubbleCell n']
        }
      ];

      // special stuff for modes 2 and 3
      if (this.mode>1){
        // setup
        var panel = (this.mode==2) ? this.decomp : this.comp;
        var panelContent = (this.mode==2) ? this.decompContent : this.compContent;
        var contentBbox = panelContent.getBoundingClientRect();
        // console.log('addressByte selector: '+`div > #g0x${hex( 32*(this.address>>5), 6 )} div #byte_${hex( this.address, 6 )}`);
        var addressByte = panelContent.querySelector(`.byte_group > #byte_${hex( this.address, 6 )} > .byte`);
        var addrByteBbox = addressByte.getBoundingClientRect();
        var deltay = 0;


        if (this.mode==2) {
          this.detailsObjects.push(...[
            
            {
              text: [` swap next 2 bytes -> `],
              class: ['notBubble']
            },
            // filler
            // {
              
            // },
            {
              text: [``,` history address: ${hex(this.address,4)} `],
              class: ['notBubble','bubbleCell']
            },
            // {
            //   text: [` swap next 2 bytes -> `,` history address: ${hex(this.address,4)} `],
            //   class: ['notBubble','bubbleCell']
            // },

          ]);
          //TODO: style the following two bytes as bblLeft and bblRight, aynced at this time
          // var cmd1 = this.compContent.querySelector(`div > #g0x${hex( 32*((1+this.compIndex)>>5), 6 )} div #byte_${hex( (1+this.compIndex), 6 )}`);
          //   if (cmd1.style.backgroundColor != `rgba(${this.bgColors[this.mode]},1)`){
          //     cmd1.style.backgroundColor = `rgba(${this.bgColors[this.mode]},1)`;
          //     cmd1.style.color = `rgba(${this.fgColors[this.mode]},1)`;
          //     // cmd1.style.borderRadius = `${crnr} 0 0 ${crnr}`;

          //     var cmd2 = this.compContent.querySelector(`div > #g0x${hex( 32*((2+this.compIndex)>>5), 6 )} div #byte_${hex( (2+this.compIndex), 6 )}`);
          //     cmd2.style.backgroundColor = `rgba(${this.bgColors[this.mode]},1)`;
          //     cmd2.style.color = `rgba(${this.fgColors[this.mode]},1)`;
          //     cmd2.style.borderRadius = `0 ${crnr} ${crnr} 0`;
          //   }
        }
        else if (this.mode==3) {
          // ` ×2 -> ` ` <<1 -> `
          this.detailsObjects.push(...[
            {
            text: [` ×2 -> `,` LUT byte address: ${hex(this.address,4)} `],
            class: ['notBubble','bubbleCell']
            }
          ]);



        }

        // establish scroll, if needed:
        // (will determine vertical position of details div)
        var offsetPos = panel.checkOffsetPosition( this.address);
        //
        if (offsetPos.inView){
          // go directly there if it's in view
          this.detailsObjects.push(...[
            {
              transform: `translate3D(${Math.round(addrByteBbox.x)}px, ${Math.round(addrByteBbox.y)}px, ${0}px)`,
              height: addrByteBbox.height+"px"
            },
          ]);

        } else{
          // go to top left, scroll it into view at the top, then go to right
          this.detailsObjects.push(...[
            {
              transform: `translate3D(${contentBbox.x}px, ${contentBbox.y}px, ${0}px)`
            },
            {
              transform: `translate3D(${Math.round(addrByteBbox.x)}px, ${Math.round(contentBbox.y)}px, ${0}px)`,
              height: addrByteBbox.height+"px"
            },
          ]);

          // set scrolling timeout now that we know length of detailsObjects
          var scrollStartTime = detailsKeyframesDuration*(this.detailsObjects.length-2)/this.detailsObjects.length;
          // var scrollStartTime = this.scrollTime;
          // console.log(`scrollStartTime:   ${scrollStartTime}`);
          // setTimeout( ()=>{
          //   // try {
          //     console.log("1) in settimeout for scroll. panel content:");
          //     // console.log(panelContent);
          //     panelContent.scrollTo({top: offsetPos.position, behavior: 'smooth'});

          //     //(content, startPos, endPos, duration, delay=0, steps=null, hold=false)
          //     this.scrollContent(content, startPos, endPos, duration, delay=0, steps=null, hold=false);

          //   },
          //   scrollStartTime*1000
          // );
          
          // create a scroll animation and add it to our list of animations
          // (content, startPos, endPos, duration, delay=0, steps=null, hold=false)
          anims.push(
            this.scrollContent(panelContent, 0, 0, detailsKeyframesDuration, 0, 
              [
                {percent: 100*scrollStartTime/detailsKeyframesDuration, props: {position:panelContent.scrollTop}},
                {percent: 100*(scrollStartTime+this.scrollTime)/detailsKeyframesDuration, props: {position:offsetPos.position}},                  
              ], true)
          );

        }

      }


      // build the html
      var texts = 0;
      var transforms = 0;
      var textsColWidths = [];


      this.details.innerHTML = ``;

      this.detailsObjects.forEach((d,i)=>{
        if (d.text) {
            let inners = d.text.reduce( (s,e,j) => s+='<div class="'+d.class[j]+'">'+d.text[j].replaceAll(" ","&nbsp;")+'</div>','');

            // console.log(inners);
            this.details.innerHTML+=`<div class="${clsnm}" style="grid-row: 1; grid-column: ${1+i};">`+inners+`</div>`;
            texts++;

          textsColWidths.push( (d.widthUnits==undefined)?"0ch":"0"+d.widthUnits);

        }
        if (d.transform) transforms++;

      });

      // track this animation, for pausing, etc
      let anim = new Animation();
      anim.element = this.details; //the actual node
      anim.keyframeName = `Mode_${this.mode}_details_${Date.now()}`;;
      anim.baseDuration = detailsKeyframesDuration;
      anim.duration = detailsKeyframesDuration;
      anim.easingFunction = 'linear';
      anim.progress = 0;
      anim.name = "Details Div, Mode "+this.mode;
      anim.steps = [];

      // this.initElement( anim ); // have to add steps first


      var textsColWidthsOG = Array.from(textsColWidths);
      var twindow = (this.mode==2) ? 3 : 2;
      // console.log(`${this.details.innerHTML}\nAfter building html, counted ${texts} texts and ${transforms} transforms`);

      // keyframes:
      var textCount = 0;
      var rts = false; // returnToStart - this idea didn't work so it's being debugged-out for now...
      var returning = (this.mode>1) && rts;
      
      var lastTextTimes = [0,1]; // percent that the last text appears
      var secondToLastTextTimes = [0, 1];
      var thirdToLastTextTimes = [0, 1];
      this.detailsObjects.forEach((d,i)=>{
        // update text width info
          if (d.text) {
            textCount++;
            // roll the window (update current, remove last if present)
            textsColWidths[i] = d.width ? d.width+""+d.widthUnits : (d.text.reduce((s,d,i)=>s+=d.length+0,0)+1)+"ch";
            if (i-twindow >= 0) textsColWidths[i-twindow] = textsColWidthsOG[i-twindow];
            thirdToLastTextTimes = [...secondToLastTextTimes];
            secondToLastTextTimes = [...lastTextTimes];
            lastTextTimes = [detailsKeyframesDuration*(i+0.66)/this.detailsObjects.length, detailsKeyframesDuration*(i+1)/this.detailsObjects.length];
          }

          // new way to prepare for building keyframes, more modular... ------
          let props = {
            'background-color': this.bgColors[this.mode],
            'color': this.fgColors[this.mode],
            'height': d.height ? d.height : cmdBbox.height+"px", 
            'grid-template-columns': d.text ? (runningColumns=textsColWidths.join(" ")) : runningColumns,
            'transform': d.transform ? (runningTransform=d.transform) : runningTransform,
          };
          anim.steps.push(...[
            // the first; previous would animate up to here and stop...
            { 'percent': 100*(i)/(this.detailsObjects.length), 'props': {...props} },
            // ...then we stay here until THIS one's percent
            { 'percent': 100*(i+0.66)/(this.detailsObjects.length), 'props': {...props} }
          ]);

          // // if it's the last and we want to close it off:
          // if ((i+1==this.detailsObjects.length) && !returning) anim.steps.push(
          //   {'percent': 100, 'props': {...props} }
          // );
          // ------

          // old way: --------------
          // add the next keyframe.
          // If it's the last, and we didnt move details (mode 0 and 1 stay in place), close it with "100%"

          // keyframes+=`/* ${i+1} of ${this.detailsObjects.length}; should be at time ${detailsKeyframesDuration*(i)/(this.detailsObjects.length)} */
          // ${100*(i)/(this.detailsObjects.length)}%,
          // ${100*(i+0.66)/(this.detailsObjects.length)}%${(i+1==this.detailsObjects.length) && !returning ?', 100%':''} {
          //   grid-template-columns: ${ d.text ? (runningColumns=textsColWidths.join(" ")) : runningColumns };
          //   transform: ${ d.transform ? (runningTransform=d.transform) : runningTransform };
          // }
          // `;
          //--------------------

        });


      // if mode 3 or 4, we move back to the starting point real quick
      // if ( returning && (this.mode>1) ) {
      if ( returning ) {
        // keyframes+=`
        //     100% {
        //       grid-template-columns: ${ [this.detailsObjects[0].width, ...textsColWidthsOG.slice(1)].join(" ") };
        //       transform: ${ this.detailsObjects[0].transform };
        //     }
        //   }`;
        anim.steps.push( {...anim.steps[0], 'percent': 100} );
      } else {
        // keyframes+=`}`; // else just close it up
        0;
      }
      // console.log( anim.steps);

      // new modulalr version: build the keyframes:
      // keyframes = this.buildKeyframe(anim);



    // old method ---------------
    // insert into stylesheet at index 0
    // document.styleSheets[0].insertRule(keyframes);

    // // apply the animation ("forwards" might be important?)
    // this.details.style.animation = `${detailsName} ${(this.mode==2)?detailsKeyframesDuration:detailsKeyframesDuration}s linear forwards`;
    // -------------------------


    

    // also animate the appearance of bubble around the cmd and maybe cmd1 and cmd2 bytes:
    var bblBoth = this.bblBoth;
    var bblLeft = this.bblLeft;
    var bblRight = this.bblRight;
    var bblNone = this.bblNone;
    var totalTime2 = detailsKeyframesDuration + this.bblTime;
    

    // cmd:
    let cmdDivAnim = new Animation();
    cmdDivAnim.name = "cmdDiv animation";
    cmdDivAnim.element = cmd;
    cmdDivAnim.baseDuration = totalTime2;
    cmdDivAnim.easingFunction = "ease";
    cmdDivAnim.keyframeName = `cmdDivStyle_${Date.now()}`;
    cmdDivAnim.steps = [];
    


    // 
    var cmdDivCompStyle = getComputedStyle(cmd);
    let origs = {
      'color':cmdDivCompStyle.getPropertyValue('color'),
      'background-color':cmdDivCompStyle.getPropertyValue('background-color'),
      'border':cmdDivCompStyle.getPropertyValue('border'),
      
    }


    var cmdBblTime = (this.mode==2) ? thirdToLastTextTimes[0] : detailsKeyframesDuration;
    if (this.mode==3) cmdBblTime = 0;

    cmdDivAnim.steps = [
      { 'percent': [0, 100*(cmdBblTime)/totalTime2],  'props': { ...origs } },
      // make it the same color from the start; we assume details div is over top anyway
      { 'percent': 0.02+(100*(cmdBblTime)/totalTime2), 'props': { 
        'background-color': `rgba(${this.bgColors[this.mode]},1)`,
        'color': `rgba(${this.fgColors[this.mode]},1)`,
        'border-radius': bblBoth} },
      // quickly morph to fit next
      { 'percent': 100*(cmdBblTime+this.bblTime)/totalTime2, 'props': {
        'border-radius': (this.mode==3) ? bblBoth : bblLeft
      } }
    ];
    anims.push( cmdDivAnim );


    // if mode 2 history, cmd 1 and cmd 2:
    if (this.mode==2){
      let histStart = 1;
      [cmd1, cmd2].forEach( (d,i)=>{

        let cmdxDivAnim = new Animation();
        cmdxDivAnim.name = "cmd"+(1+i)+" Div animation";
        cmdxDivAnim.element = d;
        cmdxDivAnim.baseDuration = totalTime2;
        cmdxDivAnim.easingFunction = "ease";
        cmdxDivAnim.keyframeName = `cmd${1+i}DivStyle_${Date.now()}`;

        cmdDivCompStyle = getComputedStyle(d);
        let xorigs = {
          'color':cmdDivCompStyle.getPropertyValue('color'),
          'background-color':cmdDivCompStyle.getPropertyValue('background-color'),
          'border':cmdDivCompStyle.getPropertyValue('border'),
          
        }

        cmdxDivAnim.steps = [
          { 'percent': [0, 100*thirdToLastTextTimes[0]/totalTime2], 'props': { ...xorigs} },
          // when the mover div appears, coming out of this, instantly* make it the same color:
          { 'percent': 0.02+(100*thirdToLastTextTimes[0]/totalTime2), 'props': { 
            'background-color': `rgba(${this.bgColors[this.mode]},1)`,
            'color': `rgba(${this.fgColors[this.mode]},1)`,
            'border-radius': bblBoth} },
          // quickly morph to fit adjacent cells
          { 'percent': 100*(thirdToLastTextTimes[0]+this.bblTime)/totalTime2, 'props': {
            'border-radius': (i==0) ? bblNone : bblRight
          } }
        ];

        // console.log(cmdxDivAnim.steps);

        anims.push( cmdxDivAnim );

      });

    }


    

    // new method : actually start animations -----------
    anims.forEach(d=> {this.initElement(d);});
    
    this.initElement(anim);
    // console.log(anim.keyframes);

    anims.forEach(d=> {this.startElement(d);});
    this.startElement(anim);

    // ---------------------
    

    // not sure if it matters...
    anim.element.addEventListener("animationend", ()=>{
        // this.details.addEventListener("animationend", ()=>{



        // ---------------------------------------------------------------
        //
        // LEVEL 2
        //  cloneAndMove outline
        //
        // SETUP:
        this.compIndex; // increment to the byte following the command byte
        // starting at an <index (mode 0 and 1: this.compIndex, modes 2 and 3: this.address)> of <panel (mode 0,1,3: comp; mode 2: decomp)>,
        var cloneTotal = 0;
        var cloneOffset = (this.mode<2) ? this.compIndex+1 : this.address;
        var clonePanel = (this.mode==2) ? this.decomp : this.comp;
        var clonePanelContent = (this.mode==2) ? this.decompContent : this.compContent;
        this.firstIncomplete = true;

        // ...highlight and clone <a (
        // mode 0: this.n,
        // mode 1: 1,
        // mode 2: this.n,
        // mode 3: 2
        // )> bytes...
        var a = [this.n, 1, this.n, 2][this.mode];
        //... <b (mode 1: n, else 1)> time(s) each...
        var b = (this.mode==1) ? this.n : 1;
        this.axb = a*b;
        this.axbi = a*b; // will count down

        // ... (decrementing the visible n value each time for modes 0,1, and 2)
        // scroll decomp into view if needed
        // this.decomp.scrollToView();

        // see if we'll need to scroll the decomp panel between picking up the data
        // and moving it to current output index:
        // if ( (this.mode==2) && !offsetPos.inView ){
        //   //checkOffsetPosition( this.decompIndex, 2, 2 );
        //   // var historyPos = this.decomp.checkOffsetPosition( this.address);
        //   this.decompScrollPos = this.decomp.checkOffsetPosition( this.decompIndex);
        //   //{inView: false, position: offsetPos, topMargin: topRowMargin*rowHeight, windowHeight:windowHeight, rowHeight:rowHeight}
        //   // we want to know where we'll need to scrol to: it'll actually just be hex_ccontent's top plus the margin
        //   // hc.y + topMargin;
        //   // for each: hcTop.y + ( thisToDiv_.position_from_checkOffsetPosition - positionWillScrollTo );
        //   var willNeedToScroll = (decompPos.position - historyPos.position - (2*decompPos.rowHeight)) > decompPos.windowHeight;
        //   setTimeout( ()=>{
        //     // try {
        //       console.log("1) in settimeout for scroll. panel content:");
        //       // console.log(panelContent);
        //       panelContent.scrollTo({top: historyPos.position-topMargin, behavior: 'smooth'});

        //     },
        //     scrollStartTime*1000
        //   );
        // } else {
        //   this.decompScrollPos = undefined;
        // }

        //...or, if we had to scroll up to get to history, we'll have to scroll down again, assuming we'll
        // go back to the first address+topMargin

        // offsetPos.position

        // move all clones into decomp starting at this.decompIndex
        // we usually do them in series,
        // but for mode 2 HISTORY we might want to do them  semi-parallel,
        // because we might need to scroll the entire page.
        this.moveBuffer = [];

        if ( ( (this.mode==2) && !offsetPos.inView ) || this.parallelize ){
            // console.log("first case");
            // move all in a batch
            var batch = [];
            for (let i = a; i>0; i--){
            for (let j = b; j>0; j--){
                batch.push(
                clonePanelContent.querySelector(
                    `.byte_group > #byte_${hex( cloneOffset, 6 )} > .byte`
                )
                );
            }
            cloneOffset++;
            // cloneTotal++;
            }
            this.moveBuffer.push( batch ); // note; not popping, won't reverse

        } else {
            // console.log("secnd case");
            // move all in series.
            for (let i = a; i>0; i--){
            for (let j = b; j>0; j--){
                // `div > #g0x${hex( 32*(cloneOffset>>5), 6 )} div #byte_${hex( cloneOffset, 6 )}`
                this.moveBuffer.push(
                [ clonePanelContent.querySelector(
                    `.byte_group > #byte_${hex( cloneOffset, 6 )} > .byte`
                ) ]
                );
            }
            cloneOffset++;
            // cloneTotal++;
            }

        }

        this.cloneIndex = 0;
        this.previousFromDiv = null;
        this.previousToDiv = null;
        this.willScrollDecomp = ( (this.mode==2) && !offsetPos.inView );


        // reverse, because we'll be popping
        this.moveBuffer = this.moveBuffer.reverse();
        // console.log(this.moveBuffer)

        // Call the function to perform the moving (recursively iterates through the this.moveBuffer)
        this.cloneAndMove();

    }); // end of level 2, moving the details div vertically, and horizontally




    }

    // skip: function(){
    //   if (!this.skipping){
    //     // 0) enter skipping mode if not already in it
    //     this.skipping = true;
    //     // 1) setting a global duration scaler to be very short,
    //     this.durationScale = 1*this.skippingDurationScale;
    //   }


    //   // 2) For each element:
    //   this.elements.forEach( d => {
    //     // pause element and recalculate the progress percentage
    //     this.pauseElement(d);
    //     // record the new shortened duration

    //     // apply the new duration and a negative delay so that it will begin at the same point.
    //     this.assignAnimation(d);
    //     // pause

    //   });

    //   // 3) pausing all elements

    // }
    // stepCount: 0,

    // step: function (){

    //   var ani = this.stack.pop();

    //   // for each element in this set of parallel animations:
    //   ani.forEach( d=> d() );

    //   // remove this one from this.animatingElements:
    //   this.animatingElements.filter(d=>d!=element);

    // },
    // pause: function (){

    //   this.animatingElements.forEach (d=>d.style.animationPlayState = 'paused');

    // }
    // play: function (){

    //   this.animatingElements.forEach (d=>d.style.animationPlayState = 'running');

    // }


  }