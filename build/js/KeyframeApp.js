import * as THREE  from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

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
			firstLine = nextLine( lines );
			
			// read motion data
			if ( firstLine !== 'MOTION' ) {

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
				if(boneRoot) {
					readFrameBoneData( tokens, i * frameTime, boneRoot );
				}
			}

		}

		if(lines.length > 1) {

			firstLine = nextLine( lines )
			if ( firstLine == 'BLENDSHAPES' )	{
				//console.error( 'THREE.BVHLoader: HIERARCHY expected.' );
				const bsList = []; // collects flat array of all blendshapes
				bs = readBlendshape( lines, nextLine( lines ), bsList );
				firstLine = nextLine( lines );

				// read motion data
				if ( firstLine !== 'MOTION' ) {
		
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
					if(bs) {
						readFrameBSData( tokens, i * frameTime, bs );
					}
	
				}
			}
			
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
			position: new THREE.Vector3(),
			rotation: new THREE.Quaternion()
		};

		bone.frames.push( keyframe );

		const quat = new THREE.Quaternion();

		const vx = new THREE.Vector3( 1, 0, 0 );
		const vy = new THREE.Vector3( 0, 1, 0 );
		const vz = new THREE.Vector3( 0, 0, 1 );

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

		const offset = new THREE.Vector3(
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

		const bone = new THREE.Bone();
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

				boneTracks.push( new THREE.VectorKeyframeTrack( bone.name + '.position', times, positions ) );

			}

			if ( scope.animateBoneRotations ) {

				boneTracks.push( new THREE.QuaternionKeyframeTrack( bone.name + '.quaternion', times, rotations ) );

			}

		}

		const bsTracks = [];
		if(blendshapes) {
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
		}
		return { skeletonClip: new THREE.AnimationClip( 'skeletonAnimation', - 1, boneTracks ), blendshapesClip: new THREE.AnimationClip( 'bsAnimation', - 1, bsTracks )};

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
			skeleton: skeletonClip.tracks.length ? new THREE.Skeleton( threeBones ) : null,
			clip: skeletonClip
		},
		blendshapesAnim: {
			clip: blendshapesClip
		}
	};		
}



// asymetric and/or negative scaling of objects is not properly supported 
class AnimationRetargeting {

