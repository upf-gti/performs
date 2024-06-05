
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { AnimationRetargeting, forceBindPoseQuats } from './retargeting/retargeting.js'

class KeyframeApp {

    constructor() {
        
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();
        this.loaderBVH = new GLTFLoader();
        
        this.currentCharacter = "";
        this.controllers = {}; // store avatar controllers

        this.currentAnimation = "";
        this.loadedAnimations = {};
        this.bindedAnimations = {};

        this.mixer = null;
    }

    update( deltaTime ) {
        this.elapsedTime += deltaTime;
        if ( this.mixer ) { 
            this.mixer.update( deltaTime ); 
        }
    }

    onLoadAvatar(newAvatar, config){      

        // Create mixer for animation
        const mixer = new THREE.AnimationMixer(newAvatar);  
        this.controllers[newAvatar.name] = { mixer, config };
        this.mixer = mixer;
    }

    onChangeAvatar(avatarName) {
        if (!this.controllers[avatarName]) { 
            return false; 
        }
        this.currentCharacter = avatarName;
        this.mixer = this.controllers[avatarName].mixer;  
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
    /* 
    * Given an array of animations of type { name: "", data: "" } where "data" is Blob of text/plain type 
    * 
    */
     async processMessageFiles( files = []) {
        let parsedFiles = {};
        let loader = new BVHLoader();
        let promises = [];

        for(let i = 0; i < files.length; i++) {
            const file = files[i];
            let filePromise = new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => {                                    
                    const data = loader.parseExtended(reader.result);
                    this.loadBVHAnimation( file.name, data );

                    resolve(parsedFiles[file.name] = data);
                }
                reader.readAsText(file.data);
            });
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
            animationData.blendshapesAnim.name = "faceAnimation";       
            faceAnimation = animationData.blendshapesAnim;
        }
        
        this.loadedAnimations[name] = {
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
        
        let animation = this.loadedAnimations[animationName];
        if(!animation) {
            console.warn(animationName + " not found");
            return false;
        }
        this.currentAnimation = animationName;
        
        let currentCharacter = this.controllers[characterName];
        if(!currentCharacter) {
            console.warn(characterName + ' not loaded')
        }
        // Remove current animation clip
        let mixer = currentCharacter.mixer;
        mixer.stopAllAction();

        while(mixer._actions.length){
            mixer.uncacheClip(mixer._actions[0]._clip); // removes action
        }
        currentCharacter.skeletonHelper.skeleton.pose(); // for some reason, mixer.stopAllAction makes bone.position and bone.quaternions undefined. Ensure they have some values

        // if not yet binded, create it. Otherwise just change to the existing animation
        if ( !this.bindedAnimations[animationName] || !this.bindedAnimations[animationName][currentCharacter.name] ) {
            let bodyAnimation = animation.bodyAnimation;        
            let skeletonAnimation = null;
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
                forceBindPoseQuats(skeleton); 
                // trgUseCurrentPose: use current Bone obj quats,pos, and scale
                // trgEmbedWorldTransform: take into account external rotations like bones[0].parent.quaternion and model.quaternion
                let retargeting = new AnimationRetargeting(skeleton, this.currentCharacter.model, { trgUseCurrentPose: true, trgEmbedWorldTransforms: true } ); // TO DO: change trgUseCurrentPose param
                bodyAnimation = retargeting.retargetAnimation(bodyAnimation);
                
                this.validateAnimationClip(bodyAnimation);

                bodyAnimation.name = "bodyAnimation";   // mixer
                skeletonAnimation.name = "bodyAnimation";  // timeline
            }
                
            let faceAnimation = animation.faceAnimation;        
            let auAnimation = null;
            if(faceAnimation) { // TO DO: Check if it's if-else or if-if
                
                // Get the formated animation
                if(animation.type == "video") {
                    faceAnimation = this.currentCharacter.blendshapesManager.createBlendShapesAnimation(animation.blendshapes);
                }

                faceAnimation.name = "faceAnimation";   // mixer
                auAnimation.name = "faceAnimation";  // timeline
            }
            
            if(!this.bindedAnimations[animationName]) {
                this.bindedAnimations[animationName] = {};
            }
            this.bindedAnimations[animationName][this.currentCharacter.name] = {
                mixerBodyAnimation: bodyAnimation, mixerFaceAnimation: faceAnimation, // for threejs mixer 
                skeletonAnimation, auAnimation // from gui timeline
            }
        }

