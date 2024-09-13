
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BVHLoader } from './extendedBVHLoader.js';
import { AnimationRetargeting } from './retargeting/retargeting.js'

class KeyframeApp {

    constructor() {
        
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();
        this.GLTFLoader = new GLTFLoader();
        this.BVHLoader = new BVHLoader();
        
        this.currentCharacter = "";
        this.loadedCharacters = {}; // store avatar loadedCharacters

        this.currentAnimation = "";
        this.loadedAnimations = {};
        this.bindedAnimations = {};

        this.mixer = null;
        this.playing = false;

        // For retargeting
        this.srcPoseMode = AnimationRetargeting.BindPoseModes.TPOSE; // TPOSE
        this.trgPoseMode = AnimationRetargeting.BindPoseModes.TPOSE; // TPOSE
   
        this.srcEmbedWorldTransforms = false;
        this.trgEmbedWorldTransforms = true;
    }

    update( deltaTime ) {
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

    onLoadAvatar(newAvatar, config, skeleton){      
        // Create mixer for animation
        const mixer = new THREE.AnimationMixer(newAvatar);  
        this.currentCharacter = newAvatar.name;
        this.loadedCharacters[newAvatar.name] = { mixer, config, model: newAvatar, skeleton};
        this.mixer = mixer;
    }

    onChangeAvatar(avatarName) {
        if (!this.loadedCharacters[avatarName]) { 
            return false; 
        }
        this.currentCharacter = avatarName;
        this.changePlayState(this.playing);
        this.mixer = this.loadedCharacters[avatarName].mixer;  
        this.bindAnimationToCharacter(this.currentAnimation, avatarName);
        return true;
    }

    onChangeAnimation(animationName) {
        if(!this.loadedAnimations[animationName]) {
            console.warn(animationName + 'not found')
        }
        this.currentAnimation = animationName;
        this.bindAnimationToCharacter(this.currentAnimation, this.currentCharacter);
    }

    onMessage( data, callback ) {
        this.processMessageFiles(data.data).then( (processedAnimationNames) => {
            if( processedAnimationNames && processedAnimationNames.length && this.loadedAnimations[processedAnimationNames[0]] ) {
                this.currentAnimation = processedAnimationNames[0];
                this.bindAnimationToCharacter(this.currentAnimation, this.currentCharacter);
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
            else {
                loader = this.GLTFLoader;
                type = 'glb';
            }
            let filePromise = null;
            if(type == 'bvh') {
                filePromise = new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => {         
                        let data = null;
                            data = loader.parseExtended(reader.result);
                            this.loadBVHAnimation( file.name, data );

                        resolve( file.name ); // this is what is returned by promise.all.then
                    }
                    let data = file.data ?? file;
                    reader.readAsText(data);
                });
            }
            else {
                filePromise = new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => {  
                        loader.load( reader.result, (glb) => {
                            let skeleton = null;
                            glb.scene.traverse( o => {                                    
                                if ( o.skeleton ){ 
                                    skeleton = o.skeleton;
                                    return;
                                }                                                
                            } );
                            let animationsNames = [];
                            let model = skeleton.bones[0];
                            while(model.parent && model.parent.type != "Scene") {
                                model = model.parent;
                            }
                            model.skeleton = skeleton;
                            for(let i = 0; i < glb.animations.length; i++) {
                                this.loadGLTFAnimation( glb.animations[i].name, glb.animations[i],  model);
                                animationsNames.push(glb.animations[i].name);
                            }
                            resolve( animationsNames ); // this is what is returned by promise.all.then
                        }); 
                    }
                    
                    let data = file.data ?? file;
                    reader.readAsDataURL(data);
                });
            }   

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
    }

    loadGLTFAnimation(name, animationData, skeleton) {
        this.loadedAnimations[name] = {
            name: name,
            bodyAnimation: animationData ?? new THREE.AnimationClip( "bodyAnimation", -1, [] ),
            skeleton,
            type: "glb"
        };
    }