    /**
    * @DEFAULT Uses skeleton's actual bind pose
    * @CURRENT Uses skeleton's current pose
    * @TPOSE Forces the skeleton's current pose to T-pose and uses skeleton's current pose
    */
    static BindPoseModes = { DEFAULT : 0, CURRENT: 1}
    static boneMap = {
        "LEye":           "lefteye",
        "REye":           "righteye",
        "Head":           "head",
        "Neck":           "neck",
        "ShouldersUnion": "spine2", // chest
        "Stomach":  	  "spine1",
        "BelowStomach":   "spine",
        "Hips":			  "hips",
        "RShoulder":      "rightshoulder",
        "RArm":           "rightarm",
        "RElbow":         "rightforearm",
        "RHandThumb":     "righthandthumb1",
        "RHandThumb2":    "righthandthumb2",
        "RHandThumb3":    "righthandthumb3",
        "RHandThumb4":    "righthandthumb4",
        "RHandIndex":     "righthandindex1",
        "RHandIndex2":    "righthandindex2",
        "RHandIndex3":    "righthandindex3",
        "RHandIndex4":    "righthandindex4",
        "RHandMiddle":    "righthandmiddle1",
        "RHandMiddle2":   "righthandmiddle2",
        "RHandMiddle3":   "righthandmiddle3",
        "RHandMiddle4":   "righthandmiddle4",
        "RHandRing":      "righthandring1",
        "RHandRing2":     "righthandring2",
        "RHandRing3":     "righthandring3",
        "RHandRing4":     "righthandring4",
        "RHandPinky":     "righthandpinky1",
        "RHandPinky2":    "righthandpinky2",
        "RHandPinky3":    "righthandpinky3",
        "RHandPinky4":    "righthandpinky4",
        "RWrist":         "righthand",
        "LShoulder":      "leftshoulder",
        "LArm":           "leftarm",
        "LElbow":         "leftforearm",
        "LHandThumb":     "lefthandthumb1",
        "LHandThumb2":    "lefthandthumb2",
        "LHandThumb3":    "lefthandthumb3",
        "LHandThumb4":    "lefthandthumb4",
        "LHandIndex":     "lefthandindex1",
        "LHandIndex2":    "lefthandindex2",
        "LHandIndex3":    "lefthandindex3",
        "LHandIndex4":    "lefthandindex4",
        "LHandMiddle":    "lefthandmiddle1",
        "LHandMiddle2":   "lefthandmiddle2",
        "LHandMiddle3":   "lefthandmiddle3",
        "LHandMiddle4":   "lefthandmiddle4",
        "LHandRing":      "lefthandring1",
        "LHandRing2":     "lefthandring2",
        "LHandRing3":     "lefthandring3",
        "LHandRing4":     "lefthandring4",
        "LHandPinky":     "lefthandpinky1",
        "LHandPinky2":    "lefthandpinky2",
        "LHandPinky3":    "lefthandpinky3",
        "LHandPinky4":    "lefthandpinky4",
        "LWrist":         "lefthand",
        "LUpLeg":         "leftupleg",
        "LLeg":           "leftleg",
        "LFoot":          "leftfoot",
        "RUpLeg":         "rightupleg",
        "RLeg":           "rightleg",
        "RFoot":          "rightfoot",
    };
    /**
     * Retargets animations and/or current poses from one skeleton to another. 
     * Both skeletons must have the same bind pose (same orientation for each mapped bone) in order to properly work.
     * Use optional parameters to adjust the bind pose.
     * @param srcSkeleton Skeleton of source avatar. Its bind pose must be the same as trgSkeleton. The original skeleton is cloned and can be safely modified
     * @param trgSkeleton Same as srcSkeleton but for the target avatar
     * @param options.srcPoseMode BindPoseModes enum values. Pose of the srcSkeleton that will be used as the bind pose for the retargeting. By default, skeleton's actual bind pose is used.
     * @param options.trgPoseMode BindPoseModes enum values. Same as srcPoseMode but for the target avatar.

     * @param options.srcEmbedWorldTransforms Bool. Retargeting only takes into account transforms from the actual bone objects. 
     * If set to true, external (parent) transforms are computed and embedded into the root joint. 
     * Afterwards, parent transforms/matrices can be safely modified and will not affect in retargeting.
     * Useful when it is easier to modify the container of the skeleton rather than the actual skeleton in order to align source and target poses
     * @param options.trgEmbedWorldTransforms Same as srcEmbedWorldTransforms but for the target avatar
     * @param options.boneNameMap String-to-string mapping between src and trg through bone names. Only supports one-to-one mapping
     */
    constructor( srcSkeleton, trgSkeleton, options = {} ){

        this.srcSkeleton = srcSkeleton; // original ref
        if ( !srcSkeleton.boneInverses ){ // find its skeleton
            srcSkeleton.traverse( (o) => { if( o.isSkinnedMesh ){ this.srcSkeleton = o.skeleton; } } );
        }
        this.trgSkeleton = trgSkeleton; // original ref
        if ( !trgSkeleton.boneInverses ){ // find its skeleton
            trgSkeleton.traverse( (o) => { if( o.isSkinnedMesh ){ this.trgSkeleton = o.skeleton; } } );
        }        

        this.boneMap = this.computeBoneMap( this.srcSkeleton, this.trgSkeleton, options.boneNameMap ); // { idxMap: [], nameMape:{} }
        this.srcBindPose = this.cloneRawSkeleton( this.srcSkeleton, options.srcPoseMode, options.srcEmbedWorldTransforms ); // returns pure skeleton, without any object model applied 
        this.trgBindPose = this.cloneRawSkeleton( this.trgSkeleton, options.trgPoseMode, options.trgEmbedWorldTransforms ); // returns pure skeleton, without any object model applied

        this.precomputedQuats = this.precomputeRetargetingQuats();
        this.proportionRatio = this.computeProportionRatio(); // returns an aproximate ratio of lengths between source skeleton and target skeleton
    }

    /**
     * creates a Transform object with identity values
     * @returns Transform
     */
    _newTransform(){ return { p: new THREE.Vector3(0,0,0), q: new THREE.Quaternion(0,0,0,1), s: new THREE.Vector3(1,1,1) }; }

