# Performs API


#### <span style="color: #049EF4;">setSpeed</span>( speed: <span style="color: gray;">Number</span> )

Changes the speed of the animation player.

**speed**: New speed. Negative values means playing the animations backwards


#### <span style="color: #049EF4;">setBackPlaneColour</span>( colour: <span style="color: gray;">String </span>) 

Changes the colour of the scene background.

**colour**: The colour in Hex sRGB space


#### <span style="color: #049EF4;">setBackground</span>( type:  <span style="color: gray;">Number</span>, image<span style="color: orange;">*</span>: <span style="color: gray;">String (base64)</span>, <span style="color: gray;">THREE.Texture</span> or <span style="color: gray;">THREE.VideoTexture</span>)

Changes the background style. It can be an open space, an studio or a photocall. The studio can have an image or a video in the background. The photocall can have an image/logo that can be repeated.

**type**: Type of background. The values can be PERFORMS.Backgrounds.OPEN (0), PERFORMS.Backgrounds.STUDIO (1), PERFORMS.Backgrounds.PHOTOCALL (2)

**image**: <span style="color: orange;">Optional</span>. The image or the video that has to be on the background.


#### <span style="color: #049EF4;">setPhotocallOffset</span>( offset: <span style="color: gray;">Number</span> )

Changes the space between the repeatitive images for the photocall background.

**offset**: New offset.


#### <span style="color: #049EF4;">setBackgroundSettings</span>( settings: <span style="color: gray;">String</span> )

Changes how to fits the image or the video in the studio background based on the passed configuration.

**settings**: Adjustment of background image or video. The values can be: `"Expand"`, `"Fill"`, `"Extend"` and `"Adjust"`. Default value is `"Expand"`.


#### <span style="color: #049EF4;">setBackgroundTextureScale</span>( scale: <span style="color: gray;">Number</span> )

Changes the scale of the image or video for studio background.

**scale**: New scale. Default value is `1`.


#### <span style="color: #049EF4;">setBackgroundTexturePosition</span>( position: <span style="color: gray;">Array</span>)

Changes the position of the image or video for studio background.

**position**: New position. Default value is center `[0,0]`.

#### <span style="color: #049EF4;">setConfiguration</span>( configuration: <span style="color: gray;">JSON</span>, <span style="color: gray;">callback<span style="color: orange;">*</span>: function</span> )

**configuration**: JSON with configuration options (position, rotation, scale, animations, autoplay, etc). See [available options](IntegrationGuide.md) for more info.

**callback**: <span style="color: orange;">Optional</span>. Function called when all configuration is loaded.


#### <span style="color: #049EF4;">changeMode</span>( mode: <span style="color: gray;">Number</span> )

Changes animation player mode. The two modes of Performs are Script (BML,SiGML based instructions) and Keyframe (bvh, bvhe, glb animations).

**mode**: New mode.`Performs.Modes.SCRIPT` (0) or `Performs.Modes.KEYFRAME` (1). Default is Script mode `0`.


#### <span style="color: #049EF4;">changeAnimation</span>( animation: <span style="color: gray;">String</span>, needsUpdate<span style="color: orange;">*</span>: <span style="color: gray;">Boolean</span> )</span>

**animation**: Name of a preloaded animation.

**needsUpdate**: <span style="color: orange;">Optional</span>. If its true, forces to bound animation to the current character


#### <span style="color: #049EF4;">changePlayState</span>( play<span style="color: orange;">*</span>: <span style="color: gray;">Boolean</span> )

**play**: <span style="color: orange;">Optional</span>. New play state. For Keyframe mode, play/stop current animation. If **play** is `NULL`, switches the current state.
For Script mode, replay the animation from the begining.


#### <span style="color: #049EF4;">getSpeed</span>(): <span style="color: gray;">Number</span>

Returns the current speed of the animation player.

#### <span style="color: #049EF4;">gettBackPlaneColour</span>(): <span style="color: gray;">String(Hex)</span>

Returns the current colour of the scene background.

#### <span style="color: #049EF4;">init</span>( options: <span style="color: gray;">JSON</span>)</span>

Initializes the application, creates the scene and loads the assets.

**options**: Configuration options (position, rotation, scale, animations, autoplay, etc). See [available options](IntegrationGuide.md) for more info.

#### <span style="color: #049EF4;">setConfiguration</span>( options: <span style="color: gray;">JSON</span>, callback<span style="color: orange;">*</span>: <span style="color: gray;">function</span>)</span>

Changes the current configuration of the scene based on passed options.

**options**: Configuration options (position, rotation, scale, animations, autoplay, etc). See [available options](IntegrationGuide.md) for more info.

**callback**: <span style="color: orange;">Optional</span>. Function called when changers are completed.


#### <span style="color: #049EF4;">loadAvatar</span>( avatarURL: <span style="color: gray;">String</span>, configFile: <span style="color: gray;">File URL</span> or <span style="color: gray;">JSON</span>, avatarRotation <span style="color: orange;">*</span> : <span style="color: gray;">THREE.Quaternion</span>, avatarName: <span style="color: gray;">String</span>, callback <span style="color: orange;">*</span>: <span style="color: gray;">function</span>, onerror<span style="color: orange;">*</span>: <span style="color: gray;">function</span>)

Loads an avatar given a public URL and with a specific configuration for Script animations.

**avatarURL**: Public URL where the avatar is hosted. Supported extensions are _glb_ and _gltf_.

**configFile**: Avatar configuration for Script animations (it can be generated through [Atelier](https://atelier.gti.upf.edu/)).

**avatarRotation**: <span style="color: orange;">Optional</span>. Avatar rotation. It can be `NULL`.

**avatarName**: Avatar name.

**callback**: <span style="color: orange;">Optional</span>. Function called when loading is complete.

**onerror**: <span style="color: orange;">Optional</span>. Function called when the avatar can not be loaded.


#### <span style="color: #049EF4;">changeAvatar</span>( avatarName: <span style="color: gray;">String</span>)

Changes the current avatar given the name of a preloaded avatar.

**avatarName**: Name of the new avatar.


#### <span style="color: #049EF4;">changeCameraMode</span>( restrictView: <span style="color: gray;">Boolean</span> )

Changes the camera mode movements.

**restrictView**: `true` restricts zoom, panning, etc. and `false` lets any camera movement.
