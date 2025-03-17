
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'

import { BVHLoader } from './extendedBVHLoader.js';
import { AnimationRetargeting, applyTPose } from './retargeting/retargeting.js'

class KeyframeApp {

    constructor() {
        
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();
        this.GLTFLoader = new GLTFLoader();
        this.FBXLoader = new FBXLoader();

        this.BVHLoader = new BVHLoader();
        
        this.currentCharacter = "";
        this.loadedCharacters = {}; // store avatar loadedCharacters

        this.currentAnimation = "";
        this.loadedAnimations = {};
        this.bindedAnimations = {};

        this.mixer = null;
        this.playing = false;
        this.speed = 1.0;
        this.blendTime = 1.0;
        this.useCrossFade = false;

        // For retargeting
        this.srcPoseMode = AnimationRetargeting.BindPoseModes.DEFAULT; 
        this.trgPoseMode = AnimationRetargeting.BindPoseModes.DEFAULT; 
   
        this.srcEmbedWorldTransforms = false;
        this.trgEmbedWorldTransforms = true;
        fetch( 'https://resources.gti.upf.edu/3Dcharacters/Eva_Low/Eva_Low.json').then(response => response.json()).then(data => this.stardardConfig = data);
    }

    update( deltaTime ) {
        deltaTime*= this.speed;
        this.elapsedTime += deltaTime;
        if (this.playing && this.mixer) { 
            this.mixer.update( deltaTime ); 
        }
    }

    changePlayState(state = !this.playing) {
        this.playing = state;
        if(this.playing && this.mixer) {
            this.mixer.setTime(0);                      
        }
    }

    onLoadAvatar(character){      
        // Create mixer for animation
        const mixer = new THREE.AnimationMixer(character.model);  
        this.currentCharacter = character.model.name;
        this.loadedCharacters[character.model.name] = character;
        this.loadedCharacters[character.model.name].mixer = mixer;

        this.mixer = mixer;
    }

    onChangeAvatar(avatarName) {
        if (!this.loadedCharacters[avatarName]) { 
            return false; 
        }

        this.currentCharacter = avatarName;
        this.mixer = this.loadedCharacters[avatarName].mixer;          
        this.onChangeAnimation(this.currentAnimation, true);
        this.changePlayState(this.playing);
        const LToePos = this.loadedCharacters[avatarName].skeleton.getBoneByName(this.loadedCharacters[avatarName].LToeName).getWorldPosition(new THREE.Vector3);
        const RToePos = this.loadedCharacters[avatarName].skeleton.getBoneByName(this.loadedCharacters[avatarName].RToeName).getWorldPosition(new THREE.Vector3);
        let diff = this.loadedCharacters[avatarName].LToePos.y - LToePos.y; 
        
        this.loadedCharacters[avatarName].model.position.y = this.loadedCharacters[avatarName].position.y - this.loadedCharacters[avatarName].diffToGround + diff;

        return true;
    }