    /**
     * Deep clone of the skeleton. New bones are generated. Skeleton's parent objects will not be linked to the cloned one
     * Returned skeleton has new attributes: 
     *  - Always: .parentIndices, .transformsWorld, .transformsWorldInverses
     *  - embedWorld == true:  .transformsWorldEmbedded
     * @param {THREE.Skeleton} skeleton 
     * @returns {THREE.Skeleton}
     */
    cloneRawSkeleton( skeleton, poseMode, embedWorld = false ){
        let bones = skeleton.bones;
       
        let resultBones = new Array( bones.length );
        let parentIndices = new Int16Array( bones.length );

        // bones[0].clone( true ); // recursive
        for( let i = 0; i < bones.length; ++i ){
            resultBones[i] = bones[i].clone(false);
            resultBones[i].parent = null;
        }
        
        for( let i = 0; i < bones.length; ++i ){
            let parentIdx = findIndexOfBone( skeleton, bones[i].parent )
            if ( parentIdx > -1 ){ resultBones[ parentIdx ].add( resultBones[ i ] ); }
            
            parentIndices[i] = parentIdx;
        }

        resultBones[0].updateWorldMatrix( false, true ); // assume 0 is root. Update all global matrices (root does not have any parent)
        
        // generate skeleton
        let resultSkeleton;
        switch(poseMode) {
            case AnimationRetargeting.BindPoseModes.CURRENT: 
                resultSkeleton = new THREE.Skeleton( resultBones ); // will automatically compute the inverses from the matrixWorld of each bone               
                
                break;
            default:
                let boneInverses = new Array( skeleton.boneInverses.length );
                for( let i = 0; i < boneInverses.length; ++i ) { 
                    boneInverses[i] = skeleton.boneInverses[i].clone(); 
                }
                resultSkeleton = new THREE.Skeleton( resultBones, boneInverses );
                resultSkeleton.pose();
                break;
        }
        
        resultSkeleton.parentIndices = parentIndices; // add this attribute to the THREE.Skeleton class

        // precompute transforms (forward and inverse) from world matrices
        let transforms = new Array( skeleton.bones.length );
        let transformsInverses = new Array( skeleton.bones.length );
        for( let i = 0; i < transforms.length; ++i ){
            let t = this._newTransform();
            resultSkeleton.bones[i].matrixWorld.decompose( t.p, t.q, t.s );
            transforms[i] = t;
            
            t = this._newTransform();
            resultSkeleton.boneInverses[i].decompose( t.p, t.q, t.s );
            transformsInverses[i] = t;
        }
        resultSkeleton.transformsWorld = transforms;
        resultSkeleton.transformsWorldInverses = transformsInverses;

        // embedded transform
        if ( embedWorld && bones[0].parent ){
            let embedded = { forward: this._newTransform(), inverse: this._newTransform() };
            let t = embedded.forward;
            bones[0].parent.updateWorldMatrix( true, false );
            bones[0].parent.matrixWorld.decompose( t.p, t.q, t.s );
            t = embedded.inverse;
            skeleton.bones[0].parent.matrixWorld.clone().invert().decompose( t.p, t.q, t.s );
            resultSkeleton.transformsWorldEmbedded = embedded;
        }
        return resultSkeleton;
    }


    /**
     * Maps bones from one skeleton to another given boneMap. 
     * Given a null bonemap, an automap is performed
     * @param {THREE.Skeleton} srcSkeleton 
     * @param {THREE.Skeleton} trgSkeleton 
     * @param {object} boneMap { string: string }
     * @returns {object} { idxMap: [], nameMape: {} }
     */
    computeBoneMap( srcSkeleton, trgSkeleton, boneMap = null ){
        let srcBones = srcSkeleton.bones;
        let trgBones = trgSkeleton.bones;
        let result = {
            idxMap: new Int16Array( srcBones.length ),
            nameMap: {}
        }
        result.idxMap.fill( -1 ); // default to no map;
        if ( boneMap ) {
            for ( let srcName in boneMap ){
                let idx = findIndexOfBoneByName( srcSkeleton, srcName );    
                if ( idx < 0 ){ continue; }
                let trgIdx = findIndexOfBoneByName( trgSkeleton, boneMap[ srcName ] ); // will return either a valid index or -1
                result.idxMap[ idx ] = trgIdx;
                result.nameMap[ srcName ] = boneMap[ srcName ];
            }
        }
        else {
            // automap
            const auxBoneMap = Object.keys(AnimationRetargeting.boneMap);
            this.srcBoneMap = computeAutoBoneMap( srcSkeleton );
            this.trgBoneMap = computeAutoBoneMap( trgSkeleton );
            if(this.srcBoneMap.idxMap.length && this.trgBoneMap.idxMap.length) {
                for(let i = 0; i < auxBoneMap.length; i++) {           
                    const name = auxBoneMap[i];
                    if(this.srcBoneMap.idxMap[i] < 0) {
                        continue;
                    }
                    result.idxMap[this.srcBoneMap.idxMap[i]] = this.trgBoneMap.idxMap[i];
                    result.nameMap[ this.srcBoneMap.nameMap[name]] = this.trgBoneMap.nameMap[name]; 
                }
            }
        }

        return result
    }

    /**
    * Computes an aproximate ratio of lengths between source skeleton and target skeleton
    */
    computeProportionRatio(){
        let srcLength = 0;        
        // Compute source sum of bone lengths
        for(let i = 1; i < this.srcBindPose.bones.length; i++) {
            let dist = this.srcBindPose.bones[i].getWorldPosition(new THREE.Vector3()).distanceTo(this.srcBindPose.bones[i].parent.getWorldPosition(new THREE.Vector3()))
            srcLength += dist;
        }

        let trgLength = 0;
        // Compute target sum of bone lengths
        for(let i = 1; i < this.trgBindPose.bones.length; i++) {
            let dist = this.trgBindPose.bones[i].getWorldPosition(new THREE.Vector3()).distanceTo(this.trgBindPose.bones[i].parent.getWorldPosition(new THREE.Vector3()))
            trgLength += dist;
        }        
        return trgLength / srcLength
    }

