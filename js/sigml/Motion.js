import * as THREE from "three";
import { cubicBezierVec3, stringToDirection } from "./Utils.js";

let _tempVec3_0 = new THREE.Vector3(0,0,0);
let _tempVec3_1 = new THREE.Vector3(0,0,0);
let _tempQuat_0 = new THREE.Quaternion(0,0,0,1);
let _tempQuat_1 = new THREE.Quaternion(0,0,0,1);

class DirectedMotion {
    constructor(){
        this.finalOffset = new THREE.Vector3(0,0,0);        
        this.bezier = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ]

        this.distance = 0.05; // metres
        this.curveSize = 0.5; // [0,1] curve curveSize

        this.zigzagDir = new THREE.Vector3(0,0,1);
        this.zigzagSize = 0.01; // metres. Complete amplitude. Motion will move half to dir and half to -dir
        this.zigzagSpeed = 2; // loops per second

        this.transition = false;
        this.time = 0;

        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
    }

    reset(){
        this.transition = false;
        this.finalOffset.set(0,0,0);
    }

    update( dt ){
        if ( !this.transition ){ return; }
        
        this.time += dt;
        if ( this.time < this.start ){ return this.finalOffset; }

        else if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            // t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5; // commented because of sigml purposes
            cubicBezierVec3( this.bezier[0], this.bezier[1], this.bezier[2], this.bezier[3], this.finalOffset, t );

            let zigzagAttenuation = Math.min( 1,  Math.min( ( this.attackPeak - this.time ) / 0.15, ( this.time - this.start ) / 0.15 ) );  // min( full, outro, intro ). 0.15 seconds of intro and 0.5 of outro if possible
            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * ( this.time - this.start ) ) * this.zigzagSize * 0.5 * zigzagAttenuation;
            this.finalOffset.x = this.finalOffset.x + this.zigzagDir.x * zigzagt;
            this.finalOffset.y = this.finalOffset.y + this.zigzagDir.y * zigzagt;
            this.finalOffset.z = this.finalOffset.z + this.zigzagDir.z * zigzagt;
        }

        else if ( this.time < this.relax ){ 
            this.finalOffset.copy( this.bezier[3] );
        }

        else if ( this.time < this.end ){ // lerp to origin (0,0,0) 
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            // t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5; // commented because of sigml purposes
            this.finalOffset.copy( this.bezier[3] );
            this.finalOffset.multiplyScalar( 1.0 - t );
        }

        else { this.transition = false; this.finalOffset.set(0,0,0); }

        return this.finalOffset;
    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * direction: string from 26 directions
     * secondDirection: (optional)
     * distance: (optional) size in metres of the displacement. Default 0.2 m (20 cm)
     * curve: (optional) string from 6 basic directions. Default to none
     * secondCurve: (optional)
     * curveSize: (optional) number from [0,1] meaning the amplitude of the curve
     * zigzag: (optional) string from 26 directions
     * zigzagSize: (optional) amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
     * zigzagSpeed: (optional) cycles per second. Default 2
     */
    newGestureBML( bml, symmetry ){
        this.finalOffset.set(0,0,0);
          
        this.distance = isNaN( bml.distance ) ? 0.2 : bml.distance; // metres
        this.curveSize = isNaN( bml.curveSize ) ? 0.5 : Math.max( 0, Math.min( 1, bml.curveSize ) );
        
        // THE FOLLOWING CODE TRIES TO MIMIC JASIGNING/HAMNOSYS BEHAVIOUR. IT COULD BE MUCH SIMPLER OTHERWISE

        // fetch curve direction and adjust curveSize if not present
        let curveDir = _tempVec3_0.set(0,0,0);
        if ( stringToDirection( bml.curve, curveDir, symmetry, true ) ){
            curveDir.z = 0;
            if ( stringToDirection( bml.secondCurve, _tempVec3_1, symmetry, true ) ){
                _tempVec3_1.z = 0;
                curveDir.lerp( _tempVec3_1, 0.5 );
            }
            if ( curveDir.lengthSq() > 0.00001 ){ curveDir.normalize(); }
        }
        curveDir.multiplyScalar( this.curveSize * 0.5 );

        // set default direction (+z), default curve direction (+y) and ajust with size and curve curveSize       
        this.bezier[0].set( 0, 0, 0 );
        this.bezier[1].set( curveDir.x, curveDir.y, 0 );
        this.bezier[2].set( curveDir.x, curveDir.y, this.distance );
        this.bezier[3].set( 0, 0, this.distance );
         
        // fetch direction and secondDirection
        let finalDir = _tempVec3_0;
        if ( !stringToDirection( bml.direction, finalDir, symmetry, true ) ){
            console.warn( "DirectedMotion has incorrect direction values" );
            return false;
        }
        if( finalDir.lengthSq() > 0.0001 ){ finalDir.normalize(); }
        if ( stringToDirection( bml.secondDirection, _tempVec3_1, symmetry, true ) ){
            if( _tempVec3_1.lengthSq() > 0.0001 ){ _tempVec3_1.normalize(); }
            finalDir.lerp( _tempVec3_1, 0.5 );
            if( finalDir.lengthSq() > 0.0001 ){ finalDir.normalize(); }
        }

        // default looks at +z. If direction falls in -z, change default to -z to avoid accidental left-right, up-down mirror
        if ( finalDir.z < 0 ){
            this.bezier[0].z *= -1;
            this.bezier[1].z *= -1;
            this.bezier[2].z *= -1;
            this.bezier[3].z *= -1;
        }
        
        // rotate default direction to match the user's one
        let lookAtQuat = _tempQuat_0;
        if ( Math.abs(finalDir.dot(this.bezier[3])) > 0.999 ){ lookAtQuat.set(0,0,0,1); }
        else{ 
            let angle = finalDir.angleTo( this.bezier[3] );
            _tempVec3_0.crossVectors( this.bezier[3], finalDir );
            _tempVec3_0.normalize();
            lookAtQuat.setFromAxisAngle( _tempVec3_0, angle );
        }
        this.bezier[0].applyQuaternion( lookAtQuat );
        this.bezier[1].applyQuaternion( lookAtQuat );
        this.bezier[2].applyQuaternion( lookAtQuat );
        this.bezier[3].applyQuaternion( lookAtQuat );

        // zig-zag
        if ( stringToDirection( bml.zigzag, this.zigzagDir ) ){
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // metres
            this.zigzagSpeed = isNaN( bml.zigzagSpeed ) ? 2 : bml.zigzagSpeed; // rps
        }else{
            this.zigzagDir.set(0,0,0);
            this.zigzagSize = 0.0; // metres
            this.zigzagSpeed = 0; // rps
        }

        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0; 

        // flag to start 
        this.transition = true;

        return true;
    }
}