    onChangeAnimation(animationName, needsUpdate) {
        if(!animationName || !this.loadedAnimations[animationName]) {
            console.warn(animationName + 'not found');
            return;
        }
        const currentCharacter = this.loadedCharacters[this.currentCharacter];
        currentCharacter.model.position.y = this.loadedCharacters[this.currentCharacter].position.y;
        
        currentCharacter.rotation = currentCharacter.model.quaternion.clone();
        currentCharacter.scale = currentCharacter.model.scale.clone();
        // currentCharacter.model.position.set(0,0,0);
        currentCharacter.model.quaternion.set(0,0,0,1);
        currentCharacter.model.scale.set(1,1,1);

        let bindedAnim = null;
        if(needsUpdate) {
            for(let animation in this.loadedAnimations) {               
                this.bindAnimationToCharacter(animation, this.currentCharacter, true);                
            }
            bindedAnim = this.bindedAnimations[animationName][this.currentCharacter];
            // Remove current animation clip
            this.mixer.stopAllAction();
    
            while(this.mixer._actions.length){
                this.mixer.uncacheClip(this.mixer._actions[0]._clip); // removes action
            }
            this.mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(1.0).play();
            this.currentAnimation = animationName;

        }
        //this.bindAnimationToCharacter(this.currentAnimation, this.currentCharacter);

        else {
            bindedAnim = this.bindedAnimations[animationName][this.currentCharacter];
            if(this.mixer._actions.length && this.useCrossFade) {
                let action = this.mixer.clipAction(bindedAnim.mixerBodyAnimation);
                action.setEffectiveWeight(1.0);
                action.play();
                for(let i = 0; i < this.mixer._actions.length; i++) {
                    if(this.mixer._actions[i]._clip ==  this.bindedAnimations[this.currentAnimation][this.currentCharacter].mixerBodyAnimation) {
                        this.prepareCrossFade( this.mixer._actions[i], action, this.blendTime );
                        this.currentAnimation = animationName;

                        break;
                    }
                }
            }
            else {
                
                while(this.mixer._actions.length){
                    this.mixer.uncacheClip(this.mixer._actions[0]._clip); // removes action
                }
            
                this.mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(1.0).play();
                this.currentAnimation = animationName;

            }
        }
        this.mixer.update(0.1);
        this.mixer.update(0);

        const LToePos = this.loadedCharacters[this.currentCharacter].model.getObjectByName(this.loadedCharacters[this.currentCharacter].LToeName).getWorldPosition(new THREE.Vector3);
        const RToePos = this.loadedCharacters[this.currentCharacter].model.getObjectByName(this.loadedCharacters[this.currentCharacter].RToeName).getWorldPosition(new THREE.Vector3);
        let diff = this.loadedCharacters[this.currentCharacter].LToePos.y - LToePos.y; 
        
        this.loadedCharacters[this.currentCharacter].model.position.y = this.loadedCharacters[this.currentCharacter].position.y - this.loadedCharacters[this.currentCharacter].diffToGround + diff;
        // let pos = currentCharacter.model.position.clone();
        // currentCharacter.model.position.set(0,0,0);
        currentCharacter.model.quaternion.copy(currentCharacter.rotation);
        currentCharacter.model.scale.copy(currentCharacter.scale);

    }
    
    prepareCrossFade( startAction, endAction, duration ) {

        // Switch default / custom crossfade duration (according to the user's choice)

        this.unPauseAllActions(startAction);

        // Wait until the current action has finished its current loop
        this.synchronizeCrossFade( startAction, endAction, duration );
    }

    synchronizeCrossFade( startAction, endAction, duration ) {
        
        const onLoopFinished = ( event ) => {

            if ( event.action === startAction ) {

                this.mixer.removeEventListener( 'loop', onLoopFinished );

                this.executeCrossFade( startAction, endAction, duration );

            }

        }
        this.mixer.addEventListener( 'loop', onLoopFinished );
    }

    executeCrossFade( startAction, endAction, duration ) {

        // Not only the start action, but also the end action must get a weight of 1 before fading
        // (concerning the start action this is already guaranteed in this place)

        endAction.enabled = true;
		endAction.setEffectiveTimeScale( 1 );
		endAction.setEffectiveWeight( 1 );
        endAction.time = 0;

        // Crossfade with warping - you can also try without warping by setting the third parameter to false

        startAction.crossFadeTo( endAction, duration, true );

    }

    unPauseAllActions(skipAction) {
        this.mixer._actions.forEach(  ( action ) => {

            if(action != skipAction) {
                
                action.enabled = false;
            }
        } );
    }