    precomputeRetargetingQuats(){
        //BASIC ALGORITHM --> trglocal = invBindTrgWorldParent * bindSrcWorldParent * srcLocal * invBindSrcWorld * bindTrgWorld
        // trglocal = invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent * srcLocal * invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld

        let left = new Array( this.srcBindPose.bones.length ); // invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent
        let right = new Array( this.srcBindPose.bones.length ); // invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld
        
        for( let srcIndex = 0; srcIndex < left.length; ++srcIndex ){
            let trgIndex = this.boneMap.idxMap[ srcIndex ];
            if( trgIndex < 0 ){ // not mapped, cannot precompute
                left[ srcIndex ] = null;
                right[ srcIndex ] = null;
                continue;
            }

            let resultQuat = new THREE.Quaternion(0,0,0,1);
            resultQuat.copy( this.trgBindPose.transformsWorld[ trgIndex ].q ); // bindTrgWorld
            if ( this.trgBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.trgBindPose.transformsWorldEmbedded.forward.q ); } // trgEmbedded
            if ( this.srcBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.srcBindPose.transformsWorldEmbedded.inverse.q ); } // invSrcEmbedded
            resultQuat.premultiply( this.srcBindPose.transformsWorldInverses[ srcIndex ].q ); // invBindSrcWorld
            right[ srcIndex ] = resultQuat;

            resultQuat = new THREE.Quaternion(0,0,0,1);
            // bindSrcWorldParent
            if ( this.srcBindPose.bones[ srcIndex ].parent ){ 
                let parentIdx = this.srcBindPose.parentIndices[ srcIndex ];
                resultQuat.premultiply( this.srcBindPose.transformsWorld[ parentIdx ].q ); 
            }