    /**
     * KeyframeEditor: fetches a loaded animation and applies it to the character. The first time an animation is binded, it is processed and saved. Afterwards, this functino just changes between existing animations 
     * @param {String} animationName 
     * @param {String} characterName 
     */
    bindAnimationToCharacter(animationName, characterName) {
        
        let animation = this.loadedAnimations[animationName];
        if(!animation) {
            console.warn(animationName + " not found");
            return false;
        }
        this.currentAnimation = animationName;
        
        let currentCharacter = this.loadedCharacters[characterName];
        if(!currentCharacter) {
            console.warn(characterName + ' not loaded')
        }
        // Remove current animation clip
        let mixer = currentCharacter.mixer;
        mixer.stopAllAction();

        while(mixer._actions.length){
            mixer.uncacheClip(mixer._actions[0]._clip); // removes action
        }
        currentCharacter.skeleton.pose(); // for some reason, mixer.stopAllAction makes bone.position and bone.quaternions undefined. Ensure they have some values

        // if not yet binded, create it. Otherwise just change to the existing animation
        if ( !this.bindedAnimations[animationName] || !this.bindedAnimations[animationName][currentCharacter.name] ) {
            let bodyAnimation = animation.bodyAnimation;        
            if(bodyAnimation) {
            
                let tracks = [];        
                // Remove position changes (only keep i == 0, hips)
                for (let i = 0; i < bodyAnimation.tracks.length; i++) {

                    if(i && bodyAnimation.tracks[i].name.includes('position')) {
                        continue;
                    }
                    tracks.push(bodyAnimation.tracks[i]);
                    tracks[tracks.length - 1].name = tracks[tracks.length - 1].name.replace( /[\[\]`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "").replace(".bones", "");
                }

                //tracks.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "") } );
                bodyAnimation.tracks = tracks;            
                let skeleton = animation.skeleton;
                // Retarget NN animation              
                //forceBindPoseQuats(this.currentCharacter.skeletonHelper.skeleton); // TO DO: Fix bind pose of Eva
                //forceBindPoseQuats(skeleton); 
                // trgUseCurrentPose: use current Bone obj quats,pos, and scale
                // trgEmbedWorldTransform: take into account external rotations like bones[0].parent.quaternion and model.quaternion
                let retargeting = new AnimationRetargeting(skeleton, currentCharacter.model, { srcEmbedWorldTransforms: this.srcEmbedWorldTransforms, trgEmbedWorldTransforms: this.trgEmbedWorldTransforms, srcPoseMode: this.srcPoseMode, trgPoseMode: this.trgPoseMode } ); // TO DO: change trgUseCurrentPose param
                bodyAnimation = retargeting.retargetAnimation(bodyAnimation);
                
                this.validateAnimationClip(bodyAnimation);

                bodyAnimation.name = "bodyAnimation";   // mixer
            }
                
            let faceAnimation = animation.faceAnimation;        
            // if(faceAnimation) { // TO DO: Check if it's if-else or if-if
                
            //     // Get the formated animation
            //     if(animation.type == "video") {
            //         faceAnimation = currentCharacter.blendshapesManager.createBlendShapesAnimation(animation.blendshapes);
            //     }

            //     faceAnimation.name = "faceAnimation";   // mixer
            // }
            
            if(!this.bindedAnimations[animationName]) {
                this.bindedAnimations[animationName] = {};
            }
            this.bindedAnimations[animationName][this.currentCharacter] = {
                mixerBodyAnimation: bodyAnimation, mixerFaceAnimation: faceAnimation, // for threejs mixer 
            }
        }

        let bindedAnim = this.bindedAnimations[animationName][this.currentCharacter];
        // mixer.clipAction(bindedAnim.mixerFaceAnimation).setEffectiveWeight(1.0).play(); // already handles nulls and undefines
        mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(1.0).play();
        mixer.update(0);
        this.duration = bindedAnim.mixerBodyAnimation.duration;
        this.mixer = mixer;

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
    
}

export { KeyframeApp }