# Integration Guide
## Available options

| Name                       | Type    | Description                                                                                                                 |
|----------------------------|---------|-----------------------------------------------------------------------------------------------------------------------------|
|  [avatar](#avatar)                    | String  | Character file URL                                                                                                          |
|  [config](#config-string)                    | String  | Configuration file URL                                                                                                      |
|  [position](#position-string)                  | String  | Character world position                                                                                                    |
|  [rotation](#rotation-string)                  | String  | Character world rotation (quaternion)                                                                                       |
|  [scale](#scale-integer)                     | Integer | Character world scale                                                                                                       |
|  [cloth](#cloth-string)                     | String  | Top cloth color value                                                                                                       |
|  [color](#color-string)                     | String  | Background color                                                                                                            |
|  [background](#background-string)                | String  | _open_, _studio_ or _photocall_. Use _open_ as default                                                                      |
|  [img](#img-string)                       | String  | Image file URL for _photocall_                                                                                              |
|  [offset](#offset-float)                    | Float   | [0, 1]. Space between images in the photocall                                                                               |
|  [light](#light-string)                     | String  | Light color                                                                                                                 |
|  [lightpos](#lightpos-string)                  | String  | Direct light position                                                                                                       |
|  [restrictView](#restrictview-boolean)              | Boolean | Restrict camera controls                                                                                                    |
|  [controls](#controls-boolean)                  | Boolean | Show GUI controls                                                                                                           |
|  [autoplay](#autoplay)                 | Boolean | "Automatically play the animation after loading                                                                                         |
|  [applyIdle](#applyidle-boolean)                 | Boolean | Play idle animation for Script mode                                                                                         |
|  [srcEmbeddedTransforms](#srcembeddedtransforms-boolean)     | Boolean | External (parent) transforms are computed and embedded into the root joint of source skeleton animation for retargeting     |
|  [trgEmbeddedTransforms](#trgembeddedtransforms-boolean)     | Boolean | External (parent) transforms are computed and embedded into the root joint of target skeleton for retargeting               |
|  [srcReferencePose](#srcreferencepose-number)          | Integer | [0, 1, 2] Pose of the source skeleton that will be used as the bind pose for the retargeting                                |
|  [trgReferencePose](#trgreferencepose-number)          | Integer | [0, 1, 2] Pose of the target skeleton that will be used as the bind pose for the retargeting                                |
|  [animations](#animations-array-of-objects)                    | Array  | Array of objects with animations' information (Keyframe mode) |
|  [trajectories](#trajectories-boolean)                    | Boolean  | Show hands and fingers trajectories (Keyframe mode) |
|  [crossfade](#crossfade-boolean)                    | Boolean  | Concatenate multiple keyframe animations and apply blending between them                                                                                                          |
|  [blendTime](#blendtime-float)                    | Float  | Time inverval between animations when _crossfade_ is _true_                                                                                                          |
|  [scripts](#scripts-array-of-objects)                    | Array  | Array of objects with scripts' information or instructions  (Script mode)                                                                                                        |
|  [onReady]()                    | Function  | Callback function triggered after animations/scripts are loaded       

### Expected values

#### avatar
URL of a glTF file. Supported extensions are _glb_ and _gltf_.

##### Expected values (String)
- **`../3Dcharacters/ReadyEva/ReadyEva.glb`** - Relative URL.
- **`https://models.readyplayer.me/67162be7608ab3c0a85ceb2d.glb`** - Get Ready Player Me avatar in T-pose with ARKit morph targets. It can be also an own hosted file.

>[!NOTE]
> Without any of the optional parameters, the avatar is returned based on default values.

#### config (String)
URL of a JSON file with the configuration provided by [performs-atelier](https://github.com/upf-gti/performs-atelier).

##### Expected values
- **`../3Dcharacters/ReadyEva/ReadyEva.json`** - Relative URL.
- **`https://resources.gti.upf.edu/3Dcharacters/ReadyEva/ReadyEva.json`**

>[!IMPORTANT]
> Without a config file, the **_Script Mode_** doesn't work. The default avatars have already had it.

#### position (String)
Control the character position in world space.
##### Expected values
- **`1,1.5,5`** - x,y,z.

#### rotation (String)
Control the character rotation with quaternion in world space.
##### Expected values
- **`0.707,0.0,0.0,0.707`** - x,y,z,w.

#### scale (Integer)
Apply an scale to the character.
##### Expected values
- min: **`0`**
>[!IMPORTANT]
> Use a decimal point as the seperator.

#### cloth (String)
Control the top cloth color by multipling it by the given color.

##### Expected values
- **`rgb(255,255,255)`** - RGB color.
- **`0xffffff`** - Hexadecimal color.
- **`hsl(0,100%,50%)`** - HSL color.
- **`skyblue`** - X11 color name.

#### color (String)
Control the background color.

##### Expected values
- **`rgb(255,255,255)`** - RGB color.
- **`0xffffff`** - Hexadecimal color.
- **`hsl(0,100%,50%)`** - HSL color.
- **`skyblue`** - X11 color name.

#### background (String)
Specify which background preset to display.
##### Expected values
- **`open`** - Open space. No walls, only transparent floot. This is the **default** background.
- **`studio`** - Backdrop like chroma.
- **`photocall`** - Like studio background, but featuring a repeated logo or image. The logo can be customized using the [_img_ parameter](####img).

#### img (String)
Specify the image or logo to be used on the photocall wall. If this is set, the default background will be the photocall design. Supported formats are _jpg_, _jpeg_ and _png_.
##### Expected values
- **`../data/imgs/performs2.png`** - Relative URL
- **`https://performs.gti.upf.edu/data/imgs/performs.png`**

#### offset (Float)
Defines the spacing between the repeated logo or image in the photocall background. Default offset is **`0.0`**.
##### Expected values
- min: **`0`**
- max: **`1`**
>[!IMPORTANT]
> Use a decimal point as the seperator.

#### light (String)
Control the direct light color.
##### Expected values
- **`rgb(255,255,255)`** - RGB color.
- **`0xffffff`** - Hexadecimal color.
- **`hsl(0,100%,50%)`** - HSL color.
- **`skyblue`** - X11 color name.

#### lightpos (String)
Control the direct light position in world space.
##### Expected values
- **`1,1.5,5`** - x,y,z.

#### restrictView (Boolean)
Restrict user camera controls.
##### Expected values
- **`true`** - Restrict view: panning is disabled, and camera orbit and dolly in/out are limited (default).
- **`false`** - Free controls: allows for damping, orbiting, zooming, and panning of the camera.

#### controls (Boolean)
Toogle GUI controls visibility.
##### Expected values
- **`true`** - Show GUI (default).
- **`false`** - Hide GUI.

#### autoplay (Boolean)
"Automatically play the animation after loading
##### Expected values
- **`true`** - Play last loaded animation.
- **`false`** - Manually play animations.

#### applyIdle (Boolean)
Play Idle animation as a base for Script animation mode.
##### Expected values
- **`true`** - Play idle animation.
- **`false`** - Not play idle animation (default).

#### srcEmbeddedTransforms (Boolean)
Toogle (parent) transforms computations and embedding into the root joint of source skeleton animation for retargeting in Keyframe mode.
##### Expected values
- **`true`** -  Takes into account the transforms from the actual bone parent (world transforms)
- **`false`** -  Takes into account the transforms from the actual bone objects (local transforms).

#### trgEmbeddedTransforms (Boolean)
Toogle (parent) transforms computations and embedding into the root joint of target skeleton for retargeting in Keyframe mode.
##### Expected values
- **`true`** -  Takes into account the transforms from the actual bone parent (world transforms)
- **`false`** -  Takes into account the transforms from the actual bone objects (local transforms).

#### srcReferencePose (Number)
Pose of the source skeleton that will be used as the reference pose for the retargeting in Keyframe mode.
##### Expected values
- **`0`** - [Default] Skeleton's actual bind pose. (default)
- **`1`** - [Current] Skeleton's current pose.
- **`2`** - [Tpose] Computes a Tpose from the skeleton's actual bind pose.

#### trgReferencePose (Number)
Pose of the target skeleton that will be used as the reference pose for the retargeting in Keyframe mode.
##### Expected values
- **`0`** - [Default] Skeleton's actual bind pose. (default)
- **`1`** - [Current] Skeleton's current pose.
- **`2`** - [Tpose] Computes a Tpose from the skeleton's actual bind pose.

#### animations (Array of objects)
Array of data with keyframe animations' information. _[{name: "", data: ""}]_
##### Expected values 
Object data:

- _**`name`**_: **`'./data/animations/myAnimation.glb'`**
- _**`data`**_: **`{}`** - Optional. Parsed data as an Object. Only _glTF_, _BVH_ and _FBX_ formats are supported.

#### trajectories (Boolean)
Show hands and fingers trajectories (Keyframe mode).

#### crossfade (Boolean)
Concatenate multiple keyframe animations and apply blending between them.
##### Expected values 
- **`true`** -  Wait until animation finishes and blend to the next one when selected
- **`false`** -  Overwrite the current animation with the new selected animation (default)

#### blendTime (Float)
Animation blending duration time.
##### Expected values 
-- min: **`0`**
>[!IMPORTANT]
> Use a decimal point as the seperator.

#### scripts (Array of objects)
Array of data with script animations' information. _[{type: "", name: "", data: ""}]_
##### Expected values 

- **`type`**: **`'sigml'`** or **`bml`**
- **`name`**: **`'./data/animations/myAnimation.sigml`** or **`'./data/animations/myAnimation.bml`** - File URL
- **`data`**: **`{
                behaviours: [{
                    type: "faceLexeme",
                    start: 4,
                    attackPeak: 0.6,
                    relax: 1.5,
                    end: 1.8,
                    amount: 1,
                    lexeme: "ARCH"
                }]`**
            } - Optional. Array of BML or SiGML Instructions