            if ( this.srcBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.srcBindPose.transformsWorldEmbedded.forward.q ); } // srcEmbedded
            if ( this.trgBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.trgBindPose.transformsWorldEmbedded.inverse.q ); } // invTrgEmbedded

            // invBindTrgWorldParent
            if ( this.trgBindPose.bones[ trgIndex ].parent ){ 
                let parentIdx = this.trgBindPose.parentIndices[ trgIndex ];
                resultQuat.premultiply( this.trgBindPose.transformsWorldInverses[ parentIdx ].q ); 
            } 
            left[ srcIndex ] = resultQuat
        }
        
        return { left: left, right: right };
    }

    /**
     * retargets the bone specified
     * @param {int} srcIndex MUST be a valid MAPPED bone. Otherwise it crashes
     * @param {THREE.Quaternion} srcLocalQuat 
     * @param {THREE.Quaternion} resultQuat if null, a new THREE.Quaternion is created
     * @returns resultQuat
     */
    _retargetQuaternion( srcIndex, srcLocalQuat, resultQuat = null ){
        if ( !resultQuat ){ resultQuat = new THREE.Quaternion(0,0,0,1); }
        //BASIC ALGORITHM --> trglocal = invBindTrgWorldParent * bindSrcWorldParent * srcLocal * invBindSrcWorld * bindTrgWorld
        // trglocal = invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent * srcLocal * invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld
        
        // In this order because resultQuat and srcLocalQuat might be the same Quaternion instance
        resultQuat.copy( srcLocalQuat ); // srcLocal
        resultQuat.premultiply( this.precomputedQuats.left[ srcIndex ] ); // invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent
        resultQuat.multiply( this.precomputedQuats.right[ srcIndex ] ); // invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld
        return resultQuat;
    }

    /**
     * Retargets the current whole (mapped) skeleton pose.
     * Currently, only quaternions are retargeted 
     */
    retargetPose(){      
        
        let m = this.boneMap.idxMap;        
        for ( let i = 0; i < m.length; ++i ){
            if ( m[i] < 0 ){ continue; }
            this._retargetQuaternion( i, this.srcSkeleton.bones[ i ].quaternion, this.trgSkeleton.bones[ m[i] ].quaternion );
        }
    }

    /**
     * 
     * assumes srcTrack IS a position track (VectorKeyframeTrack) with the proper values array and name (boneName.scale) 
     * @param {THREE.VectorKeyframeTrack} srcTrack 
     * @returns {THREE.VectorKeyframeTrack}
     */
    retargetPositionTrack( srcTrack ){
        let boneName = srcTrack.name.slice(0, srcTrack.name.length - 9 ); // remove the ".position"
        let boneIndex = findIndexOfBoneByName( this.srcSkeleton, boneName );
        if ( boneIndex < 0 || this.boneMap.idxMap[ boneIndex ] < 0 ){
            return null;
        } 
        // Retargets the root bone posiiton
        let srcValues = srcTrack.values;
        let trgValues = new Float32Array( srcValues.length );
        if( boneIndex == 0 ) { // asume the first bone is the root

            let trgBindPos = this.trgBindPose.bones[boneIndex].getWorldPosition(new THREE.Vector3());
            let srcBindPos = this.srcBindPose.bones[boneIndex].getWorldPosition(new THREE.Vector3());
						
            let pos = new THREE.Vector3();

            for( let i = 0; i < srcValues.length; i+=3 ){
                
                pos.set( srcValues[i], srcValues[i+1], srcValues[i+2]);
                let diffPosition = new THREE.Vector3();
                diffPosition.subVectors(pos, srcBindPos);

                // Scale the animation difference position with the scale diff between source and target and add it to the the Target Bind Position of the bone
                diffPosition.multiplyScalar(this.proportionRatio);
                if(this.srcBindPose.transformsWorldEmbedded) {
                    diffPosition.applyQuaternion(this.srcBindPose.transformsWorldEmbedded.forward.q);
                }
                if(this.trgBindPose.transformsWorldEmbedded) {
                    diffPosition.applyQuaternion(this.trgBindPose.transformsWorldEmbedded.inverse.q);
                }
			    diffPosition.add(trgBindPos);
                
                trgValues[i]   = diffPosition.x ;
                trgValues[i+1] = diffPosition.y ;
                trgValues[i+2] = diffPosition.z ;            
            }
        }
        // TODO missing interpolation mode. Assuming always linear. Also check if arrays are copied or referenced
        return new THREE.VectorKeyframeTrack( this.boneMap.nameMap[ boneName ] + ".position", srcTrack.times, trgValues ); 
    }
    
    /**
     * assumes srcTrack IS a quaternion track with the proper values array and name (boneName.quaternion) 
     * @param {THREE.QuaternionKeyframeTrack} srcTrack 
     * @returns {THREE.QuaternionKeyframeTrack}
     */
    retargetQuaternionTrack( srcTrack ){
        let boneName = srcTrack.name.slice(0, srcTrack.name.length - 11 ); // remove the ".quaternion"
        let boneIndex = findIndexOfBoneByName( this.srcSkeleton, boneName );
        if ( boneIndex < 0 || this.boneMap.idxMap[ boneIndex ] < 0 ){
            return null;
        } 

        let quat = new THREE.Quaternion( 0,0,0,1 );
        let srcValues = srcTrack.values;
        let trgValues = new Float32Array( srcValues.length );
        for( let i = 0; i < srcValues.length; i+=4 ){
            quat.set( srcValues[i], srcValues[i+1], srcValues[i+2], srcValues[i+3] );
            this._retargetQuaternion( boneIndex, quat, quat );
            trgValues[i] = quat.x;
            trgValues[i+1] = quat.y;
            trgValues[i+2] = quat.z;
            trgValues[i+3] = quat.w;
        }

        // TODO missing interpolation mode. Assuming always linear
        return new THREE.QuaternionKeyframeTrack( this.boneMap.nameMap[ boneName ] + ".quaternion", srcTrack.times, trgValues ); 
    }

    /**
     * NOT IMPLEMENTEED
     * assumes srcTrack IS a scale track (VectorKeyframeTrack) with the proper values array and name (boneName.scale) 
     * @param {THREE.VectorKeyframeTrack} srcTrack 
     * @returns {THREE.VectorKeyframeTrack}
     */
    retargetScaleTrack( srcTrack ){
        let boneName = srcTrack.name.slice(0, srcTrack.name.length - 6 ); // remove the ".scale"
        let boneIndex = findIndexOfBoneByName( this.srcSkeleton, boneName );
        if ( boneIndex < 0 || this.boneMap.idxMap[ boneIndex ] < 0 ){
            return null;
        } 
        // TODO

        // TODO missing interpolation mode. Assuming always linear. Also check if arrays are copied or referenced
        return new THREE.VectorKeyframeTrack( this.boneMap.nameMap[ boneName ] + ".scale", srcTrack.times, srcTrack.values ); 
    }

    /**
     * Given a clip, all tracks with a mapped bone are retargeted.
     * Currently only quaternions are retargeted
     * @param {THREE.AnimationClip} anim 
     * @returns {THREE.AnimationClip}
     */
    retargetAnimation( anim ){
        let trgTracks = [];
        let srcTracks = anim.tracks;
        for( let i = 0; i < srcTracks.length; ++i ){
            let t = srcTracks[i];
            let newTrack = null;
            if ( t.name.endsWith( ".position" ) && t.name.includes(this.srcSkeleton.bones[0].name) ){ newTrack = this.retargetPositionTrack( t ); } // ignore for now
            else if ( t.name.endsWith( ".quaternion" ) ){ newTrack = this.retargetQuaternionTrack( t ); }
            else if ( t.name.endsWith( ".scale" ) ){ newTrack = this.retargetScaleTrack( t ); } // ignore for now

            if ( newTrack ){ trgTracks.push( newTrack ); }
        } 

        // negative duration: automatically computes proper duration of animation based on tracks
        return new THREE.AnimationClip( anim.name, -1, trgTracks, anim.blendMode ); 
    }
}