class CircularMotion {
    constructor(){
        this.yAxis = new THREE.Vector3(0,1,0);
        this.xAxis = new THREE.Vector3(1,0,0);
        this.startPoint = new THREE.Vector3(0,0,0);
        this.trgAngle = 0; // target delta angle
        this.srcAngle = 0; 

        this.finalOffset = new THREE.Vector3(0,0,0);
        
        this.zigzagDir = new THREE.Vector3(0,0,1);
        this.zigzagSize = 0.01; // metres. Complete amplitude. Motion will move half to dir and half to -dir
        this.zigzagSpeed = 2; // loops per second

        this.transition = false;
        this.time = 0;

        this.start = 0;
        this.end = 0;
    }

    reset(){
        this.transition = false;
        this.finalOffset.set(0,0,0);
    }

    update( dt ){
        if ( !this.transition ){ return this.finalOffset; }
        
        this.time += dt;
        if ( this.time < this.start ){ return this.finalOffset; }
        if ( this.time >= this.attackPeak && this.time <= this.relax ){ // necessary to update (at least once) or there might be a jump
            this.finalOffset.set(0,0,0);
            this.finalOffset.addScaledVector( this.xAxis, Math.cos( this.trgAngle ) );
            this.finalOffset.addScaledVector( this.yAxis, Math.sin( this.trgAngle ) );
            this.finalOffset.sub( this.startPoint );
            return this.finalOffset; 
        }
        if ( this.time >= this.relax && this.time <= this.end ){ 
            this.finalOffset.set(0,0,0);
            this.finalOffset.addScaledVector( this.xAxis, Math.cos( this.trgAngle ) );
            this.finalOffset.addScaledVector( this.yAxis, Math.sin( this.trgAngle ) );
            this.finalOffset.sub( this.startPoint );
            this.finalOffset.multiplyScalar( ( this.end - this.time ) / ( this.end - this.relax ) );
            return this.finalOffset;
        }
        if ( this.time >= this.end ){ 
            this.transition = false; 
            this.finalOffset.set(0,0,0); 
            return this.finalOffset;
        }

        //if ( time > start && time < attackpeak ) start attackpeak
        let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
        // t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5;  // commented because of sigml purposes
        t = ( t > 1 ) ? 1 : t;
        
        // angle to rotate startPoint
        this.finalOffset.set(0,0,0);
        this.finalOffset.addScaledVector( this.xAxis, Math.cos( this.srcAngle * ( 1 - t ) + this.trgAngle * t ) );
        this.finalOffset.addScaledVector( this.yAxis, Math.sin( this.srcAngle * ( 1 - t ) + this.trgAngle * t ) );
        this.finalOffset.sub( this.startPoint );

        // zigzag 
        if ( Math.abs(this.zigzagSize) > 0.0001 ){
            let easing = Math.max( 0, Math.min( 1, Math.min( ( this.time - this.start ) / 0.5, ( this.attackPeak - this.time ) / 0.5 ) ) );
            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * ( this.time - this.start ) ) * this.zigzagSize * 0.5 * easing;
            this.finalOffset.x = this.finalOffset.x + this.zigzagDir.x * zigzagt;
            this.finalOffset.y = this.finalOffset.y + this.zigzagDir.y * zigzagt;
            this.finalOffset.z = this.finalOffset.z + this.zigzagDir.z * zigzagt;
        }
        return this.finalOffset;
    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * direction: string from 26 directions. Axis of rotation
     * secondDirection: (optional)
     * distance: (optional) radius in metres of the circle.  Default 0.05 m (5 cm)
     * startAngle: (optional) where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
     * endAngle: (optional) where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
     * ellipseAxisDirection: (optional) string from u,d,l,r directions (i,o are ignored).
     * ellipseAxisRatio: (optional) number in range [0,1]. Indicates the axis ratio of the ellipse ( minor / major ). Default to 1 (circle)
     * zigzag: (optional) string from 26 directions
     * zigzagSize: (optional) amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
     * zigzagSpeed: (optional) cycles per second. Default 2
     */
    newGestureBML( bml, symmetry ){
        this.finalOffset.set(0,0,0);
        
        // assume normal axis = (0,0,1). Set the ellipse shape 2D (x,y)
        let distance = isNaN( bml.distance ) ? 0.05 : bml.distance;
        let axisRatio = parseFloat( bml.ellipseAxisRatio ); // minor / major
        if ( isNaN( axisRatio ) ){ axisRatio = 1; } // basically a circle

        if ( stringToDirection( bml.ellipseAxisDirection, _tempVec3_0, symmetry, true ) ){
            _tempVec3_0.z = 0;
            if ( _tempVec3_0.lengthSq() < 0.0001 ){ _tempVec3_0.set(1,0,0); }
            else{ _tempVec3_0.normalize(); }
        }else{
            _tempVec3_0.set(1,0,0);
        }
        this.xAxis.copy( _tempVec3_0 ).multiplyScalar( distance ); // set major axis
        this.yAxis.set( -this.xAxis.y, this.xAxis.x, 0 ).multiplyScalar( axisRatio ); // set minor axis

        // normal axis
        if ( !stringToDirection( bml.direction, _tempVec3_0, symmetry, true ) ){
            console.warn( "Gesture: Location Motion no direction found with name \"" + bml.direction + "\"" );
            return false;
        }
        if ( !stringToDirection( bml.secondDirection, _tempVec3_1, symmetry, true ) ){
            _tempVec3_1.copy( _tempVec3_0 );
        }
        _tempVec3_1.lerpVectors( _tempVec3_1, _tempVec3_0, 0.5 );
        if( _tempVec3_1.lengthSq() < 0.0001 ){ _tempVec3_1.copy( _tempVec3_0 ); }
        _tempVec3_1.normalize(); // final axis perpendicular to circle

        // reorient ellipse normal from (0,0,1) to whatever axis the user specified
        let elevation = Math.asin( _tempVec3_1.y );
        let bearing = Math.atan2( _tempVec3_1.x, _tempVec3_1.z );
        _tempQuat_0.setFromAxisAngle( _tempVec3_0.set(1,0,0), -elevation );
        _tempQuat_1.setFromAxisAngle( _tempVec3_0.set(0,1,0), bearing );
        _tempQuat_0.premultiply( _tempQuat_1 );
        this.xAxis.applyQuaternion( _tempQuat_0 );
        this.yAxis.applyQuaternion( _tempQuat_0 );
        
        // angle computations
        this.srcAngle = isNaN( bml.startAngle ) ? 0 : ( bml.startAngle * Math.PI / 180.0 );
        this.trgAngle = isNaN( bml.endAngle ) ? ( this.srcAngle + 2 * Math.PI ) : ( bml.endAngle * Math.PI / 180.0 );
        if( symmetry ){ // all symmetries mirror the same
            this.trgAngle *= -1;
            this.srcAngle *= -1;
        }
       
        this.startPoint.set(0,0,0);
        this.startPoint.addScaledVector( this.xAxis, Math.cos( this.srcAngle ) );
        this.startPoint.addScaledVector( this.yAxis, Math.sin( this.srcAngle ) );

        // zig-zag
        if ( stringToDirection( bml.zigzag, this.zigzagDir ) ){
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // metres
            this.zigzagSpeed = isNaN( bml.zigzagSpeed ) ? 2 : bml.zigzagSpeed; // rps
        }else{
            this.zigzagDir.set(0,0,0);
            this.zigzagSize = 0.0; // metres
            this.zigzagSpeed = 0; // rps
        }

        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0; 

        // flag to start 
        this.transition = true;
        
        return true;
    }
}