    onMessage( data, callback ) {
        this.processMessageFiles(data.data).then( (processedAnimationNames) => {
            if( processedAnimationNames) {
                for(let i = 0; i < processedAnimationNames.length; i++) {

                    this.bindAnimationToCharacter(processedAnimationNames[i], this.currentCharacter);
                }
                this.currentAnimation = processedAnimationNames[0];
            }
            
            if(callback) {
                callback(processedAnimationNames);
            }
            //this.gui.animationDialog.refresh();
        });
    }
    /* 
    * Given an array of animations of type { name: "", data: "" } where "data" is Blob of text/plain type 
    * 
    */
    async processMessageFiles( files = []) {
        let parsedFiles = {};
        let promises = [];

        let loader = null;
        let type = 'bvh';

        for(let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = file.name.substr(file.name.lastIndexOf(".") + 1);;
            if(extension == 'bvh' || extension == 'bvhe') {
                loader = this.BVHLoader;
                type = 'bvh';
            }
            else if(extension == 'fbx') {
                loader = this.FBXLoader;
                type = 'fbx';
            }
            else {
                loader = this.GLTFLoader;
                type = 'glb';
            }
            let filePromise = null;
            if(type == 'bvh') {
               
                filePromise = new Promise(resolve => {
                    const loadData = (dataFile) => {
                        let data = this.BVHLoader.parseExtended(dataFile);
                        let name = file.name;
                        if(this.loadedAnimations[name]) {
                            let filename = file.name.split(".");
                            filename.pop();
                            filename.join('.');
                            name = name + "_"+ filename;
                        }
                        this.loadBVHAnimation( name, data );
    
                        resolve( name ); // this is what is returned by promise.all.then
                    }

                    const reader = new FileReader();
                    reader.onload = () => {     
                        loadData(reader.result);    
                        
                    }
                    let data = file.data ?? file;
                   
                    if(file.constructor.name == File.name || file.data && typeof(file.data) == 'object') {
                        reader.readAsText(data);
                    }
                    else if(file.data && typeof(file.data) == 'string') {
                        loadData(file.data);
                    }
                    else {
                        fetch(file.name || file)
                        .then( (response) => {
                            if (response.ok) {
                            response.text().then( (text) => {
                                loadData(text)
                            });
                            } else {
                                console.log("Not found");
                            }
                        })
                        .catch(function (error) {
                            console.log("Error:" + error.message);
                        });        
                    } 
                    
                });
            }
            else {
                filePromise = new Promise(resolve => {
                    const loadData = (dataFile) => {
                        loader.load( dataFile, (glb) => {
                            let skeleton = null;
                            let model = glb.scene ? glb.scene : glb;
                            model.traverse( o => {                                    
                                if ( o.skeleton ) {
                                    skeleton = o.skeleton;
                                    return;
                                }                                
                            } );
                            let animationsNames = [];
                            if ( skeleton ){
                                let model = skeleton.bones[0];
                                while(model.parent && model.parent.type != "Scene") {
                                    model = model.parent;
                                }
                                model.skeleton = skeleton;
                            }
                            else if ( this.loadedAnimations[this.currentAnimation] ){
                                skeleton = this.loadedAnimations[this.currentAnimation].skeleton;
                            }
                            else{
                                resolve( animationsNames ); // this is what is returned by promise.all.then
                                return;
                            }

                            for(let i = 0; i < glb.animations.length; i++) {
                                let name = glb.animations[i].name;
                                const tracks = [];
                                for(let j = 0; j < glb.animations[i].tracks.length; j++) {
                                
                                    let track = glb.animations[i].tracks[j];
                                    const trackBinding = THREE.PropertyBinding.parseTrackName( track.name );
                                    const meshName = trackBinding.nodeName; // Mesh name                                    
                                    let morphTargetName = trackBinding.propertyIndex; // Morph target name
                                    
                                    if(trackBinding.propertyName != 'morphTargetInfluences' || morphTargetName) {
                                        tracks.push(track);
                                        continue;
                                    }

                                    // this track affects all morph targets together (are merged)                                        
                                    const sourceTrackNode = THREE.PropertyBinding.findNode( model, trackBinding.nodeName );
                                    const targetCount = sourceTrackNode.morphTargetInfluences.length;
                                    const times = track.times;
                                    for( let morphTarget in sourceTrackNode.morphTargetDictionary ) {
                                        
                                        const morphTargetIdx = sourceTrackNode.morphTargetDictionary[morphTarget];
                                        const values = new track.ValueBufferType( track.times.length );
                                        for ( let j = 0; j < times.length; j ++ ) {

                                            values[j] = track.values[j * targetCount + morphTargetIdx];
                                        }
                                        tracks.push( new THREE.NumberKeyframeTrack(track.name + "[" + morphTarget + "]", times, values, track.getInterpolation()))
                                    }
                                }
                                glb.animations[i].tracks = tracks;

                                if(this.loadedAnimations[name]) {
                                    let filename = file.name.split(".");
                                    filename.pop();
                                    filename.join('.');
                                    name = name + "_"+ filename;
                                }
                                this.loadGLTFAnimation(name, glb.animations[i], skeleton);
                                animationsNames.push(name);
                            }
                            resolve( animationsNames ); // this is what is returned by promise.all.then
                        }); 
                    }
                    
                    let data = file.data ?? file;

                    if(file.constructor.name != File.name) {
                        loadData(file.name || file);
                    }
                    else {
                        const reader = new FileReader();
                        reader.onload = () => {  
                           loadData(reader.result);
                        }
                        reader.readAsDataURL(data);
                    }
                });
            }   

            promises.push(filePromise);           
        }
       
        return Promise.all(promises);
    }