// ---- HELPERS ----
// should be moved into a "utils" file 

// O(n)
function findIndexOfBone( skeleton, bone ){
    if ( !bone ){ return -1;}
    let b = skeleton.bones;
    for( let i = 0; i < b.length; ++i ){
        if ( b[i] == bone ){ return i; }
    }
    return -1;
}

// O(nm)
function findIndexOfBoneByName( skeleton, name ){
    if ( !name ){ return -1; }
    let b = skeleton.bones;
    for( let i = 0; i < b.length; ++i ){
        if ( b[i].name == name ){ return i; }
    }
    return -1;
}

// sets bind quaternions only. Warning: Not the best function to call every frame.
function forceBindPoseQuats( skeleton, skipRoot = false ){
    let bones = skeleton.bones;
    let inverses = skeleton.boneInverses;
    if ( inverses.length < 1 ){ return; }
    let boneMat = inverses[0].clone(); 
    let _ignoreVec3 = new THREE.Vector3();
    for( let i = 0; i < bones.length; ++i ){
        boneMat.copy( inverses[i] ); // World to Local
        boneMat.invert(); // Local to World

        // get only the local matrix of the bone (root should not need any change)
        let parentIdx = findIndexOfBone( skeleton, bones[i].parent );
        if ( parentIdx > -1 ){ boneMat.premultiply( inverses[ parentIdx ] ); }
        else{
            if ( skipRoot ){ continue; }
        }
       
        boneMat.decompose( _ignoreVec3, bones[i].quaternion, _ignoreVec3 );
        // bones[i].quaternion.setFromRotationMatrix( boneMat );
        bones[i].quaternion.normalize(); 
    }
}

/**
 * Apply a T-pose shape facing +Z axis  to the passed skeleton.     
 * @param {THREE.Skeleton} skeleton 
 * @param {Object} map 
*/
function applyTPose(skeleton, map) {
	if(!map) {
        map = computeAutoBoneMap(skeleton);
        map = map.nameMap;
    }
    else {
        if(Object.values(map).every(value => value === null)) {
            map = computeAutoBoneMap(skeleton);
            map = map.nameMap;
        }
    }
    
    const resultSkeleton = skeleton;
    
	const x_axis = new THREE.Vector3(1, 0, 0);
	const y_axis = new THREE.Vector3(0, 1, 0);
	const z_axis = new THREE.Vector3(0, 0, 1);

	// Fully extend the chains    
	extendChain( resultSkeleton, resultSkeleton.bones[0].name, map.ShouldersUnion); // Spine
	extendChain( resultSkeleton, map.LUpLeg, map.LFoot); // Left Leg
	extendChain( resultSkeleton, map.RUpLeg, map.RFoot); // Right Leg
	extendChain( resultSkeleton, map.LArm, map.LWrist); // Left Arm
	extendChain( resultSkeleton, map.RArm, map.RWrist); // Right Arm
    
    const leftHand = resultSkeleton.getBoneByName(map.LWrist);
    for(let i = 0; i < leftHand.children.length; i++) { // Left Fingers
        extendChain( resultSkeleton, leftHand.children[i]);
        extendChain( resultSkeleton, map.LWrist, leftHand.children[i].children[0]); // Left Arm
    }
    const rightHand = resultSkeleton.getBoneByName(map.RWrist);
    for(let i = 0; i < rightHand.children.length; i++) { // Right Fingers
        extendChain( resultSkeleton, rightHand.children[i]); 
        extendChain( resultSkeleton, map.RWrist, rightHand.children[i].children[0]); // Right Arm
    }

	// Forces the pose to face the +Z axis using the left-right arm and spine plane
    const right_arm = resultSkeleton.getBoneByName(map.RArm);
    const left_arm = resultSkeleton.getBoneByName(map.LArm);
    
    const spine_base = resultSkeleton.bones[0];
    const spine_end = resultSkeleton.getBoneByName(map.ShouldersUnion);
	
    const rArmPos = right_arm.getWorldPosition(new THREE.Vector3());
    const lArmPos = left_arm.getWorldPosition(new THREE.Vector3());

    const basePos = spine_base.getWorldPosition(new THREE.Vector3());
    const endPos = spine_end.getWorldPosition(new THREE.Vector3());
  
    const spine_dir = new THREE.Vector3();
    spine_dir.subVectors(endPos, basePos).normalize();

    const arms_dir = new THREE.Vector3();
    arms_dir.subVectors(lArmPos, rArmPos).normalize();
	lookBoneAtAxis(resultSkeleton.bones[0], arms_dir, spine_dir, z_axis);
	
	// Align the 5 chains so that they follow their corresponding axes
	// SPINE
    alignBoneToAxis(resultSkeleton, resultSkeleton.bones[0].name, map.ShouldersUnion, y_axis);
	
	// LEGS
	// check if left leg follows the -Y axis
    const neg_y_axis = y_axis.clone().multiplyScalar(-1);
    alignBoneToAxis(resultSkeleton, map.LUpLeg, map.LFoot, neg_y_axis);
	// if check right leg follow the -Y axis
    alignBoneToAxis(resultSkeleton, map.RUpLeg, map.RFoot, neg_y_axis);
    
	// ARMS
	// check if left arm follows the X axis
    alignBoneToAxis(resultSkeleton, map.LArm, map.LWrist, x_axis);
	// if check right arm follow the -X axis
    const neg_x_axis = x_axis.clone().multiplyScalar(-1);
    alignBoneToAxis(resultSkeleton, map.RArm, map.RWrist, neg_x_axis);

    for(let i = 0; i < leftHand.children.length; i++) { // Left Fingers
        alignBoneToAxis( resultSkeleton, leftHand.children[i], null, x_axis); 
    }
    for(let i = 0; i < rightHand.children.length; i++) { // Right Fingers
        alignBoneToAxis( resultSkeleton, rightHand.children[i], null, neg_x_axis); 
    }
	// return new T-pose
    resultSkeleton.update(); 
    return {skeleton: resultSkeleton, map};
}