class FingerPlay {
    constructor(){ 
        this.curBends = [ 0, 0, 0, 0, 0 ]; // thumb, index, middle, ring, pinky
        this.fingerEnabler = 0x00; // flags. bit0 = thumb, bit1 = index, bit2 = middle, bit3 = ring, bit4 = pinky
        
        this.transition = false;
        this.speed = 3;
        this.intensity = 0.3;
        
        
        this.clock = 0; // using cos operations. if a fingerplay overwrites another in play, need to be in the same phase  
        this.curUpdateIntensity = [0,0,0,0,0];
        this.srcUpdateIntensity = [0,0,0,0,0];
        
        this.time = 0;
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
    }

    reset(){
        this.transition = false;
        this.curBends.fill( 0 );
    }

    update( dt ){
        if ( !this.transition ){ return; }

        this.clock += dt;
        this.time += dt;
        let interpolator = 0;
        let introInterpolator = 1;
        if ( this.time < this.start ){ introInterpolator= 0; interpolator = 0; }
        else if ( this.time < this.attackPeak ){ 
            interpolator = ( this.time - this.start ) / ( this.attackPeak - this.start ); 
            introInterpolator = interpolator;
        }
        else if ( this.time < this.relax ){ interpolator = 1; }
        else if ( this.time < this.end ){ interpolator = ( this.end - this.time ) / ( this.end - this.relax ); }
        else {
            interpolator = 0; 
            this.transition = false;
        }

        let intensity = interpolator * this.intensity;

        // interpolation -- cos(t + X) where X is different for each finger
        this.curUpdateIntensity[0] = ( (this.fingerEnabler & 0x01 ? 1 : 0) * intensity ) + this.srcUpdateIntensity[0] * (1-introInterpolator);
        this.curBends[0] = ( Math.cos( Math.PI * 2 * this.speed * this.clock + Math.PI * 0.25 ) * 0.5 + 0.5 ) * this.curUpdateIntensity[0];

        this.curUpdateIntensity[1] = ( (this.fingerEnabler & 0x02 ? 1 : 0) * intensity ) + this.srcUpdateIntensity[1] * (1-introInterpolator);
        this.curBends[1] = ( Math.cos( Math.PI * 2 * this.speed * this.clock ) * 0.5 + 0.5 ) * this.curUpdateIntensity[1];

        this.curUpdateIntensity[2] = ( (this.fingerEnabler & 0x04 ? 1 : 0) * intensity ) + this.srcUpdateIntensity[2] * (1-introInterpolator);
        this.curBends[2] = ( Math.cos( Math.PI * 2 * this.speed * this.clock + Math.PI * 0.65 ) * 0.5 + 0.5 ) * this.curUpdateIntensity[2];

        this.curUpdateIntensity[3] = ( (this.fingerEnabler & 0x08 ? 1 : 0) * intensity ) + this.srcUpdateIntensity[3] * (1-introInterpolator); 
        this.curBends[3] = ( Math.cos( Math.PI * 2 * this.speed * this.clock + Math.PI * 1.05 ) * 0.5 + 0.5 ) * this.curUpdateIntensity[3];

        this.curUpdateIntensity[4] = ( (this.fingerEnabler & 0x10 ? 1 : 0) * intensity ) + this.srcUpdateIntensity[4] * (1-introInterpolator);
        this.curBends[4] =  ( Math.cos( Math.PI * 2 * this.speed * this.clock + Math.PI * 1.35 ) * 0.5 + 0.5 ) * this.curUpdateIntensity[4];
    }

