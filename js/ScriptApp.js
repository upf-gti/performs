import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { CharacterController } from './controllers/CharacterController.js';
import { sigmlStringToBML } from './sigml/SigmlToBML.js';
import { findIndexOfBone } from "./sigml/Utils.js";
import { BVHLoader } from './extendedBVHLoader.js';
import { AnimationRetargeting } from './retargeting/retargeting.js';

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class ScriptApp {

    constructor() {
        
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();
        this.loaderGLB = new GLTFLoader();
        
        this.controllers = {}; // store avatar controllers
        this.ECAcontroller = null; // current selected
        this.eyesTarget = null;
        this.headTarget = null;
        this.neckTarget = null;
        
        this.msg = {};
        
        this.languageDictionaries = {}; // key = NGT, value = { glosses: {}, word2ARPA: {} }
        this.selectedLanguage = "NGT";       

        this.loadedIdleAnimations = {};
        this.bindedIdleAnimations = {};
        this.currentIdle = "";
        this.baseSkeleton = null;
        this.applyIdle = false;

        this.intensity = 0.3;
        this.speed = 1;

        this.mood = "Neutral";
        this.moodIntensity = 1.0;
        
        this.scene = null;
    }

    // loads dictionary for mouthing purposes. Not synchronous.
    loadMouthingDictionary( language ){
        let that = this;
               
        fetch("./data/dictionaries/" + language + "/IPA/ipa.txt").then(x => x.text()).then(function(text){ 

            let texts = text.split("\n");
            let IPADict = {}; // keys: plain text word,   value: ipa transcription
            let ARPADict = {}; // keys: plain text word,   value: arpabet transcription
            
            //https://www.researchgate.net/figure/1-Phonetic-Alphabet-for-IPA-and-ARPAbet-symbols_tbl1_2865098                
            let ipaToArpa =  {
                // symbols
                "'": "", // primary stress
                '.': " ", // syllable break
                
                // vowels
                'a': "a",   'ɑ': "a",   'ɒ': "a", 
                'œ': "@",   'ɛ': "E",   'ɔ': "c",
                'e': "e",   'ø': "e",   'ə': "x",   'o': "o",  
                'ɪ': "I",   'i': "i",   'y': "i",   'u': "u",   'ʉ': "u",

                // consonants
                'x': "k",   'j': "y",   't': "t",   'p': "p",   'l': "l",   'ŋ': "G", 
                'k': "k",   'b': "b",   's': "s",   'ʒ': "Z",   'm': "m",   'n': "n", 
                'v': "v",   'r': "r",   'ɣ': "g",   'f': "f",   'ʋ': "v",   'z': "z", 
                'h': "h",   'd': "d",   'ɡ': "g",   'ʃ': "S",   'ʤ': "J"
            };
            let errorPhonemes = {};


            for(let i = 0; i < texts.length; ++i){
                let a = texts[i].replace("\t", "").split("\/");
                if (a.length < 2 || a[0].length == 0 || a[1].length == 0 ){ continue; }

                IPADict[ a[0] ] = a[1];

                let ipa = a[1];
                let arpa = "";

                // convert each IPA character into correpsonding ARPABet
                for( let j = 0; j < ipa.length; ++j ){
                    if ( ipa[j] == 'ː' || ipa[j] == ":" ) { arpa += arpa[arpa.length-1]; continue; }
                    let s = ipaToArpa[ ipa[j] ];
                    if ( s != undefined ){ arpa += s; continue; }
                    errorPhonemes[ s ];
                }

                ARPADict[ a[0] ] = arpa; 

            }

            if ( Object.keys(errorPhonemes).length > 0 ){ console.error( "MOUTHING: loading phonetics: unmapped IPA phonemes to ARPABET: \n", errorPhonemes ); }

            that.languageDictionaries[ language ].word2ARPA = ARPADict;

        });
    }

    // convert plain text into phoneme encoding ARPABet-1-letter. Uses dictionaries previously loaded 
    wordsToArpa ( phrase, language = "NGT" ){
        
        if ( !this.languageDictionaries[ language ] || !this.languageDictionaries[ language ].word2ARPA ){
            console.warn( "missing word-ARPABET dictionary for " + language );
            return "";
        }
        let word2ARPA = this.languageDictionaries[ language ].word2ARPA;
        let words = phrase.replace(",", "").replace(".", "").split(" ");

        let result = "";
        let unmappedWords = [];
        for ( let i = 0; i < words.length; ++i ){
            let r = word2ARPA[ words[i] ] ;
            if ( r ){ result += " " + r; }
            else{ unmappedWords.push( words[i]); }
        }
        if ( unmappedWords.length > 0 ){ console.error("MOUTHING: phrase: ", phrase, "\nUnknown words: ",JSON.stringify(unmappedWords)); }
        return result;
    
    }

    loadLanguageDictionaries( language ){
        this.languageDictionaries[ language ] = { glosses: null, wordsToArpa: null };

        this.loadMouthingDictionary( language );

        fetch( "./data/dictionaries/" + language + "/Glosses/_glossesDictionary.txt").then( (x)=>x.text() ).then( (file) =>{
            let glossesDictionary = this.languageDictionaries[ language ].glosses = {};
            let lines = file.split("\n");
            for( let i = 0; i < lines.length; ++i ){
                if ( !lines[i] || lines[i].length < 1 ){ continue; }
                let map = lines[i].split("\t");
                if ( map.length < 2 ){ continue; }
                glossesDictionary[ map[0] ] = map[1].replace("\r", "").replace("\n", "");
            }
        } );
    }

    async loadIdleAnimations(animations)
    {
        let loader = new BVHLoader();
        let promises = [];

        // Load current character
        for(let i = 0; i < animations.length; i++) {
            let filePromise = fetch(animations[i]).then(x => x.text()).then((text) =>{ 
                const data = loader.parseExtended(text);
                const name = animations[i].split("/").pop();
                
                this.loadBVHAnimation( name, data );
            })
            promises.push(filePromise);
        }

        return Promise.all(promises);
    }

    // load animation from bvhe file
    loadBVHAnimation(name, animationData) { // TO DO: Refactor params of loadAnimation...()

        let skeleton = null;
        let bodyAnimation = null;
        let faceAnimation = null;
        if ( animationData && animationData.skeletonAnim ){
            skeleton = animationData.skeletonAnim.skeleton;
            if(!skeleton) {
                return;
            }
            skeleton.bones.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()|+\-=?;:'"<>\{\}\\\/]/gi, "") } );
            // loader does not correctly compute the skeleton boneInverses and matrixWorld 
            skeleton.bones[0].updateWorldMatrix( false, true ); // assume 0 is root
            skeleton = new THREE.Skeleton( skeleton.bones ); // will automatically compute boneInverses
            
            animationData.skeletonAnim.clip.tracks.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()|+\-=?;:'"<>\{\}\\\/]/gi, "") } );     
            animationData.skeletonAnim.clip.name = "bodyAnimation";
            bodyAnimation = animationData.skeletonAnim.clip;
        }
        
        if ( animationData && animationData.blendshapesAnim ){
            animationData.blendshapesAnim.clip.name = "faceAnimation";       
            faceAnimation = animationData.blendshapesAnim.clip;
        }
        
        this.loadedIdleAnimations[name] = {
            name: name,
            bodyAnimation: bodyAnimation ?? new THREE.AnimationClip( "bodyAnimation", -1, [] ),
            faceAnimation: faceAnimation ?? new THREE.AnimationClip( "faceAnimation", -1, [] ),
            skeleton,
            type: "bvhe"
        };
    }

    /**
     * KeyframeEditor: fetches a loaded animation and applies it to the character. The first time an animation is binded, it is processed and saved. Afterwards, this functino just changes between existing animations 
     * @param {String} animationName 
     * @param {String} characterName 
     */
    bindAnimationToCharacter(animationName, characterName) {
        
        let animation = this.loadedIdleAnimations[animationName];
        if(!animation) {
            console.warn(animationName + " not found");
            return false;
        }
        this.currentAnimation = animationName;
        
        let currentCharacter = this.controllers[characterName];
        if(!currentCharacter) {
            console.warn(characterName + ' not loaded')
        }
      
        currentCharacter.originalSkeleton.pose(); // for some reason, mixer.stopAllAction makes bone.position and bone.quaternions undefined. Ensure they have some values
        // if not yet binded, create it. Otherwise just change to the existing animation
        if ( !this.bindedIdleAnimations[animationName] || !this.bindedIdleAnimations[animationName][currentCharacter.character.name] ) {
            let bonesNames = [];
            let bodyAnimation = animation.bodyAnimation;        
            if(bodyAnimation) {
            
                let tracks = [];        
                // Remove position changes (only keep i == 0, hips)
                for (let i = 0; i < bodyAnimation.tracks.length; i++) {

                    if(bodyAnimation.tracks[i].name.includes('position')) {
                        continue;
                    }
                    tracks.push(bodyAnimation.tracks[i]);
                    tracks[tracks.length - 1].name = tracks[tracks.length - 1].name.replace( /[\[\]`~!@#$%^&*()|+\-=?;:'"<>\{\}\\\/]/gi, "").replace(".bones", "");
                }

                bodyAnimation.tracks = tracks;            
                let skeleton = animation.skeleton;
            
                let retargeting = new AnimationRetargeting(skeleton, currentCharacter.character, { trgUseCurrentPose: true, trgEmbedWorldTransforms: true, srcPoseMode: AnimationRetargeting.BindPoseModes.TPOSE, trgPoseMode: AnimationRetargeting.BindPoseModes.TPOSE } ); // TO DO: change trgUseCurrentPose param
                bodyAnimation = retargeting.retargetAnimation(bodyAnimation);
                
                bonesNames = this.validateAnimationClip(bodyAnimation);
                bodyAnimation.name = "bodyAnimation";   // mixer
            }
                
            let faceAnimation = animation.faceAnimation;        
           
            if(!this.bindedIdleAnimations[animationName]) {
                this.bindedIdleAnimations[animationName] = {};
            }
            this.bindedIdleAnimations[animationName][currentCharacter.character.name] = {
                mixerBodyAnimation: bodyAnimation, mixerFaceAnimation: faceAnimation, bonesNames // for threejs mixer 
            }
        }

        let bindedAnim = this.bindedIdleAnimations[animationName][currentCharacter.character.name];
        
        // Remove current animation clip
        let mixer = currentCharacter.mixer;
        mixer.stopAllAction();
        
        while(mixer._actions.length){
            mixer.uncacheClip(mixer._actions[0]._clip); // removes action
        }

        mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(this.intensity).play();
        mixer.update(0);

        this.mixer = mixer;
        this.duration = bindedAnim.mixerBodyAnimation.duration;
       
        // Clone skeleton with first frame of animation applied, for using it in additive blending
        let bones = currentCharacter.originalSkeleton.bones;
        let resultBones = new Array( bones.length );
        
        // bones[0].clone( true ); // recursive
        for( let i = 0; i < bones.length; ++i ){
            resultBones[i] = bones[i].clone(false);
            resultBones[i].parent = null;
        }
        
        for( let i = 0; i < bones.length; ++i ){
            let parentIdx = findIndexOfBone(currentCharacter.originalSkeleton, bones[i].parent);
            if ( parentIdx > -1 ){ resultBones[ parentIdx ].add( resultBones[ i ] ); }   
        }
        
        resultBones[0].updateWorldMatrix( false, true ); // assume 0 is root. Update all global matrices (root does not have any parent)          
        this.baseSkeleton = new THREE.Skeleton(resultBones);       

        return true;
    }

    /** Validate body animation clip created using ML */
    validateAnimationClip(clip) {

        let newTracks = [];
        let tracks = clip.tracks;
        let bones = this.ECAcontroller.originalSkeleton.bones;
        let bonesNames = [];
        tracks.map((v) => { bonesNames.push(v.name.split(".")[0])});

        for(let i = 0; i < bones.length; i++)
        {
            
            let name = bones[i].name;
            if(bonesNames.indexOf( name ) > -1)
                continue;
            let times = [0];
            let values = [bones[i].quaternion.x, bones[i].quaternion.y, bones[i].quaternion.z, bones[i].quaternion.w];
            
            let track = new THREE.QuaternionKeyframeTrack(name + '.quaternion', times, values);
            newTracks.push(track);
            
        }
        clip.tracks = clip.tracks.concat(newTracks);
        return bonesNames;
    }

    init(scene) {
        this.loadLanguageDictionaries( "NGT" );
        
        // Behaviour Planner
        this.eyesTarget = new THREE.Object3D(); //THREE.Mesh( new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthWrite: false }) );
        this.eyesTarget.name = "eyesTarget";
        this.eyesTarget.position.set(0, 2.5, 15); 
        this.headTarget = new THREE.Object3D(); //THREE.Mesh( new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({ color: 0xff0000 , depthWrite: false }) );
        this.headTarget.name = "headTarget";
        this.headTarget.position.set(0, 2.5, 15); 
        this.neckTarget = new THREE.Object3D(); //THREE.Mesh( new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({ color: 0x00fff0 , depthWrite: false }) );
        this.neckTarget.name = "neckTarget";
        this.neckTarget.position.set(0, 2.5, 15); 

        scene.add(this.eyesTarget);
        scene.add(this.headTarget);
        scene.add(this.neckTarget);

        this.scene = scene;
    }
        
    update( deltaTime ) {
        deltaTime*=this.speed;
        this.elapsedTime += deltaTime;
        
        if ( this.ECAcontroller ){ this.ECAcontroller.update( deltaTime, this.elapsedTime ); }
        
        const bmlSkeleton = this.ECAcontroller.skeleton;
        const animatedSkeleton = this.ECAcontroller.originalSkeleton;
        // Apply additive blending animation to the bml animation
        if(this.applyIdle && this.baseSkeleton && this.mixer) {
            if(this.mixer) {
                this.mixer.update(deltaTime/this.speed);           
            }

            const anim = this.bindedIdleAnimations[this.currentIdle][this.ECAcontroller.character.name];
            const boneNames = anim.bonesNames;
            
            for(let i = 0; i < bmlSkeleton.bones.length; i++) {
                
                let input = bmlSkeleton.bones[i].quaternion.clone();
                
                if(bmlSkeleton.bones[i].name.includes("RightHand") || bmlSkeleton.bones[i].name.includes("LeftHand") || boneNames.indexOf(bmlSkeleton.bones[i].name) < 0) {
                    animatedSkeleton.bones[i].quaternion.copy(input);
                    animatedSkeleton.bones[i].position.copy(bmlSkeleton.bones[i].position);                    
                    continue;
                }
                const add = animatedSkeleton.bones[i].quaternion.clone();
                const addBase = this.baseSkeleton.bones[i].quaternion.clone();
                input.multiply(addBase.invert().multiply(add));
                animatedSkeleton.bones[i].quaternion.copy(input);
            }
            animatedSkeleton.bones[0].updateWorldMatrix(false, true);
        
        } else {
            for(let i = 0; i < bmlSkeleton.bones.length; i++) { 
                animatedSkeleton.bones[i].position.copy(bmlSkeleton.bones[i].position);
                animatedSkeleton.bones[i].quaternion.copy(bmlSkeleton.bones[i].quaternion);
                animatedSkeleton.bones[i].scale.copy(bmlSkeleton.bones[i].scale);
            }

        }
    }

    replay() {
        if(!this.msg) {
            return;
        }
        
        this.ECAcontroller.processMsg( JSON.parse( JSON.stringify(this.msg) ) ); 
    }

    onLoadAvatar(newAvatar, config, skeleton){
        newAvatar.eyesTarget = this.eyesTarget;
        newAvatar.headTarget = this.headTarget;
        newAvatar.neckTarget = this.neckTarget;
            
        const mixer = new THREE.AnimationMixer(newAvatar);  
        this.mixer = mixer;

        // Clone skeleton in bind pose for the CharacterController (compute the animation in an auxiliary skeleton)
        skeleton.pose();
        let bones = skeleton.bones;
        let resultBones = new Array( bones.length );
        
        // bones[0].clone( true ); // recursive
        for( let i = 0; i < bones.length; ++i ){
            resultBones[i] = bones[i].clone(false);
            resultBones[i].parent = null;
        }
        
        for( let i = 0; i < bones.length; ++i ){
            let parentIdx = findIndexOfBone( skeleton, bones[i].parent )
            if ( parentIdx > -1 ){ resultBones[ parentIdx ].add( resultBones[ i ] ); }   
        }

        let root = bones[0].parent.clone(false);
        root.add(resultBones[0]);
        if(bones[0].parent.parent) {
            let parent = bones[0].parent.parent.clone(false);
            parent.add(root);
            this.scene.add(parent)
        }
        else {
            this.scene.add(root)
        }
        resultBones[0].updateWorldMatrix( true, true ); // assume 0 is root. Update all global matrices (root does not have any parent)
        let resultSkeleton = new THREE.Skeleton(resultBones);

        let ECAcontroller = new CharacterController( {character: newAvatar, characterConfig: config, skeleton: resultSkeleton} );
        ECAcontroller.start();
        ECAcontroller.reset();
        ECAcontroller.processMsg( { control: 2 } ); // speaking mode
        ECAcontroller.originalSkeleton = skeleton;
        ECAcontroller.mixer = mixer;

        this.ECAcontroller = this.controllers[newAvatar.name] = ECAcontroller;

        if(!Object.keys(this.loadedIdleAnimations).length) {
            this.loadIdleAnimations(["./data/animations/Idle.bvh", "./data/animations/SitIdle.bvh", "./data/animations/standingIdle.bvh"]).then((v) => {
                if(!Object.keys(this.loadedIdleAnimations).length) {return;}
                this.currentIdle = Object.keys(this.loadedIdleAnimations)[0].replace("./data/animations/", "");
                this.bindAnimationToCharacter(this.currentIdle, newAvatar.name);
            })
        }
        else {
            this.bindAnimationToCharacter(this.currentIdle, newAvatar.name);
        }
    }

    onChangeAvatar(avatarName) {
        if (!this.controllers[avatarName]) { 
            return false; 
        }
        this.ECAcontroller = this.controllers[avatarName];
        return true;
    }

    getLookAtPosition(target = new THREE.Vector3()) {
        if( this.ECAcontroller ) { 
            this.ECAcontroller.skeleton.bones[ this.ECAcontroller.characterConfig.boneMap["ShouldersUnion"] ].getWorldPosition( target ); 
        }
        return target;
    }

    /* 
    * Given an array of blocks of type { type: "bml" || "sigml" || "glossName",  data: "" } where data contains the text instructions either in bml or sigml.
    * It computes the sequential union of all blocks.
    * Provides a way to feed the app with custom bmls, sigml 
    * Returns duration of the whole array, without delayTime
    */
    async processMessageRawBlocks( glosses = [], delayTime = 0 ){
        if ( !glosses ){ return null; }

        delayTime = parseFloat( delayTime );
        delayTime = isNaN( delayTime ) ? 0 : delayTime;
        let time = delayTime;
        let orders = []; // resulting bml instructions
        let glossesDictionary = this.languageDictionaries[ this.selectedLanguage ].glosses;
        
        let peakRelaxDuration = 0;
        let relaxEndDuration = 0;
        
        for( let i = 0; i < glosses.length; ++i ){
            let gloss = glosses[i];
            
            try{ 
                // if gloss name. First fetch file, update gloss data and continue
                if ( gloss.type == "glossName" ){
                    let glossFile = glossesDictionary[ gloss.data ];
                    if ( !glossFile ){  // skipping gloss
                        gloss = { type: "invalid" };
                    }
                    else{ 
                        await fetch( "./data/dictionaries/" + this.selectedLanguage + "/Glosses/" + glossFile ).then(x=>x.text()).then( (text) =>{ 
                            let extension = glossFile.split(".");
                            extension = extension[ extension.length - 1 ];
                            gloss = { type: extension, data: text };
                        } );    
                    }
                }

                if ( gloss.type == "bml" ){ // BML
                    let result = gloss.data;
                    if( typeof( result ) == "string" ){ result = JSON.parse( result ) };
                    if ( Array.isArray( result.behaviours ) ){ result = result.behaviours; } // animics returns this
                    else if ( Array.isArray( result.data ) ){ result = result.data; } // bml messages uses this
                    else if ( !Array.isArray( result ) ){ throw "error"; }

                    time = time - relaxEndDuration - peakRelaxDuration; // if not last, remove relax-end and peak-relax stages
                    let maxDuration = 0;
                    let maxRelax = 0;
                    for( let b = 0; b < result.length; ++b ){
                        let bml = result[b];
                        if( !isNaN( bml.start ) ){ bml.start += time; }
                        if( !isNaN( bml.ready ) ){ bml.ready += time; }
                        if( !isNaN( bml.attackPeak ) ){ bml.attackPeak += time; }
                        if( !isNaN( bml.relax ) ){ 
                            if ( maxRelax < bml.relax ){ maxRelax = bml.relax; } 
                            bml.relax += time;  
                        }
                        if( !isNaN( bml.end ) ){ 
                            if ( maxDuration < bml.end ){ maxDuration = bml.end; } 
                            bml.end += time; 
                        }
                    }
                    orders = orders.concat( result );
                    time += maxDuration; // time up to last end

                    peakRelaxDuration = 0;
                    relaxEndDuration = maxDuration - maxRelax;
                }
                else if ( gloss.type == "sigml" ){ // SiGML
                    time = time - relaxEndDuration - peakRelaxDuration; // if not last, remove relax-end and peak-relax stages
                    let result = sigmlStringToBML( gloss.data, time );
                    orders = orders.concat(result.data);
                    time += result.duration; 
                    peakRelaxDuration = result.peakRelaxDuration;
                    relaxEndDuration = result.relaxEndDuration;
                }
                else{
                    // TODO DEFAULT SKIPPING SIGN MESSAGE
                    time += 3; continue; 
                }
            }catch(e){ console.log( "parse error: " + gloss ); time += 3; }
        }

        // give the orders to the avatar controller 
        let msg = {
            type: "behaviours",
            data: orders
        };
        this.msg = JSON.parse(JSON.stringify(msg)); // make copy
        this.ECAcontroller.processMsg( msg );

        return { msg: msg, duration: time - delayTime, peakRelaxDuration: peakRelaxDuration, relaxEndDuration: relaxEndDuration }; // duration
    }

    onMessage(data, callback){
        if ( !data || !Array.isArray(data) ) {
            return;
        }

        this.ECAcontroller.reset();
        this.processMessageRawBlocks( data ).then((processedData)=>{ 
            if(callback) {
                callback(processedData);
            }          
        } );          
    };

    setIntensity(value) {
        this.intensity = value;
        if(this.mixer && this.mixer._actions.length) {
            this.mixer._actions[0].setEffectiveWeight(value);
            this.mixer.update(0);
    
        let bones = this.ECAcontroller.originalSkeleton.bones;
        
        for( let i = 0; i < bones.length; ++i ){
            this.baseSkeleton.bones[i].position.copy(bones[i].position);
            this.baseSkeleton.bones[i].quaternion.copy(bones[i].quaternion);
            this.baseSkeleton.bones[i].scale.copy(bones[i].scale);
        }
        
        this.baseSkeleton.bones[0].updateWorldMatrix( false, true ); // assume 0 is root. Update all global matrices (root does not have any parent)          
        this.baseSkeleton.calculateInverses();
        }
    }
}

export { ScriptApp };