/**
 * Extends all bones in the given chain (origin and end) to follow the direction of the parent bone and updates it to the given pose
 * @param {THREE.Skeleton} resultSkeleton 
 * @param {String} origin : bone's name 
 * @param {String} end : bone's name 
 */
function extendChain(resultSkeleton, origin, end) {

    const base = typeof(origin) == 'string' ? resultSkeleton.getBoneByName(origin) : origin;
    let previous = null;
    if( !end ) {
        end = base;
        while( end.children.length ) {
            end = end.children[0];            
        }
        previous = end;
    }
    else {
        previous = typeof(end) == 'string' ? resultSkeleton.getBoneByName(end) : end;
    }
	let current = previous.parent;
	let next = current.parent;

	while( next != base.parent ) {
		
		// Extend the bone current_id - previous_id to follow the next_id - current_id direction
		const prevPos = previous.getWorldPosition(new THREE.Vector3());
		const currPos = current.getWorldPosition(new THREE.Vector3());
		const nextPos = next.getWorldPosition(new THREE.Vector3());

		// Direction from the parent joint to the middle joint (desired)
        const desired_dir = new THREE.Vector3();
		desired_dir.subVectors(nextPos, currPos).normalize();
		// Direction from the middle joint to the child joint (current)
		const current_dir = new THREE.Vector3();
        current_dir.subVectors(currPos, prevPos);

		// Angle to go from the current dir to the desired dir
		const angle = current_dir.angleTo(desired_dir);

		if (Math.abs(angle) > 0.01) {
			// Axis of rotation (perpendicular): To rotate from the current to the desired direction
            let axis = new THREE.Vector3();
            axis.crossVectors(current_dir, desired_dir).normalize();
			// Rotation from current to the desired direction in quaterion
			const rot = new THREE.Quaternion().setFromAxisAngle(axis, angle);
			// Apply the rotation to the current rotation of the joint in global space
            let currRot = current.getWorldQuaternion(new THREE.Quaternion());
			currRot = rot.multiply(currRot);
            let nextRot = next.getWorldQuaternion(new THREE.Quaternion());
			// Convert the rotation in local space
			const localRot = nextRot.invert().multiply(currRot);
			current.quaternion.copy(localRot);			
            current.updateMatrix();
            current.updateMatrixWorld(false, true);
		}

		// Update the ids for the next iteration
		previous = current;
		current = next;
		next = next.parent;
	}
}
/**
 * Given the vectors that form a plane and the desired direction where to look, rotates the root bone of the given pose to face at the desired axis.
 * @param {THREE.Bone} bone 
 * @param {THREE.Vector3} dir_a : bone's name 
 * @param {THREE.Vector3} dir_b : bone's name 
 * @param {THREE.Vector3} axis 
 */