     /**
     * bml info
     * start, attackPeak, relax, end
     * speed = (optional) oscillations per second. Default 3
     * intensity = (optional) [0,1]. Default 0.3
     * fingers = (optional) string with numbers. Each number present activates a finger. 1=thumb, 2=index, 3=middle, 4=ring, 5=pinky. I.E. "234" activates index, middle, ring but not pinky. Default all enabled
     * exemptedFingers = (optional) string with numbers. Blocks a finger from doing the finger play. Default all fingers move
     */
    newGestureBML( bml ){
        
        this.transition = true;
        this.speed = isNaN( bml.speed ) ? 3 : bml.speed;
        this.intensity = isNaN( bml.intensity ) ? 0.3 : bml.intensity;
        this.intensity = Math.min( 1, Math.max( -1, this.intensity ) ) * 0.5;

        // swap pointers
        let temp = this.srcUpdateIntensity; 
        this.srcUpdateIntensity = this.curUpdateIntensity;
        this.curUpdateIntensity = temp;

        this.fingerEnabler = 0x1f;
        if ( typeof( bml.fingers ) == 'string' ){
            // enable only the specified fingers (bits)
            this.fingerEnabler = 0x00; 
            for( let i = 0; i < bml.fingers.length; ++i ){
                let val = parseInt( bml.fingers[i] );
                if ( !isNaN( val ) ){ this.fingerEnabler |= 0x01 << (val-1); }
            }
            this.fingerEnabler &= 0x1f; // mask unused bits
        }
        if ( typeof( bml.exemptedFingers ) == 'string' ){
            // enable only the specified fingers (bits)
            for( let i = 0; i < bml.exemptedFingers.length; ++i ){
                let val = parseInt( bml.exemptedFingers[i] );
                if ( !isNaN( val ) ){ this.fingerEnabler &= ~(0x01 << (val-1)); }
            }
            this.fingerEnabler &= 0x1f; // mask unused bits
        }


        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0;

        return true;
    }

};