    loadFiles( files, callback ) {
               
        this.processMessageFiles(files).then((data) => {
            if(data[0].length) {              
                let animation = typeof(data[0]) == 'string' ? data[0] : data[0][0];
                this.currentAnimation = animation;
                if(callback) {
                    callback(animation);
                }
            }
            else {
                if(callback)
                {
                    callback();
                }
            }
        });
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
            skeleton.bones.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "") } );
            // loader does not correctly compute the skeleton boneInverses and matrixWorld 
            skeleton.bones[0].updateWorldMatrix( false, true ); // assume 0 is root
            skeleton = new THREE.Skeleton( skeleton.bones ); // will automatically compute boneInverses
            
            animationData.skeletonAnim.clip.tracks.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "") } );     
            animationData.skeletonAnim.clip.name = "bodyAnimation";
            bodyAnimation = animationData.skeletonAnim.clip;
        }
        
        if ( animationData && animationData.blendshapesAnim ){
            animationData.blendshapesAnim.clip.name = "faceAnimation";       
            faceAnimation = animationData.blendshapesAnim.clip;
        }
        
        this.loadedAnimations[name] = {
            name: name,
            bodyAnimation: bodyAnimation ?? new THREE.AnimationClip( "bodyAnimation", -1, [] ),
            faceAnimation: faceAnimation ?? new THREE.AnimationClip( "faceAnimation", -1, [] ),
            skeleton,
            type: "bvhe"
        };
        this.bindAnimationToCharacter(name, this.currentCharacter);
        
    }

    loadGLTFAnimation(name, animationData, skeleton, model) {
        this.loadedAnimations[name] = {
            name: name,
            bodyAnimation: animationData ?? new THREE.AnimationClip( "bodyAnimation", -1, [] ),
            skeleton,
            model,
            type: "glb"
        };

        if( this.onLoadGLTFAnimation ) {
            this.onLoadGLTFAnimation(this.loadedAnimations[name]);
        }

        this.bindAnimationToCharacter(name, this.currentCharacter);
    }

    /**
     * KeyframeEditor: fetches a loaded animation and applies it to the character. The first time an animation is binded, it is processed and saved. Afterwards, this functino just changes between existing animations 
     * @param {String} animationName 
     * @param {String} characterName 
     */
    bindAnimationToCharacter(animationName, characterName, force) {
        
        let animation = this.loadedAnimations[animationName];
        if(!animation) {
            console.warn(animationName + " not found");
            return false;
        }
        
        let currentCharacter = this.loadedCharacters[characterName];
        if(!currentCharacter) {
            console.warn(characterName + ' not loaded')
        }
        let mixer = currentCharacter.mixer;
        this.mixer = mixer;
        
        let faceAnimation = null;
        let bodyAnimation = null;
        // if not yet binded, create it. Otherwise just change to the existing animation
        if ( !this.bindedAnimations[animationName] || !this.bindedAnimations[animationName][characterName] || force) {
            let srcPoseMode = this.srcPoseMode;
            let trgPoseMode = this.trgPoseMode;

            if(this.trgPoseMode != AnimationRetargeting.BindPoseModes.CURRENT && this.trgPoseMode != AnimationRetargeting.BindPoseModes.DEFAULT) {
                currentCharacter.skeleton.pose();
                const skeleton = applyTPose(currentCharacter.skeleton).skeleton;
                if(skeleton)
                {
                    currentCharacter.skeleton = skeleton;
                    trgPoseMode = AnimationRetargeting.BindPoseModes.CURRENT;
                }
                else {
                    console.warn("T-pose can't be applyied to the TARGET. Automap falied.")
                }
            } 
            else {
                currentCharacter.skeleton.pose(); // for some reason, mixer.stopAllAction makes bone.position and bone.quaternions undefined. Ensure they have some values
            }
               
            bodyAnimation = Object.assign({}, animation.bodyAnimation);       
            if(bodyAnimation) {
            
                let tracks = [];
                const otherTracks = []; // blendshapes
                // Remove position changes (only keep i == 0, hips)
                for (let i = 0; i < bodyAnimation.tracks.length; i++) {

                    if(bodyAnimation.tracks[i].constructor.name == THREE.NumberKeyframeTrack.name ) {
                        otherTracks.push(bodyAnimation.tracks[i]);
                        continue;
                    }
                    if(i && bodyAnimation.tracks[i].name.includes('position')) {
                        continue;
                    }
                    tracks.push(bodyAnimation.tracks[i]);
                    tracks[tracks.length - 1].name = tracks[tracks.length - 1].name.replace(".bones", "");//tracks[tracks.length - 1].name.replace( /[\[\]`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "").replace(".bones", "");
                }

                //tracks.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "") } );
                bodyAnimation.tracks = tracks;            
                
                if(this.srcPoseMode != AnimationRetargeting.BindPoseModes.CURRENT && this.srcPoseMode != AnimationRetargeting.BindPoseModes.DEFAULT) {
                    animation.skeleton.pose();
                    const skeleton = applyTPose(animation.skeleton).skeleton;
                    if(skeleton)
                    {
                        animation.skeleton = skeleton;
                        srcPoseMode = AnimationRetargeting.BindPoseModes.CURRENT;
                    }
                    else {
                        console.warn("T-pose can't be applyied to the SOURCE. Automap falied.")
                    }
                }
                
             
                let retargeting = new AnimationRetargeting(animation.skeleton, currentCharacter.model, { srcEmbedWorldTransforms: this.srcEmbedWorldTransforms, trgEmbedWorldTransforms: this.trgEmbedWorldTransforms, srcPoseMode, trgPoseMode } ); // TO DO: change trgUseCurrentPose param
                bodyAnimation = retargeting.retargetAnimation(bodyAnimation);
                
                this.validateAnimationClip(bodyAnimation);
                if(otherTracks.length) {
                    faceAnimation = new THREE.AnimationClip("faceAnimation", bodyAnimation.duration, otherTracks);
                }
                // bodyAnimation.tracks = bodyAnimation.tracks.concat(otherTracks);
                // this.loadedAnimations[animationName].bodyAnimation.tracks = this.loadedAnimations[animationName].bodyAnimation.tracks.concat(otherTracks);
                bodyAnimation.name = "bodyAnimation";   // mixer
            }
            
            if( animation.faceAnimation ) {
                faceAnimation = faceAnimation ? animation.faceAnimation.tracks.concat(faceAnimation.tracks) : animation.faceAnimation;
            }                   

            let mixerFaceAnimation = null;
            if( faceAnimation ) {
                mixerFaceAnimation = faceAnimation.clone();
                const morphTargets = currentCharacter.morphTargets;
                const morphTargetMeshes = Object.keys(morphTargets);
                const morphTargetNames = Object.values(morphTargets);
                const morphTargetMap = currentCharacter.config ? currentCharacter.config.faceController.blendshapeMap : null;
                
                const meshes = currentCharacter.config ? currentCharacter.config.faceController.parts : null;

                const tracks = [];
                const trackNames = [];
                const parsedTracks = [];

                for(let i = 0; i < faceAnimation.tracks.length; i++) {

                    const track = faceAnimation.tracks[i];
                    const times = track.times;
                    let values = track.values;
                    
                    const trackBinding = THREE.PropertyBinding.parseTrackName( track.name );                            
                    const meshName = trackBinding.nodeName; // Mesh name
                    let morphTargetName = trackBinding.propertyIndex; // Morph target name

                    if(!morphTargetName) {
                                            
                        tracks.push(track);
                        continue;

                        // for( let mesh in morphTargets ) {
                        //     if(trackNames.includes(mesh)) {
                        //         continue;
                        //     }
                        //     tracks.push( new THREE.NumberKeyframeTrack(mesh + ".morphTargetInfluences", times, values ));                                            
                        //     trackNames.push(mesh);
                        //     break;
                        // }

                    }

                    let weight = 1;
                    if( parsedTracks.includes(morphTargetName )) {
                        continue;
                    }

                    if(morphTargetMap) {
                        let found = false;
                        for( let i = 0; i < morphTargetNames.length; i++ ) {
                            if( morphTargetNames[i][morphTargetName] != undefined ) {
                                found = true;
                                tracks.push(track);
                                break;
                            }
                        }
                        if( found ) {
                            continue;
                        }

                        // Search te morph target to the AU standard list (map the animation to standard AU)
                        if(this.stardardConfig) {
                            const standardMap = this.stardardConfig.faceController.blendshapeMap;
                            let mappedAUs = [];
                            let weights = [];
                            for ( let actionUnit in standardMap ) {
                                const mapData = standardMap[actionUnit];
                                // If the morph target is mapped to the AU, assign the weight
                                for( let j = 0; j < mapData.length; j++ ) {
                                    if ( mapData[j][0] == morphTargetName ) {
                                        // morphTargetName = actionUnit; // Assuming first, but it's wrong. TO DO: Create tracks and give weights. Each AU can have more than 1 morph target assigned
                                        // weight = mapData[j][1];      
                                        mappedAUs.push(actionUnit);
                                        weights.push(1);
                                        break;
                                    }                                
                                }
                                // if(found) {
                                //     break;
                                // }
                            }
                            if( mappedAUs.length ) {
                                parsedTracks.push(morphTargetName);
                                found = true;
                            }
                            morphTargetName = mappedAUs;
                            weight = weights;
                        }

                        // TO DO: check if it's found, otherwise have a RPM standard config to search a correspondence there
                        
                        // Search the AU mapped to this morph target (map the standard AU to the avatar morph targets)
                        for ( let actionUnit in morphTargetMap ) {

                            const mapData = morphTargetMap[actionUnit];
                            // If the morph target is mapped to the AU, assign the weight
                            if( morphTargetName instanceof String ) {
                                morphTargetName = [morphTargetName];
                                weight = [weight];
                            }
                            for( let j = 0; j < morphTargetName.length; j++ ) {

                                if ( actionUnit == morphTargetName[j] ) {
                                    for(let m = 0; m < mapData.length; m++) {
    
                                        const newName = mapData[m][0];
    
                                        if(!newName) {
                                            continue;
                                        }
                                        if( weight[j] < 1 ) {
                                            values = values.map( v => v*weight[j]);
                                        }
                                        for( let mesh in meshes ) {
                                            const name = mesh + ".morphTargetInfluences[" + newName + "]";
                                            const id = trackNames.indexOf( name );
                                            if(id > -1 && weight[j] < 1) {                                               
                                                tracks[id].values = tracks[id].values.map( (v, idx) => v + values[idx]);
                                            }
                                            else {
    
                                                tracks.push( new THREE.NumberKeyframeTrack(name, times, values ));
                                                trackNames.push(name);
                                            }
                                        }
    
                                        break;
                                    }
                                }
                                // else if (mapData === morphTargetName[j]) {
    
                                //     const newName = actionUnit
                                //     if(!newName || trackNames.indexOf( newName ) > -1) {
                                //         continue;
                                //     }
                                //     trackNames.push(newName);
    
                                //     for( let mesh in meshes ) {
                                //         tracks.push( new THREE.NumberKeyframeTrack(mesh + ".morphTargetInfluences[" + newName + "]", times, values ));
                                //     }
                                //     break;
                                // }
                            }
                        }
                    }

                    if(tracks.length < (i +1)* morphTargetNames.length) {
                        tracks.push(track);
                    }

                }
                
                if( tracks ) {                   
                    mixerFaceAnimation.tracks = tracks;
                }

                bodyAnimation.tracks = bodyAnimation.tracks.concat(mixerFaceAnimation.tracks);

            }

            if(!this.bindedAnimations[animationName]) {
                this.bindedAnimations[animationName] = {};
            }
            this.bindedAnimations[animationName][this.currentCharacter] = {
                mixerBodyAnimation: bodyAnimation, mixerFaceAnimation: mixerFaceAnimation, // for threejs mixer 
            }

            // bindedAnim = this.bindedAnimations[animationName][this.currentCharacter];
            // // Remove current animation clip
            // mixer.stopAllAction();

            // while(mixer._actions.length){
            //     mixer.uncacheClip(mixer._actions[0]._clip); // removes action
            // }
            // mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(1.0).play();
            // mixer.update(0);

        }
        else {
            // bindedAnim = this.bindedAnimations[animationName][this.currentCharacter];
            // if(mixer._actions.length && mixer._actions[0]._clip != bindedAnim.mixerBodyAnimation) {
            //     mixer.clipAction(bindedAnim.mixerBodyAnimation).play();
            //     for(let i = 0; i < mixer._actions.length; i++) {
            //         if(mixer._actions[i]._clip ==  this.bindedAnimations[this.currentAnimation][this.currentCharacter]) {
            //             mixer._actions[i].crossFadeTo(mixer.clipAction(bindedAnim.mixerBodyAnimation), 0.25);
            //         }
            //     }
            // }
            // else {
            //     // if(!(mixer._actions.length && mixer._actions[0].name == animationName)) {
            //     // }
            //     mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(1.0).play();
            //     mixer.update(0);
    
            // }
        }
        
        // this.duration = bindedAnim.mixerBodyAnimation.duration;


        return true;
    }

    /** Validate body animation clip created using ML */
    validateAnimationClip(clip) {

        let newTracks = [];
        let tracks = clip.tracks;
        let bones = this.loadedCharacters[this.currentCharacter].skeleton.bones;
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
    }

    exportAnimations() {
        const animations = [];
        for(let name in this.bindedAnimations) { // can be an array of loadedAnimations, or an object with animations (loadedAnimations itself)
            const bindedAnim = this.bindedAnimations[name][this.currentCharacter];
            const animSaveName = name;
            
            let tracks = []; 
            if(bindedAnim.mixerBodyAnimation) {
                tracks = tracks.concat( bindedAnim.mixerBodyAnimation.tracks );
            }
            if(bindedAnim.mixerFaceAnimation) {
                tracks = tracks.concat( bindedAnim.mixerFaceAnimation.tracks );
            }
            if(bindedAnim.mixerAnimation) {
                tracks = tracks.concat( bindedAnim.mixerAnimation.tracks );
            }

            animations.push( new THREE.AnimationClip( animSaveName, -1, tracks ) );
        }
        return animations;
    }
    
}

export { KeyframeApp }