function lookBoneAtAxis(bone, dir_a, dir_b, axis ) {
	
	// Face the pose looking at the given axis
	// Normal vector of the plane (perpendicular): Current direction that the character is looking
    let rot_axis = new THREE.Vector3();
    rot_axis.crossVectors(dir_a, dir_b).normalize();
	const angle = rot_axis.angleTo(axis);

	if (Math.abs(angle) > 0.01) {
		// Axis of rotation (perpendicular): To rotate from the current plane direction to the axis direction
        let new_axis = new THREE.Vector3();
        new_axis.crossVectors(rot_axis, axis).normalize();
		// Rotation from current to the desired direction in quaterion
        const rot = new THREE.Quaternion().setFromAxisAngle(new_axis, angle);
			
		// Apply the rotation to the current rotation of the joint in global space
        let global_rot = bone.getWorldQuaternion(new THREE.Quaternion())
		global_rot = rot.multiply(global_rot);

		// Convert the rotation in local space
        let local_rot = global_rot;
        // Convert the rotation in local space
        if ( bone.parent ) {
            const parent_rot = bone.parent.getWorldQuaternion(new THREE.Quaternion());
            local_rot = parent_rot.invert().multiply(global_rot);
        }
		bone.quaternion.copy(local_rot);
        bone.updateMatrix();
        bone.updateMatrixWorld(false, true);
	}
}


/**
 * Aligns the direction of the origin-end vector to follow the given axis and updates the direction at the given pose
 * @param {THREE.Skeleton} resultSkeleton 
 * @param {String} origin : bone's name 
 * @param {String} end : bone's name 
 * @param {THREE.Vector3} axis 
 */
function alignBoneToAxis(resultSkeleton, origin, end = null, axis ) {
    
	// Rotate the direction of the origin-end vector to follow the given axis
	const oBone = typeof(origin) == 'string' ? resultSkeleton.getBoneByName(origin) : origin;
    oBone.updateMatrixWorld(true, true);
    if( !end ) {
        end = oBone.children[0];
    }
    const eBone = typeof(end) == 'string' ? resultSkeleton.getBoneByName(end) : end;
    // Get global positions
    const oPos = oBone.getWorldPosition(new THREE.Vector3());
    const ePos = eBone.getWorldPosition(new THREE.Vector3());
    
    // Compute the unitary direction of the bone from its position and its child position
    let dir = new THREE.Vector3();
    dir.subVectors(ePos, oPos).normalize();

	// Angle between the current direction and the desired direction 
	const angle = (dir).angleTo(axis);
    if( Math.abs(angle) > 0.001 ) {
        // Axis of rotation (perpendicular): To rotate from the current to the desired direction
        let new_axis = new THREE.Vector3();
        new_axis.crossVectors(dir, axis).normalize();
        // Rotation from current to the desired direction in quaterion
        const rot = new THREE.Quaternion().setFromAxisAngle(new_axis, angle);
        // Get bone global rotation 
        let oRot = oBone.getWorldQuaternion(new THREE.Quaternion())
        // Apply the rotation to the current rotation of the joint in global space
        oRot = rot.multiply(oRot);
        let oLocalRot = oRot;
        // Convert the rotation in local space
        if ( oBone.parent ) {
            const oParentRot = oBone.parent.getWorldQuaternion(new THREE.Quaternion());
            oLocalRot = oParentRot.invert().multiply(oRot);
        }

        oBone.quaternion.copy(oLocalRot);
        oBone.updateMatrix();
        oBone.updateMatrixWorld(false, true);
    }
}

/**
 * Maps automatically bones from the skeleton to an auxiliar map. 
 * Given a null bonemap, an automap is performed
 * @param {THREE.Skeleton} srcSkeleton 
 * @returns {object} { idxMap: [], nameMape: {} }
 */
function computeAutoBoneMap( skeleton ){
    const auxBoneMap = Object.keys(AnimationRetargeting.boneMap);
    let bones = skeleton.bones;
    let result = {
        idxMap: new Int16Array( auxBoneMap.length ),
        nameMap: {} 
    };

    result.idxMap.fill( -1 ); // default to no map;
    // automap
    for(let i = 0; i < auxBoneMap.length; i++) {
        const auxName = auxBoneMap[i];
        for( let j = 0; j < bones.length; ++j ){
            let name = bones[j].name;
            if ( typeof( name ) !== "string" ){ continue; }
            name = name.toLowerCase().replace( "mixamorig", "" ).replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "" );
            if ( name.length < 1 ){ continue; }
            if(name.toLowerCase().includes(auxName.toLocaleLowerCase()) || name.toLowerCase().includes(AnimationRetargeting.boneMap[auxName].toLocaleLowerCase())) {
                result.nameMap[auxName] = bones[j].name;
                result.idxMap[i] = j;
                break;
            }
        }                
    }
    return result;
}




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

export { BVHLoader, AnimationRetargeting, findIndexOfBone, findIndexOfBoneByName, forceBindPoseQuats, applyTPose, computeAutoBoneMap, KeyframeApp} 