class WristMotion {
    constructor( config, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.config = config;
        
        this.time = 0;
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        this.transition = false;

        this.clock = 0; // using cos operations. if a wristmotion overwrites another in play, need to be in the same phase  
        this.curUpdateIntensity = [0,0,0]; // [ twist, nod, swing ]
        this.srcUpdateIntensity = [0,0,0];
        
        this.mode = 0; // FLAGS 0=NONE, 1=TWIST, 2=NOD, 4=SWING 
        this.intensity = 1;
        this.speed = 1;
        
        let handName = isLeftHand ? "L" : "R";
        this.wristBone = this.skeleton.bones[ config.boneMap[ handName + "Wrist" ] ];
        
        // ** compute axes based on skeleton T-pose shape. Avoids hardcoded axes **
        this.axes = [ new THREE.Vector3(0,0,1), new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0) ]; // twist, nod, swing. Axes in local space
        let wristBindMat = this.skeleton.boneInverses[ config.boneMap[ handName + "Wrist" ] ];
        let middleBindMat = this.skeleton.boneInverses[ config.boneMap[ handName + "HandMiddle" ] ];
        let indexBindMat = this.skeleton.boneInverses[ config.boneMap[ handName + "HandIndex" ] ];
        let ringBindMat = this.skeleton.boneInverses[ config.boneMap[ handName + "HandRing" ] ];
        