        let bindedAnim = this.bindedAnimations[animationName][currentCharacter.name];
        mixer.clipAction(bindedAnim.mixerFaceAnimation).setEffectiveWeight(1.0).play(); // already handles nulls and undefines
        mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(1.0).play();
        
        this.mixer = mixer;

        return true;
    }

    /** Validate body animation clip created using ML */
    validateAnimationClip(clip) {

        let newTracks = [];
        let tracks = clip.tracks;
        let bones = this.currentCharacter.skeletonHelper.bones;
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

// Overwrite/add methods

/*
	reads a string array (lines) from a BVHE file
	and outputs a skeleton structure including motion data

	returns thee root node:
	{ name: '', channels: [], children: [] }
*/
BVHLoader.prototype.parseExtended = function(text) {

	function readBvh( lines ) {

		// read model structure
		let boneRoot = null;
		const bonesList = []; // collects flat array of all bones

		let bs = null;
		let firstLine = nextLine( lines );

		if ( firstLine == 'HIERARCHY' ) {

			boneRoot = readNode( lines, nextLine( lines ), bonesList );
			firstLine = nextLine( lines )

		}

		if ( firstLine == 'BLENDSHAPES' )	{
			//console.error( 'THREE.BVHLoader: HIERARCHY expected.' );
			const bsList = []; // collects flat array of all blendshapes
			bs = readBlendshape( lines, nextLine( lines ), bsList );
			
		}
		

		// read motion data

		if ( nextLine( lines ) !== 'MOTION' ) {

			console.error( 'THREE.BVHLoader: MOTION expected.' );

		}

		// number of frames

		let tokens = nextLine( lines ).split( /[\s]+/ );
		const numFrames = parseInt( tokens[ 1 ] );

		if ( isNaN( numFrames ) ) {

			console.error( 'THREE.BVHLoader: Failed to read number of frames.' );

		}

		// frame time

		tokens = nextLine( lines ).split( /[\s]+/ );
		const frameTime = parseFloat( tokens[ 2 ] );

		if ( isNaN( frameTime ) ) {

			console.error( 'THREE.BVHLoader: Failed to read frame time.' );

		}

		// read frame data line by line /**CHANGE IT TO SUPPORT BLENDSHAPES ANIMATION */

		for ( let i = 0; i < numFrames; i ++ ) {

			tokens = nextLine( lines ).split( /[\s]+/ );
			if(boneRoot)
				readFrameBoneData( tokens, i * frameTime, boneRoot );
			readFrameBSData( tokens, i * frameTime, bs );

		}

		return {bones: bonesList, blendshapes: bs};
	}

	/*
		Recursively reads data from a single frame into the bone hierarchy.
		The passed bone hierarchy has to be structured in the same order as the BVH file.
		keyframe data is stored in bone.frames.

		- data: splitted string array (frame values), values are shift()ed so
		this should be empty after parsing the whole hierarchy.
		- frameTime: playback time for this keyframe.
		- bone: the bone to read frame data from.
	*/
	function readFrameBoneData( data, frameTime, bone ) {

		// end sites have no motion data

		if ( bone.type === 'ENDSITE' ) return;

		// add keyframe

		const keyframe = {
			time: frameTime,
			position: new Vector3(),
			rotation: new Quaternion()
		};

		bone.frames.push( keyframe );

		const quat = new Quaternion();

		const vx = new Vector3( 1, 0, 0 );
		const vy = new Vector3( 0, 1, 0 );
		const vz = new Vector3( 0, 0, 1 );

		// parse values for each channel in node

		for ( let i = 0; i < bone.channels.length; i ++ ) {

			switch ( bone.channels[ i ] ) {

				case 'Xposition':
					keyframe.position.x = parseFloat( data.shift().trim() );
					break;
				case 'Yposition':
					keyframe.position.y = parseFloat( data.shift().trim() );
					break;
				case 'Zposition':
					keyframe.position.z = parseFloat( data.shift().trim() );
					break;
				case 'Xrotation':
					quat.setFromAxisAngle( vx, parseFloat( data.shift().trim() ) * Math.PI / 180 );
					keyframe.rotation.multiply( quat );
					break;
				case 'Yrotation':
					quat.setFromAxisAngle( vy, parseFloat( data.shift().trim() ) * Math.PI / 180 );
					keyframe.rotation.multiply( quat );
					break;
				case 'Zrotation':
					quat.setFromAxisAngle( vz, parseFloat( data.shift().trim() ) * Math.PI / 180 );
					keyframe.rotation.multiply( quat );
					break;
				default:
					console.warn( 'THREE.BVHLoader: Invalid channel type.' );

			}

		}

		// parse child nodes

		for ( let i = 0; i < bone.children.length; i ++ ) {

			readFrameBoneData( data, frameTime, bone.children[ i ] );

		}

	}

	/*
		Recursively reads data from a single frame into the bone hierarchy.
		The passed bone hierarchy has to be structured in the same order as the BVH file.
		keyframe data is stored in bone.frames.

		- data: splitted string array (frame values), values are shift()ed so
		this should be empty after parsing the whole hierarchy.
		- frameTime: playback time for this keyframe.
		- bs: blendshapes array to read frame data from.
	*/
	function readFrameBSData( data, frameTime, bs ) {

		for( let i = 0; i < bs.length; i++ ) {
			// add keyframe

			const keyframe = {
				time: frameTime,
				weight: 0
			};

			bs[i].frames.push( keyframe );
			// parse values in node
			keyframe.weight = parseFloat( data.shift().trim() );
		}

	}

	/*
		Recursively parses the HIERACHY section of the BVH file

		- lines: all lines of the file. lines are consumed as we go along.
		- firstline: line containing the node type and name e.g. 'JOINT hip'
		- list: collects a flat list of nodes

		returns: a BVH node including children
	*/
	function readNode( lines, firstline, list ) {

		const node = { name: '', type: '', frames: [] };
		list.push( node );

		// parse node type and name

		let tokens = firstline.split( /[\s]+/ );

		if ( tokens[ 0 ].toUpperCase() === 'END' && tokens[ 1 ].toUpperCase() === 'SITE' ) {

			node.type = 'ENDSITE';
			node.name = 'ENDSITE'; // bvh end sites have no name

		} else {

			node.name = tokens[ 1 ];
			node.type = tokens[ 0 ].toUpperCase();

		}

		if ( nextLine( lines ) !== '{' ) {

			console.error( 'THREE.BVHLoader: Expected opening { after type & name' );

		}

		// parse OFFSET

		tokens = nextLine( lines ).split( /[\s]+/ );

		if ( tokens[ 0 ] !== 'OFFSET' ) {

			console.error( 'THREE.BVHLoader: Expected OFFSET but got: ' + tokens[ 0 ] );

		}

		if ( tokens.length !== 4 ) {

			console.error( 'THREE.BVHLoader: Invalid number of values for OFFSET.' );

		}

		const offset = new Vector3(
			parseFloat( tokens[ 1 ] ),
			parseFloat( tokens[ 2 ] ),
			parseFloat( tokens[ 3 ] )
		);

		if ( isNaN( offset.x ) || isNaN( offset.y ) || isNaN( offset.z ) ) {

			console.error( 'THREE.BVHLoader: Invalid values of OFFSET.' );

		}

		node.offset = offset;

		// parse CHANNELS definitions

		if ( node.type !== 'ENDSITE' ) {

			tokens = nextLine( lines ).split( /[\s]+/ );

			if ( tokens[ 0 ] !== 'CHANNELS' ) {

				console.error( 'THREE.BVHLoader: Expected CHANNELS definition.' );

			}

			const numChannels = parseInt( tokens[ 1 ] );
			node.channels = tokens.splice( 2, numChannels );
			node.children = [];

		}

		// read children

		while ( true ) {

			const line = nextLine( lines );

			if ( line === '}' ) {

				return node;

			} else {

				node.children.push( readNode( lines, line, list ) );

			}

		}

	}

	/*
		Recursively parses the BLENDSHAPES section of the BVH file

		- lines: all lines of the file. lines are consumed as we go along.
		- firstline: line containing the blendshape name e.g. 'Blink_Left' and the skinning meshes names that have this morph target
		- list: collects a flat list of blendshapes

		returns: a BVH node including children
	*/
	function readBlendshape( lines, line, list ) {

		while ( true ) {
			let line = nextLine( lines );

			if ( line === '{' ) continue;
			if ( line === '}' ) return list;

			let node = { name: '', meshes: [], frames: [] };
			list.push( node );

			// parse node type and name

			let tokens = line.split( /[\s]+/ );

			node.name = tokens[ 0 ];

			for(let i = 1; i < tokens.length; i++){

				node.meshes.push(tokens[ i ]);

			}
			

		}
		
	}

	/*
		recursively converts the internal bvh node structure to a Bone hierarchy

		source: the bvh root node
		list: pass an empty array, collects a flat list of all converted THREE.Bones

		returns the root Bone
	*/
	function toTHREEBone( source, list ) {

		const bone = new Bone();
		list.push( bone );

		bone.position.add( source.offset );
		bone.name = source.name;

		if ( source.type !== 'ENDSITE' ) {

			for ( let i = 0; i < source.children.length; i ++ ) {

				bone.add( toTHREEBone( source.children[ i ], list ) );

			}

		}

		return bone;

	}

	/*
		builds a AnimationClip from the keyframe data saved in each bone.

		bone: bvh root node

		returns: a AnimationClip containing position and quaternion tracks
	*/
	function toTHREEAnimation( bones, blendshapes ) {

		const boneTracks = [];

		// create a position and quaternion animation track for each node

		for ( let i = 0; i < bones.length; i ++ ) {

			const bone = bones[ i ];

			if ( bone.type === 'ENDSITE' )
				continue;

			// track data

			const times = [];
			const positions = [];
			const rotations = [];

			for ( let j = 0; j < bone.frames.length; j ++ ) {

				const frame = bone.frames[ j ];

				times.push( frame.time );

				// the animation system animates the position property,
				// so we have to add the joint offset to all values

				positions.push( frame.position.x + bone.offset.x );
				positions.push( frame.position.y + bone.offset.y );
				positions.push( frame.position.z + bone.offset.z );

				rotations.push( frame.rotation.x );
				rotations.push( frame.rotation.y );
				rotations.push( frame.rotation.z );
				rotations.push( frame.rotation.w );

			}

			if ( scope.animateBonePositions ) {

				boneTracks.push( new VectorKeyframeTrack( bone.name + '.position', times, positions ) );

			}

			if ( scope.animateBoneRotations ) {

				boneTracks.push( new QuaternionKeyframeTrack( bone.name + '.quaternion', times, rotations ) );

			}

		}

		const bsTracks = [];
		for ( let i = 0; i < blendshapes.length; i ++ ) {

			const bs = blendshapes[ i ];
			// track data

			const times = [];
			const weights = [];

			for ( let j = 0; j < bs.frames.length; j ++ ) {
				const frame = bs.frames[ j ];

				times.push( frame.time );

				// the animation system animates the morphInfluences property,
				// so we have to add the blendhsape weight to all values

				weights.push( frame.weight );
			}
			
			if( bs.meshes.length ) {

				for( let b = 0; b < bs.meshes.length; b++) {
					
					bsTracks.push( new THREE.NumberKeyframeTrack( bs.meshes[b] + '.morphTargetInfluences[' + bs.name + ']', times, weights ) );
				}
			}
			else {

				bsTracks.push( new THREE.NumberKeyframeTrack( 'Body' + '.morphTargetInfluences[' + bs.name + ']', times, weights ) );
			}	
			
		}
		return { skeletonClip: new THREE.AnimationClip( 'bsAnimation', - 1, bsTracks ), blendshapesClip: new THREE.AnimationClip( 'bsAnimation', - 1, bsTracks )};

	}

	/*
		returns the next non-empty line in lines
	*/
	function nextLine( lines ) {

		let line;
		// skip empty lines
		while ( ( line = lines.shift().trim() ).length === 0 ) { }

		return line;

	}

	const scope = this;

	const lines = text.split( /[\r\n]+/g );

	const {bones, blendshapes} = readBvh( lines );

	const threeBones = [];
	if(bones.length)
		toTHREEBone( bones[ 0 ], threeBones );

	const {skeletonClip, blendshapesClip } = toTHREEAnimation( bones, blendshapes );

	return {
		skeletonAnim: {
			skeleton: skeletonClip.length ? new THREE.Skeleton( threeBones ) : null,
			clip: skeletonClip
		},
		blendshapesAnim: {
			clip: blendshapesClip
		}
	};
		
}