        // bind world positions
        let wristBindPos = (new THREE.Vector3()).setFromMatrixPosition( wristBindMat.clone().invert() );
        let middleBindDir = (new THREE.Vector3()).setFromMatrixPosition( middleBindMat.clone().invert() ).sub( wristBindPos ).normalize();
        let indexBindDir = (new THREE.Vector3()).setFromMatrixPosition( indexBindMat.clone().invert() ).sub( wristBindPos ).normalize();
        let ringBindDir = (new THREE.Vector3()).setFromMatrixPosition( ringBindMat.clone().invert() ).sub( wristBindPos ).normalize();

        this.axes[0].copy( middleBindDir ); // twist
        this.axes[2].crossVectors( ringBindDir, indexBindDir ).multiplyScalar( isLeftHand ? -1 : 1 ).normalize(); // temporal swing
        this.axes[1].crossVectors( this.axes[2], this.axes[0] ).normalize(); // nod
        this.axes[2].crossVectors( this.axes[0], this.axes[1] ); // ensure swing axis is perpendicular

        let wristBindWtoL = (new THREE.Matrix3()).setFromMatrix4( wristBindMat ); // just for direction vectors
        this.axes[0].applyMatrix3( wristBindWtoL ).normalize();
        this.axes[1].applyMatrix3( wristBindWtoL ).normalize();
        this.axes[2].applyMatrix3( wristBindWtoL ).normalize();
        
    }

    reset(){
        this.time = 0;
        this.mode = 0;
        this.transition = false;
    }

    update( dt ){
        if ( !this.transition ){ return; }

        this.clock += dt;
        this.time += dt;
        let interpolator = 0;
        let introInterpolator = 0;
        if ( this.time < this.start ){ interpolator = 0; }
        else if ( this.time < this.attackPeak ){ interpolator = ( this.time - this.start ) / ( this.attackPeak - this.start ); introInterpolator = 1.0-interpolator; }
        else if ( this.time < this.relax ){ interpolator = 1; }
        else if ( this.time < this.end ){ interpolator = ( this.end - this.time ) / ( this.end - this.relax ); }
        else {
            interpolator = 0; 
            this.mode = 0x00;
            this.transition = false;
        }
        
        let intensity = 0;
        let axis = _tempVec3_0;

        // TWIST
        axis.copy( this.axes[0] ).applyQuaternion( this.wristBone.quaternion ); // apply other rotations to ensure correct axis direction
        intensity = this.srcUpdateIntensity[0] * introInterpolator;
        if ( this.mode & 0x01 ){ intensity += this.intensity * interpolator };
        this.curUpdateIntensity[0] = intensity;
        _tempQuat_0.setFromAxisAngle( axis, Math.cos( 2 * Math.PI * this.speed * this.clock ) * intensity * ( Math.PI * 0.5 ) );
        this.wristBone.quaternion.premultiply( _tempQuat_0 );

        // NOD
        axis.copy( this.axes[1] ).applyQuaternion( this.wristBone.quaternion ); // apply other rotations to ensure correct axis direction
        intensity = this.srcUpdateIntensity[1] * introInterpolator;
        if ( this.mode & 0x02 ){ intensity += this.intensity * interpolator };
        this.curUpdateIntensity[1] = intensity;
        _tempQuat_0.setFromAxisAngle( axis, Math.cos( 2 * Math.PI * this.speed * this.clock ) * intensity * ( Math.PI * 0.5 ) );
        this.wristBone.quaternion.premultiply( _tempQuat_0 );
        
        // SWING
        axis.copy( this.axes[2] ).applyQuaternion( this.wristBone.quaternion ); // apply other rotations to ensure correct axis direction
        intensity = this.srcUpdateIntensity[2] * introInterpolator;
        if ( this.mode & 0x04 ){ intensity += this.intensity * interpolator };
        this.curUpdateIntensity[2] = intensity;
        _tempQuat_0.setFromAxisAngle( axis, Math.sin( 2 * Math.PI * this.speed * this.clock ) * intensity * ( Math.PI * 0.5 ) ); // PHASE of 90ª (sin instead of cos) with respect to NOD (see newGestureBML)
        this.wristBone.quaternion.premultiply( _tempQuat_0 );
    }

     /**
     * bml info
     * start, attackPeak, relax, end
     * mode = either a: 
     *          - string from [ "NOD", "NODDING", "SWING", "SWINGING", "TWIST", "TWISTING", "STIR_CW", "STIR_CCW", "ALL" ]
     *          - or a value from [ 0 = None, 1 = TWIST, 2 = NOD, SWING = 4 ]. 
     *            Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = STIR_CW
     *            Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = STIR_CW
     * speed = (optional) oscillations per second. A negative values accepted. Default 3. 
     * intensity = (optional) [0,1]. Default 0.3
     */
    newGestureBML( bml, symmetry ){
        
        this.speed = isNaN( bml.speed ) ? 3 : bml.speed;
        if ( symmetry & 0x07 ){ this.speed *= -1; }
        this.intensity = isNaN( bml.intensity ) ? 0.3 : bml.intensity;
        this.intensity = Math.min( 1, Math.max( 0, this.intensity ) );
        
        if ( typeof( bml.mode ) == "string" ){
            switch( bml.mode.toLowerCase() ){
                case "nod": case "nodding": this.mode = 0x02; break;
                case "swing": case "swinging": this.mode = 0x04; break;
                case "twist": case "twisting": this.mode = 0x01; break;
                case "stir_cw": this.mode = 0x06; break; // 0x02 | 0x04
                case "stir_ccw": this.mode = 0x06; this.speed *= -1; break;
                case "all": this.mode = 0x07; break;
                default:
                    console.warn( "Gesture: No wrist motion called \"", bml.mode, "\" found" );
                    return false;
            }
        }
        else if ( isNaN( bml.mode ) ) {
            console.warn( "Gesture: No wrist motion called \"", bml.mode, "\" found" );
            return false;
        }
        else{
            this.mode = bml.mode & 0x07; // take only the necessary bits
        }

        // swap pointers
        let temp = this.curUpdateIntensity;
        this.curUpdateIntensity = this.srcUpdateIntensity;
        this.srcUpdateIntensity = temp;
        
        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0; 

        this.transition = true;
        
        return true;
    }
};
    
export { DirectedMotion, CircularMotion, FingerPlay, WristMotion }